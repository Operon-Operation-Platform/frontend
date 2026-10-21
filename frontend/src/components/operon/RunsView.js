"use client";

import React, { useState, useEffect } from "react";
import {
  Activity,
  Search,
  Filter,
  Play,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  ChevronRight,
  Bot,
  Zap,
  X,
} from "lucide-react";
import { operonApi } from "../../api/operon";

const STATUS_CONFIG = {
  queued:           { label: "Queued",            color: "text-slate-700 bg-slate-100 border-slate-200", dot: "bg-slate-500" },
  pending:          { label: "Pending",           color: "text-slate-700 bg-slate-100 border-slate-200", dot: "bg-slate-500" },
  running:          { label: "Running",          color: "text-blue-700 bg-blue-50 border-blue-200",     dot: "bg-blue-600 animate-pulse" },
  succeeded:        { label: "Succeeded",        color: "text-emerald-700 bg-emerald-50 border-emerald-200", dot: "bg-emerald-600" },
  failed:           { label: "Failed",           color: "text-red-700 bg-red-50 border-red-200",         dot: "bg-red-600" },
  waiting_for_approval: { label: "Needs Approval", color: "text-amber-700 bg-amber-50 border-amber-200", dot: "bg-amber-600" },
  waiting_approval: { label: "Needs Approval",   color: "text-amber-700 bg-amber-50 border-amber-200",   dot: "bg-amber-600" },
  paused:           { label: "Paused",           color: "text-slate-700 bg-slate-100 border-slate-200",   dot: "bg-slate-500" },
  cancelled:        { label: "Cancelled",        color: "text-slate-700 bg-slate-100 border-slate-200",   dot: "bg-slate-500" },
};

const TEMPLATE_META = {
  customer_support: { label: "Customer Support", color: "text-blue-600 bg-blue-50", icon: "🎧" },
  sales:            { label: "Sales Agent",      color: "text-violet-600 bg-violet-50", icon: "📈" },
  operations:       { label: "Operations Agent", color: "text-amber-600 bg-amber-50", icon: "⚙️" },
};

