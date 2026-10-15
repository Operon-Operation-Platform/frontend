"""
Operon Platform Admin Console Router
Platform-owner interface for overseeing customer tenants, global agent health,
tool request approvals, execution diagnostics, and platform usage metrics.
"""

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database.postgres.database import get_db
from database.postgres.models import (
    Organization,
    Agent,
    AgentRun,
    ToolRequest,
    MCPServer,
    PlatformUser,
)
from api.routers.operon_auth import get_current_tenant_session

router = APIRouter(prefix="/api/v1/platform-admin", tags=["Operon Platform Admin Console"])


class DecideToolRequestPayload(BaseModel):
    decision: str  # approved, rejected, in_development
    admin_notes: Optional[str] = None


@router.get("/stats")
def get_platform_stats(db: Session = Depends(get_db)):
    """Retrieve global platform owner metrics across all tenants."""
    total_orgs = db.query(Organization).count()
    total_users = db.query(PlatformUser).count()
    total_agents = db.query(Agent).count()
    total_runs = db.query(AgentRun).count()
    total_mcp = db.query(MCPServer).count()
    pending_tool_reqs = db.query(ToolRequest).filter(ToolRequest.status == "pending").count()

    return {
        "total_organizations": total_orgs,
        "total_users": total_users,
        "total_agents": total_agents,
        "total_executions": total_runs,
        "active_mcp_servers": total_mcp,
        "pending_tool_requests": pending_tool_reqs,
        "system_status": "OPERATIONAL",
    }


@router.get("/tenants")
def list_all_tenants(db: Session = Depends(get_db)):
    """List all tenant organizations with agent and run summaries."""
    orgs = db.query(Organization).all()
    results = []
    for o in orgs:
        agent_count = db.query(Agent).filter(Agent.organization_id == o.id).count()
        run_count = db.query(AgentRun).filter(AgentRun.organization_id == o.id).count()
        results.append({
            "id": o.id,
            "name": o.name,
            "slug": o.slug,
            "tier": o.tier,
            "agent_count": agent_count,
            "execution_count": run_count,
            "created_at": o.created_at.isoformat() if o.created_at else None,
        })
    return results


@router.get("/tool-requests")
def list_global_tool_requests(db: Session = Depends(get_db)):
    """List customer tool requests needing platform review."""
    reqs = db.query(ToolRequest).order_by(ToolRequest.created_at.desc()).all()
    results = []
    for r in reqs:
        org = db.query(Organization).filter(Organization.id == r.organization_id).first()
        results.append({
            "id": r.id,
            "organization_name": org.name if org else "Unknown",
            "tool_name": r.tool_name,
            "description": r.description,
            "use_case": r.use_case,
            "status": r.status,
            "admin_notes": r.admin_notes,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        })
    return results


@router.post("/tool-requests/{req_id}/decide")
def decide_tool_request(
    req_id: str,
    payload: DecideToolRequestPayload,
    db: Session = Depends(get_db),
):
    """Approve or reject a customer tool request."""
    tr = db.query(ToolRequest).filter(ToolRequest.id == req_id).first()
    if not tr:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tool request not found.")

    tr.status = payload.decision
    tr.admin_notes = payload.admin_notes
    db.commit()

    return {
        "id": tr.id,
        "tool_name": tr.tool_name,
        "status": tr.status,
        "message": f"Tool request marked as {tr.status}",
    }
