"use client";

import React, { useState, useEffect } from "react";
import {
  Shield, Building2, Users, Activity, Server, Wrench,
  TrendingUp, AlertTriangle, CheckCircle2, XCircle,
  ChevronRight, BarChart3, Globe, Clock, Cpu,
  Database, Layers, RefreshCw,
} from "lucide-react";

function StatCard({ label, value, icon: Icon, color, sub }) {
  return (
    <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/60 rounded-2xl p-5 hover:border-slate-700 transition">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-slate-600 dark:text-slate-400 uppercase tracking-wider font-medium">{label}</p>
          <p className={`text-2xl font-bold mt-1.5 ${color}`}>{value}</p>
          {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
        </div>
        <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
          <Icon className={`w-5 h-5 ${color}`} />
        </div>
      </div>
    </div>
  );
}

function TenantRow({ tenant }) {
  return (
    <tr className="hover:bg-slate-100 dark:hover:bg-slate-800/30 transition border-b border-slate-200 dark:border-slate-800/50">
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-600/20 border border-slate-700 flex items-center justify-center">
            <Building2 className="w-4 h-4 text-violet-700 dark:text-violet-400" />
          </div>
          <div>
            <p className="font-medium text-slate-900 dark:text-white text-sm">{tenant.name}</p>
            <p className="text-xs text-slate-500">{tenant.slug}</p>
          </div>
        </div>
      </td>
      <td className="px-5 py-3.5 text-xs text-slate-700 dark:text-slate-300">{tenant.tier || "—"}</td>
      <td className="px-5 py-3.5 text-xs text-slate-700 dark:text-slate-300">{tenant.agent_count ?? 0}</td>
      <td className="px-5 py-3.5 text-xs text-slate-700 dark:text-slate-300">{tenant.member_count ?? "?"}</td>
      <td className="px-5 py-3.5 text-xs text-slate-700 dark:text-slate-300">{tenant.total_runs ?? 0}</td>
      <td className="px-5 py-3.5">
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
          tenant.status === "active"
            ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20"
            : "bg-slate-100 text-slate-600 dark:bg-slate-700/50 dark:text-slate-400 border border-slate-200 dark:border-slate-700"
        }`}>
          {tenant.status || "unknown"}
        </span>
      </td>
    </tr>
  );
}

function ToolRequestRow({ request, onApprove, onReject }) {
  return (
    <div className="flex items-center justify-between p-4 bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/60 rounded-2xl hover:border-slate-700 transition">
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <h4 className="font-semibold text-slate-900 dark:text-white text-sm">{request.name}</h4>
          <span className="text-[10px] font-mono bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-1.5 py-0.5 rounded">{request.system}</span>
        </div>
        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed line-clamp-2">{request.description}</p>
        <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
          <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{request.org_name || "Unknown"}</span>
          <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{request.created_at ? new Date(request.created_at).toLocaleDateString() : "--"}</span>
        </div>
      </div>
      <div className="flex items-center gap-2 ml-4 flex-shrink-0">
        <button
          onClick={() => onApprove(request.id)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/15 text-xs font-medium transition"
        >
          <CheckCircle2 className="w-3.5 h-3.5" /> Approve
        </button>
        <button
          onClick={() => onReject(request.id)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/15 text-xs font-medium transition"
        >
          <XCircle className="w-3.5 h-3.5" /> Reject
        </button>
      </div>
    </div>
  );
}

function SystemHealthCard({ label, status, latency, icon: Icon }) {
  Icon = Icon || Activity;
  const isHealthy = status === "healthy" || status === "operational";
  return (
    <div className={`flex items-center justify-between p-4 bg-white dark:bg-slate-900/60 border rounded-xl transition ${isHealthy ? "border-emerald-500/10" : "border-amber-500/20"}`}>
      <div className="flex items-center gap-3">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isHealthy ? "bg-emerald-500/10" : "bg-amber-500/10"}`}>
          <Icon className={`w-4 h-4 ${isHealthy ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400"}`} />
        </div>
        <div>
          <p className="text-sm font-medium text-slate-900 dark:text-white">{label}</p>
          {latency && <p className="text-xs text-slate-500">{latency}ms avg</p>}
        </div>
      </div>
      <span className={`flex items-center gap-1.5 text-xs font-medium ${isHealthy ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400"}`}>
        <span className={`w-2 h-2 rounded-full ${isHealthy ? "bg-emerald-400" : "bg-amber-400"}`} />
        {status}
      </span>
    </div>
  );
}

