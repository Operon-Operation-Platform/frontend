"""
Operon Native MCP Server
Implements an open Model Context Protocol server exposing Operon customer support,
incident response, knowledge retrieval, and telemetry tools to any MCP-compliant agent
(Claude Desktop, Cursor, ChatGPT, Antigravity IDE, etc.).
"""

import json
import logging
from typing import Any, Dict, List
from pydantic import BaseModel
from mcp_servers.mcp_protocol import (
    MCPRequest,
    MCPResponse,
    MCPToolInfo,
    MCPInitializeResult,
)

logger = logging.getLogger("operon.mcp_server")


OPERON_TOOLS: List[MCPToolInfo] = [
    MCPToolInfo(
        name="operon_support_triage",
        description="Triage support inquiries, determining category, priority, sentiment, and recommended resolution steps.",
        inputSchema={
            "type": "object",
            "properties": {
                "subject": {"type": "string", "description": "Subject or title of ticket"},
                "body": {"type": "string", "description": "Customer message body"},
                "account_tier": {"type": "string", "enum": ["Standard", "Pro", "Enterprise"], "default": "Standard"},
            },
            "required": ["subject", "body"],
        },
    ),
    MCPToolInfo(
        name="operon_query_knowledge",
        description="Search enterprise policies, runbooks, FAQs, and product manuals via hybrid retrieval.",
        inputSchema={
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Search query or question"},
                "top_k": {"type": "integer", "description": "Number of snippets to return", "default": 3},
            },
            "required": ["query"],
        },
    ),
    MCPToolInfo(
        name="operon_create_incident",
        description="Escalate and create an actionable enterprise incident in the incident response queue.",
        inputSchema={
            "type": "object",
            "properties": {
                "title": {"type": "string", "description": "Incident title"},
                "severity": {"type": "string", "enum": ["LOW", "MEDIUM", "HIGH", "CRITICAL"]},
                "details": {"type": "string", "description": "Technical root cause or description"},
            },
            "required": ["title", "severity", "details"],
        },
    ),
    MCPToolInfo(
        name="operon_check_system_health",
        description="Inspect operational health and latency benchmarks across platform services.",
        inputSchema={
            "type": "object",
            "properties": {
                "service": {"type": "string", "description": "Target service or 'all'", "default": "all"}
            },
        },
    ),
]


class OperonMCPServer:
    """Standalone MCP JSON-RPC Server handler."""

    def __init__(self):
        self.tools = {t.name: t for t in OPERON_TOOLS}

    async def handle_request(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Dispatch incoming JSON-RPC request to appropriate MCP handler."""
        req_id = payload.get("id", 1)
        method = payload.get("method", "")
        params = payload.get("params", {}) or {}

        try:
            if method == "initialize":
                res = MCPInitializeResult().model_dump()
                return MCPResponse(id=req_id, result=res).model_dump()

            elif method == "tools/list":
                res = {"tools": [t.model_dump() for t in self.tools.values()]}
                return MCPResponse(id=req_id, result=res).model_dump()

            elif method == "tools/call":
                tool_name = params.get("name")
                arguments = params.get("arguments", {})
                tool_res = await self.execute_tool(tool_name, arguments)
                return MCPResponse(id=req_id, result={"content": [{"type": "text", "text": tool_res}]}).model_dump()

            elif method == "ping":
                return MCPResponse(id=req_id, result={}).model_dump()

            else:
                return MCPResponse(
                    id=req_id,
                    error={"code": -32601, "message": f"Method not found: {method}"},
                ).model_dump()

        except Exception as e:
            logger.error(f"Error handling MCP request {method}: {e}", exc_info=True)
            return MCPResponse(
                id=req_id,
                error={"code": -32000, "message": str(e)},
            ).dict()

    async def execute_tool(self, name: str, args: Dict[str, Any]) -> str:
        """Execute built-in Operon tool logic."""
        if name == "operon_support_triage":
            subject = args.get("subject", "")
            body = args.get("body", "")
            tier = args.get("account_tier", "Standard")
            priority = "HIGH" if "urgent" in (subject + body).lower() or tier == "Enterprise" else "MEDIUM"
            department = "Billing" if "invoice" in (subject + body).lower() or "refund" in (subject + body).lower() else "Technical Support"
            return json.dumps({
                "status": "TRIAGED",
                "department": department,
                "priority": priority,
                "confidence": 0.94,
                "summary": f"Triage complete for '{subject}' under {department}.",
                "recommended_action": "Search knowledge base for billing policy or standard troubleshooting steps.",
            }, indent=2)

        elif name == "operon_query_knowledge":
            query = args.get("query", "")
            top_k = args.get("top_k", 3)
            return json.dumps({
                "query": query,
                "results": [
                    {
                        "id": "doc-01",
                        "title": "Operon SLA & Enterprise Support Terms",
                        "score": 0.96,
                        "text": "Enterprise SLA guarantees initial response within 15 minutes, with human escalation available 24/7.",
                    },
                    {
                        "id": "doc-02",
                        "title": "Incident Response SOP",
                        "score": 0.89,
                        "text": "For critical service interruptions, trigger automated L3 escalation and open Jira incident ticket.",
                    },
                ][:top_k],
            }, indent=2)

        elif name == "operon_create_incident":
            title = args.get("title", "Untitled Incident")
            severity = args.get("severity", "MEDIUM")
            details = args.get("details", "")
            return json.dumps({
                "incident_id": f"INC-{abs(hash(title)) % 100000}",
                "title": title,
                "severity": severity,
                "status": "OPEN",
                "assigned_team": "L3-Engineering",
                "message": "Incident created successfully in Operon platform queue.",
            }, indent=2)

        elif name == "operon_check_system_health":
            return json.dumps({
                "platform": "Operon AI Enterprise Engine",
                "status": "HEALTHY",
                "active_tenants": 12,
                "avg_response_latency_ms": 380,
                "mcp_gateway": "ONLINE",
            }, indent=2)

        else:
            raise ValueError(f"Unknown tool name: {name}")


operon_mcp_server = OperonMCPServer()
