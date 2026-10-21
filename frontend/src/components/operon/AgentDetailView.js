"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  ArrowLeft,
  Bot,
  Play,
  Pause,
  Trash2,
  Save,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Layers,
  Database,
  Wrench,
  Activity,
  Sliders,
  Sparkles,
  Shield,
  Clock,
  RotateCw,
  FileCheck,
  Check,
  AlertTriangle,
  ExternalLink,
} from "lucide-react";
import { operonApi } from "../../api/operon";

export default function AgentDetailView({
  agent,
  onTriggerRun,
  onOpenRun,
  onBack,
  onRefresh,
}) {
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview"); // overview | runs | evaluations | integrations | knowledge | tools | settings
  const [actionLoading, setActionLoading] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState({ text: "", type: "" });
  const [testMessage, setTestMessage] = useState("");
  const [testingAgent, setTestingAgent] = useState(false);
  const [testError, setTestError] = useState("");

  // ── Evaluations Tab State ─────────────────────────────────────────────
  const [evalSummary, setEvalSummary] = useState(null);
  const [evalScenarios, setEvalScenarios] = useState([]);
  const [runningEval, setRunningEval] = useState(false);
  const [selectedScenarioId, setSelectedScenarioId] = useState("");

  // ── Settings & Edit Form ──────────────────────────────────────────────
  const [editForm, setEditForm] = useState({
    name: "",
    description: "",
    instructions: "",
    model: "meta-llama/Llama-3.3-70B-Instruct",
  });
  const [savingConfig, setSavingConfig] = useState(false);
  const [availableTools, setAvailableTools] = useState([]);
  const [selectedToolSlugs, setSelectedToolSlugs] = useState([]);
  const [savingTools, setSavingTools] = useState(false);

  // ── Deliberate Double-Confirmation Deletion State (Section 16) ─────────
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteStep, setDeleteStep] = useState(1); // 1: Warning dialog | 2: Type exact name & checkbox
  const [typedNameConfirm, setTypedNameConfirm] = useState("");
  const [acknowledgedPermanent, setAcknowledgedPermanent] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // ── Pre-publish Readiness Check (Section 13) ──────────────────────────
  const [readiness, setReadiness] = useState(null);

  const fetchDetails = useCallback(async () => {
    if (!agent?.id) return;
    setLoading(true);
    try {
      const [agentData, evalData, scenariosData, readinessData, toolsData, mcpData] = await Promise.allSettled([
        operonApi.agents.getAgentDetails(agent.id),
        operonApi.evaluations.getSummary(agent.id),
        operonApi.evaluations.getScenarios(agent.id),
        operonApi.agents.getReadiness(agent.id),
        operonApi.toolsAndMcp.getTools(),
        operonApi.toolsAndMcp.getMcpServers(),
      ]);

      const builtinTools = toolsData.status === "fulfilled"
        ? (toolsData.value || []).filter((tool) => tool.available)
        : [];
      const approvedMcpTools = mcpData.status === "fulfilled"
        ? (mcpData.value || []).flatMap((server) =>
            (server.discovered_tools || [])
              .filter((tool) => tool.approved)
              .map((tool) => ({
                slug: `mcp_${server.id}_${tool.name}`,
                name: `${server.name}: ${tool.name}`,
                description: tool.description || `Approved tool from ${server.name}.`,
                category: "mcp",
              })),
          )
        : [];
      const toolOptions = [...builtinTools, ...approvedMcpTools];
      setAvailableTools(toolOptions);

      if (agentData.status === "fulfilled") {
        const data = agentData.value;
        setDetails(data);
        const allowedActions = data.allowed_actions || [];
        setSelectedToolSlugs(
          allowedActions.includes("*") ? toolOptions.map((tool) => tool.slug) : allowedActions,
        );
        setEditForm({
          name: data.name || "",
          description: data.description || "",
          instructions: data.instructions || "",
          model: data.model_config_settings?.model || "meta-llama/Llama-3.3-70B-Instruct",
        });
      }

      if (evalData.status === "fulfilled") {
        setEvalSummary(evalData.value);
      }
      if (scenariosData.status === "fulfilled") {
        setEvalScenarios(scenariosData.value || []);
      }
      if (readinessData.status === "fulfilled") {
        setReadiness(readinessData.value);
      }
    } catch (err) {
      setFeedbackMsg({ text: err.message || "Failed to load agent details.", type: "error" });
    } finally {
      setLoading(false);
    }
  }, [agent?.id]);

  useEffect(() => {
    fetchDetails();
  }, [fetchDetails]);

  const handleTogglePause = async () => {
    if (!details) return;
    setActionLoading(true);
    try {
      if (details.status === "active") {
        await operonApi.agents.pauseAgent(details.id);
        setFeedbackMsg({ text: `Agent '${details.name}' paused.`, type: "success" });
      } else {
        await operonApi.agents.activateAgent(details.id);
        setFeedbackMsg({ text: `Agent '${details.name}' activated!`, type: "success" });
      }
      await fetchDetails();
      if (onRefresh) onRefresh();
    } catch (err) {
      setFeedbackMsg({ text: err.message || "Failed to update agent status.", type: "error" });
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveConfig = async (e) => {
    e.preventDefault();
    setSavingConfig(true);
    setFeedbackMsg({ text: "", type: "" });
    try {
      await operonApi.agents.updateAgent(details.id, {
        name: editForm.name,
        description: editForm.description,
        instructions: editForm.instructions,
        model_config_settings: { model: editForm.model },
        create_new_version: true,
      });
      setFeedbackMsg({ text: "Configuration saved and immutable version bumped successfully.", type: "success" });
      await fetchDetails();
      if (onRefresh) onRefresh();
    } catch (err) {
      setFeedbackMsg({ text: err.message || "Failed to update configuration.", type: "error" });
    } finally {
      setSavingConfig(false);
    }
  };

  const handleSaveToolBindings = async () => {
    if (!details?.id) return;
    setSavingTools(true);
    setFeedbackMsg({ text: "", type: "" });
    try {
      await operonApi.agents.updateAgent(details.id, {
        allowed_actions: selectedToolSlugs,
        create_new_version: true,
      });
      setFeedbackMsg({ text: "Agent tool permissions saved in a new version.", type: "success" });
      await fetchDetails();
      if (onRefresh) onRefresh();
    } catch (err) {
      setFeedbackMsg({ text: err.message || "Could not update this agent's tools.", type: "error" });
    } finally {
      setSavingTools(false);
    }
  };

  const handleTriggerEvaluation = async () => {
    if (!details?.id) return;
    setRunningEval(true);
    setFeedbackMsg({ text: "", type: "" });
    try {
      const res = await operonApi.evaluations.run({
        agent_id: details.id,
        scenario_id: selectedScenarioId || undefined,
        judge_model: editForm.model,
      });
      setFeedbackMsg({
        text: `Evaluation finished: ${res.status.toUpperCase()} (Judge score: ${res.llm_judge_score ?? "N/A"})`,
        type: res.status === "passed" ? "success" : "error",
      });
      await fetchDetails();
    } catch (err) {
      setFeedbackMsg({ text: err.message || "Evaluation run failed.", type: "error" });
    } finally {
      setRunningEval(false);
    }
  };

  const handleTestAgent = async (e) => {
    e.preventDefault();
    if (!testMessage.trim() || !onTriggerRun) return;
    setTestingAgent(true);
    setTestError("");
    try {
      const input = currentAgent.template_key === "sales"
        ? { inquiry: testMessage.trim() }
        : currentAgent.template_key === "operations"
          ? { alert_name: testMessage.trim(), log_sample: testMessage.trim() }
          : { subject: testMessage.trim().slice(0, 120), body: testMessage.trim() };
      await onTriggerRun(currentAgent, input);
    } catch (err) {
      setTestError(err.message || "The agent test failed. Please try again.");
    } finally {
      setTestingAgent(false);
    }
  };

  // ── Two-Step Double Confirmation Deletion (Section 16) ──────────────────
  const handleExecuteDeleteConfirmed = async () => {
    if (!details?.id) return;
    setDeleting(true);
    try {
      await operonApi.agents.deleteConfirmed(details.id, typedNameConfirm, acknowledgedPermanent);
      setShowDeleteModal(false);
      if (onRefresh) onRefresh();
      if (onBack) onBack();
    } catch (err) {
      setFeedbackMsg({ text: err.message || "Failed to delete agent.", type: "error" });
      setDeleting(false);
    }
  };

  const currentAgent = details || agent;
  const isActive = currentAgent?.status === "active";

  if (loading && !details) {
    return (
      <div className="flex items-center justify-center p-16 text-xs text-slate-500 dark:text-slate-400">
        <RotateCw className="w-4 h-4 animate-spin mr-2 text-blue-600" />
        Loading agent specifications...
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 transition"
            aria-label="Back to dashboard"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">{currentAgent?.name}</h1>
              <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                isActive
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-slate-100 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800"
              }`}>
                {currentAgent?.status?.toUpperCase()}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-blue-50 text-blue-700 border border-blue-200">
                v{currentAgent?.current_version_number || 1}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              ID: {currentAgent?.id} • Archetype: {currentAgent?.template_key}
            </p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleTogglePause}
            disabled={actionLoading}
            className="px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 flex items-center gap-1.5 transition"
          >
            {isActive ? <Pause className="w-3.5 h-3.5 text-amber-600" /> : <Play className="w-3.5 h-3.5 text-emerald-600" />}
            <span>{isActive ? "Pause" : "Activate"}</span>
          </button>

          <button
            onClick={() => setActiveTab("test")}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 transition"
          >
            <Play className="w-3.5 h-3.5" />
            <span>Test Agent</span>
          </button>
        </div>
      </div>

      {/* Feedback Alert */}
      {feedbackMsg.text && (
        <div className={`p-3 rounded-xl border text-xs font-medium flex items-center justify-between ${
          feedbackMsg.type === "success"
            ? "bg-emerald-50 border-emerald-200 text-emerald-800"
            : "bg-rose-50 border-rose-200 text-rose-800"
        }`}>
          <span>{feedbackMsg.text}</span>
          <button onClick={() => setFeedbackMsg({ text: "", type: "" })} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 text-xs">Dismiss</button>
        </div>
      )}

      {/* Navigation Tabs (Section 14) */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 overflow-x-auto gap-2">
        {[
          { id: "overview", label: "Overview", icon: Activity },
          { id: "test", label: "Test Agent", icon: Play },
          { id: "runs", label: "Activity & Runs", icon: Clock },
          { id: "evaluations", label: "Evaluations", icon: FileCheck },
          { id: "integrations", label: "Integrations", icon: Layers },
          { id: "tools", label: "Bound Tools", icon: Wrench },
          { id: "settings", label: "Settings", icon: Sliders },
        ].map((tab) => {
          const Icon = tab.icon;
          const isSelected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium border-b-2 transition whitespace-nowrap ${
                isSelected
                  ? "border-blue-600 text-blue-700 font-semibold"
                  : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
              }`}
            >
              <Icon className={`w-4 h-4 ${isSelected ? "text-blue-600" : "text-slate-400"}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ── TAB 1: OVERVIEW ─────────────────────────────────────────────────── */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium block">Total Recorded Runs</span>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">{details?.recent_runs?.length || 0}</p>
              <span className="text-[11px] text-slate-400 mt-1 block">From PostgreSQL trace store</span>
            </div>

            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium block">Evaluation Status</span>
              <p className={`text-2xl font-bold mt-1 ${evalSummary?.passed > 0 ? "text-emerald-600" : "text-slate-700 dark:text-slate-300"}`}>
                {evalSummary?.pass_rate != null && Number.isFinite(Number(evalSummary.pass_rate)) ? `${Number(evalSummary.pass_rate)}%` : "N/A"}
              </p>
              <span className="text-[11px] text-slate-400 mt-1 block">
                {evalSummary?.total_evaluations || 0} benchmark tests run
              </span>
            </div>

            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium block">Active Version</span>
              <p className="text-2xl font-bold text-blue-600 mt-1">{details?.current_version_number ? `v${details.current_version_number}` : "—"}</p>
              <span className="text-[11px] text-slate-400 mt-1 block">Immutable config version</span>
            </div>

            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium block">Target Model</span>
              <p className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-2 truncate">
                {details?.model_config_settings?.model || "Not configured"}
              </p>
              <span className="text-[11px] text-slate-400 mt-1 block">Hugging Face Provider</span>
            </div>
          </div>

          {/* Instructions & Prompt Card */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
            <span className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider block">
              Active Instructions & Operating Rules
            </span>
            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-200 leading-relaxed font-mono whitespace-pre-wrap">
              {details?.instructions || "No operating instructions configured."}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: ACTIVITY & RUNS ─────────────────────────────────────────── */}
      {activeTab === "runs" && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Recorded Execution Runs</h3>
            <span className="text-xs text-slate-500 dark:text-slate-400">{details?.recent_runs?.length || 0} runs total</span>
          </div>

          {(!details?.recent_runs || details.recent_runs.length === 0) ? (
            <div className="p-12 text-center text-xs text-slate-500 dark:text-slate-400">
              No executions recorded yet. Click &quot;Trigger Run&quot; to execute this agent.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 text-xs">
              {details.recent_runs.map((r) => (
                <div
                  key={r.id}
                  onClick={() => onOpenRun && onOpenRun(r)}
                  className="px-6 py-3.5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer transition"
                >
                  <div className="flex items-center gap-3">
                    <span className={`w-2 h-2 rounded-full ${r.status === "succeeded" || r.status === "completed" ? "bg-emerald-500" : "bg-blue-500"}`} />
                    <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">{r.id}</span>
                  </div>
                  <div className="flex items-center gap-4 text-slate-500 dark:text-slate-400">
                    <span>{r.latency_ms ? `${r.latency_ms.toFixed(0)}ms` : "—"}</span>
                    <span className="capitalize">{r.status}</span>
                    <span>{r.created_at ? new Date(r.created_at).toLocaleTimeString() : "?"}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "test" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <form onSubmit={handleTestAgent} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Send a test message</h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Try this agent with a real example. Its execution trace and response will open when the run finishes.</p>
            </div>
            <textarea
              value={testMessage}
              onChange={(e) => setTestMessage(e.target.value)}
              rows={6}
              required
              placeholder="Enter a message or scenario for this agent..."
              className="w-full resize-y rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 p-3 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
            {testError && <p role="alert" className="text-xs text-red-600 dark:text-red-400">{testError}</p>}
            <button
              type="submit"
              disabled={testingAgent || !testMessage.trim()}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {testingAgent ? <RotateCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              {testingAgent ? "Running agent..." : "Run"}
            </button>
          </form>
          <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-6 flex flex-col justify-center text-center">
            <Activity className="mx-auto h-8 w-8 text-blue-500" />
            <h3 className="mt-3 text-sm font-semibold text-slate-900 dark:text-slate-100">Execution trace and response</h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">After you run a test, inspect the agent steps, tool activity, and final output in the run details.</p>
          </div>
        </div>
      )}

      {/* ── TAB 3: TRUTHFUL EVALUATIONS (Section 21) ────────────────────────── */}
      {activeTab === "evaluations" && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Deterministic & LLM Evaluation Benchmark</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Runs real execution traces and verifies tool calling, refusal of prohibited tools, and judge rubric adherence.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={selectedScenarioId}
                  onChange={(e) => setSelectedScenarioId(e.target.value)}
                  className="px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 focus:outline-none bg-white dark:bg-slate-900"
                >
                  <option value="">Default Archetype Benchmark</option>
                  {evalScenarios.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>

                <button
                  onClick={handleTriggerEvaluation}
                  disabled={runningEval}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 transition"
                >
                  {runningEval ? <RotateCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                  <span>Run Evaluation Test</span>
                </button>
              </div>
            </div>

            {/* Latest Evaluation Result Scorecard */}
            {evalSummary?.latest_result ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-800">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Latest Status</span>
                    <span className={`text-sm font-bold uppercase ${
                      evalSummary.latest_result.status === "passed" ? "text-emerald-600" : "text-rose-600"
                    }`}>
                      {evalSummary.latest_result.status}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Judge Score</span>
                    <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      {typeof evalSummary.latest_result.judge_score === "number" ? `${(evalSummary.latest_result.judge_score * 100).toFixed(0)}%` : "N/A"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Judge Reasoning</span>
                    <span className="text-xs text-slate-600 dark:text-slate-400 max-w-sm truncate block">
                      {evalSummary.latest_result.judge_reasoning || "Satisfied policy."}
                    </span>
                  </div>
                </div>

                {/* Individual Deterministic Checks */}
                <div className="space-y-1.5">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">Deterministic Evidence Checks</span>
                  {evalSummary.latest_result.deterministic_checks?.map((chk, i) => (
                    <div key={i} className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-semibold text-slate-900 dark:text-slate-100 block">{chk.name}</span>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">{chk.evidence}</span>
                      </div>
                      <span className={`font-bold flex items-center gap-1 ${chk.passed ? "text-emerald-600" : "text-rose-600"}`}>
                        {chk.passed ? <Check className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                        {chk.passed ? "PASSED" : "FAILED"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400">
                No evaluation tests recorded for this agent yet. Click &quot;Run Evaluation Test&quot; above to verify behavior.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB 4: INTEGRATIONS ─────────────────────────────────────────────── */}
      {activeTab === "integrations" && (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Assigned Integrations</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Connections are scoped per workspace and credentials are encrypted at rest in the vault.
          </p>
          <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 space-y-1">
            <span className="font-semibold block text-slate-900 dark:text-slate-100">Assigned integrations:</span>
            <span>{details?.integrations?.length ? details.integrations.map((item) => item.name).join(", ") : "No integrations are assigned to this agent."}</span>
          </div>
        </div>
      )}

      {/* ── TAB 5: BOUND TOOLS ──────────────────────────────────────────────── */}
      {activeTab === "tools" && (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Authorized Execution Tools</h3>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Select only tools this agent should be allowed to use. MCP tools appear here after connecting a server and approving the discovered tool.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            {availableTools.length ? availableTools.map((tool) => {
              const checked = selectedToolSlugs.includes(tool.slug);
              return (
                <label key={tool.slug} className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/60">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => setSelectedToolSlugs((selected) =>
                      checked
                        ? selected.filter((slug) => slug !== tool.slug)
                        : [...selected, tool.slug],
                    )}
                    className="mt-0.5 accent-blue-600"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-slate-900 dark:text-slate-100">{tool.name}</span>
                    <span className="mt-1 block text-[11px] text-slate-600 dark:text-slate-400">{tool.description}</span>
                    <span className="mt-1 block font-mono text-[10px] text-slate-500 dark:text-slate-500">{tool.slug}</span>
                  </span>
                  <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold ${checked ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300" : "border-slate-200 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400"}`}>
                    {checked ? "BOUND" : "AVAILABLE"}
                  </span>
                </label>
              );
            }) : (
              <p className="col-span-full text-slate-500 dark:text-slate-400">
                No ready-to-use tools yet. Add and approve an MCP server tool in Tools &amp; MCP to bind it here.
              </p>
            )}
          </div>
          <div className="flex justify-end border-t border-slate-200 pt-4 dark:border-slate-800">
            <button
              type="button"
              onClick={handleSaveToolBindings}
              disabled={savingTools}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
            >
              {savingTools && <RotateCw className="h-3.5 w-3.5 animate-spin" />}
              Save Tool Bindings
            </button>
          </div>
        </div>
      )}

      {/* ── TAB 6: SETTINGS & DELIBERATE DELETION (Section 15, 16) ───────────── */}
      {activeTab === "settings" && (
        <div className="space-y-6">
          <form onSubmit={handleSaveConfig} className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 pb-3 border-b border-slate-100">
              Agent Parameters & Versioning
            </h3>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">Agent Name</label>
              <input
                type="text"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">Description</label>
              <input
                type="text"
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">Operating Instructions</label>
              <textarea
                rows={4}
                value={editForm.instructions}
                onChange={(e) => setEditForm({ ...editForm, instructions: e.target.value })}
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">Hugging Face Model Selection</label>
              <select
                value={editForm.model}
                onChange={(e) => setEditForm({ ...editForm, model: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-900"
              >
                <option value="meta-llama/Llama-3.3-70B-Instruct">meta-llama/Llama-3.3-70B-Instruct</option>
                <option value="deepseek-ai/DeepSeek-R1-Distill-Qwen-32B">deepseek-ai/DeepSeek-R1-Distill-Qwen-32B</option>
              </select>
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                type="submit"
                disabled={savingConfig}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 transition"
              >
                {savingConfig && <RotateCw className="w-3.5 h-3.5 animate-spin" />}
                <Save className="w-3.5 h-3.5" />
                <span>Save New Version</span>
              </button>
            </div>
          </form>

          {/* Danger Zone: Deliberate Two-Step Deletion (Section 16) */}
          <div className="bg-rose-50/50 p-6 rounded-2xl border border-rose-200 space-y-3">
            <h4 className="text-xs font-bold text-rose-900 uppercase tracking-wider">Danger Zone</h4>
            <p className="text-xs text-rose-700">
              Permanently deactivates and archives this agent instance. Shared workspace integration credentials remain intact.
            </p>
            <button
              type="button"
              onClick={() => {
                setDeleteStep(1);
                setTypedNameConfirm("");
                setAcknowledgedPermanent(false);
                setShowDeleteModal(true);
              }}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Agent</span>
            </button>
          </div>
        </div>
      )}

      {/* ── DELIBERATE DOUBLE-CONFIRMATION DELETION MODAL (Section 16) ──────── */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">

            {deleteStep === 1 ? (
              <>
                <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Delete this agent?</h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  This action will permanently remove the agent from your active workspace and may affect scheduled runs, tool bindings, and associated configuration. This action cannot be undone.
                </p>
                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    onClick={() => setShowDeleteModal(false)}
                    className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => setDeleteStep(2)}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold shadow-xs transition"
                  >
                    Continue to Confirmation
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600">
                  <Shield className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Type exact name to confirm</h3>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Please type <strong className="font-mono text-slate-900 dark:text-slate-100 select-all">{currentAgent?.name}</strong> to confirm deletion:
                </p>

                <input
                  type="text"
                  placeholder={currentAgent?.name}
                  value={typedNameConfirm}
                  onChange={(e) => setTypedNameConfirm(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-rose-500 bg-white dark:bg-slate-900"
                />

                <label className="flex items-start gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={acknowledgedPermanent}
                    onChange={(e) => setAcknowledgedPermanent(e.target.checked)}
                    className="rounded text-rose-600 mt-0.5"
                  />
                  <span>I understand that this action is permanent and cannot be reversed.</span>
                </label>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    onClick={() => setShowDeleteModal(false)}
                    className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition"
                  >
                    Cancel
                  </button>
                  <button
                    disabled={typedNameConfirm.trim() !== currentAgent?.name?.trim() || !acknowledgedPermanent || deleting}
                    onClick={handleExecuteDeleteConfirmed}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs disabled:opacity-40 flex items-center gap-1.5 transition"
                  >
                    {deleting && <RotateCw className="w-3.5 h-3.5 animate-spin" />}
                    <span>Delete Agent</span>
                  </button>
                </div>
              </>
            )}

          </div>
        </div>
      )}

    </div>
  );
}
