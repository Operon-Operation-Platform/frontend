"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  X,
  Bot,
  Sparkles,
  FileCode,
  Layers,
  Database,
  Wrench,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  ArrowLeft,
  Send,
  Play,
  RotateCw,
  ShieldCheck,
  Check,
} from "lucide-react";
import { operonApi } from "../../api/operon";

const TEMPLATES = [
  {
    key: "customer_support",
    name: "Customer Support & Triage",
    badge: "Most Popular",
    description: "Triages incoming support inquiries, consults verified knowledge bases, and drafts resolutions with human approval for refunds.",
    capabilities: [
      "Ticket Triage & Sentiment Classification",
      "Multi-Modal OCR Screenshot Analysis",
      "Hybrid RAG Retrieval (BM25 + Dense)",
      "Read-only Database Customer Inquiries",
      "Human Approval Gate for Refunds & Escalations",
    ],
    recommended_integrations: ["zendesk", "email", "slack"],
    required_permissions: "Read tickets, query customer database, draft emails",
    typical_tools: ["search_knowledge", "check_order", "request_refund"],
  },
  {
    key: "sales",
    name: "Enterprise Sales & Outreach",
    badge: "Growth",
    description: "Scores inbound prospects, synchronizes deals in CRM, and prepares customized enterprise outreach proposals.",
    capabilities: [
      "Lead Scoring & Firmographic Enrichment",
      "CRM Contact & Deal Synchronization",
      "Sales Collateral & Pricing Match",
      "Human Approval Gate for Discounting & Cold Outreach",
    ],
    recommended_integrations: ["salesforce", "email", "slack"],
    required_permissions: "Read/write CRM deals, draft outreach communications",
    typical_tools: ["search_knowledge", "summarize_records", "query_approved_database"],
  },
  {
    key: "operations",
    name: "Cloud Incident & SRE Response",
    badge: "Operations",
    description: "Monitors infrastructure telemetry, matches alerts with SOP runbooks, and coordinates rapid incident mitigation.",
    capabilities: [
      "Telemetry & Metric Ingestion",
      "Automated SOP Runbook Matching",
      "Slack War-room Notification Dispatch",
      "Human Approval Gate for Pod Restarts & DDL Changes",
    ],
    recommended_integrations: ["slack", "jira"],
    required_permissions: "Create Jira incidents, post in Slack alert channels",
    typical_tools: ["search_knowledge", "jira_escalate_incident", "slack_post_message"],
  },
];

