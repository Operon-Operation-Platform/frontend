"""
Operon Agent Builder & Template Router
Manages agent lifecycle, templates (Support, Sales, Operations),
immutable versioning, business branch scoping, and draft-to-active transitions.
"""

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from database.postgres.database import get_db
from database.postgres.models import (
    Agent,
    AgentVersion,
    AgentTemplate,
    AgentBranchAssignment,
    AgentRun,
    BusinessBranch,
)
from api.routers.operon_auth import get_current_tenant_session

router = APIRouter(prefix="/api/v1/agents", tags=["Operon Agent Builder"])


# -----------------------------------------------------------------------------
# TEMPLATE DEFINITIONS (Section 4 of implementation.md)
# -----------------------------------------------------------------------------

DEFAULT_TEMPLATES = [
    {
        "key": "customer_support",
        "name": "Customer Support Agent",
        "description": "Resolves customer tickets, diagnoses issues with vision & telemetry, retrieves policies, checks orders, and handles refunds with approval.",
        "capabilities": [
            "Ticket Triage & Sentiment Analysis",
            "Multi-Modal Vision & OCR Screenshot Diagnosis",
            "Hybrid RAG Retrieval (Policies & FAQs)",
            "Safe Order & Customer Database Queries",
            "Human Approval Gate for Refunds & High-Risk Actions",
            "Automated Jira Escalation to Engineering L3",
        ],
        "default_instructions": (
            "You are an empathetic, highly knowledgeable enterprise Customer Support Agent. "
            "Your objective is to diagnose issues rapidly, reference company policy accurately, "
            "and provide concise step-by-step solutions while upholding SLAs."
        ),
        "recommended_integrations": ["Zendesk", "Intercom", "Email", "Slack"],
        "default_tools": ["search_knowledge", "check_order", "query_approved_database", "request_refund"],
        "typical_data": "Tickets, customer accounts, orders, knowledge base",
        "approval_examples": "Refunds over $50, account cancellations, sensitive email replies",
        "success_metric": "Verified First-Contact Resolution Rate",
    },
    {
        "key": "sales",
        "name": "Sales & Inbound Lead Agent",
        "description": "Qualifies inbound prospects, enriches company firmographics, drafts tailored proposals, and updates CRM deal stages.",
        "capabilities": [
            "Inbound Lead Scoring & Firmographic Enrichment",
            "Sales Playbook & Pricing Match",
            "Personalized Executive Outreach Drafting",
            "CRM Contact & Deal Synchronization",
            "Human Approval Gate for Deal Changes & Discounting",
        ],
        "default_instructions": (
            "You are a strategic Sales Representative agent. "
            "Analyze customer pain points, score lead urgency and budget fit, "
            "and draft compelling, concise value-driven follow-ups."
        ),
        "recommended_integrations": ["HubSpot", "Salesforce", "Email", "LinkedIn"],
        "default_tools": ["search_knowledge", "summarize_records", "query_approved_database"],
        "typical_data": "Leads, accounts, deals, sales collateral, case studies",
        "approval_examples": "Outbound executive cold messages, discount offers, deal stage advances",
        "success_metric": "Lead Qualification Velocity & Meeting Booking Rate",
    },
    {
        "key": "operations",
        "name": "Operations & Incident Agent",
        "description": "Monitors system health, triages operational alerts, consults runbooks, and executes safe recovery actions with human approval.",
        "capabilities": [
            "Alert Telemetry Ingestion & Triage",
            "Automated Runbook & SOP Matching",
            "Incident Channel Broadcast (Slack & PagerDuty)",
            "Safe Job Retries & Service Health Checks",
            "Human Approval Gate for Production Restarts & Changes",
        ],
        "default_instructions": (
            "You are an SRE Operations & Incident Response Agent. "
            "Your goal is rapid MTTR (mean time to resolve) while avoiding unintended disruptions. "
            "Never execute destructive actions without human approval."
        ),
        "recommended_integrations": ["Slack", "Jira", "Datadog", "PagerDuty"],
        "default_tools": ["search_knowledge", "jira_escalate_incident", "slack_post_message", "create_task"],
        "typical_data": "Alerts, telemetry logs, runbooks, incidents, deployment events",
        "approval_examples": "Production pod restarts, database failovers, cache purges",
        "success_metric": "Mean Time to Recovery (MTTR) & Automation Accuracy",
    },
]


# -----------------------------------------------------------------------------
# Schemas
# -----------------------------------------------------------------------------

