"""
Model Context Protocol (MCP) JSON-RPC 2.0 Specification Implementation
Standard protocol types for tool discovery, tool invocation, and resource access.
"""

from typing import Any, Dict, List, Optional, Union
from pydantic import BaseModel, Field


class MCPRequest(BaseModel):
    jsonrpc: str = "2.0"
    id: Union[str, int]
    method: str
    params: Optional[Dict[str, Any]] = None


class MCPResponse(BaseModel):
    jsonrpc: str = "2.0"
    id: Union[str, int]
    result: Optional[Any] = None
    error: Optional[Dict[str, Any]] = None


class MCPToolParameterSchema(BaseModel):
    type: str = "object"
    properties: Dict[str, Any] = Field(default_factory=dict)
    required: Optional[List[str]] = None


class MCPToolInfo(BaseModel):
    name: str
    description: str
    inputSchema: Dict[str, Any]


class MCPInitializeResult(BaseModel):
    protocolVersion: str = "2024-11-05"
    capabilities: Dict[str, Any] = Field(default_factory=lambda: {"tools": {"listChanged": True}})
    serverInfo: Dict[str, str] = Field(default_factory=lambda: {"name": "Operon-MCP-Platform", "version": "1.0.0"})


class MCPToolCallRequest(BaseModel):
    name: str
    arguments: Dict[str, Any] = Field(default_factory=dict)


class MCPToolCallResult(BaseModel):
    content: List[Dict[str, Any]] = Field(default_factory=list)
    isError: bool = False
