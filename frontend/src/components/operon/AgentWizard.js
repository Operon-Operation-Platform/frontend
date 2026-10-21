"use client";

import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  Bot,
  Sparkles,
  Layers,
  Database,
  Server,
  Play,
  Save,
  HelpCircle,
  AlertTriangle,
  Zap,
  ShieldCheck,
  Check,
  Plus,
  RefreshCw,
  Clock,
  Terminal,
} from 'lucide-react';
import { operonApi } from '../../api/operon';

const STEPS = [
  { id: 1, label: "Template", icon: Bot },
  { id: 2, label: "Define Agent", icon: Sparkles },
  { id: 3, label: "Integrations", icon: Layers },
  { id: 4, label: "Data & Knowledge", icon: Database },
  { id: 5, label: "Tools & MCP", icon: Server },
  { id: 6, label: "Test & Activate", icon: Play },
];

export default function AgentWizard({ onClose, onAgentCreated, onCreated }) {
  // Support both prop names
  const handleAgentCreated = onCreated || onAgentCreated;
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [metadataLoading, setMetadataLoading] = useState(true);
  const [metadataErrors, setMetadataErrors] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [branches, setBranches] = useState([]);

  // Wizard Form State
  const [selectedTemplate, setSelectedTemplate] = useState('customer_support');
  const [agentName, setAgentName] = useState('');
  const [agentDescription, setAgentDescription] = useState('');
  const [instructions, setInstructions] = useState('');
  const [businessHours, setBusinessHours] = useState('24/7');
  const [escalationContact, setEscalationContact] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('');
  
  // Integrations state
  const [integrationsCatalog, setIntegrationsCatalog] = useState([]);
  const [enabledIntegrations, setEnabledIntegrations] = useState([]);

  // Data Source & Knowledge state
  const [dbType, setDbType] = useState('postgres');
  const [retrievalMode, setRetrievalMode] = useState('hybrid');
  const [allowlistedTables, setAllowlistedTables] = useState('');
  const [readOnlyDb, setReadOnlyDb] = useState(true);

  // Tools & MCP state
  const [availableTools, setAvailableTools] = useState([]);
  const [enabledTools, setEnabledTools] = useState([]);
  const [mcpServerUrl, setMcpServerUrl] = useState('');
  const [discoveredMcpTools, setDiscoveredMcpTools] = useState([]);
  const [showToolRequestModal, setShowToolRequestModal] = useState(false);
  const [toolRequestForm, setToolRequestForm] = useState({ name: '', description: '', use_case: '' });

  // Test & Activate state
  const [testInput, setTestInput] = useState({ subject: "", body: "", account_tier: "" });
  const [testResult, setTestResult] = useState(null);
  const [testLoading, setTestLoading] = useState(false);

  const loadInitialData = useCallback(async () => {
    setMetadataLoading(true);
    const results = await Promise.allSettled([
        operonApi.agents.getTemplates(),
        operonApi.auth.getBranches(),
        operonApi.toolsAndMcp.getTools(),
    ]);
    const errors = [];

    if (results[0].status === 'fulfilled') {
      const templateList = results[0].value || [];
      setTemplates(templateList);
      const currentTemplate = templateList.find((template) => template.key === selectedTemplate);
      if (currentTemplate) {
        setAgentName((current) => current || currentTemplate.name);
        setAgentDescription((current) => current || currentTemplate.description);
        setInstructions((current) => current || currentTemplate.default_instructions);
        setEnabledTools((current) => current.length ? current : currentTemplate.default_tools || []);
        setEnabledIntegrations(currentTemplate.recommended_integrations || []);
      }
    } else {
      errors.push(`Agent templates: ${results[0].reason?.message || 'Unable to load templates.'}`);
    }

    if (results[1].status === 'fulfilled') {
      setBranches(results[1].value || []);
    } else {
      errors.push(`Branches: ${results[1].reason?.message || 'Unable to load branches.'}`);
    }

    if (results[2].status === 'fulfilled') {
      setAvailableTools(results[2].value || []);
    } else {
      errors.push(`Tools: ${results[2].reason?.message || 'Unable to load tools.'}`);
    }
    setMetadataErrors((current) => [
      ...current.filter((message) => message.startsWith('Integrations:')),
      ...errors,
    ]);
    setMetadataLoading(false);
  }, [selectedTemplate]);

  const loadIntegrationCatalog = useCallback(async () => {
    setIntegrationsCatalog([]);
    setMetadataErrors((current) => current.filter((message) => !message.startsWith('Integrations:')));
    try {
      const catalog = await operonApi.integrations.getCatalog(selectedTemplate);
      setIntegrationsCatalog(catalog || []);
      setMetadataErrors((current) => current.filter((message) => !message.startsWith('Integrations:')));
    } catch (error) {
      setMetadataErrors((current) => [
        ...current.filter((message) => !message.startsWith('Integrations:')),
        `Integrations: ${error.message || 'Unable to load integrations.'}`,
      ]);
    }
  }, [selectedTemplate]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  useEffect(() => {
    loadIntegrationCatalog();
  }, [loadIntegrationCatalog]);

  const handleTemplateSelect = (tmplKey) => {
    setSelectedTemplate(tmplKey);
    const tmpl = templates.find((t) => t.key === tmplKey);
    if (tmpl) {
      setAgentName(tmpl.name);
      setAgentDescription(tmpl.description);
      setInstructions(tmpl.default_instructions);
      setEnabledTools(tmpl.default_tools || []);
      setEnabledIntegrations(tmpl.recommended_integrations || []);
    }
  };

  const toggleTool = (slug) => {
    if (enabledTools.includes(slug)) {
      setEnabledTools(enabledTools.filter((t) => t !== slug));
    } else {
      setEnabledTools([...enabledTools, slug]);
    }
  };

  const handleConnectMcp = async () => {
    if (!mcpServerUrl) return;
    setLoading(true);
    try {
      const res = await operonApi.toolsAndMcp.connectMcpServer({
        name: "External-MCP-Node",
        server_url: mcpServerUrl,
        transport_type: "sse",
      });
      setDiscoveredMcpTools(res.discovered_tools || []);
    } catch (e) {
      alert("Error connecting to MCP server: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRunTest = async () => {
    setTestLoading(true);
    setTestResult(null);
    setTestResult({ status: "unavailable", error: "Save the agent before running a test. Test executions require a persisted agent and a live runtime." });
    setTestLoading(false);
  };

  const handleSaveAndActivate = async (status = "active") => {
    setLoading(true);
    try {
      const payload = {
        template_key: selectedTemplate,
        name: agentName || "My New Agent",
        description: agentDescription,
        instructions: instructions,
        business_rules: {
          business_hours: businessHours,
          escalation_contact: escalationContact,
        },
        allowed_actions: enabledTools,
        escalation_rules: {
          sla_hours: 2,
          l3_target: "jira",
        },
        model_config_settings: {
          model: "llama-3-70b",
          temperature: 0.2,
          integration_keys: enabledIntegrations,
        },
        branch_ids: selectedBranch ? [selectedBranch] : [],
        status: status,
      };

      await operonApi.agents.createAgent(payload);
      handleAgentCreated?.();
      onClose();
    } catch (e) {
      alert("Failed to save agent: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  // Parent renders conditionally — no isOpen guard needed

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-slate-100">
        {/* Wizard Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Agent Setup Engine</h2>
              <p className="text-xs text-slate-400">Shared multi-tenant runtime across Help Desk, Sales, and Incident Response</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Navigation Bar */}
        <div className="px-6 py-3 bg-slate-950/40 border-b border-slate-800 flex items-center justify-between overflow-x-auto gap-2">
          {STEPS.map((s) => {
            const Icon = s.icon;
            const isActive = currentStep === s.id;
            const isDone = currentStep > s.id;
            return (
              <button
                key={s.id}
                onClick={() => setCurrentStep(s.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition whitespace-nowrap ${
                  isActive
                    ? "bg-cyan-500/15 text-cyan-400 border border-cyan-500/30"
                    : isDone
                    ? "text-emerald-400 hover:bg-slate-800"
                    : "text-slate-400 hover:text-white hover:bg-slate-800/60"
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold ${
                    isActive ? "bg-cyan-500 text-slate-950" : isDone ? "bg-emerald-500 text-slate-950" : "bg-slate-800 text-slate-400"
                  }`}
                >
                  {isDone ? <Check className="w-3 h-3 stroke-[3]" /> : s.id}
                </div>
                <span>{s.label}</span>
              </button>
            );
          })}
        </div>

        {/* Wizard Step Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {metadataErrors.length > 0 && (
            <div role="alert" className="rounded-xl border border-amber-500/30 bg-amber-950/30 p-3 text-xs text-amber-200">
              <p className="font-semibold">Some setup options could not be loaded.</p>
              <ul className="mt-1 list-disc pl-5">
                {metadataErrors.map((message) => <li key={message}>{message}</li>)}
              </ul>
              <button
                type="button"
                onClick={() => {
                  loadInitialData();
                  loadIntegrationCatalog();
                }}
                className="mt-2 font-semibold underline underline-offset-2"
              >
                Retry loading options
              </button>
            </div>
          )}

          {/* STEP 1: CHOOSE TEMPLATE */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-bold text-white">Step 1 — Choose Agent Archetype</h3>
                <p className="text-sm text-slate-400">
                  Select a starter template with preconfigured integrations, tool catalogs, and default policies.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                {metadataLoading && templates.length === 0 ? (
                  <p className="md:col-span-3 text-sm text-slate-400">Loading agent templates…</p>
                ) : templates.length === 0 ? (
                  <p className="md:col-span-3 text-sm text-amber-300">No agent templates are available. Check that the API is running and try reloading.</p>
                ) : templates.map((tmpl) => {
                  const isSelected = selectedTemplate === tmpl.key;
                  return (
                    <div
                      key={tmpl.key}
                      onClick={() => handleTemplateSelect(tmpl.key)}
                      className={`cursor-pointer rounded-xl p-5 border transition flex flex-col justify-between ${
                        isSelected
                          ? "bg-cyan-950/20 border-cyan-500 ring-2 ring-cyan-500/20"
                          : "bg-slate-800/40 border-slate-800 hover:border-slate-700 hover:bg-slate-800/60"
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-xs font-semibold uppercase px-2 py-0.5 rounded bg-slate-800 text-cyan-400 border border-slate-700">
                            {tmpl.key.replace('_', ' ')}
                          </span>
                          {isSelected && <CheckCircle2 className="w-5 h-5 text-cyan-400" />}
                        </div>
                        <h4 className="font-bold text-white text-base mb-1.5">{tmpl.name}</h4>
                        <p className="text-xs text-slate-400 leading-relaxed mb-4">{tmpl.description}</p>
                        
                        <div className="space-y-1.5 border-t border-slate-800/80 pt-3">
                          <div className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">Capabilities:</div>
                          {tmpl.capabilities?.slice(0, 3).map((cap, i) => (
                            <div key={i} className="text-xs text-slate-300 flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
                              <span>{cap}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-800/80 text-[11px] text-slate-400">
                        <span className="font-semibold text-slate-300">Metric:</span> {tmpl.success_metric}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 2: DEFINE THE AGENT */}
          {currentStep === 2 && (
            <div className="space-y-4 max-w-3xl">
              <div>
                <h3 className="text-lg font-bold text-white">Step 2 — Define Agent Persona & Rules</h3>
                <p className="text-sm text-slate-400">
                  Tailor the agent's objective, operating instructions, and escalation policies.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5">Agent Name</label>
                  <input
                    type="text"
                    value={agentName}
                    onChange={(e) => setAgentName(e.target.value)}
                    placeholder="e.g. Customer Support Agent"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:border-cyan-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5">Objective / Description</label>
                  <input
                    type="text"
                    value={agentDescription}
                    onChange={(e) => setAgentDescription(e.target.value)}
                    placeholder="Brief description of the agent's business role"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:border-cyan-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5">Operating Instructions (System Prompt)</label>
                  <textarea
                    rows={5}
                    value={instructions}
                    onChange={(e) => setInstructions(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:border-cyan-500 focus:outline-none font-mono"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5">Business Hours</label>
                    <select
                      value={businessHours}
                      onChange={(e) => setBusinessHours(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:border-cyan-500 focus:outline-none"
                    >
                      <option value="24/7">24/7 Continuous Operation</option>
                      <option value="9am-5pm-est">Business Hours (9 AM - 5 PM EST)</option>
                      <option value="weekend-only">Off-Hours & Weekend Coverage</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5">Business Branch Assignment</label>
                    <select
                      value={selectedBranch}
                      onChange={(e) => setSelectedBranch(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:border-cyan-500 focus:outline-none"
                    >
                      <option value="">All Branches (Global)</option>
                      {branches.map((b) => (
                        <option key={b.id} value={b.id}>{b.name} ({b.code || 'LOC'})</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: CONNECT INTEGRATIONS */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-bold text-white">Step 3 — Authorize Integrations</h3>
                <p className="text-sm text-slate-400">
                  Choose the integrations this agent can use. Credentials are configured on the backend and never sent to the browser.
                </p>
              </div>

              <p className="text-xs text-slate-500">
                Selected integrations are saved with this agent. Add the listed environment variables to the backend environment to enable each provider.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
                {integrationsCatalog.length === 0 ? (
                  <p className="sm:col-span-2 lg:col-span-3 text-sm text-slate-400">
                    {metadataErrors.some((message) => message.startsWith('Integrations:'))
                      ? "Integration options couldn't be loaded. Use “Retry loading options” above."
                      : "Loading integrations for this agent type…"}
                  </p>
                ) : integrationsCatalog.map((item) => {
                  const isEnabled = enabledIntegrations.includes(item.key);
                  return (
                    <div
                      key={item.key}
                      className={`p-4 rounded-xl border transition flex flex-col justify-between ${
                        isEnabled ? "bg-slate-800/80 border-cyan-500/50" : "bg-slate-800/30 border-slate-800"
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-bold text-white text-sm">{item.name}</h4>
                          <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-slate-900 text-slate-400">
                            {item.auth_type}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mb-4">{item.description}</p>
                        {item.environment_variables?.length > 0 && (
                          <div className="mb-3">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                              Backend environment
                            </p>
                            <p className="mt-1 break-words font-mono text-[10px] text-slate-400">
                              {item.environment_variables.join(", ")}
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                        <button
                          onClick={() => {
                            if (isEnabled) setEnabledIntegrations(enabledIntegrations.filter(k => k !== item.key));
                            else setEnabledIntegrations([...enabledIntegrations, item.key]);
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                            isEnabled
                              ? "bg-cyan-500 text-slate-950 hover:bg-cyan-400"
                              : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                          }`}
                        >
                          {isEnabled ? "Selected" : "Select"}
                        </button>
                        {isEnabled && (
                          <span className={`text-[11px] flex items-center gap-1 font-medium ${item.configured ? "text-emerald-400" : "text-amber-300"}`}>
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            {item.configured ? "Environment ready" : "Needs configuration"}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 4: CONFIGURE KNOWLEDGE & DATA */}
          {currentStep === 4 && (
            <div className="space-y-5 max-w-3xl">
              <div>
                <h3 className="text-lg font-bold text-white">Step 4 — Customer Data Sources & Knowledge</h3>
                <p className="text-sm text-slate-400">
                  Strictly separate Operon platform DB from your company database. Configure read-only table allowlists and hybrid retrieval.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-4">
                <div className="flex items-center gap-2 text-cyan-400 text-xs font-bold uppercase tracking-wider">
                  <Database className="w-4 h-4" />
                  Database Connection Configuration
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5">Database System</label>
                    <select
                      value={dbType}
                      onChange={(e) => setDbType(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white text-sm focus:border-cyan-500 focus:outline-none"
                    >
                      <option value="postgres">PostgreSQL (Relational Customer Data)</option>
                      <option value="neo4j">Neo4j (Knowledge Graph & Entity Relations)</option>
                      <option value="pgvector">PostgreSQL with pgvector</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5">Knowledge Retrieval Mode</label>
                    <select
                      value={retrievalMode}
                      onChange={(e) => setRetrievalMode(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white text-sm focus:border-cyan-500 focus:outline-none"
                    >
                      <option value="hybrid">Hybrid Retrieval (BM25 + Dense RRF)</option>
                      <option value="vector">Vector Similarity Only</option>
                      <option value="keyword">Sparse BM25 Keyword Search</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5">Allowlisted Tables & Columns</label>
                  <input
                    type="text"
                    value={allowlistedTables}
                    onChange={(e) => setAllowlistedTables(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white text-sm font-mono focus:border-cyan-500 focus:outline-none"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">The agent is only permitted to query these allowlisted tables via parameterized queries.</p>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <input
                    type="checkbox"
                    id="readonly_check"
                    checked={readOnlyDb}
                    onChange={(e) => setReadOnlyDb(e.target.checked)}
                    className="w-4 h-4 rounded text-cyan-500 bg-slate-900 border-slate-700"
                  />
                  <label htmlFor="readonly_check" className="text-xs text-slate-300 font-medium">
                    Enforce Read-Only Database Role (Prevents unintended table alterations or writes)
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: TOOLS & MCP SERVERS */}
          {currentStep === 5 && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-white">Step 5 — Tools & Model Context Protocol (MCP)</h3>
                  <p className="text-sm text-slate-400">
                    Enable approved built-in actions or connect remote MCP servers with explicit human approval policies.
                  </p>
                </div>
                <button
                  onClick={() => setShowToolRequestModal(true)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 hover:bg-slate-700 text-xs font-medium text-slate-200 flex items-center gap-1.5 transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Request a Tool
                </button>
              </div>

              {/* Tools Catalog Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {availableTools.map((tool) => {
                  const isChecked = enabledTools.includes(tool.slug);
                  return (
                    <div
                      key={tool.slug}
                      onClick={() => toggleTool(tool.slug)}
                      className={`p-3.5 rounded-xl border cursor-pointer transition ${
                        isChecked ? "bg-slate-800/80 border-cyan-500/50" : "bg-slate-800/20 border-slate-800 hover:border-slate-700"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-bold text-xs text-white">{tool.name}</span>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          className="w-4 h-4 rounded text-cyan-500 bg-slate-900"
                        />
                      </div>
                      <p className="text-[11px] text-slate-400 line-clamp-2">{tool.description}</p>
                      {tool.requires_approval && (
                        <div className="mt-2 text-[10px] font-semibold text-amber-400 flex items-center gap-1">
                          <ShieldCheck className="w-3 h-3" /> Approval Required
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Connect MCP Server Section */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
                <div className="flex items-center gap-2 text-rose-400 text-xs font-bold uppercase tracking-wider">
                  <Server className="w-4 h-4" />
                  Connect External Model Context Protocol (MCP) Server
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={mcpServerUrl}
                    onChange={(e) => setMcpServerUrl(e.target.value)}
                    placeholder="e.g. http://localhost:8001/mcp or sse://api.your-company.com/mcp"
                    className="flex-1 px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs font-mono focus:border-cyan-500 focus:outline-none"
                  />
                  <button
                    onClick={handleConnectMcp}
                    disabled={loading || !mcpServerUrl}
                    className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-semibold transition"
                  >
                    Discover Tools
                  </button>
                </div>

                {discoveredMcpTools.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-800 space-y-2">
                    <div className="text-xs font-semibold text-slate-300">Discovered MCP Tools (Requires Explicit Approval):</div>
                    {discoveredMcpTools.map((t, i) => (
                      <div key={i} className="flex items-center justify-between p-2 rounded bg-slate-900 text-xs border border-slate-800">
                        <span className="font-mono text-cyan-300">{t.name}</span>
                        <button
                          onClick={() => {
                            const updated = [...discoveredMcpTools];
                            updated[i].approved = !updated[i].approved;
                            setDiscoveredMcpTools(updated);
                          }}
                          className={`px-2.5 py-1 rounded text-[11px] font-semibold transition ${
                            t.approved ? "bg-emerald-600 text-white" : "bg-slate-800 text-slate-400 hover:text-white"
                          }`}
                        >
                          {t.approved ? "Approved" : "Approve Tool"}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 6: TEST AND ACTIVATE */}
          {currentStep === 6 && (
            <div className="space-y-5">
              <div>
                <h3 className="text-lg font-bold text-white">Step 6 — Test Sandbox & Activation</h3>
                <p className="text-sm text-slate-400">
                  Run an end-to-end test ticket through the agent, inspect the step trace, and activate immutable version 1.
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Test Input Editor */}
                <div className="p-4 rounded-xl bg-white dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center justify-between">
                    <span>Test Inquiry Payload</span>
                    <span className="text-slate-500 font-mono">POST /runs/trigger</span>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">Subject</label>
                    <input
                      type="text"
                      value={testInput.subject}
                      onChange={(e) => setTestInput({ ...testInput, subject: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-xs focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">Body</label>
                    <textarea
                      rows={4}
                      value={testInput.body}
                      onChange={(e) => setTestInput({ ...testInput, body: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-xs focus:outline-none"
                    />
                  </div>

                  <button
                    onClick={handleRunTest}
                    disabled={testLoading}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 disabled:opacity-50 text-white text-xs font-bold transition flex items-center justify-center gap-2"
                  >
                    {testLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                    <span>{testLoading ? "Executing Workflow..." : "Run Test Execution"}</span>
                  </button>
                </div>

                {/* Execution Results View */}
                <div className="p-4 rounded-xl bg-white dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-3 flex flex-col justify-between">
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-2 flex items-center justify-between">
                      <span>Execution Trace & Output</span>
                      {testResult && (
                        <span className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> {testResult.latency_ms}ms
                        </span>
                      )}
                    </div>

                    {!testResult && !testLoading && (
                      <div className="h-44 border border-dashed border-slate-300 dark:border-slate-800 rounded-xl flex items-center justify-center text-xs text-slate-500 dark:text-slate-500">
                        Click "Run Test Execution" to validate agent before activation.
                      </div>
                    )}

                    {testLoading && (
                      <div className="h-44 flex flex-col items-center justify-center gap-2 text-xs text-cyan-400">
                        <RefreshCw className="w-6 h-6 animate-spin" />
                        <span>Evaluating policies, tools & synthesising resolution...</span>
                      </div>
                    )}

                    {testResult && (
                      <div className="space-y-3">
                        {testResult.error && <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">{testResult.error}</p>}
                        <div className="space-y-1">
                          {testResult.steps?.map((st, i) => (
                            <div key={i} className="flex items-center justify-between text-[11px] px-2.5 py-1.5 rounded bg-slate-900 border border-slate-800">
                              <span className="text-slate-300 font-medium">{st.name}</span>
                              <span className="text-slate-400 font-mono">{st.duration}ms</span>
                            </div>
                          ))}
                        </div>

                        <div>
                          <div className="text-[11px] font-semibold text-slate-400 uppercase mb-1">Synthesized Resolution Draft:</div>
                          <div className="p-2.5 rounded bg-slate-900 border border-slate-800 text-xs text-slate-200 font-mono whitespace-pre-wrap max-h-36 overflow-y-auto">
                            {testResult.draft_response}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-slate-800 flex items-center gap-2">
                    <button
                      onClick={() => handleSaveAndActivate("draft")}
                      disabled={loading}
                      className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition"
                    >
                      Save as Draft
                    </button>
                    <button
                      onClick={() => handleSaveAndActivate("active")}
                      disabled={loading}
                      className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-lg shadow-emerald-600/20"
                    >
                      Activate Agent (v1)
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Wizard Footer Controls */}
        <div className="px-6 py-4 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between">
          <button
            onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
            disabled={currentStep === 1}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 text-xs font-medium transition flex items-center gap-1.5"
          >
            <ChevronLeft className="w-4 h-4" />
            Previous
          </button>

          <div className="text-xs text-slate-500 font-medium">
            Step {currentStep} of {STEPS.length}
          </div>

          {currentStep < 6 ? (
            <button
              onClick={() => setCurrentStep(Math.min(6, currentStep + 1))}
              className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-cyan-600/20"
            >
              Next Step
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={() => handleSaveAndActivate("active")}
              disabled={loading}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-md shadow-emerald-600/20"
            >
              Activate Agent
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
