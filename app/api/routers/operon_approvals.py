"""
Operon Human-in-the-Loop Approvals Router
Treats human review and high-risk action authorizations as first-class workflow states.
"""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database.postgres.database import get_db
from database.postgres.models import Approval, AgentRun, AgentTask
from api.routers.operon_auth import get_current_tenant_session
from services.tool_registry import tool_registry

router = APIRouter(prefix="/api/v1/approvals", tags=["Operon Human Approvals"])


class ApprovalDecisionPayload(BaseModel):
    decision: str  # approved, rejected
    reason: Optional[str] = None
    edited_payload: Optional[Dict[str, Any]] = None


@router.get("")
def list_approvals(
    status_filter: Optional[str] = None,
    session: Dict[str, Any] = Depends(get_current_tenant_session),
    db: Session = Depends(get_db),
):
    """List pending and historical approval requests."""
    org = session["organization"]
    query = db.query(Approval).filter(Approval.organization_id == org.id)
    if status_filter:
        query = query.filter(Approval.status == status_filter)

    approvals = query.order_by(Approval.created_at.desc()).all()
    result = []
    for a in approvals:
        run = db.query(AgentRun).filter(AgentRun.id == a.run_id).first()
        result.append({
            "id": a.id,
            "run_id": a.run_id,
            "action_type": a.action_type,
            "description": a.description,
            "status": a.status,
            "payload": a.payload,
            "decided_by": a.decided_by,
            "decision_reason": a.decision_reason,
            "created_at": a.created_at.isoformat() if a.created_at else None,
            "decided_at": a.decided_at.isoformat() if a.decided_at else None,
        })
    return result


@router.post("/{approval_id}/decide")
async def decide_approval(
    approval_id: str,
    payload: ApprovalDecisionPayload,
    session: Dict[str, Any] = Depends(get_current_tenant_session),
    db: Session = Depends(get_db),
):
    """Approve or reject a pending agent action, resuming execution."""
    org = session["organization"]
    user = session["user"]

    approval = (
        db.query(Approval)
        .filter(Approval.id == approval_id, Approval.organization_id == org.id)
        .first()
    )
    if not approval:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Approval request not found.")

    if approval.status != "pending":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Approval has already been decided.")

    approval.status = payload.decision
    approval.decided_by = user.email
    approval.decision_reason = payload.reason
    approval.decided_at = datetime.now(timezone.utc)

    # Resume the AgentRun
    run = db.query(AgentRun).filter(AgentRun.id == approval.run_id).first()
    if run:
        if payload.decision == "approved":
            run.status = "succeeded"
            run.output_payload = {
                "approval_status": "APPROVED",
                "action": approval.action_type,
                "executed_at": datetime.now(timezone.utc).isoformat(),
                "approver": user.email,
            }
        else:
            run.status = "failed"
            run.error_message = f"Action rejected by reviewer {user.email}: {payload.reason or 'No reason provided'}"

    db.commit()

    return {
        "approval_id": approval.id,
        "status": approval.status,
        "message": f"Action has been {approval.status} by {user.email}",
    }
