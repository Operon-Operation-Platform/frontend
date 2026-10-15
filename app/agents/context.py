"""
Operon Multi-Tenant Context Definition
Enforces strict tenant isolation, allowed tool authorization,
data-source binding, and configuration scoping during workflow executions.
"""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class TenantContext(BaseModel):
    run_id: str = Field(..., description="Unique execution run identifier")
    organization_id: str = Field(..., description="Customer organization tenant boundary")
    agent_id: str = Field(..., description="Agent instance identifier")
    version_id: Optional[str] = Field(None, description="Active agent configuration version")
    template_key: str = Field("customer_support", description="Template type: customer_support, sales, operations")
    branch_id: Optional[str] = Field(None, description="Optional business location or department scope")
    
    # Authorized capabilities for this run
    allowed_tools: List[str] = Field(default_factory=list, description="Allowlisted tool slugs")
    data_sources: List[Dict[str, Any]] = Field(default_factory=list, description="Authorized data source configurations")
    integrations: List[Dict[str, Any]] = Field(default_factory=list, description="Authorized integration configurations")
    mcp_servers: List[Dict[str, Any]] = Field(default_factory=list, description="Connected and approved MCP servers")
    
    # Operating policies and guidelines
    instructions: str = Field("", description="System instructions and persona")
    business_rules: Dict[str, Any] = Field(default_factory=dict, description="Domain and business policy constraints")
    escalation_rules: Dict[str, Any] = Field(default_factory=dict, description="Escalation thresholds and targets")
    model_config_settings: Dict[str, Any] = Field(default_factory=dict, description="Model parameters: temperature, max_tokens, etc.")

    def is_tool_allowed(self, tool_slug: str) -> bool:
        """Verify whether this agent run has permission to invoke a specific tool."""
        # Builtin safe read tools are allowed by default if wildcard or included
        if "*" in self.allowed_tools or tool_slug in self.allowed_tools:
            return True
        return False

    def get_data_source(self, source_name_or_type: str) -> Optional[Dict[str, Any]]:
        """Resolve an authorized tenant data source by name or type."""
        for ds in self.data_sources:
            if ds.get("name") == source_name_or_type or ds.get("source_type") == source_name_or_type:
                return ds
        return None

    def get_integration(self, provider_key: str) -> Optional[Dict[str, Any]]:
        """Resolve authorized customer integration connection."""
        for integ in self.integrations:
            if integ.get("provider_key") == provider_key:
                return integ
        return None
