from sqlalchemy import (
    Column,
    Integer,
    String,
    Float,
    Boolean,
    ForeignKey,
    TIMESTAMP,
    VARCHAR,
    text,
)
from database.postgres.database import Base
from sqlalchemy.sql.expression import text
from sqlalchemy.sql import func
from sqlalchemy.sql.sqltypes import TIMESTAMP
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.ext.compiler import compiles

@compiles(ARRAY, "sqlite")
def compile_array_sqlite(type_, compiler, **kw):
    return "JSON"

@compiles(JSONB, "sqlite")
def compile_jsonb_sqlite(type_, compiler, **kw):
    return "JSON"


class User(Base):
    __tablename__ = "accounts"

    id = Column(Integer, nullable=False, primary_key=True)
    business_name = Column(String, nullable=False, unique=True)
    email = Column(String, nullable=False, unique=True)
    password = Column(String, nullable=False)
    account_tier = Column(String, nullable=False)
    sla = Column(Integer, nullable=False)
    created_at = Column(
        TIMESTAMP(timezone=True), nullable=False, server_default=func.now()
    )
    incidents = relationship("Tickets", back_populates="owner")


class Admin(Base):
    __tablename__ = "admins"

    id = Column(Integer, nullable=False, primary_key=True)
    name = Column(String, nullable=False)
    email = Column(String, nullable=False, unique=True)
    password = Column(String, nullable=False)
    role = Column(String, server_default="Admin", default="Admin", nullable=False)


