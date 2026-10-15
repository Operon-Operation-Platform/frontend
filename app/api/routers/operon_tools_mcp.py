"""
Operon Tools & Model Context Protocol (MCP) Router
Handles tool registry catalog, custom tool requests, remote MCP server connections,
tool discovery, tool approvals, and native Operon MCP endpoint execution.
"""

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database.postgres.database import get_db
from database.postgres.models import (
    ToolDefinition,
    ToolRequest,
    MCPServer,
    MCPServerTool,
)
from api.routers.operon_auth import get_current_tenant_session
from services.tool_registry import tool_registry
from mcp_servers.mcp_client import MCPClient
from mcp_servers.operon_mcp_server import operon_mcp_server

router = APIRouter(prefix="/api/v1/mcp", tags=["Operon Tools & MCP Servers"])


# -----------------------------------------------------------------------------
# Schemas
# -----------------------------------------------------------------------------

class SubmitToolRequestPayload(BaseModel):
    tool_name: str
    description: str
    use_case: str
    agent_id: Optional[str] = None


class ConnectMCPServerPayload(BaseModel):
    name: str
    server_url: str
    transport_type: str = "sse"  # sse, stdio, stream
    auth_token: Optional[str] = None


class ToolApprovalPayload(BaseModel):
    approved: bool
    permission_policy: Optional[Dict[str, Any]] = None


# -----------------------------------------------------------------------------
# Endpoints
# -----------------------------------------------------------------------------

@router.get("/tools")
def list_available_tools(category: Optional[str] = None):
    """Retrieve catalog of registered tools in the central Tool Registry."""
    return tool_registry.list_tools(category=category)


@router.post("/tools/request", status_code=status.HTTP_201_CREATED)
def request_new_tool(
    payload: SubmitToolRequestPayload,
    session: Dict[str, Any] = Depends(get_current_tenant_session),
    db: Session = Depends(get_db),
):
    """Submit a request for an unreleased tool or connector."""
    org = session["organization"]
    tool_req = ToolRequest(
        organization_id=org.id,
        agent_id=payload.agent_id,
        tool_name=payload.tool_name,
        description=payload.description,
        use_case=payload.use_case,
        status="pending",
    )
    db.add(tool_req)
    db.commit()
    db.refresh(tool_req)

    return {
        "id": tool_req.id,
        "tool_name": tool_req.tool_name,
        "status": tool_req.status,
        "message": f"Tool request for '{payload.tool_name}' submitted to platform review queue.",
    }


@router.get("/tools/requests")
def list_tool_requests(
    session: Dict[str, Any] = Depends(get_current_tenant_session),
    db: Session = Depends(get_db),
):
    """List tool requests submitted by this workspace."""
    org = session["organization"]
    reqs = db.query(ToolRequest).filter(ToolRequest.organization_id == org.id).all()
    return [
        {
            "id": r.id,
            "tool_name": r.tool_name,
            "description": r.description,
            "use_case": r.use_case,
            "status": r.status,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in reqs
    ]


@router.get("/servers")
def list_mcp_servers(
    session: Dict[str, Any] = Depends(get_current_tenant_session),
    db: Session = Depends(get_db),
):
    """List connected MCP servers and their discovered tools."""
    org = session["organization"]
    servers = db.query(MCPServer).filter(MCPServer.organization_id == org.id).all()
    result = []
    for s in servers:
        tools = db.query(MCPServerTool).filter(MCPServerTool.mcp_server_id == s.id).all()
        result.append({
            "id": s.id,
            "name": s.name,
            "server_url": s.server_url,
            "transport_type": s.transport_type,
            "status": s.status,
            "discovered_tools": [
                {
                    "id": t.id,
                    "name": t.tool_name,
                    "schema": t.schema,
                    "approved": t.approved,
                }
                for t in tools
            ],
            "created_at": s.created_at.isoformat() if s.created_at else None,
        })
    return result


@router.post("/servers/connect", status_code=status.HTTP_201_CREATED)
async def connect_mcp_server(
    payload: ConnectMCPServerPayload,
    session: Dict[str, Any] = Depends(get_current_tenant_session),
    db: Session = Depends(get_db),
):
    """Connect to a Model Context Protocol server, run handshake, and discover tools."""
    org = session["organization"]

    # 1. Instantiate MCP Client and discover tools
    client = MCPClient(server_url=payload.server_url, auth_token=payload.auth_token)
    await client.initialize()
    discovered = await client.list_tools()

    # 2. Persist MCPServer record
    server = MCPServer(
        organization_id=org.id,
        name=payload.name,
        server_url=payload.server_url,
        transport_type=payload.transport_type,
        auth_token=payload.auth_token,
        status="active",
        discovered_tools=[t.dict() for t in discovered],
    )
    db.add(server)
    db.flush()

    # 3. Persist discovered tools in mcp_server_tools
    for tool_info in discovered:
        mcp_tool = MCPServerTool(
            mcp_server_id=server.id,
            tool_name=tool_info.name,
            schema=tool_info.dict(),
            approved=False,  # Security rule: never auto-approve untrusted discovered tools!
        )
        db.add(mcp_tool)

    db.commit()
    db.refresh(server)

    return {
        "id": server.id,
        "name": server.name,
        "server_url": server.server_url,
        "discovered_tools_count": len(discovered),
        "status": server.status,
        "message": f"Successfully connected MCP server and discovered {len(discovered)} tools awaiting customer approval.",
    }


@router.post("/servers/{server_id}/tools/{tool_id}/approve")
def approve_mcp_tool(
    server_id: str,
    tool_id: str,
    payload: ToolApprovalPayload,
    session: Dict[str, Any] = Depends(get_current_tenant_session),
    db: Session = Depends(get_db),
):
    """Explicitly approve or revoke a discovered tool from an MCP server."""
    org = session["organization"]
    server = db.query(MCPServer).filter(MCPServer.id == server_id, MCPServer.organization_id == org.id).first()
    if not server:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="MCP Server not found.")

    tool = db.query(MCPServerTool).filter(MCPServerTool.id == tool_id, MCPServerTool.mcp_server_id == server.id).first()
    if not tool:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tool not found.")

    tool.approved = payload.approved
    if payload.permission_policy:
        tool.permission_policy = payload.permission_policy
    db.commit()

    return {
        "tool_id": tool.id,
        "tool_name": tool.tool_name,
        "approved": tool.approved,
        "message": f"Tool '{tool.tool_name}' approval status updated to {tool.approved}",
    }


@router.post("/operon-server")
async def invoke_native_mcp_server(request: Request):
    """
    Native Operon MCP Server JSON-RPC 2.0 endpoint.
    Exposes Operon tools directly to Claude Desktop, Cursor, and standard MCP clients.
    """
    body = await request.json()
    response = await operon_mcp_server.handle_request(body)
    return response
