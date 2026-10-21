/**
 * Operon Enterprise Multi-Tenant Platform API Client
 * Connects frontend to all multi-tenant endpoints for agents,
 * integrations, data sources, tools, MCP servers, runs, and approvals.
 *
 * Token key: "operon_token" — separate from the legacy IRS token.
 */

import { API_BASE_URL } from '../config';

export class OperonApiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.name = 'OperonApiError';
    this.status = status;
    this.body = body;
  }
}

const TOKEN_KEY = 'operon_token';
const TOKEN_EXPIRY_KEY = 'operon_token_expires_at';
const TOKEN_LIFETIME_MS = 12 * 60 * 60 * 1000;

export function getOperonToken() {
  if (typeof window === 'undefined') return null;
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) {
    localStorage.removeItem(TOKEN_EXPIRY_KEY);
    return null;
  }

  const expiresAt = Number(localStorage.getItem(TOKEN_EXPIRY_KEY));
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    setOperonToken(null);
    return null;
  }

  return token;
}

export function setOperonToken(token) {
  if (typeof window === 'undefined') return;
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(TOKEN_EXPIRY_KEY, String(Date.now() + TOKEN_LIFETIME_MS));
  } else {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_EXPIRY_KEY);
  }
}

async function operonRequest(path, options = {}) {
  const { body, auth = true, expectJson = false, headers: customHeaders, ...rest } = options;
  const headers = new Headers(customHeaders);

  if (body !== undefined && !(body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  if (auth) {
    const token = getOperonToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...rest,
      headers,
      body:
        body === undefined
          ? undefined
          : body instanceof FormData
          ? body
          : JSON.stringify(body),
    });
  } catch (error) {
    const reason = error instanceof Error ? `: ${error.message}` : '';
    throw new OperonApiError(`Unable to reach the API${reason}`, 0, error);
  }

  if (!response.ok) {
    let errorBody;
    try { errorBody = await response.json(); }
    catch { errorBody = await response.text(); }
    const detail = errorBody?.detail || errorBody || response.statusText;
    throw new OperonApiError(
      typeof detail === 'string' ? detail : JSON.stringify(detail),
      response.status,
      errorBody,
    );
  }

  if (response.status === 204) return undefined;
  const ct = response.headers.get('content-type') ?? '';
  if (ct.includes('application/json') || expectJson) {
    const responseBody = await response.text();
    if (!responseBody) {
      if (expectJson) {
        throw new OperonApiError(
          `Expected a JSON response from ${path}, but the response body was empty.`,
          response.status,
          responseBody,
        );
      }
      return undefined;
    }

    try {
      return JSON.parse(responseBody);
    } catch (error) {
      throw new OperonApiError(
        `Expected a JSON response from ${path}, but received ${ct || 'an unspecified content type'}.`,
        response.status,
        error,
      );
    }
  }
  return undefined;
}

