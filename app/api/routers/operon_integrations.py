"""
Operon Integrations Router
Manages third-party connector authorizations, scoped credentials, and connection validation.
"""

import os
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database.postgres.database import get_db
from database.postgres.models import (
    IntegrationProvider,
    IntegrationConnection,
)
from api.routers.operon_auth import get_current_tenant_session

router = APIRouter(prefix="/api/v1/integrations", tags=["Operon Integrations"])


# Pre-populated provider catalog
CATALOG_PROVIDERS = [
    {
        "key": "zendesk",
        "name": "Zendesk",
        "category": "support",
        "description": "Bi-directional ticket syncing, tags, macro triggers, and customer lookup.",
        "auth_type": "api_key",
        "icon": "zendesk",
        "environment_variables": ["ZENDESK_SUBDOMAIN", "ZENDESK_EMAIL", "ZENDESK_API_TOKEN"],
    },
    {
        "key": "intercom",
        "name": "Intercom",
        "category": "support",
        "description": "Live chat conversation sync, customer attribute enrichment, and inbox management.",
        "auth_type": "oauth2",
        "icon": "intercom",
        "environment_variables": ["INTERCOM_ACCESS_TOKEN"],
    },
    {
        "key": "email",
        "name": "Corporate Email (IMAP/SMTP)",
        "category": "support",
        "description": "Inbound support email ingestion and verified outbound response dispatch.",
        "auth_type": "smtp",
        "icon": "email",
        "environment_variables": ["SMTP_HOST", "SMTP_PORT", "SMTP_USERNAME", "SMTP_PASSWORD"],
    },
    {
        "key": "freshdesk",
        "name": "Freshdesk",
        "category": "support",
        "description": "Help-desk ticket lookup, status updates, and customer support history.",
        "auth_type": "api_key",
        "icon": "freshdesk",
        "environment_variables": ["FRESHDESK_DOMAIN", "FRESHDESK_API_KEY"],
    },
    {
        "key": "hubspot",
        "name": "HubSpot CRM",
        "category": "crm",
        "description": "Lead status updates, deal progression, timeline event logging, and contact scoring.",
        "auth_type": "oauth2",
        "icon": "hubspot",
        "environment_variables": ["HUBSPOT_ACCESS_TOKEN"],
    },
    {
        "key": "salesforce",
        "name": "Salesforce",
        "category": "crm",
        "description": "Enterprise account, lead, and opportunity object synchronization.",
        "auth_type": "oauth2",
        "icon": "salesforce",
        "environment_variables": ["SALESFORCE_INSTANCE_URL", "SALESFORCE_ACCESS_TOKEN"],
    },
    {
        "key": "pipedrive",
        "name": "Pipedrive",
        "category": "crm",
        "description": "Lead and deal lookup, activity tracking, and pipeline updates.",
        "auth_type": "api_key",
        "icon": "pipedrive",
        "environment_variables": ["PIPEDRIVE_API_TOKEN"],
    },
    {
        "key": "linkedin",
        "name": "LinkedIn",
        "category": "crm",
        "description": "Company and professional profile enrichment for sales prospect research.",
        "auth_type": "oauth2",
        "icon": "linkedin",
        "environment_variables": ["LINKEDIN_ACCESS_TOKEN"],
    },
    {
        "key": "slack",
        "name": "Slack Enterprise",
        "category": "communication",
        "description": "Channel notifications, incident war room alerts, and interactive approvals.",
        "auth_type": "oauth2",
        "icon": "slack",
        "environment_variables": ["SLACK_BOT_TOKEN"],
    },
    {
        "key": "microsoft_teams",
        "name": "Microsoft Teams",
        "category": "communication",
        "description": "Post support, sales, and incident notifications to authorized team channels.",
        "auth_type": "oauth2",
        "icon": "microsoft_teams",
        "environment_variables": ["TEAMS_WEBHOOK_URL"],
    },
    {
        "key": "jira",
        "name": "Jira Software",
        "category": "ops",
        "description": "Automated incident bug escalation, SLA tracking, and sprint task creation.",
        "auth_type": "api_key",
        "icon": "jira",
        "environment_variables": ["JIRA_BASE_URL", "JIRA_EMAIL", "JIRA_API_TOKEN"],
    },
    {
        "key": "datadog",
        "name": "Datadog / APM",
        "category": "ops",
        "description": "Infrastructure alert webhook ingestion and metric threshold tracking.",
        "auth_type": "api_key",
        "icon": "datadog",
        "environment_variables": ["DATADOG_API_KEY", "DATADOG_APP_KEY"],
    },
    {
        "key": "pagerduty",
        "name": "PagerDuty",
        "category": "ops",
        "description": "Incident alert ingestion, on-call schedules, and escalation policies.",
        "auth_type": "api_key",
        "icon": "pagerduty",
        "environment_variables": ["PAGERDUTY_API_KEY"],
    },
    {
        "key": "grafana",
        "name": "Grafana",
        "category": "ops",
        "description": "Read dashboards, alert rules, and service telemetry for incident diagnosis.",
        "auth_type": "api_key",
        "icon": "grafana",
        "environment_variables": ["GRAFANA_URL", "GRAFANA_API_KEY"],
    },
    {
        "key": "prometheus",
        "name": "Prometheus",
        "category": "ops",
        "description": "Query approved metrics and alert time series during incident response.",
        "auth_type": "bearer_token",
        "icon": "prometheus",
        "environment_variables": ["PROMETHEUS_URL", "PROMETHEUS_BEARER_TOKEN"],
    },
]


