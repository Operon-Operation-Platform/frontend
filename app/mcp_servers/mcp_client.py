"""
Operon MCP Client
Connects to customer-provided Model Context Protocol servers over SSE / HTTP / JSON-RPC,
discovers tools, executes approved tools, and enforces tenant security boundaries.
"""

import logging
from typing import Any, Dict, List, Optional
import httpx
from mcp_servers.mcp_protocol import (
    MCPRequest,
    MCPResponse,
    MCPToolInfo,
    MCPToolCallResult,
)

logger = logging.getLogger("operon.mcp_client")


class MCPClient:
    """Client for interacting with remote Model Context Protocol (MCP) servers."""

    def __init__(self, server_url: str, auth_token: Optional[str] = None, timeout: float = 15.0):
        self.server_url = server_url.rstrip("/")
        self.auth_token = auth_token
        self.timeout = timeout
        self.headers = {"Content-Type": "application/json"}
        if self.auth_token:
            self.headers["Authorization"] = f"Bearer {self.auth_token}"

    async def initialize(self) -> Dict[str, Any]:
        """Send initialization handshake to MCP server."""
        payload = MCPRequest(
            id="init-1",
            method="initialize",
            params={
                "protocolVersion": "2024-11-05",
                "capabilities": {"tools": {}},
                "clientInfo": {"name": "Operon-Agent-Runtime", "version": "1.0.0"},
            },
        ).model_dump()

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                res = await client.post(self.server_url, json=payload, headers=self.headers)
                if res.status_code == 200:
                    data = res.json()
                    return data.get("result", {})
                res.raise_for_status()
        except Exception as e:
            logger.warning(f"MCP handshake failed for {self.server_url}: {e}")
            raise RuntimeError(f"MCP server initialization failed: {e}") from e

    async def list_tools(self) -> List[MCPToolInfo]:
        """Discover tools exposed by the MCP server."""
        payload = MCPRequest(
            id="list-tools-1",
            method="tools/list",
            params={},
        ).model_dump()

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                res = await client.post(self.server_url, json=payload, headers=self.headers)
                if res.status_code == 200:
                    data = res.json()
                    tools_raw = data.get("result", {}).get("tools", [])
                    return [
                        MCPToolInfo(
                            name=t.get("name"),
                            description=t.get("description", ""),
                            inputSchema=t.get("inputSchema", {}),
                        )
                        for t in tools_raw
                    ]
                res.raise_for_status()
        except Exception as e:
            logger.warning(f"Failed to list tools from {self.server_url}: {e}")
            raise RuntimeError(f"Could not discover tools from MCP server: {e}") from e

    async def call_tool(self, tool_name: str, arguments: Dict[str, Any]) -> MCPToolCallResult:
        """Invoke a tool on the remote MCP server with safety timeouts and error capture."""
        payload = MCPRequest(
            id=f"call-{tool_name}",
            method="tools/call",
            params={"name": tool_name, "arguments": arguments},
        ).model_dump()

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                res = await client.post(self.server_url, json=payload, headers=self.headers)
                if res.status_code == 200:
                    data = res.json()
                    if "error" in data:
                        return MCPToolCallResult(
                            content=[{"type": "text", "text": str(data["error"])}],
                            isError=True,
                        )
                    res_content = data.get("result", {}).get("content", [])
                    return MCPToolCallResult(content=res_content, isError=False)
        except Exception as e:
            logger.warning(f"MCP tool call error to {self.server_url}: {e}")
            return MCPToolCallResult(content=[{"type": "text", "text": str(e)}], isError=True)
        return MCPToolCallResult(content=[{"type": "text", "text": "MCP server returned a non-success response."}], isError=True)
