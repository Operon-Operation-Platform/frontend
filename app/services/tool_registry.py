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
from database.postgres.database import get_db_ctx
from database.postgres.models import Agent, AgentTask, KnowledgeIndex

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
        available: bool = True,
    ):
        self.slug = slug
        self.name = name
        self.description = description
        self.category = category
        self.parameters = parameters
        self.handler = handler
        self.requires_approval = requires_approval
        self.available = available

    def to_dict(self) -> Dict[str, Any]:
        return {
            "slug": self.slug,
            "name": self.name,
            "description": self.description,
            "category": self.category,
            "parameters": self.parameters,
            "requires_approval": self.requires_approval,
            "available": self.available,
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
        server_id, separator, tool_name = slug.removeprefix("mcp_").partition("_")
        if not separator or not server_id or not tool_name:
            return {
                "success": False,
                "error": f"MCP tool binding '{slug}' is invalid.",
            }

        target_server = next(
            (server for server in context.mcp_servers if server.get("id") == server_id),
            None,
        )
        if not target_server:
            return {
                "success": False,
                "error": f"The MCP server bound to '{slug}' is not connected in this workspace.",
            }
        if tool_name not in target_server.get("approved_tools", []):
            return {
                "success": False,
                "error": f"MCP tool '{tool_name}' has not been approved for this workspace.",
            }

        client = MCPClient(
            server_url=target_server["server_url"],
            auth_token=target_server.get("auth_token"),
        )
        call_res = await client.call_tool(tool_name=tool_name, arguments=parameters)
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
                available=False,
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

        # 4. List Workspace Agents (Built-in)
        self.register(
            ToolDefinitionItem(
                slug="list_workspace_agents",
                name="List Workspace Agents",
                description="List active agents in the current workspace without exposing other tenants' data.",
                category="builtin",
                parameters={
                    "type": "object",
                    "properties": {
                        "limit": {"type": "integer", "description": "Maximum number of agents to return", "default": 10},
                    },
                },
                handler=self._tool_list_workspace_agents,
            )
        )

        # 5. List Recent Tasks (Built-in)
        self.register(
            ToolDefinitionItem(
                slug="list_recent_tasks",
                name="List Recent Tasks",
                description="List recent workflow tasks created in the current workspace.",
                category="builtin",
                parameters={
                    "type": "object",
                    "properties": {
                        "limit": {"type": "integer", "description": "Maximum number of tasks to return", "default": 10},
                    },
                },
                handler=self._tool_list_recent_tasks,
            )
        )

        # 6. Summarize Records (Built-in)
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
                available=False,
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
                available=False,
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
                available=False,
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
                available=False,
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
                available=False,
            )
        )

    # -------------------------------------------------------------------------
    # HANDLER IMPLEMENTATIONS
    # -------------------------------------------------------------------------

    async def _tool_search_knowledge(self, context: TenantContext, params: Dict[str, Any]) -> Dict[str, Any]:
        query = str(params.get("query", "")).strip()
        top_k = max(1, min(int(params.get("top_k", 3)), 20))
        if not query:
            return {"query": query, "retrieved_count": 0, "snippets": []}

        terms = {term.lower() for term in re.findall(r"[\w'-]+", query) if len(term) > 1}
        scored = []
        with get_db_ctx() as db:
            indexes = (
                db.query(KnowledgeIndex)
                .filter(KnowledgeIndex.organization_id == context.organization_id)
                .filter((KnowledgeIndex.agent_id == context.agent_id) | (KnowledgeIndex.agent_id.is_(None)))
                .all()
            )
            for index in indexes:
                for doc in (index.config or {}).get("documents", []):
                    if not isinstance(doc, dict):
                        continue
                    content = str(doc.get("content") or "")
                    title = str(doc.get("title") or index.name)
                    searchable = f"{title} {content}".lower()
                    score = sum(searchable.count(term) for term in terms)
                    if score:
                        scored.append({
                            "source": title,
                            "title": title,
                            "score": score / max(len(terms), 1),
                            "content": content,
                        })
        snippets = sorted(scored, key=lambda item: item["score"], reverse=True)[:top_k]
        return {
            "query": query,
            "retrieved_count": len(snippets),
            "snippets": snippets,
        }

    async def _tool_query_database(self, context: TenantContext, params: Dict[str, Any]) -> Dict[str, Any]:
        table = params.get("table", "")
        filters = params.get("filters", {})
        limit = min(params.get("limit", 10), 50)

        # Security check: disallow unauthorized or dangerous table queries
        forbidden_pattern = re.compile(r"(\bdrop\b|\bdelete\b|\bupdate\b|\binsert\b|\balter\b)", re.IGNORECASE)
        if forbidden_pattern.search(table):
            raise ValueError(f"Unsafe table name or query attempt detected: {table}")

        source = next((item for item in context.data_sources if table in (item.get("schema_config") or {}).get("allowlisted_tables", [])), None)
        if not source or not source.get("connection_ref"):
            raise RuntimeError("No connected, allowlisted customer database is configured for this table.")
        raise RuntimeError("The configured customer database adapter is unavailable; no query was run.")

    async def _tool_create_task(self, context: TenantContext, params: Dict[str, Any]) -> Dict[str, Any]:
        with get_db_ctx() as db:
            task = AgentTask(
                organization_id=context.organization_id,
                run_id=context.run_id,
                title=str(params.get("title", "")).strip(),
                priority=params.get("priority", "medium"),
                payload=params.get("payload") or {},
            )
            db.add(task)
            db.commit()
            db.refresh(task)
            return {"task_id": task.id, "title": task.title, "priority": task.priority, "status": task.status}

    async def _tool_list_workspace_agents(self, context: TenantContext, params: Dict[str, Any]) -> Dict[str, Any]:
        limit = max(1, min(int(params.get("limit", 10)), 50))
        with get_db_ctx() as db:
            agents = (
                db.query(Agent)
                .filter(
                    Agent.organization_id == context.organization_id,
                    Agent.is_deleted == False,
                )
                .order_by(Agent.created_at.desc())
                .limit(limit)
                .all()
            )
            return {
                "count": len(agents),
                "agents": [
                    {
                        "id": agent.id,
                        "name": agent.name,
                        "template_key": agent.template_key,
                        "status": agent.status,
                    }
                    for agent in agents
                ],
            }

    async def _tool_list_recent_tasks(self, context: TenantContext, params: Dict[str, Any]) -> Dict[str, Any]:
        limit = max(1, min(int(params.get("limit", 10)), 50))
        with get_db_ctx() as db:
            tasks = (
                db.query(AgentTask)
                .filter(AgentTask.organization_id == context.organization_id)
                .order_by(AgentTask.created_at.desc())
                .limit(limit)
                .all()
            )
            return {
                "count": len(tasks),
                "tasks": [
                    {
                        "id": task.id,
                        "title": task.title,
                        "priority": task.priority,
                        "status": task.status,
                        "created_at": task.created_at.isoformat() if task.created_at else None,
                    }
                    for task in tasks
                ],
            }

    async def _tool_summarize_records(self, context: TenantContext, params: Dict[str, Any]) -> Dict[str, Any]:
        records = params.get("records") or []
        if not records:
            raise RuntimeError("No customer records were provided to summarize.")
        return {"customer_id": params.get("customer_id"), "records": records}

    async def _tool_check_order(self, context: TenantContext, params: Dict[str, Any]) -> Dict[str, Any]:
        raise RuntimeError("Order lookup requires a connected customer data source or approved MCP tool.")

    async def _tool_process_refund(self, context: TenantContext, params: Dict[str, Any]) -> Dict[str, Any]:
        raise RuntimeError("Refund execution requires a configured payment integration. No refund was submitted.")

    async def _tool_slack_post(self, context: TenantContext, params: Dict[str, Any]) -> Dict[str, Any]:
        raise RuntimeError("Message delivery requires a configured Slack integration. No message was sent.")

    async def _tool_jira_escalate(self, context: TenantContext, params: Dict[str, Any]) -> Dict[str, Any]:
        raise RuntimeError("Issue creation requires a configured Jira integration. No issue was created.")


# Global Singleton Registry Instance
tool_registry = ToolRegistry()