export const operonApi = {
  // Auth & Workspaces
  auth: {
    signup:          (data)    => operonRequest('/api/v1/auth/signup', { method: 'POST', body: data, auth: false, expectJson: true }),
    login:           (data)    => operonRequest('/api/v1/auth/login',  { method: 'POST', body: data, auth: false, expectJson: true }),
    getMe:           ()        => operonRequest('/api/v1/auth/me', { expectJson: true }),
    getWorkspaces:   ()        => operonRequest('/api/v1/auth/workspaces'),
    getApiKey:       ()        => operonRequest('/api/v1/auth/api-key'),
    generateApiKey:  ()        => operonRequest('/api/v1/auth/api-key', { method: 'POST' }),
    createWorkspace: (data)    => operonRequest('/api/v1/auth/workspaces', { method: 'POST', body: data }),
    switchWorkspace: (orgId)   => operonRequest(`/api/v1/auth/workspaces/${orgId}/switch`, { method: 'POST' }),
    getBranches:     ()        => operonRequest('/api/v1/auth/branches'),
    createBranch:    (data)    => operonRequest('/api/v1/auth/branches', { method: 'POST', body: data }),
    inviteMember:    (data)    => operonRequest('/api/v1/auth/invite', { method: 'POST', body: data }),
    getMembers:      ()        => operonRequest('/api/v1/auth/members'),
  },

  // Agent Builder & Versions
  agents: {
    getTemplates:      ()        => operonRequest('/api/v1/agents/templates'),
    getAgents:         ()        => operonRequest('/api/v1/agents'),
    getDashboardStats: ()        => operonRequest('/api/v1/agents/stats/dashboard'),
    getSupportedModels:()        => operonRequest('/api/v1/agents/models/supported'),
    createAgent:       (data)    => operonRequest('/api/v1/agents', { method: 'POST', body: data }),
    getAgentDetails:   (id)      => operonRequest(`/api/v1/agents/${id}`),
    getReadiness:      (id)      => operonRequest(`/api/v1/agents/${id}/readiness`),
    updateAgent:       (id, data)=> operonRequest(`/api/v1/agents/${id}`, { method: 'PUT', body: data }),
    activateAgent:     (id)      => operonRequest(`/api/v1/agents/${id}/activate`, { method: 'POST' }),
    pauseAgent:        (id)      => operonRequest(`/api/v1/agents/${id}/pause`,    { method: 'POST' }),
    deleteAgent:       (id)      => operonRequest(`/api/v1/agents/${id}`,          { method: 'DELETE' }),
    deleteConfirmed:   (id, confirmName, acknowledgePermanent) =>
      operonRequest(`/api/v1/agents/${id}/delete_confirmed`, {
        method: 'POST',
        body: { confirm_name: confirmName, acknowledge_permanent: acknowledgePermanent },
      }),
  },

  // Interactive Resumable Agent Builder (LangGraph HITL)
  builder: {
    start:       (data)    => operonRequest('/api/v1/agents/builder/start', { method: 'POST', body: data }),
    getSession:  (threadId)=> operonRequest(`/api/v1/agents/builder/session/${threadId}`),
    resume:      (threadId, data) => operonRequest(`/api/v1/agents/builder/session/${threadId}/resume`, { method: 'POST', body: data }),
    chat:        (threadId, message) => operonRequest(`/api/v1/agents/builder/session/${threadId}/chat`, { method: 'POST', body: { message } }),
    publish:     (threadId)=> operonRequest(`/api/v1/agents/builder/session/${threadId}/publish`, { method: 'POST' }),
  },

  // Truthful Agent Evaluations
  evaluations: {
    getModels:       ()        => operonRequest('/api/v1/evaluations/models'),
    getScenarios:    (agentId) => operonRequest(`/api/v1/evaluations/scenarios${agentId ? `?agent_id=${agentId}` : ''}`),
    createScenario:  (data)    => operonRequest('/api/v1/evaluations/scenarios', { method: 'POST', body: data }),
    run:             (data)    => operonRequest('/api/v1/evaluations/run', { method: 'POST', body: data }),
    getResults:      (agentId) => operonRequest(`/api/v1/evaluations/results${agentId ? `?agent_id=${agentId}` : ''}`),
    getSummary:      (agentId) => operonRequest(`/api/v1/evaluations/summary/${agentId}`),
  },

  // Integrations Catalog & Authorized Connections
  integrations: {
    getCatalog:      (agentType) => operonRequest(`/api/v1/integrations/catalog${agentType ? `?agent_type=${agentType}` : ''}`),
    getConnections:  ()          => operonRequest('/api/v1/integrations/connections'),
    connect:         (data)      => operonRequest('/api/v1/integrations/connect',         { method: 'POST', body: data }),
    test:            (data)      => operonRequest('/api/v1/integrations/test',            { method: 'POST', body: data }),
    disconnect:      (id)        => operonRequest(`/api/v1/integrations/connections/${id}`, { method: 'DELETE' }),
  },

  // Customer Data Sources & Knowledge Retrieval
  dataSources: {
    getDataSources:       ()     => operonRequest('/api/v1/datasources'),
    connectDataSource:    (data) => operonRequest('/api/v1/datasources',          { method: 'POST', body: data }),
    testDataSource:       (data) => operonRequest('/api/v1/datasources/test',     { method: 'POST', body: data }),
    deleteDataSource:     (id)   => operonRequest(`/api/v1/datasources/${id}`,    { method: 'DELETE' }),
    getKnowledgeIndexes:  ()     => operonRequest('/api/v1/datasources/knowledge'),
    createKnowledgeIndex: (data) => operonRequest('/api/v1/datasources/knowledge', { method: 'POST', body: data }),
    deleteKnowledgeIndex: (id)   => operonRequest(`/api/v1/datasources/knowledge/${id}`, { method: 'DELETE' }),
    uploadDocument:       (data) => operonRequest('/api/v1/datasources/upload',    { method: 'POST', body: data }),
    testQuery:            (data) => operonRequest('/api/v1/datasources/query',     { method: 'POST', body: data }),
  },

  // Tool Registry & Model Context Protocol (MCP)
  toolsAndMcp: {
    getTools:         (cat)      => operonRequest(`/api/v1/mcp/tools${cat ? `?category=${cat}` : ''}`),
    requestTool:      (data)     => operonRequest('/api/v1/mcp/tools/request',   { method: 'POST', body: data }),
    getToolRequests:  ()         => operonRequest('/api/v1/mcp/tools/requests'),
    getMcpServers:    ()         => operonRequest('/api/v1/mcp/servers'),
    connectMcpServer: (data)     => operonRequest('/api/v1/mcp/servers/connect', { method: 'POST', body: data }),
    disconnectMcpServer: (id)    => operonRequest(`/api/v1/mcp/servers/${id}`, { method: 'DELETE' }),
    approveMcpTool:   (sId, tId, approved, policy) =>
      operonRequest(`/api/v1/mcp/servers/${sId}/tools/${tId}/approve`, {
        method: 'POST', body: { approved, permission_policy: policy },
      }),
    callNativeMcpServer: (payload) => operonRequest('/api/v1/mcp/operon-server', { method: 'POST', body: payload }),
  },

  // Workflow Runs & Live Traces
  runs: {
    triggerRun:    (data)    => operonRequest('/api/v1/runs/trigger', { method: 'POST', body: data }),
    getRuns:       (params={}) => {
      const q = new URLSearchParams();
      if (params.agent_id) q.set('agent_id', params.agent_id);
      if (params.status)   q.set('status_filter', params.status);
      return operonRequest(`/api/v1/runs${q.toString() ? `?${q}` : ''}`);
    },
    getRunDetails: (id)      => operonRequest(`/api/v1/runs/${id}`),
    cancelRun:     (id)      => operonRequest(`/api/v1/runs/${id}/cancel`, { method: 'POST' }),
  },

  // Human-in-the-Loop Approvals
  approvals: {
    getApprovals: (status) => operonRequest(`/api/v1/approvals${status ? `?status_filter=${status}` : ''}`),
    decide: (id, decision, reason, editedPayload) =>
      operonRequest(`/api/v1/approvals/${id}/decide`, {
        method: 'POST',
        body: { decision, reason, edited_payload: editedPayload },
      }),
  },

  // Platform Owner Admin Console
  platformAdmin: {
    getStats:         ()              => operonRequest('/api/v1/platform-admin/stats'),
    getTenants:       ()              => operonRequest('/api/v1/platform-admin/tenants'),
    getToolRequests:  ()              => operonRequest('/api/v1/platform-admin/tool-requests'),
    decideToolRequest:(id, decision, notes) =>
      operonRequest(`/api/v1/platform-admin/tool-requests/${id}/decide`, {
        method: 'POST', body: { decision, admin_notes: notes },
      }),
  },
};