class AgentCreateRequest(BaseModel):
    template_key: str = "customer_support"
    name: str
    description: Optional[str] = None
    instructions: str
    business_rules: Optional[Dict[str, Any]] = None
    allowed_actions: Optional[List[str]] = None
    escalation_rules: Optional[Dict[str, Any]] = None
    model_config_settings: Optional[Dict[str, Any]] = None
    branch_ids: Optional[List[str]] = None
    status: str = "active"  # draft, active


class AgentUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    instructions: Optional[str] = None
    business_rules: Optional[Dict[str, Any]] = None
    allowed_actions: Optional[List[str]] = None
    escalation_rules: Optional[Dict[str, Any]] = None
    model_config_settings: Optional[Dict[str, Any]] = None
    branch_ids: Optional[List[str]] = None
    status: Optional[str] = None
    create_new_version: bool = False


# -----------------------------------------------------------------------------
# Endpoints
# -----------------------------------------------------------------------------

@router.get("/templates")
def list_agent_templates():
    """Return available agent archetype templates."""
    return DEFAULT_TEMPLATES


@router.get("")
def list_agents(
    session: Dict[str, Any] = Depends(get_current_tenant_session),
    db: Session = Depends(get_db),
):
    """List all agents created in current workspace."""
    org = session["organization"]
    agents = db.query(Agent).filter(Agent.organization_id == org.id).order_by(Agent.created_at.desc()).all()

    result = []
    for a in agents:
        latest_version = (
            db.query(AgentVersion)
            .filter(AgentVersion.agent_id == a.id)
            .order_by(AgentVersion.version_number.desc())
            .first()
        )
        run_count = db.query(AgentRun).filter(AgentRun.agent_id == a.id).count()

        result.append({
            "id": a.id,
            "name": a.name,
            "description": a.description,
            "template_key": a.template_key,
            "status": a.status,
            "current_version_number": a.current_version_number,
            "instructions": latest_version.instructions if latest_version else "",
            "run_count": run_count,
            "created_at": a.created_at.isoformat() if a.created_at else None,
            "updated_at": a.updated_at.isoformat() if a.updated_at else None,
        })
    return result


@router.post("", status_code=status.HTTP_201_CREATED)
def create_agent(
    req: AgentCreateRequest,
    session: Dict[str, Any] = Depends(get_current_tenant_session),
    db: Session = Depends(get_db),
):
    """Create a new agent instance with initial immutable version 1."""
    org = session["organization"]

    # 1. Create Agent record
    new_agent = Agent(
        organization_id=org.id,
        template_key=req.template_key,
        name=req.name,
        description=req.description,
        status=req.status,
        current_version_number=1,
    )
    db.add(new_agent)
    db.flush()

    # 2. Create initial AgentVersion (v1)
    version = AgentVersion(
        agent_id=new_agent.id,
        version_number=1,
        instructions=req.instructions,
        business_rules=req.business_rules or {},
        allowed_actions=req.allowed_actions or [],
        escalation_rules=req.escalation_rules or {},
        model_config_settings=req.model_config_settings or {"model": "llama-3-70b", "temperature": 0.2},
    )
    db.add(version)

    # 3. Assign to branches if specified
    if req.branch_ids:
        for b_id in req.branch_ids:
            assignment = AgentBranchAssignment(agent_id=new_agent.id, branch_id=b_id)
            db.add(assignment)

    db.commit()
    db.refresh(new_agent)

    return {
        "id": new_agent.id,
        "name": new_agent.name,
        "template_key": new_agent.template_key,
        "status": new_agent.status,
        "version_number": 1,
        "message": "Agent configured and created successfully",
    }


