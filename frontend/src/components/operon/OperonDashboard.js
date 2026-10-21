"use client";

import React, { useState, useEffect } from "react";
import { operonApi } from "../../api/operon";
import {
  Bot, Plus, CheckCircle2, Activity, TrendingUp,
  ShieldAlert, Sparkles, ChevronRight, ArrowUpRight,
  Cpu,
} from "lucide-react";

const STATUS_CONFIG = {
  running:   { color: "text-emerald-700 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20", dot: "bg-emerald-600", label: "Running" },
  succeeded: { color: "text-blue-700 dark:text-blue-400",    bg: "bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20",       dot: "bg-blue-600",    label: "Succeeded" },
  failed:    { color: "text-red-700 dark:text-red-400",     bg: "bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20",          dot: "bg-red-600",     label: "Failed" },
  paused:    { color: "text-amber-700 dark:text-amber-400",   bg: "bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20",      dot: "bg-amber-600",   label: "Paused" },
  pending:   { color: "text-slate-600 dark:text-gray-400",   bg: "bg-slate-100 dark:bg-slate-500/10 border-slate-200 dark:border-slate-500/20",      dot: "bg-slate-500",   label: "Pending" },
};

const TEMPLATE_META = {
  customer_support: { bg: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border border-blue-200", icon: "🎧", label: "Customer Support" },
  sales:            { bg: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border border-blue-200", icon: "📈", label: "Sales & Triage" },
  operations:       { bg: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border border-blue-200", icon: "⚙️",  label: "Operations" },
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${cfg.bg} ${cfg.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function MetricCard({ label, value, sub, icon: Icon, color }) {
  return (
    <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 hover:border-slate-300 dark:hover:border-slate-700 transition shadow-xs group">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500 dark:text-gray-400">{label}</p>
          <p className={`text-3xl font-bold mt-1 ${color}`}>{value}</p>
          {sub && <p className="text-xs text-slate-500 dark:text-gray-400 mt-1">{sub}</p>}
        </div>
        <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center group-hover:scale-110 transition">
          <Icon className={`w-5 h-5 ${color}`} />
        </div>
      </div>
    </div>
  );
}

function EmptyState({ onOpenWizard }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center bg-white dark:bg-slate-900/40 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 shadow-xs">
      <div className="relative mb-6">
        <div className="w-20 h-20 rounded-2xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center border border-blue-200/80 dark:border-blue-800/40">
          <Bot className="w-10 h-10 text-blue-600 dark:text-blue-400" />
        </div>
      </div>
      <h2 className="text-xl font-bold text-slate-900 dark:text-gray-100 mb-2">No agents created yet</h2>
      <p className="text-slate-500 dark:text-gray-400 max-w-sm mb-6 text-sm leading-relaxed">
        Deploy your first autonomous AI agent to automate customer inquiries, support workflows, or backend operations.
      </p>
      <button
        onClick={onOpenWizard}
        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-sm transition active:scale-95 text-sm"
      >
        <Plus className="w-4 h-4" />
        Create your first agent
      </button>
    </div>
  );
}

function AgentCard({ agent, onSelectAgent }) {
  const meta = TEMPLATE_META[agent.template_key] || { bg: "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800", icon: "🤖", label: agent.template_key || "Agent" };
  const isActive = agent.status === "active";
  return (
    <div
      className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 hover:border-blue-300 dark:hover:border-blue-700 transition cursor-pointer group shadow-xs flex flex-col justify-between"
      onClick={() => onSelectAgent && onSelectAgent(agent)}
    >
      <div>
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl ${meta.bg} flex items-center justify-center text-lg shadow-xs`}>
              {meta.icon}
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-gray-100 text-sm sm:text-base leading-tight group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                {agent.name}
              </h3>
              <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">{meta.label}</p>
            </div>
          </div>
          <StatusBadge status={isActive ? "running" : "paused"} />
        </div>
        {agent.description && (
          <p className="text-xs sm:text-sm text-slate-600 dark:text-gray-300 leading-relaxed line-clamp-2 mb-4">
            {agent.description}
          </p>
        )}
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-gray-400 font-medium">
          <span className="flex items-center gap-1"><Activity className="w-3.5 h-3.5 text-slate-400" />{agent.run_count ?? 0} runs</span>
          <span className="flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />{agent.success_rate == null ? "N/A" : `${agent.success_rate}%`}</span>
        </div>
        <span className="text-xs font-medium text-blue-700 dark:text-blue-400">Open agent to test <ChevronRight className="inline h-3.5 w-3.5" /></span>
      </div>
    </div>
  );
}

export default function OperonDashboard({
  agents = [],
  recentRuns = [],
  pendingApprovals = [],
  loading = false,
  onOpenWizard,
  onOpenRun,
  onSelectAgent,
  onApprovalClick,
}) {
  const [dbStats, setDbStats] = useState(null);

  useEffect(() => {
    let mounted = true;
    operonApi.agents.getDashboardStats()
      .then((res) => {
        if (mounted && res) setDbStats(res);
      })
      .catch(() => {});
    return () => { mounted = false; };
  }, [agents.length, recentRuns.length, pendingApprovals.length]);

  const activeAgents  = dbStats ? dbStats.active_agents : agents.filter(a => a.status === "active").length;
  const totalAgents   = dbStats ? dbStats.total_agents : agents.length;
  const totalRuns     = dbStats ? dbStats.total_runs : recentRuns.length;
  const successRate   = dbStats ? dbStats.success_rate_percent : (totalRuns ? Math.round((recentRuns.filter(r => r.status === "succeeded").length / totalRuns) * 100) : null);
  const approvalsCount = dbStats ? dbStats.pending_approvals : pendingApprovals.length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="w-9 h-9 rounded-full border-2 border-blue-600/30 border-t-blue-600 animate-spin" />
          <p className="text-slate-500 dark:text-gray-400 text-sm">Loading workspace…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in text-slate-800 dark:text-gray-200">
      {/* Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="Active Agents"     value={activeAgents}              sub={`of ${totalAgents} total`}   icon={Cpu}         color="text-blue-600 dark:text-blue-400" />
        <MetricCard label="Total Runs"        value={totalRuns}                 sub="total executions"            icon={Activity}    color="text-slate-800 dark:text-slate-200" />
        <MetricCard label="Success Rate"      value={successRate == null ? "N/A" : `${successRate}%`}         sub="executions succeeded"        icon={TrendingUp}  color="text-emerald-600 dark:text-emerald-400" />
        <MetricCard label="Pending Approvals" value={approvalsCount}            sub="awaiting decision"           icon={ShieldAlert} color="text-amber-600 dark:text-amber-400" />
      </div>

      {/* Approvals Banner */}
      {pendingApprovals.length > 0 && (
        <div
          className="flex items-center justify-between p-4 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 cursor-pointer hover:bg-amber-100/60 dark:hover:bg-amber-500/15 transition shadow-xs"
          onClick={onApprovalClick}
        >
          <div className="flex items-center gap-3">
            <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            <div>
              <p className="text-sm font-semibold text-amber-900 dark:text-amber-300">
                {pendingApprovals.length} action{pendingApprovals.length > 1 ? "s" : ""} awaiting approval
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-400/80">Agents are paused waiting for human review</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-amber-600 dark:text-amber-400" />
        </div>
      )}

      {/* Agents Grid */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-900 dark:text-gray-100">Your Agents</h2>
          <button
            onClick={onOpenWizard}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-gray-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" /> New Agent
          </button>
        </div>
        {agents.length === 0 ? (
          <EmptyState onOpenWizard={onOpenWizard} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {agents.map(agent => (
              <AgentCard key={agent.id} agent={agent} onSelectAgent={onSelectAgent} />
            ))}
          </div>
        )}
      </section>

      {/* Recent Runs Table */}
      {recentRuns.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-gray-100">Recent Runs</h2>
            <span className="text-xs text-slate-500 dark:text-gray-400">Last 20 executions</span>
          </div>
          <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wider">Agent</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wider">Duration</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wider hidden md:table-cell">Started</th>
                  <th className="px-5 py-3.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {recentRuns.slice(0, 10).map(run => (
                  <tr key={run.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition group">
                    <td className="px-5 py-3.5">
                      <div className="font-semibold text-slate-900 dark:text-gray-100 text-sm">{run.agent_name || run.agent_id}</div>
                      <div className="text-xs text-slate-500 dark:text-gray-400 font-mono truncate max-w-[140px]">{run.id}</div>
                    </td>
                    <td className="px-5 py-3.5"><StatusBadge status={run.status} /></td>
                    <td className="px-5 py-3.5 text-slate-600 dark:text-gray-300 text-xs">{run.duration_ms ? `${(run.duration_ms / 1000).toFixed(2)}s` : "--"}</td>
                    <td className="px-5 py-3.5 text-slate-500 dark:text-gray-400 text-xs hidden md:table-cell">{run.started_at ? new Date(run.started_at).toLocaleString() : "--"}</td>
                    <td className="px-5 py-3.5 text-right">
                      <button onClick={() => onOpenRun && onOpenRun(run)} className="opacity-0 group-hover:opacity-100 flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 transition ml-auto">
                        Inspect <ArrowUpRight className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