export default function RunsView({ runs = [], agents = [], onOpenRun, onRefresh }) {
  const [search, setSearch] = useState("");
  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);

  // Manual Trigger Modal
  const [showTriggerModal, setShowTriggerModal] = useState(false);
  const [triggerAgentId, setTriggerAgentId] = useState(agents[0]?.id || "");
  const [triggerSubject, setTriggerSubject] = useState("");
  const [triggerBody, setTriggerBody] = useState("");
  const [triggering, setTriggering] = useState(false);

  useEffect(() => {
    if (agents.length > 0 && !triggerAgentId) {
      setTriggerAgentId(agents[0].id);
    }
  }, [agents, triggerAgentId]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      if (onRefresh) onRefresh();
    }, 4000);
    return () => clearInterval(interval);
  }, [autoRefresh, onRefresh]);

  const handleManualTrigger = async (e) => {
    e.preventDefault();
    if (!triggerAgentId) return;
    setTriggering(true);
    try {
      const res = await operonApi.runs.triggerRun({
        agent_id: triggerAgentId,
        input_payload: {
          subject: triggerSubject,
          body: triggerBody,
        },
      });
      setShowTriggerModal(false);
      if (onRefresh) await onRefresh();
      if (onOpenRun && res) {
        onOpenRun(res);
      }
    } catch {
      // handled
    } finally {
      setTriggering(false);
    }
  };

  const filteredRuns = runs.filter((r) => {
    const matchesAgent = selectedAgentId ? r.agent_id === selectedAgentId : true;
    const matchesStatus = selectedStatus ? r.status === selectedStatus : true;
    const query = search.toLowerCase();
    const matchesSearch = search
      ? r.id.toLowerCase().includes(query) ||
        (r.agent_name && r.agent_name.toLowerCase().includes(query)) ||
        (r.input_payload?.subject && r.input_payload.subject.toLowerCase().includes(query))
      : true;
    return matchesAgent && matchesStatus && matchesSearch;
  });

  return (
    <div className="operon-themed-view space-y-6 pt-4 sm:pt-6 text-slate-800 dark:text-gray-200">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-gray-100">
              Live Agent Runs & Execution Traces
            </h1>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
              Workspace Runs
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">
            Real-time step traces, tool invocations, approval gates, and latency across all workspace agents.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs sm:text-sm font-semibold transition ${
              autoRefresh
                ? "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400"
                : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            } transition-colors duration-200`}
          >
            <span className={`w-2 h-2 rounded-full ${autoRefresh ? "bg-emerald-500 animate-ping" : "bg-slate-300 dark:bg-slate-600"}`} />
            Auto-refresh (4s)
          </button>

          <button
            onClick={onRefresh}
            className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-gray-300 transition-colors duration-200"
            title="Refresh runs"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            onClick={() => setShowTriggerModal(true)}
            disabled={agents.length === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white text-xs sm:text-sm font-semibold shadow-md shadow-blue-600/20 transition-all duration-200 active:scale-95"
          >
            <Play className="w-3.5 h-3.5" />
            Trigger Test Run
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800 p-3.5 flex flex-wrap items-center gap-3 text-xs">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by run ID, agent name, or subject..."
            className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-gray-100 focus:outline-none focus:border-blue-600 text-xs"
          />
        </div>

        <select
          value={selectedAgentId}
          onChange={(e) => setSelectedAgentId(e.target.value)}
          className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-gray-200 focus:outline-none focus:border-blue-600"
        >
          <option value="">All Agents</option>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>

        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-gray-200 focus:outline-none focus:border-blue-600"
        >
          <option value="">All Statuses</option>
          <option value="running">Running</option>
          <option value="succeeded">Succeeded</option>
          <option value="failed">Failed</option>
          <option value="waiting_for_approval">Needs Approval</option>
        </select>

        {(search || selectedAgentId || selectedStatus) && (
          <button
            onClick={() => {
              setSearch("");
              setSelectedAgentId("");
              setSelectedStatus("");
            }}
            className="text-slate-500 hover:text-slate-800 font-medium px-2 py-1"
          >
            Reset Filters
          </button>
        )}
      </div>

      {/* Runs List Table */}
      {filteredRuns.length === 0 ? (
        <div className="bg-white dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800 p-12 text-center">
          <Activity className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-slate-900">No execution runs found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
            Trigger a run with input for one of your agents to see its real execution record here.
          </p>
          <button
            onClick={() => setShowTriggerModal(true)}
            disabled={agents.length === 0}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-medium shadow-sm transition"
          >
            Launch First Run
          </button>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-slate-500 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4 font-semibold">Agent</th>
                  <th className="py-3 px-4 font-semibold">Run ID</th>
                  <th className="py-3 px-4 font-semibold">Trigger / Input</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                  <th className="py-3 px-4 font-semibold">Latency</th>
                  <th className="py-3 px-4 font-semibold">Started</th>
                  <th className="py-3 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredRuns.map((r) => {
                  const statusMeta = STATUS_CONFIG[r.status] || STATUS_CONFIG.pending;
                  const tmplMeta = TEMPLATE_META[r.template_key] || { label: r.template_key || "Agent", icon: "AI", color: "text-blue-700 bg-blue-50" };
                  const subject = r.input_payload?.subject || "";

                  return (
                    <tr
                      key={r.id}
                      onClick={() => onOpenRun && onOpenRun(r)}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 cursor-pointer transition-colors duration-200"
                    >
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className="text-base">{tmplMeta.icon}</span>
                          <div>
                            <span className="font-semibold text-slate-900 dark:text-gray-100 block">{r.agent_name || r.agent_id || ""}</span>
                            <span className="text-[10px] text-slate-500 dark:text-gray-400 capitalize transition-colors duration-200">{r.trigger_type || "manual"}</span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500">
                        {r.id.slice(0, 14)}…
                      </td>

                      <td className="py-3.5 px-4 max-w-xs">
                        <span className="text-slate-800 dark:text-gray-200 font-medium truncate block">{subject}</span>
                        {r.error_message && (
                          <span className="text-[10px] text-red-600 dark:text-red-400 truncate block mt-0.5 transition-colors duration-200">
                            {r.error_message}
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border ${statusMeta.color}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${statusMeta.dot}`} />
                          {statusMeta.label}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-slate-600 font-mono text-[11px]">
                        {r.latency_ms ? `${(r.latency_ms / 1000).toFixed(2)}s` : "—"}
                      </td>

                      <td className="py-3.5 px-4 text-slate-400 text-[11px]">
                        {r.created_at ? new Date(r.created_at).toLocaleTimeString() : "?"}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onOpenRun) onOpenRun(r);
                          }}
                          className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 text-[11px] font-medium transition-colors duration-200 inline-flex items-center gap-1"
                        >
                          Trace
                          <ChevronRight className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Manual Trigger Modal */}
      {showTriggerModal && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 sm:p-6 pt-16 sm:pt-20 bg-slate-950/70 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-md w-full p-6 space-y-4 my-auto animate-slide-up text-slate-800 dark:text-gray-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
                  <Play className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-gray-100">Trigger Agent Run</h3>
                  <p className="text-xs text-slate-500 dark:text-gray-400">Dispatch test input to LangGraph pipeline</p>
                </div>
              </div>
              <button
                onClick={() => setShowTriggerModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-gray-200 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleManualTrigger} className="space-y-4 text-sm">
              <div>
                <label className="block text-slate-700 dark:text-gray-300 font-semibold text-xs mb-1.5">Select Target Agent</label>
                <select
                  value={triggerAgentId}
                  onChange={(e) => setTriggerAgentId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-gray-200 text-sm focus:outline-none focus:border-blue-600"
                >
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.template_key})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-gray-300 font-semibold text-xs mb-1.5">Subject / Task Title</label>
                <input
                  type="text"
                  required
                  value={triggerSubject}
                  onChange={(e) => setTriggerSubject(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-gray-100 text-sm focus:outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-gray-300 font-semibold text-xs mb-1.5">Input Payload / Description</label>
                <textarea
                  rows={4}
                  required
                  value={triggerBody}
                  onChange={(e) => setTriggerBody(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-gray-100 text-sm focus:outline-none focus:border-blue-600"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowTriggerModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-gray-300 text-sm font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={triggering || !triggerAgentId}
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white text-sm font-semibold shadow-md shadow-blue-600/20 transition flex items-center gap-1.5"
                >
                  {triggering ? "Dispatching..." : "Run Agent Now"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