@router.get("/{agent_id}")
def get_agent_details(
    agent_id: str,
    session: Dict[str, Any] = Depends(get_current_tenant_session),
    db: Session = Depends(get_db),
):
    """Retrieve full agent configuration, versions, and branch assignments."""
    org = session["organization"]
    agent = db.query(Agent).filter(Agent.id == agent_id, Agent.organization_id == org.id).first()
    if not agent:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found.")

    versions = (
        db.query(AgentVersion)
        .filter(AgentVersion.agent_id == agent.id)
        .order_by(AgentVersion.version_number.desc())
        .all()
    )

    branch_assignments = (
        db.query(BusinessBranch)
        .join(AgentBranchAssignment, AgentBranchAssignment.branch_id == BusinessBranch.id)
        .filter(AgentBranchAssignment.agent_id == agent.id)
        .all()
    )

    recent_runs = (
        db.query(AgentRun)
        .filter(AgentRun.agent_id == agent.id)
        .order_by(AgentRun.created_at.desc())
        .limit(10)
        .all()
    )

    current_v = versions[0] if versions else None

    return {
        "id": agent.id,
        "name": agent.name,
        "description": agent.description,
        "template_key": agent.template_key,
        "status": agent.status,
        "current_version_number": agent.current_version_number,
        "instructions": current_v.instructions if current_v else "",
        "business_rules": current_v.business_rules if current_v else {},
        "allowed_actions": current_v.allowed_actions if current_v else [],
        "escalation_rules": current_v.escalation_rules if current_v else {},
        "model_config_settings": current_v.model_config_settings if current_v else {},
        "versions": [
            {
                "id": v.id,
                "version_number": v.version_number,
                "created_at": v.created_at.isoformat() if v.created_at else None,
            }
            for v in versions
        ],
        "branches": [{"id": b.id, "name": b.name, "code": b.code} for b in branch_assignments],
        "recent_runs": [
            {
                "id": r.id,
                "status": r.status,
                "latency_ms": r.latency_ms,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in recent_runs
        ],
    }


@router.put("/{agent_id}")
def update_agent(
    agent_id: str,
    req: AgentUpdateRequest,
    session: Dict[str, Any] = Depends(get_current_tenant_session),
    db: Session = Depends(get_db),
):
    """Update agent configuration or create a new immutable version."""
    org = session["organization"]
    agent = db.query(Agent).filter(Agent.id == agent_id, Agent.organization_id == org.id).first()
    if not agent:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found.")

    if req.name:
        agent.name = req.name
    if req.description is not None:
        agent.description = req.description
    if req.status:
        agent.status = req.status

    latest_v = (
        db.query(AgentVersion)
        .filter(AgentVersion.agent_id == agent.id)
        .order_by(AgentVersion.version_number.desc())
        .first()
    )

    if req.create_new_version or not latest_v:
        new_v_num = (latest_v.version_number + 1) if latest_v else 1
        new_v = AgentVersion(
            agent_id=agent.id,
            version_number=new_v_num,
            instructions=req.instructions if req.instructions is not None else (latest_v.instructions if latest_v else ""),
            business_rules=req.business_rules if req.business_rules is not None else (latest_v.business_rules if latest_v else {}),
            allowed_actions=req.allowed_actions if req.allowed_actions is not None else (latest_v.allowed_actions if latest_v else []),
            escalation_rules=req.escalation_rules if req.escalation_rules is not None else (latest_v.escalation_rules if latest_v else {}),
            model_config_settings=req.model_config_settings or (latest_v.model_config_settings if latest_v else {}),
        )
        db.add(new_v)
        agent.current_version_number = new_v_num
    else:
        # Edit draft version in-place
        if req.instructions is not None:
            latest_v.instructions = req.instructions
        if req.business_rules is not None:
            latest_v.business_rules = req.business_rules
        if req.allowed_actions is not None:
            latest_v.allowed_actions = req.allowed_actions
        if req.escalation_rules is not None:
            latest_v.escalation_rules = req.escalation_rules

    db.commit()
    return {"message": "Agent updated successfully", "version_number": agent.current_version_number}


@router.post("/{agent_id}/activate")
def activate_agent(
    agent_id: str,
    session: Dict[str, Any] = Depends(get_current_tenant_session),
    db: Session = Depends(get_db),
):
    """Activate agent for production executions."""
    org = session["organization"]
    agent = db.query(Agent).filter(Agent.id == agent_id, Agent.organization_id == org.id).first()
    if not agent:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found.")

    agent.status = "active"
    db.commit()
    return {"status": "active", "message": f"Agent '{agent.name}' is now active"}


@router.post("/{agent_id}/pause")
def pause_agent(
    agent_id: str,
    session: Dict[str, Any] = Depends(get_current_tenant_session),
    db: Session = Depends(get_db),
):
    """Pause agent from taking new executions."""
    org = session["organization"]
    agent = db.query(Agent).filter(Agent.id == agent_id, Agent.organization_id == org.id).first()
    if not agent:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found.")

    agent.status = "paused"
    db.commit()
    return {"status": "paused", "message": f"Agent '{agent.name}' paused"}


@router.delete("/{agent_id}")
def delete_agent(
    agent_id: str,
    session: Dict[str, Any] = Depends(get_current_tenant_session),
    db: Session = Depends(get_db),
):
    """Delete agent instance."""
    org = session["organization"]
    agent = db.query(Agent).filter(Agent.id == agent_id, Agent.organization_id == org.id).first()
    if not agent:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found.")

    db.delete(agent)
    db.commit()
    return {"message": "Agent deleted successfully"}