def provider_catalog_entry(provider: Dict[str, Any]) -> Dict[str, Any]:
    environment_variables = provider.get("environment_variables", [])
    return {
        **provider,
        "configured": bool(environment_variables) and all(os.getenv(name) for name in environment_variables),
    }


from services.integration_service import IntegrationService, INTEGRATION_CATALOG
from services.secret_vault import redact_secrets


@router.get("/catalog")
def get_catalog(agent_type: Optional[str] = None):
    """Retrieve connector catalog with full field definitions and tools."""
    catalog = IntegrationService.get_catalog()
    if agent_type == "customer_support":
        providers = [p for p in catalog if p["category"] in ["Customer Support", "Communication"]]
    elif agent_type == "sales":
        providers = [p for p in catalog if p["category"] in ["Sales & CRM", "Communication"]]
    elif agent_type == "operations":
        providers = [p for p in catalog if p["category"] in ["Operations", "Communication"]]
    else:
        providers = catalog

    return [
        {
            **p,
            "configured": bool(os.getenv(f"{p['key'].upper()}_API_KEY") or os.getenv(f"{p['key'].upper()}_TOKEN")),
        }
        for p in providers
    ]


@router.get("/connections")
def list_connections(
    session: Dict[str, Any] = Depends(get_current_tenant_session),
    db: Session = Depends(get_db),
):
    """List connected third-party integrations for this workspace without leaking secrets."""
    org = session["organization"]
    connections = (
        db.query(IntegrationConnection)
        .filter(IntegrationConnection.organization_id == org.id)
        .all()
    )
    return [
        {
            "id": c.id,
            "provider_key": c.provider_key,
            "name": c.name,
            "status": c.status,
            "config": redact_secrets(c.config or {}),
            "created_at": c.created_at.isoformat() if c.created_at else None,
        }
        for c in connections
    ]


@router.post("/connect", status_code=status.HTTP_201_CREATED)
async def connect_integration(
    req: ConnectIntegrationRequest,
    session: Dict[str, Any] = Depends(get_current_tenant_session),
):
    """Connect, validate, encrypt credentials, and save an integration connection."""
    org = session["organization"]
    credentials = req.credentials or req.config or {}

    res = await IntegrationService.test_and_save_connection(
        organization_id=org.id,
        provider_key=req.provider_key,
        name=req.name,
        credentials=credentials,
    )

    if not res["success"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=res.get("error", "Integration connectivity check failed."),
        )

    return {
        "id": res["connection_id"],
        "provider_key": res["provider_key"],
        "name": res["name"],
        "status": res["status"],
        "tools_available": res.get("tools_available", []),
        "message": f"Successfully connected {res['name']}.",
    }


@router.post("/test")
async def test_integration_connection(
    req: ConnectIntegrationRequest,
    session: Dict[str, Any] = Depends(get_current_tenant_session),
):
    """Validate credentials with truthful testing and bounded retries."""
    org = session["organization"]
    credentials = req.credentials or req.config or {}

    res = await IntegrationService.test_and_save_connection(
        organization_id=org.id,
        provider_key=req.provider_key,
        name=req.name,
        credentials=credentials,
    )

    return {
        "success": res["success"],
        "provider_key": req.provider_key,
        "status": "HEALTHY" if res["success"] else "FAILED",
        "error": res.get("error"),
        "message": f"Connection to {req.provider_key} verified successfully." if res["success"] else res.get("error"),
    }



@router.delete("/connections/{conn_id}")
def delete_connection(
    conn_id: str,
    session: Dict[str, Any] = Depends(get_current_tenant_session),
    db: Session = Depends(get_db),
):
    """Disconnect and remove integration connection."""
    org = session["organization"]
    conn = (
        db.query(IntegrationConnection)
        .filter(IntegrationConnection.id == conn_id, IntegrationConnection.organization_id == org.id)
        .first()
    )
    if not conn:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Connection not found.")

    db.delete(conn)
    db.commit()
    return {"message": "Integration disconnected successfully"}
