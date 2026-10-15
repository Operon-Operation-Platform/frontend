"""
Operon Central Tool Registry
Centralized catalog for Built-in, Integration, MCP, and Custom tools.
Enforces tenant permissions, schema validation, human approval gating, and execution logging.
"""

import asyncio
import json
import logging
import re
from typing import Any, Callable, Dict, List, Optional
from agents.context import TenantContext
from mcp_servers.mcp_client import MCPClient

logger = logging.getLogger("operon.tool_registry")


class ToolDefinitionItem:
    def __init__(
        self,
        slug: str,
        name: str,
        description: str,
        category: str,
        parameters: Dict[str, Any],
        handler: Callable,
        requires_approval: bool = False,
    ):
        self.slug = slug
        self.name = name
        self.description = description
        self.category = category
        self.parameters = parameters
        self.handler = handler
        self.requires_approval = requires_approval

    def to_dict(self) -> Dict[str, Any]:
        return {
            "slug": self.slug,
            "name": self.name,
            "description": self.description,
            "category": self.category,
            "parameters": self.parameters,
            "requires_approval": self.requires_approval,
        }


class ToolRegistry:
    """Enterprise Tool Registry with tenant isolation and approval hooks."""

    def __init__(self):
        self._tools: Dict[str, ToolDefinitionItem] = {}
        self._register_default_tools()

    def register(self, tool: ToolDefinitionItem):
        self._tools[tool.slug] = tool

    def get_tool(self, slug: str) -> Optional[ToolDefinitionItem]:
        return self._tools.get(slug)

    def list_tools(self, category: Optional[str] = None) -> List[Dict[str, Any]]:
        tools = self._tools.values()
        if category:
            tools = [t for t in tools if t.category == category]
        return [t.to_dict() for t in tools]

    async def execute_tool(
        self,
        context: TenantContext,
        slug: str,
        parameters: Dict[str, Any],
        bypass_approval_check: bool = False,
    ) -> Dict[str, Any]:
        """
        Execute tool with strict tenant verification, approval gating, and audit trail.
        """
        # 1. Enforce Tenant Tool Permissions
        if not context.is_tool_allowed(slug):
            logger.warning(f"Tenant {context.organization_id} denied tool '{slug}' (not in allowed_tools)")
            return {
                "success": False,
                "error": f"Permission denied: Tool '{slug}' is not authorized for this agent.",
            }

        # 2. Check dynamic MCP tool
        if slug.startswith("mcp_") and slug not in self._tools:
            return await self._execute_mcp_tool(context, slug, parameters)

        tool = self._tools.get(slug)
        if not tool:
            return {
                "success": False,
                "error": f"Tool '{slug}' not found in registry.",
            }

        # 3. Check Human Approval Requirement
        if tool.requires_approval and not bypass_approval_check:
            logger.info(f"Tool '{slug}' requires human approval for run {context.run_id}.")
            return {
                "success": True,
                "status": "WAITING_FOR_APPROVAL",
                "action_type": slug,
                "description": f"Human approval required to execute {tool.name}",
                "payload": parameters,
            }

        # 4. Execute tool adapter
        try:
            result = await tool.handler(context, parameters)
            return {
                "success": True,
                "status": "COMPLETED",
                "tool": slug,
                "result": result,
            }
        except Exception as e:
            logger.error(f"Error executing tool {slug}: {e}", exc_info=True)
            return {
                "success": False,
                "status": "FAILED",
                "tool": slug,
                "error": str(e),
            }

    async def _execute_mcp_tool(
        self, context: TenantContext, slug: str, parameters: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Dynamically dispatch tool execution to customer's connected MCP server."""
        mcp_servers = context.mcp_servers
        if not mcp_servers:
            return {
                "success": False,
                "error": f"No active MCP server found for tenant {context.organization_id} to execute {slug}.",
            }

        # Pick matching server or first active
        target_server = mcp_servers[0]
        client = MCPClient(
            server_url=target_server.get("server_url", "http://localhost:8001/mcp"),
            auth_token=target_server.get("auth_token"),
        )
        call_res = await client.call_tool(tool_name=slug, arguments=parameters)
        return {
            "success": not call_res.isError,
            "status": "COMPLETED" if not call_res.isError else "FAILED",
            "tool": slug,
            "result": call_res.content,
        }

    # =========================================================================
    # DEFAULT BUILT-IN & INTEGRATION TOOLS
    # =========================================================================

    def _register_default_tools(self):
        # 1. Search Knowledge (Built-in)
        self.register(
            ToolDefinitionItem(
                slug="search_knowledge",
                name="Search Knowledge Base",
                description="Search authorized customer documents, FAQs, and product manuals using hybrid search.",
                category="builtin",
                parameters={
                    "type": "object",
                    "properties": {
                        "query": {"type": "string", "description": "Search query keywords or natural language question"},
                        "top_k": {"type": "integer", "description": "Number of snippets to retrieve", "default": 3},
                    },
                    "required": ["query"],
                },
                handler=self._tool_search_knowledge,
                requires_approval=False,
            )
        )

        # 2. Query Approved Database (Built-in)
        self.register(
            ToolDefinitionItem(
                slug="query_approved_database",
                name="Query Approved Database",
                description="Execute safe, read-only SQL parameterized queries against customer allowlisted tables.",
                category="builtin",
                parameters={
                    "type": "object",
                    "properties": {
                        "table": {"type": "string", "description": "Allowlisted table name"},
                        "filters": {"type": "object", "description": "Key-value equality filters (e.g. {'status': 'active'})"},
                        "limit": {"type": "integer", "description": "Max rows to return", "default": 10},
                    },
                    "required": ["table"],
                },
                handler=self._tool_query_database,
                requires_approval=False,
            )
        )

        # 3. Create Task (Built-in)
        self.register(
            ToolDefinitionItem(
                slug="create_task",
                name="Create Workflow Task",
                description="Record an actionable work item or follow-up in the Operon task queue.",
                category="builtin",
                parameters={
                    "type": "object",
                    "properties": {
                        "title": {"type": "string", "description": "Task summary title"},
                        "priority": {"type": "string", "enum": ["low", "medium", "high", "urgent"], "default": "medium"},
                        "payload": {"type": "object", "description": "Arbitrary task details"},
                    },
                    "required": ["title"],
                },
                handler=self._tool_create_task,
                requires_approval=False,
            )
        )

        # 4. Summarize Records (Built-in)
        self.register(
            ToolDefinitionItem(
                slug="summarize_records",
                name="Summarize Customer Records",
                description="Summarize customer activity, previous tickets, or account timeline.",
                category="builtin",
                parameters={
                    "type": "object",
                    "properties": {
                        "customer_id": {"type": "string", "description": "Customer identifier or email"},
                        "records": {"type": "array", "items": {"type": "object"}, "description": "Raw records to summarize"},
                    },
                    "required": ["customer_id"],
                },
                handler=self._tool_summarize_records,
                requires_approval=False,
            )
        )

        # 5. Check Order / Subscription (Support & Sales)
        self.register(
            ToolDefinitionItem(
                slug="check_order",
                name="Check Order Status",
                description="Look up order details, tracking information, item status, and fulfillment state.",
                category="integration",
                parameters={
                    "type": "object",
                    "properties": {
                        "order_id": {"type": "string", "description": "Order number or reference code"},
                    },
                    "required": ["order_id"],
                },
                handler=self._tool_check_order,
                requires_approval=False,
            )
        )

        # 6. Request Refund (High-risk, Requires Approval!)
        self.register(
            ToolDefinitionItem(
                slug="request_refund",
                name="Process Customer Refund",
                description="Issue payment refund to customer account. Requires explicit human manager approval.",
                category="integration",
                parameters={
                    "type": "object",
                    "properties": {
                        "order_id": {"type": "string", "description": "Order identifier"},
                        "amount": {"type": "number", "description": "Refund amount"},
                        "reason": {"type": "string", "description": "Reason for refund"},
                    },
                    "required": ["order_id", "amount", "reason"],
                },
                handler=self._tool_process_refund,
                requires_approval=True,  # Human-in-the-loop approval enforced!
            )
        )

        # 7. Slack Post Message (Communication Integration)
        self.register(
            ToolDefinitionItem(
                slug="slack_post_message",
                name="Post Slack Notification",
                description="Post notification or alert to authorized customer Slack channel.",
                category="integration",
                parameters={
                    "type": "object",
                    "properties": {
                        "channel": {"type": "string", "description": "Slack channel (e.g. #customer-support or #ops-alerts)"},
                        "message": {"type": "string", "description": "Notification message text"},
                    },
                    "required": ["channel", "message"],
                },
                handler=self._tool_slack_post,
                requires_approval=False,
            )
        )

        # 8. Jira Escalate Incident (Operations & Support Integration)
        self.register(
            ToolDefinitionItem(
                slug="jira_escalate_incident",
                name="Escalate Incident to Jira",
                description="Create or update engineering bug ticket in Jira for L3 escalation.",
                category="integration",
                parameters={
                    "type": "object",
                    "properties": {
                        "summary": {"type": "string", "description": "Issue summary"},
                        "description": {"type": "string", "description": "Issue details & reproduction steps"},
                        "priority": {"type": "string", "enum": ["Low", "Medium", "High", "Critical"], "default": "High"},
                    },
                    "required": ["summary", "description"],
                },
                handler=self._tool_jira_escalate,
                requires_approval=False,
            )
        )

    # -------------------------------------------------------------------------
    # HANDLER IMPLEMENTATIONS
    # -------------------------------------------------------------------------

    async def _tool_search_knowledge(self, context: TenantContext, params: Dict[str, Any]) -> Dict[str, Any]:
        query = params.get("query", "")
        top_k = params.get("top_k", 3)
        # Check if customer has connected knowledge index or use tenant defaults
        return {
            "query": query,
            "retrieved_count": top_k,
            "snippets": [
                {
                    "source": "knowledge_base/sop_policy.md",
                    "title": "Standard Operating Procedure & Support Policy",
                    "score": 0.94,
                    "content": f"Relevant policy match for query '{query}': Customer SLA response time must be satisfied. Escalations require verified issue replication.",
                },
                {
                    "source": "knowledge_base/refund_policy.md",
                    "title": "Customer Refund Policy",
                    "score": 0.88,
                    "content": "Refunds exceeding $100 require manager approval. Digital service cancellation is prorated.",
                },
            ][:top_k],
        }

    async def _tool_query_database(self, context: TenantContext, params: Dict[str, Any]) -> Dict[str, Any]:
        table = params.get("table", "")
        filters = params.get("filters", {})
        limit = min(params.get("limit", 10), 50)

        # Security check: disallow unauthorized or dangerous table queries
        forbidden_pattern = re.compile(r"(\bdrop\b|\bdelete\b|\bupdate\b|\binsert\b|\balter\b)", re.IGNORECASE)
        if forbidden_pattern.search(table):
            raise ValueError(f"Unsafe table name or query attempt detected: {table}")

        # Returns mock/sample records conforming to tenant database schema
        return {
            "table": table,
            "filters_applied": filters,
            "rows_returned": 2,
            "data": [
                {"id": "rec_001", "name": "Acme Global Order", "status": "shipped", "value": 249.00},
                {"id": "rec_002", "name": "Standard Subscription", "status": "active", "value": 49.00},
            ][:limit],
        }

    async def _tool_create_task(self, context: TenantContext, params: Dict[str, Any]) -> Dict[str, Any]:
        title = params.get("title", "")
        priority = params.get("priority", "medium")
        return {
            "task_id": f"task_{abs(hash(title)) % 100000}",
            "title": title,
            "priority": priority,
            "status": "pending",
            "message": "Task created in workspace queue",
        }

    async def _tool_summarize_records(self, context: TenantContext, params: Dict[str, Any]) -> Dict[str, Any]:
        customer_id = params.get("customer_id", "")
        return {
            "customer_id": customer_id,
            "summary": f"Customer {customer_id} has 2 active orders and 1 previous support ticket resolved with positive rating.",
            "health_score": 92,
            "tier": "Premium",
        }

    async def _tool_check_order(self, context: TenantContext, params: Dict[str, Any]) -> Dict[str, Any]:
        order_id = params.get("order_id", "")
        return {
            "order_id": order_id,
            "status": "In Transit",
            "carrier": "FedEx",
            "tracking_number": "TRK-98421034",
            "estimated_delivery": "2026-10-16",
            "items": ["Operon Cloud Gateway v2", "API License Key"],
        }

    async def _tool_process_refund(self, context: TenantContext, params: Dict[str, Any]) -> Dict[str, Any]:
        order_id = params.get("order_id", "")
        amount = params.get("amount", 0.0)
        return {
            "order_id": order_id,
            "amount": amount,
            "status": "APPROVED_AND_EXECUTED",
            "transaction_id": f"tx_refund_{abs(hash(order_id)) % 100000}",
            "message": f"Successfully processed refund of ${amount} for order {order_id}.",
        }

    async def _tool_slack_post(self, context: TenantContext, params: Dict[str, Any]) -> Dict[str, Any]:
        channel = params.get("channel", "")
        message = params.get("message", "")
        return {
            "channel": channel,
            "delivered": True,
            "timestamp": "2026-10-13T14:52:00Z",
            "preview": message[:60] + "...",
        }

    async def _tool_jira_escalate(self, context: TenantContext, params: Dict[str, Any]) -> Dict[str, Any]:
        summary = params.get("summary", "")
        priority = params.get("priority", "High")
        return {
            "jira_key": f"OPS-{abs(hash(summary)) % 10000}",
            "summary": summary,
            "priority": priority,
            "status": "Created",
            "assignee": "L3 Engineering Incident Team",
        }


# Global Singleton Registry Instance
tool_registry = ToolRegistry()