class Tickets(Base):
    __tablename__ = "tickets"

    id = Column(Integer, primary_key=True, nullable=False)
    thread_id = Column(String, unique=True, index=True, nullable=True)
    user_id = Column(
        Integer, ForeignKey("accounts.id", ondelete="CASCADE"), nullable=True
    )
    account_tier = Column(String, default="Standard", nullable=False)

    # 2. Ingestion & Vision Phase (Raw Data)
    subject = Column(String, nullable=False)
    body = Column(String, nullable=False)
    ticket_safe = Column(Boolean, nullable=True)
    ticket_check_message = Column(String, nullable=True)
    image_url = Column(String, nullable=True)
    unified_ticket = Column(String, nullable=True)
    telemetry_data = Column(JSONB, nullable=True)

    department = Column(String, nullable=True)
    confidence = Column(Float, nullable=True)
    priority = Column(String, nullable=True)
    tags = Column(ARRAY(String), nullable=True)
    extracted_keywords = Column(ARRAY(String), nullable=True)
    search_query = Column(String, nullable=True)
    retrieved_docs = Column(JSONB, nullable=True)
    retries = Column(Integer, nullable=False, default=0, server_default="0")

    eval_confidence = Column(Float, nullable=True)
    has_hallucinations = Column(Boolean, nullable=True)
    grounding_source_ids = Column(ARRAY(String), nullable=True)
    eval_feedback = Column(String, nullable=True)

    ai_draft = Column(JSONB, nullable=True)
    human_decision = Column(String, nullable=True)
    human_edited_text = Column(String, nullable=True)
    final_response_text = Column(String, nullable=True)

    status = Column(String, default="QUEUED", nullable=False)
    
    email_sent = Column(Boolean, default=False, nullable=False)
    message_id = Column(String, nullable=True)
    latency = Column(Float, nullable=True)

    initial_latency = Column(Float, nullable=True)
    total_latency = Column(Float, nullable=True)

    # Timestamps
    created_at = Column(
        TIMESTAMP(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at = Column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    # Relationships
    owner = relationship("User", back_populates="incidents")
    
    # reward signal
    user_rating = Column(Integer, nullable=True)
    user_feedback_comment = Column(String, nullable=True)
    
    # engineer solution
    resolved_by = Column(String, nullable=True)
    troubleshooting_steps = Column(ARRAY(String), nullable=True)
    solution = Column(String, nullable=True)
    root_cause = Column(String, nullable=True)


class TicketDiffs(Base):
    __tablename__ = "ticket_diffs"

    id = Column(Integer, nullable=False, primary_key=True)
    ticket_id = Column(Integer, ForeignKey("tickets.id", ondelete="CASCADE"), nullable=True)
    agent_id = Column(Integer, ForeignKey("admins.id", ondelete="CASCADE"), nullable=True)
    department = Column(String, nullable=True)
    change_type = Column(VARCHAR, nullable=True)
    target_entity = Column(VARCHAR, nullable=True)
    old_value = Column(VARCHAR, nullable=True)
    new_value = Column(VARCHAR, nullable=True)
    factual_correction = Column(VARCHAR, nullable=True)
    created_at = Column(
        TIMESTAMP(timezone=True), nullable=False, server_default=func.now()
    )


# ============================================================================
# OPERON MULTI-TENANT ENTERPRISE PLATFORM SCHEMA
# ============================================================================
import uuid
from sqlalchemy import JSON


def generate_uuid() -> str:
    return str(uuid.uuid4())


class Organization(Base):
    """Customer organization/workspace tenant boundary."""
    __tablename__ = "organizations"

    id = Column(String, primary_key=True, default=generate_uuid)
    name = Column(String, nullable=False)
    slug = Column(String, nullable=False, unique=True, index=True)
    tier = Column(String, default="growth", nullable=False)  # starter, growth, enterprise
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())


class PlatformUser(Base):
    """Platform user identity across workspaces."""
    __tablename__ = "platform_users"

    id = Column(String, primary_key=True, default=generate_uuid)
    email = Column(String, nullable=False, unique=True, index=True)
    password_hash = Column(String, nullable=False)
    full_name = Column(String, nullable=False)
    avatar_url = Column(String, nullable=True)
    is_platform_admin = Column(Boolean, default=False, nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())


class OrganizationMember(Base):
    """Workspace membership and roles."""
    __tablename__ = "organization_members"

    id = Column(String, primary_key=True, default=generate_uuid)
    organization_id = Column(String, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String, ForeignKey("platform_users.id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(String, default="owner", nullable=False)  # owner, admin, member, viewer
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())


class BusinessBranch(Base):
    """Company location, branch office, or operating department."""
    __tablename__ = "business_branches"

    id = Column(String, primary_key=True, default=generate_uuid)
    organization_id = Column(String, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String, nullable=False)
    location = Column(String, nullable=True)
    code = Column(String, nullable=True)
    business_hours = Column(JSON, nullable=True)
    escalation_contact = Column(String, nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())


class AgentTemplate(Base):
    """Preconfigured agent templates: Customer Support, Sales, Operations."""
    __tablename__ = "agent_templates"

    id = Column(String, primary_key=True, default=generate_uuid)
    key = Column(String, nullable=False, unique=True, index=True)  # customer_support, sales, operations
    name = Column(String, nullable=False)
    description = Column(String, nullable=False)
    capabilities = Column(JSON, nullable=True)
    default_instructions = Column(String, nullable=True)
    default_tools = Column(JSON, nullable=True)
    default_integrations = Column(JSON, nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())


class Agent(Base):
    """Customer-created agent instances."""
    __tablename__ = "agents"

    id = Column(String, primary_key=True, default=generate_uuid)
    organization_id = Column(String, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    template_key = Column(String, default="customer_support", nullable=False)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    status = Column(String, default="active", nullable=False)  # draft, active, paused
    current_version_number = Column(Integer, default=1, nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())


class AgentVersion(Base):
    """Immutable versioned instructions, rules, and configuration for an agent."""
    __tablename__ = "agent_versions"

    id = Column(String, primary_key=True, default=generate_uuid)
    agent_id = Column(String, ForeignKey("agents.id", ondelete="CASCADE"), nullable=False, index=True)
    version_number = Column(Integer, nullable=False)
    instructions = Column(String, nullable=False)
    business_rules = Column(JSON, nullable=True)
    allowed_actions = Column(JSON, nullable=True)
    escalation_rules = Column(JSON, nullable=True)
    model_config_settings = Column(JSON, nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())


class AgentBranchAssignment(Base):
    """Links agents to specific business locations/branches."""
    __tablename__ = "agent_branch_assignments"

    id = Column(String, primary_key=True, default=generate_uuid)
    agent_id = Column(String, ForeignKey("agents.id", ondelete="CASCADE"), nullable=False, index=True)
    branch_id = Column(String, ForeignKey("business_branches.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())


class AgentRun(Base):
    """Individual workflow executions, steps, outcomes, and audit logs."""
    __tablename__ = "agent_runs"

    id = Column(String, primary_key=True, default=generate_uuid)
    organization_id = Column(String, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    agent_id = Column(String, ForeignKey("agents.id", ondelete="CASCADE"), nullable=False, index=True)
    version_id = Column(String, nullable=True)
    branch_id = Column(String, nullable=True)
    status = Column(String, default="queued", nullable=False)  # queued, running, waiting_for_approval, succeeded, failed, cancelled
    trigger_type = Column(String, default="manual", nullable=False)  # manual, webhook, schedule, event
    input_payload = Column(JSON, nullable=True)
    output_payload = Column(JSON, nullable=True)
    error_message = Column(String, nullable=True)
    latency_ms = Column(Float, nullable=True)
    token_count = Column(Integer, default=0, nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())
    completed_at = Column(TIMESTAMP(timezone=True), nullable=True)


class ExecutionStep(Base):
    """Step-by-step trace of agent execution."""
    __tablename__ = "execution_steps"

    id = Column(String, primary_key=True, default=generate_uuid)
    run_id = Column(String, ForeignKey("agent_runs.id", ondelete="CASCADE"), nullable=False, index=True)
    step_name = Column(String, nullable=False)
    status = Column(String, default="completed", nullable=False)  # started, completed, failed, paused
    input_state = Column(JSON, nullable=True)
    output_state = Column(JSON, nullable=True)
    duration_ms = Column(Float, nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())


class AgentTask(Base):
    """Work items created or managed by agents."""
    __tablename__ = "agent_tasks"

    id = Column(String, primary_key=True, default=generate_uuid)
    organization_id = Column(String, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    run_id = Column(String, ForeignKey("agent_runs.id", ondelete="SET NULL"), nullable=True, index=True)
    title = Column(String, nullable=False)
    status = Column(String, default="pending", nullable=False)  # pending, in_progress, completed, failed
    priority = Column(String, default="medium", nullable=False)  # low, medium, high, urgent
    payload = Column(JSON, nullable=True)
    outcome = Column(String, nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())


class Approval(Base):
    """First-class human-in-the-loop decisions."""
    __tablename__ = "approvals"

    id = Column(String, primary_key=True, default=generate_uuid)
    organization_id = Column(String, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    run_id = Column(String, ForeignKey("agent_runs.id", ondelete="CASCADE"), nullable=False, index=True)
    action_type = Column(String, nullable=False)  # refund, sensitive_reply, outbound_email, execute_script, deal_change
    description = Column(String, nullable=False)
    status = Column(String, default="pending", nullable=False)  # pending, approved, rejected
    payload = Column(JSON, nullable=True)
    decided_by = Column(String, nullable=True)
    decision_reason = Column(String, nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())
    decided_at = Column(TIMESTAMP(timezone=True), nullable=True)


class AuditEvent(Base):
    """Immutable audit trail for enterprise governance."""
    __tablename__ = "audit_events"

    id = Column(String, primary_key=True, default=generate_uuid)
    organization_id = Column(String, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    actor_type = Column(String, default="user", nullable=False)  # user, agent, system
    actor_id = Column(String, nullable=False)
    event_type = Column(String, nullable=False)
    details = Column(JSON, nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())


class IntegrationProvider(Base):
    """Catalog of supported integration systems."""
    __tablename__ = "integration_providers"

    id = Column(String, primary_key=True, default=generate_uuid)
    key = Column(String, nullable=False, unique=True, index=True)
    name = Column(String, nullable=False)
    category = Column(String, nullable=False)  # support, crm, communication, ops
    description = Column(String, nullable=False)
    auth_type = Column(String, default="oauth2", nullable=False)
    icon_url = Column(String, nullable=True)
    enabled = Column(Boolean, default=True, nullable=False)


class IntegrationConnection(Base):
    """Customer-authorized connection to third-party tools."""
    __tablename__ = "integration_connections"

    id = Column(String, primary_key=True, default=generate_uuid)
    organization_id = Column(String, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    provider_key = Column(String, nullable=False, index=True)
    name = Column(String, nullable=False)
    status = Column(String, default="connected", nullable=False)  # connected, error, disconnected
    config = Column(JSON, nullable=True)
    encrypted_credentials_ref = Column(String, nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())


class DataSource(Base):
    """Customer databases, vector stores, and APIs."""
    __tablename__ = "data_sources"

    id = Column(String, primary_key=True, default=generate_uuid)
    organization_id = Column(String, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String, nullable=False)
    source_type = Column(String, nullable=False)  # postgres, mysql, neo4j, vector, hybrid
    connection_ref = Column(String, nullable=True)
    schema_config = Column(JSON, nullable=True)  # allowlisted tables, schemas, read_only flag
    status = Column(String, default="ready", nullable=False)  # ready, testing, error
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())


class KnowledgeIndex(Base):
    """Retrieval configuration and document index."""
    __tablename__ = "knowledge_indexes"

    id = Column(String, primary_key=True, default=generate_uuid)
    organization_id = Column(String, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    agent_id = Column(String, ForeignKey("agents.id", ondelete="SET NULL"), nullable=True, index=True)
    name = Column(String, nullable=False)
    retrieval_mode = Column(String, default="hybrid", nullable=False)  # keyword, vector, hybrid
    config = Column(JSON, nullable=True)
    doc_count = Column(Integer, default=0, nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())


class ToolDefinition(Base):
    """Available action catalog in the Tool Registry."""
    __tablename__ = "tool_definitions"

    id = Column(String, primary_key=True, default=generate_uuid)
    name = Column(String, nullable=False)
    slug = Column(String, nullable=False, unique=True, index=True)
    description = Column(String, nullable=False)
    category = Column(String, default="builtin", nullable=False)  # builtin, integration, mcp, custom
    input_schema = Column(JSON, nullable=True)
    output_schema = Column(JSON, nullable=True)
    adapter_type = Column(String, default="builtin", nullable=False)
    requires_approval = Column(Boolean, default=False, nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())


class AgentTool(Base):
    """Tools enabled for a specific agent with permission rules."""
    __tablename__ = "agent_tools"

    id = Column(String, primary_key=True, default=generate_uuid)
    agent_id = Column(String, ForeignKey("agents.id", ondelete="CASCADE"), nullable=False, index=True)
    tool_slug = Column(String, nullable=False, index=True)
    permission_policy = Column(JSON, nullable=True)
    enabled = Column(Boolean, default=True, nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())


class MCPServer(Base):
    """Customer-configured Model Context Protocol servers."""
    __tablename__ = "mcp_servers"

    id = Column(String, primary_key=True, default=generate_uuid)
    organization_id = Column(String, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String, nullable=False)
    server_url = Column(String, nullable=False)
    transport_type = Column(String, default="sse", nullable=False)  # sse, stdio, stream
    auth_token = Column(String, nullable=True)
    status = Column(String, default="active", nullable=False)  # active, offline, error
    discovered_tools = Column(JSON, nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())


class MCPServerTool(Base):
    """Discovered tools on an MCP server with customer approval."""
    __tablename__ = "mcp_server_tools"

    id = Column(String, primary_key=True, default=generate_uuid)
    mcp_server_id = Column(String, ForeignKey("mcp_servers.id", ondelete="CASCADE"), nullable=False, index=True)
    tool_name = Column(String, nullable=False)
    schema = Column(JSON, nullable=True)
    approved = Column(Boolean, default=False, nullable=False)
    permission_policy = Column(JSON, nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())


class ToolRequest(Base):
    """Customer request for unreleased tools and connectors."""
    __tablename__ = "tool_requests"

    id = Column(String, primary_key=True, default=generate_uuid)
    organization_id = Column(String, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    agent_id = Column(String, nullable=True)
    tool_name = Column(String, nullable=False)
    description = Column(String, nullable=False)
    use_case = Column(String, nullable=False)
    status = Column(String, default="pending", nullable=False)  # pending, approved, rejected, in_development
    admin_notes = Column(String, nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())