export default function AgentBuilderWorkspace({ onClose, onAgentPublished }) {
  // ── Navigation & Phase ─────────────────────────────────────────────────
  // "entry" | "plain_english_form" | "json_form" | "template_select" | "workspace"
  const [phase, setPhase] = useState("entry");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // ── Plain English Form ────────────────────────────────────────────────
  const [peForm, setPeForm] = useState({
    name: "",
    prompt: "",
    business_objective: "",
    instructions: "",
    model: "meta-llama/Llama-3.3-70B-Instruct",
  });

  // ── JSON Form ─────────────────────────────────────────────────────────
  const [rawJson, setRawJson] = useState("");
  const [jsonError, setJsonError] = useState("");


  // ── 3-Panel Workspace Session State ───────────────────────────────────
  const [session, setSession] = useState(null);
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState("center"); // mobile: "plan" | "center" | "chat"

  // ── Center Panel Interruption Form Data ────────────────────────────────
  const [interruptionFormData, setInterruptionFormData] = useState({});
  const [submittingStep, setSubmittingStep] = useState(false);

  // ── Right Panel Chat ──────────────────────────────────────────────────
  const [chatInput, setChatInput] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const chatBottomRef = useRef(null);

  // ── Integration Catalog ───────────────────────────────────────────────
  const [integrationsCatalog, setIntegrationsCatalog] = useState([]);
  const [selectedProviderKey, setSelectedProviderKey] = useState("zendesk");

  useEffect(() => {
    operonApi.integrations.getCatalog?.()
      .then((data) => setIntegrationsCatalog(data || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [session?.chat_history]);

  // ── Start Workflow Handlers ───────────────────────────────────────────
  const handleStartPlainEnglish = async (e) => {
    e.preventDefault();
    if (!peForm.prompt.trim()) {
      setErrorMsg("Please describe what the agent should do.");
      return;
    }
    setLoading(true);
    setErrorMsg("");
    try {
      const res = await operonApi.builder.start({
        mode: "plain_english",
        name: peForm.name.trim() || undefined,
        prompt: peForm.prompt,
        business_objective: peForm.business_objective,
        instructions: peForm.instructions,
        model: peForm.model,
      });
      setSession(res);
      setPhase("workspace");
    } catch (err) {
      setErrorMsg(err.message || "Failed to initialize agent builder workflow.");
    } finally {
      setLoading(false);
    }
  };

  const handleStartJson = async (e) => {
    e.preventDefault();
    setJsonError("");
    try {
      JSON.parse(rawJson);
    } catch (err) {
      setJsonError(`Invalid JSON: ${err.message}`);
      return;
    }

    setLoading(true);
    setErrorMsg("");
    try {
      const res = await operonApi.builder.start({
        mode: "json",
        raw_json: rawJson,
        model: peForm.model,
      });
      setSession(res);
      setPhase("workspace");
    } catch (err) {
      setErrorMsg(err.message || "Failed to parse JSON agent specification.");
    } finally {
      setLoading(false);
    }
  };

  const handleStartTemplate = async (templateKey) => {
    setLoading(true);
    setErrorMsg("");
    try {
      const res = await operonApi.builder.start({
        mode: "template",
        template_key: templateKey,
        model: peForm.model,
      });
      setSession(res);
      setPhase("workspace");
    } catch (err) {
      setErrorMsg(err.message || "Failed to initialize template workflow.");
    } finally {
      setLoading(false);
    }
  };

  // ── Resume Node Handler (User clicks Done) ─────────────────────────────
  const handleDoneStep = async () => {
    if (!session?.thread_id) return;
    setSubmittingStep(true);
    setErrorMsg("");
    try {
      const res = await operonApi.builder.resume(session.thread_id, {
        action_type: "submit",
        submitted_data: interruptionFormData,
      });
      setSession(res);
      setInterruptionFormData({});
    } catch (err) {
      setErrorMsg(err.message || "Failed to complete step.");
    } finally {
      setSubmittingStep(false);
    }
  };

  // ── Chat with Operon ──────────────────────────────────────────────────
  const handleSendChat = async (e) => {
    e.preventDefault();
    if (!chatInput.trim() || !session?.thread_id) return;
    const msg = chatInput.trim();
    setChatInput("");
    setChatSending(true);
    try {
      const res = await operonApi.builder.chat(session.thread_id, msg);
      setSession((prev) => ({
        ...prev,
        chat_history: res.chat_history,
      }));
    } catch (err) {
      setErrorMsg(err.message || "Failed to send message to Operon.");
    } finally {
      setChatSending(false);
    }
  };

  // ── Publish Agent ─────────────────────────────────────────────────────
  const handlePublish = async () => {
    if (!session?.thread_id) return;
    setLoading(true);
    setErrorMsg("");
    try {
      const res = await operonApi.builder.publish(session.thread_id);
      if (onAgentPublished) onAgentPublished(res);
      if (onClose) onClose();
    } catch (err) {
      setErrorMsg(err.message || "Failed to publish agent.");
      setLoading(false);
    }
  };

  return (
    <div className="operon-themed-view fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-7xl h-[92vh] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden">

        {/* Top Header */}
        <div className="px-6 py-4 bg-white border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shadow-xs">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span>Operon Agent Builder</span>
                {session && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                    Session: {session.thread_id.slice(-8)}
                  </span>
                )}
              </h1>
              <p className="text-xs text-slate-500">
                Multi-tenant LangGraph orchestration • Human-in-the-loop configuration
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {phase !== "entry" && phase !== "workspace" && (
              <button
                onClick={() => setPhase("entry")}
                className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
              >
                Change Method
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition"
              aria-label="Close Builder"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Error Banner */}
        {errorMsg && (
          <div className="px-6 py-2.5 bg-rose-50 border-b border-rose-200 text-rose-700 text-xs font-medium flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <button onClick={() => setErrorMsg("")} className="text-rose-500 hover:text-rose-800 text-xs">Dismiss</button>
          </div>
        )}

        {/* ── PHASE 1: ENTRY POINT (Section 4) ──────────────────────────────── */}
        {phase === "entry" && (
          <div className="flex-1 p-8 sm:p-12 overflow-y-auto bg-slate-50 flex flex-col justify-center">
            <div className="max-w-3xl mx-auto w-full text-center mb-8">
              <h2 className="text-2xl font-bold text-slate-900 mb-2">How would you like to create your agent?</h2>
              <p className="text-sm text-slate-600">
                Choose a preconfigured enterprise archetype, describe your requirements in plain English, or supply a structured JSON specification.
              </p>
            </div>

            <div className="max-w-4xl mx-auto w-full grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Option A: Use a Template */}
              <div
                onClick={() => setPhase("template_select")}
                className="group relative bg-white p-8 rounded-2xl border-2 border-slate-200 hover:border-blue-600 hover:shadow-lg transition-all duration-200 cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 mb-5 group-hover:scale-105 transition">
                    <Layers className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-bold uppercase tracking-wider text-blue-600 mb-1 block">Option A</span>
                  <h3 className="text-lg font-bold text-slate-900 mb-2">Use a Template</h3>
                  <p className="text-sm text-slate-600 leading-relaxed mb-4">
                    Select from battle-tested enterprise agent archetypes: Customer Support, Sales, or Operations, preconfigured with verified tool mappings.
                  </p>
                </div>
                <div className="flex items-center text-sm font-semibold text-blue-600 group-hover:translate-x-1 transition">
                  <span>Browse Templates</span>
                  <ArrowRight className="w-4 h-4 ml-1.5" />
                </div>
              </div>

              {/* Option B: Create Your Agent */}
              <div
                onClick={() => setPhase("plain_english_form")}
                className="group relative bg-white p-8 rounded-2xl border-2 border-slate-200 hover:border-blue-600 hover:shadow-lg transition-all duration-200 cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 mb-5 group-hover:scale-105 transition">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 mb-1 block">Option B</span>
                  <h3 className="text-lg font-bold text-slate-900 mb-2">Create Your Agent</h3>
                  <p className="text-sm text-slate-600 leading-relaxed mb-4">
                    Describe what you want in plain English or paste custom JSON. Operon will formulate the schema, identify integrations, and guide credential connection.
                  </p>
                </div>
                <div className="flex items-center gap-4 text-xs font-semibold text-slate-500">
                  <span className="text-blue-600 flex items-center">
                    Plain English <ArrowRight className="w-3.5 h-3.5 ml-1" />
                  </span>
                  <span>•</span>
                  <span
                    onClick={(e) => { e.stopPropagation(); setPhase("json_form"); }}
                    className="hover:text-blue-600 underline cursor-pointer"
                  >
                    Structured JSON
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── PHASE 2A: TEMPLATE SELECTION ──────────────────────────────────── */}
        {phase === "template_select" && (
          <div className="flex-1 p-6 sm:p-8 overflow-y-auto bg-slate-50">
            <div className="max-w-5xl mx-auto">
              <div className="mb-6">
                <button
                  onClick={() => setPhase("entry")}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 mb-3"
                >
                  <ArrowLeft className="w-4 h-4" /> Back
                </button>
                <h2 className="text-xl font-bold text-slate-900">Select an Enterprise Agent Template</h2>
                <p className="text-xs text-slate-600">Review real capabilities, expected permissions, and recommended integrations.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {TEMPLATES.map((tmpl) => (
                  <div
                    key={tmpl.key}
                    onClick={() => handleStartTemplate(tmpl.key)}
                    className="bg-white rounded-2xl border-2 border-slate-200 hover:border-blue-600 p-6 flex flex-col justify-between shadow-xs hover:shadow-md transition cursor-pointer"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                          {tmpl.badge}
                        </span>
                      </div>
                      <h3 className="text-base font-bold text-slate-900 mb-2">{tmpl.name}</h3>
                      <p className="text-xs text-slate-600 leading-relaxed mb-4">{tmpl.description}</p>

                      <div className="space-y-3 pt-3 border-t border-slate-100">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Capabilities</span>
                          <ul className="space-y-1">
                            {tmpl.capabilities.slice(0, 3).map((cap, i) => (
                              <li key={i} className="text-xs text-slate-700 flex items-start gap-1.5">
                                <Check className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                                <span>{cap}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Integrations</span>
                          <div className="flex flex-wrap gap-1.5">
                            {tmpl.recommended_integrations.map((rec) => (
                              <span key={rec} className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-700">
                                {rec}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    <button
                      disabled={loading}
                      className="mt-6 w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs transition flex items-center justify-center gap-1.5"
                    >
                      {loading ? <RotateCw className="w-3.5 h-3.5 animate-spin" /> : <span>Use Template</span>}
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── PHASE 2B: PLAIN ENGLISH FORM (Section 5) ──────────────────────── */}
        {phase === "plain_english_form" && (
          <div className="flex-1 p-6 sm:p-10 overflow-y-auto bg-slate-50 dark:bg-slate-950 flex justify-center">
            <form onSubmit={handleStartPlainEnglish} className="max-w-2xl w-full bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Define Your Agent (Plain English)</h2>
                  <p className="text-xs text-slate-500">Operon will plan the agent and identify integrations with LangGraph.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setPhase("json_form")}
                  className="text-xs font-semibold text-blue-600 hover:underline flex items-center gap-1"
                >
                  <FileCode className="w-3.5 h-3.5" /> Switch to JSON
                </button>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Agent Name</label>
                <input
                  type="text"
                  placeholder="e.g. Customer Support Specialist"
                  value={peForm.name}
                  onChange={(e) => setPeForm({ ...peForm, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  What should this agent do? <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={4}
                  required
                  placeholder="e.g. Triage customer tickets from Zendesk, search our help center docs, query order history in PostgreSQL, and draft resolution replies. Any refunds over $50 require manager approval."
                  value={peForm.prompt}
                  onChange={(e) => setPeForm({ ...peForm, prompt: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Business Objective</label>
                  <input
                    type="text"
                    placeholder="e.g. Fast resolution within SLA"
                    value={peForm.business_objective}
                    onChange={(e) => setPeForm({ ...peForm, business_objective: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Model Selection</label>
                  <select
                    value={peForm.model}
                    onChange={(e) => setPeForm({ ...peForm, model: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="meta-llama/Llama-3.3-70B-Instruct">Llama 3.3 70B Instruct (Hugging Face)</option>
                    <option value="deepseek-ai/DeepSeek-R1-Distill-Qwen-32B">DeepSeek R1 Distill Qwen 32B (Hugging Face)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Operating Rules & Constraints</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Always verify tenant ID. Never disclose customer passwords. Escalate unknown errors."
                  value={peForm.instructions}
                  onChange={(e) => setPeForm({ ...peForm, instructions: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setPhase("entry")}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs flex items-center gap-2 transition"
                >
                  {loading && <RotateCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Generate Agent Plan</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ── PHASE 2C: JSON SPECIFICATION FORM (Section 6) ─────────────────── */}
        {phase === "json_form" && (
          <div className="flex-1 p-6 sm:p-10 overflow-y-auto bg-slate-50 dark:bg-slate-950 flex justify-center">
            <form onSubmit={handleStartJson} className="max-w-3xl w-full bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Define Your Agent (JSON Specification)</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Paste a structured agent schema with rules, integrations, and tool requirements.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setPhase("plain_english_form")}
                  className="text-xs font-semibold text-blue-600 hover:underline flex items-center gap-1"
                >
                  <Sparkles className="w-3.5 h-3.5" /> Switch to Plain English
                </button>
              </div>

              {jsonError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-mono">
                  {jsonError}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">JSON Specification</label>
                <textarea
                  rows={12}
                  required
                  placeholder="Paste your JSON agent specification here..."
                  value={rawJson}
                  onChange={(e) => { setRawJson(e.target.value); setJsonError(""); }}
                  className="block w-full max-w-full min-w-0 box-border px-4 py-3 text-xs font-mono rounded-xl border border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-950 text-slate-900 dark:text-emerald-300 placeholder:text-slate-400 leading-relaxed"
                />
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setPhase("entry")}
                    className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs flex items-center gap-2 transition"
                  >
                    {loading && <RotateCw className="w-3.5 h-3.5 animate-spin" />}
                    <span>Validate & Launch Workflow</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}

        {/* ── PHASE 3: THREE-PANEL INTERACTIVE WORKSPACE (Section 7, 8) ──────── */}
        {phase === "workspace" && session && (
          <div className="flex-1 flex flex-col min-h-0 bg-slate-100">

            {/* Mobile Tab Switcher */}
            <div className="lg:hidden flex border-b border-slate-200 bg-white">
              <button
                onClick={() => setActiveWorkspaceTab("plan")}
                className={`flex-1 py-2 text-xs font-semibold text-center ${activeWorkspaceTab === "plan" ? "text-blue-600 border-b-2 border-blue-600" : "text-slate-500"}`}
              >
                Plan & Steps
              </button>
              <button
                onClick={() => setActiveWorkspaceTab("center")}
                className={`flex-1 py-2 text-xs font-semibold text-center ${activeWorkspaceTab === "center" ? "text-blue-600 border-b-2 border-blue-600" : "text-slate-500"}`}
              >
                Current Stage
              </button>
              <button
                onClick={() => setActiveWorkspaceTab("chat")}
                className={`flex-1 py-2 text-xs font-semibold text-center ${activeWorkspaceTab === "chat" ? "text-blue-600 border-b-2 border-blue-600" : "text-slate-500"}`}
              >
                Operon Chat
              </button>
            </div>

            <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 min-h-0 overflow-hidden">

              {/* ── LEFT PANEL (28% width / col-span-3): Workflow Plan ────── */}
              <div className={`lg:col-span-3 border-r border-slate-200 bg-white p-5 flex flex-col justify-between overflow-y-auto ${activeWorkspaceTab === "plan" ? "block" : "hidden lg:flex"}`}>
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Workflow Plan</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                      LangGraph Active
                    </span>
                  </div>

                  <div className="space-y-3">
                    {session.plan_steps?.map((step, idx) => {
                      const isCompleted = step.status === "completed";
                      const isRunning = step.status === "running";
                      const isWaiting = step.status === "waiting_for_input";
                      return (
                        <div
                          key={step.id}
                          className={`p-3 rounded-xl border text-xs transition ${
                            isRunning
                              ? "bg-blue-50 border-blue-300 text-blue-900 shadow-xs"
                              : isWaiting
                              ? "bg-amber-50 border-amber-300 text-amber-900"
                              : isCompleted
                              ? "bg-slate-50 border-slate-200 text-slate-700"
                              : "bg-white border-slate-200 text-slate-400"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-bold flex items-center gap-1.5">
                              <span className="w-4 h-4 rounded-full bg-white border border-current text-[10px] flex items-center justify-center font-mono">
                                {idx + 1}
                              </span>
                              {step.label}
                            </span>
                            {isCompleted && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                            {isRunning && <RotateCw className="w-3.5 h-3.5 text-blue-600 animate-spin" />}
                            {isWaiting && <Clock className="w-3.5 h-3.5 text-amber-600 animate-pulse" />}
                          </div>
                          <p className="text-[11px] opacity-80 leading-snug">{step.description}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 text-[11px] text-slate-500">
                  <span className="font-bold text-slate-700 block mb-1">Target Model</span>
                  <span>{peForm.model}</span>
                </div>
              </div>

              {/* ── CENTER PANEL (col-span-6): Current Stage Interaction ───── */}
              <div className={`lg:col-span-6 bg-slate-50 p-6 flex flex-col justify-between overflow-y-auto ${activeWorkspaceTab === "center" ? "block" : "hidden lg:flex"}`}>
                <div className="space-y-5">

                  {/* Stage Header */}
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 block mb-1">
                      Current Stage: {session.current_step?.toUpperCase()}
                    </span>
                    <h3 className="text-base font-bold text-slate-900">
                      {session.pending_interruption?.title || "Agent Architecture & Specifications"}
                    </h3>
                    <p className="text-xs text-slate-600 mt-1">
                      {session.pending_interruption?.description || "Operon has formulated the canonical agent rules and is awaiting system parameterization."}
                    </p>
                  </div>

                  {/* STAGE: CONNECT INTEGRATIONS INTERRUPTION */}
                  {session.current_step === "integrations" && (
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                        <span className="text-xs font-bold text-slate-800">Select Integration Provider to Configure</span>
                        <span className="text-[11px] text-slate-500">Credentials stored in encrypted vault</span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {integrationsCatalog.slice(0, 4).map((p) => (
                          <button
                            key={p.key}
                            type="button"
                            onClick={() => setSelectedProviderKey(p.key)}
                            className={`p-2.5 rounded-xl border text-xs font-semibold text-center transition ${
                              selectedProviderKey === p.key
                                ? "bg-blue-50 border-blue-600 text-blue-700"
                                : "bg-white border-slate-200 text-slate-700 hover:border-slate-300"
                            }`}
                          >
                            {p.name}
                          </button>
                        ))}
                      </div>

                      {/* Provider Specific Form */}
                      {(() => {
                        const provider = integrationsCatalog.find((p) => p.key === selectedProviderKey) || integrationsCatalog[0];
                        if (!provider) return null;
                        return (
                          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                            <span className="text-xs font-bold text-slate-800 block">
                              Configure {provider.name} Connection
                            </span>
                            {provider.fields?.map((f) => (
                              <div key={f.key}>
                                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                                  {f.label} {f.required && <span className="text-rose-500">*</span>}
                                </label>
                                <input
                                  type={f.type}
                                  placeholder={f.placeholder}
                                  value={interruptionFormData[f.key] || ""}
                                  onChange={(e) =>
                                    setInterruptionFormData({ ...interruptionFormData, [f.key]: e.target.value })
                                  }
                                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                />
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {/* STAGE: CONFIGURE DATA SOURCES INTERRUPTION */}
                  {session.current_step === "data_sources" && (
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                        <span className="text-xs font-bold text-slate-800">Database & Knowledge Retrieval Configuration</span>
                        <span className="text-[11px] text-slate-500">Read-only sandbox enforced</span>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 mb-1">Customer Database Type</label>
                          <select
                            value={interruptionFormData.db_type || "postgres"}
                            onChange={(e) => setInterruptionFormData({ ...interruptionFormData, db_type: e.target.value })}
                            className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                          >
                            <option value="postgres">PostgreSQL Database (SSL Enforced)</option>
                            <option value="mysql">MySQL Enterprise</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 mb-1">Allowlisted Query Tables</label>
                          <input
                            type="text"
                            placeholder="Enter only tables available in the connected source"
                            value={interruptionFormData.tables || ""}
                            onChange={(e) => setInterruptionFormData({ ...interruptionFormData, tables: e.target.value })}
                            className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                          />
                          <span className="text-[10px] text-slate-400 mt-0.5 block">
                            Agent cannot query any tables outside this explicit allowlist.
                          </span>
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 mb-1">Knowledge Retrieval Mode</label>
                          <select
                            value={interruptionFormData.retrieval_mode || "keyword"}
                            onChange={(e) => setInterruptionFormData({ ...interruptionFormData, retrieval_mode: e.target.value })}
                            className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                          >
                            <option value="keyword">Keyword retrieval over added documents</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* STAGE: READY TO PUBLISH SCREEN (Section 13) */}
                  {session.current_step === "ready" && (
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                      <div className="flex items-center gap-2 text-emerald-700 font-bold text-xs pb-3 border-b border-slate-100">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>Pre-Publish Verification Passed</span>
                      </div>

                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between py-1.5 border-b border-slate-100">
                          <span className="text-slate-500">Agent Name</span>
                          <span className="font-semibold text-slate-900">{session.agent_spec?.name}</span>
                        </div>
                        <div className="flex justify-between py-1.5 border-b border-slate-100">
                          <span className="text-slate-500">Model Provider</span>
                          <span className="font-semibold text-slate-900">{peForm.model}</span>
                        </div>
                        <div className="flex justify-between py-1.5 border-b border-slate-100">
                          <span className="text-slate-500">Bound Tools</span>
                          <span className="font-semibold text-slate-900">
                            {session.agent_spec?.bound_tools?.join(", ") || "No tools selected"}
                          </span>
                        </div>
                        <div className="flex justify-between py-1.5 border-b border-slate-100">
                          <span className="text-slate-500">Evaluation Score</span>
                          <span className="font-bold text-emerald-600">
                            {session.pending_interruption?.evaluation?.score != null ? `${session.pending_interruption.evaluation.score}%` : "Not evaluated"}
                          </span>
                        </div>
                      </div>

                      {/* Evaluation Checks Evidence */}
                      <div className="p-3 bg-slate-50 rounded-xl space-y-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                          Deterministic Verification Evidence
                        </span>
                        {session.pending_interruption?.evaluation?.checks?.map((chk, i) => (
                          <div key={i} className="flex items-center justify-between text-xs">
                            <span className="text-slate-700">{chk.check}</span>
                            <span className="font-semibold text-emerald-600 flex items-center gap-1">
                              <Check className="w-3.5 h-3.5" /> OK
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                </div>

                {/* Bottom Action Bar with Done / Publish Button */}
                <div className="pt-4 border-t border-slate-200 flex items-center justify-between bg-white px-6 py-4 rounded-2xl shadow-xs mt-4">
                  <span className="text-xs text-slate-500">
                    {session.current_step === "ready"
                      ? "Configuration ready for production deployment."
                      : "Complete the stage fields above and click Done to advance."}
                  </span>

                  {session.current_step === "ready" ? (
                    <button
                      onClick={handlePublish}
                      disabled={loading}
                      className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs flex items-center gap-2 transition"
                    >
                      {loading && <RotateCw className="w-3.5 h-3.5 animate-spin" />}
                      <ShieldCheck className="w-4 h-4" />
                      <span>Publish Agent</span>
                    </button>
                  ) : (
                    <button
                      onClick={handleDoneStep}
                      disabled={submittingStep}
                      className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs flex items-center gap-2 transition"
                    >
                      {submittingStep && <RotateCw className="w-3.5 h-3.5 animate-spin" />}
                      <Check className="w-4 h-4" />
                      <span>Done</span>
                    </button>
                  )}
                </div>
              </div>

              {/* ── RIGHT PANEL (28% width / col-span-3): Chat with Operon ─── */}
              <div className={`lg:col-span-3 border-l border-slate-200 bg-white p-5 flex flex-col justify-between overflow-hidden ${activeWorkspaceTab === "chat" ? "block" : "hidden lg:flex"}`}>
                <div className="pb-3 border-b border-slate-100 flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-bold text-slate-800">Chat with Operon</span>
                </div>

                {/* Messages Container */}
                <div className="flex-1 overflow-y-auto space-y-3 py-4 pr-1">
                  {session.chat_history?.map((msg, i) => {
                    const isUser = msg.role === "user";
                    return (
                      <div key={i} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                        <div
                          className={`max-w-[85%] p-3 rounded-2xl text-xs leading-relaxed ${
                            isUser
                              ? "bg-blue-600 text-white rounded-br-none"
                              : "bg-slate-100 text-slate-800 rounded-bl-none"
                          }`}
                        >
                          {msg.content}
                        </div>
                      </div>
                    );
                  })}
                  <div ref={chatBottomRef} />
                </div>

                {/* Chat Input */}
                <form onSubmit={handleSendChat} className="pt-3 border-t border-slate-100 flex gap-2">
                  <input
                    type="text"
                    placeholder="Ask Operon to adjust rules, tools..."
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    className="flex-1 px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                  <button
                    type="submit"
                    disabled={chatSending || !chatInput.trim()}
                    className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs disabled:opacity-50 transition"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  );
}