export default function PlatformAdminConsole({
  metrics = {},
  tenants = [],
  toolRequests = [],
  systemHealth = [],
  loading = false,
  onApproveToolRequest,
  onRejectToolRequest,
  onRefresh,
}) {
  const [tab, setTab] = useState("overview");

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 rounded-full border-2 border-purple-500/30 border-t-purple-500 animate-spin" />
      </div>
    );
  }

  const TABS = [
    { id: "overview",      label: "Overview",       icon: BarChart3 },
    { id: "tenants",       label: "Tenants",        icon: Building2 },
    { id: "tool_requests", label: "Tool Requests",  icon: Wrench, badge: toolRequests.filter(r => r.status === "pending").length },
    { id: "health",        label: "System Health",  icon: Activity },
  ];

  const defaultHealth = systemHealth;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Shield className="w-5 h-5 text-purple-400" />
            Platform Administration
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">Monitor tenants, system health, and manage platform-wide tool requests</p>
        </div>
        <button
          onClick={onRefresh}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium hover:border-slate-300 dark:hover:border-slate-600 hover:text-slate-900 dark:hover:text-white transition"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200 dark:border-slate-800/50 pb-1">
        {TABS.map(t => {
          const TIcon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition relative ${
                tab === t.id ? "bg-blue-50 text-blue-800 dark:bg-blue-500/15 dark:text-blue-200" : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-900"
              }`}
            >
              <TIcon className="w-4 h-4" /> {t.label}
              {t.badge > 0 && (
                <span className="w-5 h-5 rounded-full bg-amber-500 text-slate-950 text-[10px] font-bold flex items-center justify-center ml-1">
                  {t.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Overview */}
      {tab === "overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Total Tenants"     value={metrics.total_tenants ?? tenants.length} icon={Building2} color="text-violet-700 dark:text-violet-400" />
            <StatCard label="Active Agents"     value={metrics.active_agents ?? 0}             icon={Cpu}       color="text-cyan-700 dark:text-cyan-400" />
            <StatCard label="Total Runs (7d)"   value={metrics.total_runs_7d ?? 0}             icon={Activity}  color="text-emerald-700 dark:text-emerald-400" />
            <StatCard label="Pending Requests"  value={toolRequests.filter(r => r.status === "pending").length} icon={Wrench} color="text-amber-700 dark:text-amber-400" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Quick Health */}
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">System Health</h3>
              <div className="space-y-2">
                {defaultHealth.slice(0, 4).map(h => (
                  <SystemHealthCard key={h.label} {...h} />
                ))}
                {defaultHealth.length === 0 && <p className="col-span-2 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">System health data is not available.</p>}
              </div>
            </div>
            {/* Recent Tenants */}
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">Latest Tenants</h3>
              <div className="space-y-2">
                {tenants.slice(0, 5).map(t => (
                  <div key={t.id} className="flex items-center justify-between p-3 bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/60 rounded-xl">
                    <div className="flex items-center gap-3">
                      <Building2 className="w-4 h-4 text-violet-700 dark:text-violet-400" />
                      <div>
                        <p className="text-sm font-medium text-slate-900 dark:text-white">{t.name}</p>
                        <p className="text-xs text-slate-500">{t.agent_count ?? 0} agents</p>
                      </div>
                    </div>
                    <span className="text-xs text-slate-600 dark:text-slate-400">{t.tier || "—"}</span>
                  </div>
                ))}
                {tenants.length === 0 && <p className="text-sm text-slate-500 py-4 text-center">No tenants yet</p>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tenants */}
      {tab === "tenants" && (
        <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/60 rounded-2xl overflow-hidden">
          {tenants.length === 0 ? (
            <div className="text-center py-16 text-slate-600 dark:text-slate-400 text-sm">No tenants registered yet.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800/80">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Organization</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Tier</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Agents</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Members</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Runs</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody>
                {tenants.map(t => <TenantRow key={t.id} tenant={t} />)}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Tool Requests */}
      {tab === "tool_requests" && (
        <div className="space-y-4">
          {toolRequests.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-7 h-7 text-emerald-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">No pending requests</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">All tool requests have been processed.</p>
            </div>
          ) : (
            toolRequests.map(req => (
              <ToolRequestRow key={req.id} request={req} onApprove={onApproveToolRequest} onReject={onRejectToolRequest} />
            ))
          )}
        </div>
      )}

      {/* System Health */}
      {tab === "health" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {defaultHealth.map(h => (
            <SystemHealthCard key={h.label} {...h} />
          ))}
          {defaultHealth.length === 0 && <p className="col-span-2 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">System health data is not available.</p>}
        </div>
      )}
    </div>
  );
}
