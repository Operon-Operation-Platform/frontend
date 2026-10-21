"""
Operon Agent Runs & Live Execution Streaming Router
Triggers agent workflows, retrieves step traces, handles cancellations,
and streams real-time Server-Sent Events (SSE) directly to the dashboard.
"""

import asyncio
import hashlib
import json
import uuid
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, Header, HTTPException, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database.postgres.database import get_db, get_db_ctx
from database.postgres.models import (
    Agent,
    AgentVersion,
    AgentRun,
    ExecutionStep,
    BusinessBranch,
    MCPServer,
    MCPServerTool,
    DataSource,
    IntegrationConnection,
    Organization,
    OrganizationMember,
    PlatformAPIKey,
    PlatformUser,
)
from api.routers.operon_auth import get_current_tenant_session
from api.routers.operon_integrations import CATALOG_PROVIDERS, provider_catalog_entry
from services.secret_vault import decrypt_credentials
from agents.context import TenantContext
from agents.adapters.support_adapter import OperonSupportAgentAdapter
from agents.runners.sales_agent import OperonSalesAgentRunner
from agents.runners.operations_agent import OperonOperationsAgentRunner

router = APIRouter(prefix="/api/v1/runs", tags=["Operon Execution Runs"])


def get_agent_run_session(
    authorization: Optional[str] = Header(None),
    x_workspace_id: Optional[str] = Header(None),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Allow user JWTs or a user API key to trigger runs in its own workspace."""
    if authorization and authorization.startswith("Bearer opn_"):
        raw_key = authorization.removeprefix("Bearer ")
        key_hash = hashlib.sha256(raw_key.encode("utf-8")).hexdigest()
        api_key = db.query(PlatformAPIKey).filter(PlatformAPIKey.key_hash == key_hash).first()
        if not api_key:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="API key is invalid or has been rotated.",
            )
        if x_workspace_id and x_workspace_id != api_key.organization_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This API key is scoped to a different workspace.",
            )

        user = db.query(PlatformUser).filter(PlatformUser.id == api_key.user_id).first()
        membership = db.query(OrganizationMember).filter(
            OrganizationMember.user_id == api_key.user_id,
            OrganizationMember.organization_id == api_key.organization_id,
        ).first()
        org = db.query(Organization).filter(Organization.id == api_key.organization_id).first()
        if not user or not membership or not org:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="API key owner no longer has access to this workspace.",
            )
        return {
            "user": user,
            "organization": org,
            "membership": membership,
            "role": membership.role,
            "api_key_id": api_key.id,
        }

    return get_current_tenant_session(
        authorization=authorization,
        x_workspace_id=x_workspace_id,
        db=db,
    )


class TriggerRunRequest(BaseModel):
    agent_id: str
    branch_id: Optional[str] = None
    input_payload: Dict[str, Any]
    trigger_type: str = "manual"  # manual, webhook, schedule


@router.post("/trigger", status_code=status.HTTP_202_ACCEPTED)
async def trigger_agent_run(
    req: TriggerRunRequest,
    session: Dict[str, Any] = Depends(get_agent_run_session),
    db: Session = Depends(get_db),
):
    """Trigger an execution run for an agent with full tenant context."""
    org = session["organization"]

    # 1. Load agent and verify tenant ownership
    agent = db.query(Agent).filter(
        Agent.id == req.agent_id,
        Agent.organization_id == org.id,
        Agent.is_deleted == False,
    ).first()
    if not agent:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found in workspace.")

    if agent.status == "paused":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot run a paused agent.")

    # 2. Load latest agent version
    latest_v = (
        db.query(AgentVersion)
        .filter(AgentVersion.agent_id == agent.id)
        .order_by(AgentVersion.version_number.desc())
        .first()
    )

    # 3. Load tenant resources (tools, data sources, integrations, MCP servers)
    mcp_servers = db.query(MCPServer).filter(MCPServer.organization_id == org.id, MCPServer.status == "active").all()
    data_sources = db.query(DataSource).filter(DataSource.organization_id == org.id).all()
    integrations = db.query(IntegrationConnection).filter(IntegrationConnection.organization_id == org.id).all()
    integration_context = [
        {"id": ic.id, "provider_key": ic.provider_key, "name": ic.name, "status": ic.status}
        for ic in integrations
    ]
    model_settings = (latest_v.model_config_settings or {}) if latest_v else {}
    selected_integration_keys = model_settings.get("integration_keys", [])
    if not isinstance(selected_integration_keys, list):
        selected_integration_keys = []
    configured_catalog = {
        provider["key"]: provider_catalog_entry(provider)
        for provider in CATALOG_PROVIDERS
    }
    connected_provider_keys = {integration["provider_key"] for integration in integration_context}
    for provider_key in selected_integration_keys:
        provider = configured_catalog.get(provider_key)
        if provider and provider_key not in connected_provider_keys:
            integration_context.append({
                "provider_key": provider_key,
                "name": provider["name"],
                "source": "environment",
                "configured": provider["configured"],
                "environment_variables": provider["environment_variables"],
            })

    # 4. Construct TenantContext
    run_id = f"run-{uuid.uuid4().hex[:10]}"
    allowed_actions = latest_v.allowed_actions if latest_v and latest_v.allowed_actions else []

    tenant_context = TenantContext(
        run_id=run_id,
        organization_id=org.id,
        agent_id=agent.id,
        version_id=latest_v.id if latest_v else None,
        template_key=agent.template_key,
        branch_id=req.branch_id,
        allowed_tools=allowed_actions,
        data_sources=[{"id": ds.id, "name": ds.name, "source_type": ds.source_type} for ds in data_sources],
        integrations=integration_context,
        mcp_servers=[{
            "id": s.id,
            "server_url": s.server_url,
            "auth_token": (
                decrypt_credentials(s.auth_token).get("auth_token")
                if s.auth_token and s.auth_token.startswith("gAAAA")
                else s.auth_token
            ),
            "approved_tools": [
                tool.tool_name
                for tool in db.query(MCPServerTool).filter(
                    MCPServerTool.mcp_server_id == s.id,
                    MCPServerTool.approved == True,
                ).all()
            ],
        } for s in mcp_servers],
        instructions=latest_v.instructions if latest_v else "",
        business_rules=latest_v.business_rules if latest_v else {},
        escalation_rules=latest_v.escalation_rules if latest_v else {},
        model_config_settings=model_settings,
    )

    # 5. Dispatch execution to appropriate archetype runner
    if agent.template_key == "customer_support":
        run_result = await OperonSupportAgentAdapter.execute(tenant_context, req.input_payload)
    elif agent.template_key == "sales":
        run_result = await OperonSalesAgentRunner.execute(tenant_context, req.input_payload)
    elif agent.template_key == "operations":
        run_result = await OperonOperationsAgentRunner.execute(tenant_context, req.input_payload)
    else:
        run_result = await OperonSupportAgentAdapter.execute(tenant_context, req.input_payload)

    return {
        "run_id": run_id,
        "agent_id": agent.id,
        "template_key": agent.template_key,
        "status": run_result.get("status", "running"),
        "result": run_result,
        "stream_url": f"/api/v1/runs/{run_id}/stream",
    }


@router.get("")
def list_runs(
    agent_id: Optional[str] = None,
    status_filter: Optional[str] = None,
    session: Dict[str, Any] = Depends(get_current_tenant_session),
    db: Session = Depends(get_db),
):
    """List execution runs for current workspace."""
    org = session["organization"]
    query = (
        db.query(AgentRun)
        .join(Agent, Agent.id == AgentRun.agent_id)
        .filter(
            AgentRun.organization_id == org.id,
            Agent.organization_id == org.id,
            Agent.is_deleted == False,
        )
    )
    if agent_id:
        query = query.filter(AgentRun.agent_id == agent_id)
    if status_filter:
        query = query.filter(AgentRun.status == status_filter)

    runs = query.order_by(AgentRun.created_at.desc()).limit(50).all()
    result = []
    for r in runs:
        agent = db.query(Agent).filter(Agent.id == r.agent_id, Agent.organization_id == org.id, Agent.is_deleted == False).first()
        result.append({
            "id": r.id,
            "agent_id": r.agent_id,
            "agent_name": agent.name if agent else "Unknown Agent",
            "template_key": agent.template_key if agent else "customer_support",
            "status": r.status,
            "trigger_type": r.trigger_type,
            "latency_ms": r.latency_ms,
            "input_payload": r.input_payload,
            "output_payload": r.output_payload,
            "error_message": r.error_message,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "completed_at": r.completed_at.isoformat() if r.completed_at else None,
        })
    return result


@router.get("/{run_id}")
def get_run_details(
    run_id: str,
    session: Dict[str, Any] = Depends(get_current_tenant_session),
    db: Session = Depends(get_db),
):
    """Retrieve execution run details and step trace."""
    org = session["organization"]
    run = db.query(AgentRun).filter(AgentRun.id == run_id, AgentRun.organization_id == org.id).first()
    if not run:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found.")

    steps = db.query(ExecutionStep).filter(ExecutionStep.run_id == run.id).order_by(ExecutionStep.created_at.asc()).all()
    agent = db.query(Agent).filter(Agent.id == run.agent_id).first()

    return {
        "id": run.id,
        "agent_id": run.agent_id,
        "agent_name": agent.name if agent else "Unknown Agent",
        "template_key": agent.template_key if agent else "customer_support",
        "status": run.status,
        "trigger_type": run.trigger_type,
        "latency_ms": run.latency_ms,
        "input_payload": run.input_payload,
        "output_payload": run.output_payload,
        "error_message": run.error_message,
        "steps": [
            {
                "id": s.id,
                "step_name": s.step_name,
                "status": s.status,
                "duration_ms": s.duration_ms,
                "created_at": s.created_at.isoformat() if s.created_at else None,
            }
            for s in steps
        ],
        "created_at": run.created_at.isoformat() if run.created_at else None,
        "completed_at": run.completed_at.isoformat() if run.completed_at else None,
    }


@router.get("/{run_id}/stream")
async def stream_run_execution(
    run_id: str,
    session: Dict[str, Any] = Depends(get_current_tenant_session),
):
    """
    Server-Sent Events (SSE) endpoint providing live real-time execution telemetry
    to the Operon dashboard.
    """
    async def event_generator():
        for i in range(1, 10):
            with get_db_ctx() as db:
                run = db.query(AgentRun).filter(AgentRun.id == run_id).first()
                if run:
                    steps = db.query(ExecutionStep).filter(ExecutionStep.run_id == run.id).all()
                    data = {
                        "run_id": run.id,
                        "status": run.status,
                        "steps_completed": len(steps),
                        "latency_ms": run.latency_ms,
                    }
                    yield f"data: {json.dumps(data)}\n\n"
                    if run.status in ["succeeded", "failed", "waiting_for_approval", "cancelled"]:
                        break
            await asyncio.sleep(1.0)
        yield f"data: {json.dumps({'event': 'stream_end'})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.post("/{run_id}/cancel")
def cancel_run(
    run_id: str,
    session: Dict[str, Any] = Depends(get_current_tenant_session),
    db: Session = Depends(get_db),
):
    """Cancel an active execution run."""
    org = session["organization"]
    run = db.query(AgentRun).filter(AgentRun.id == run_id, AgentRun.organization_id == org.id).first()
    if not run:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found.")

    run.status = "cancelled"
    db.commit()
    return {"message": "Execution run cancelled"}
