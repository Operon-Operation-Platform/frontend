"use client";

import React, { useState } from "react";
import { ShieldAlert, CheckCircle2, XCircle, ChevronRight, Code2 } from "lucide-react";

function ApprovalCard({ approval, onDecide }) {
  const [expanded, setExpanded] = useState(false);
  const [deciding, setDeciding] = useState(false);
  const [comment, setComment] = useState("");
  const pending = approval.status === "pending";
  const decide = async (status) => {
    setDeciding(true);
    try { await onDecide(approval.id, status, comment); }
    finally { setDeciding(false); }
  };
  return <article className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
    <div className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-300"><ShieldAlert className="h-5 w-5" /></span>
          <div className="min-w-0"><h3 className="text-sm font-semibold text-slate-900 dark:text-gray-100">{approval.action_type}</h3><p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{approval.description || ""}</p></div>
        </div>
        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-semibold ${approval.status === "rejected" ? "border-red-200 bg-red-50 text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300" : approval.status === "approved" ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300" : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300"}`}>{approval.status}</span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
        <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60"><p className="text-slate-500 dark:text-slate-400">Agent</p><p className="mt-1 truncate font-medium text-slate-800 dark:text-slate-200">{approval.agent_name || approval.agent_id || ""}</p></div>
        <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60"><p className="text-slate-500 dark:text-slate-400">Requested</p><p className="mt-1 font-medium text-slate-800 dark:text-slate-200">{approval.created_at ? new Date(approval.created_at).toLocaleString() : ""}</p></div>
      </div>
      <button className="mt-4 flex items-center gap-1.5 text-xs font-medium text-blue-700 hover:text-blue-800 dark:text-blue-300" onClick={() => setExpanded(!expanded)}><Code2 className="h-3.5 w-3.5" />{expanded ? "Hide" : "Show"} proposed action<ChevronRight className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-90" : ""}`} /></button>
      {expanded && <pre className="mt-3 max-h-40 overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-emerald-200">{JSON.stringify(approval.proposed_inputs || {}, null, 2)}</pre>}
    </div>
    {pending && <div className="space-y-3 border-t border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900/30">
      <textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="Optional note for the audit log" rows={2} className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200" />
      <div className="flex gap-2">
        <button disabled={deciding} onClick={() => decide("approved")} className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-300 dark:hover:bg-emerald-500/25"><CheckCircle2 className="h-4 w-4" />Approve</button>
        <button disabled={deciding} onClick={() => decide("rejected")} className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-red-300 bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50 dark:border-red-500/30 dark:bg-red-500/15 dark:text-red-300 dark:hover:bg-red-500/25"><XCircle className="h-4 w-4" />Reject</button>
      </div>
    </div>}
  </article>;
}

export default function ApprovalsView({ approvals = [], loading = false, onDecide }) {
  const [filter, setFilter] = useState("pending");
  const filtered = approvals.filter(a => filter === "all" || a.status === filter);
  if (loading) return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500/30 border-t-blue-600" /></div>;
  return <div className="space-y-6 text-slate-800 dark:text-gray-200">
    <header className="flex flex-wrap items-end justify-between gap-4"><div><h1 className="text-xl font-bold text-slate-900 dark:text-gray-100">Human Approvals</h1><p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Review and authorize agent actions that require human oversight.</p></div><div className="flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900">{["pending", "approved", "rejected", "all"].map(f => <button key={f} onClick={() => setFilter(f)} className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition ${filter === f ? "bg-blue-600 text-white dark:bg-blue-500" : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"}`}>{f}</button>)}</div></header>
    {filtered.length ? <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">{filtered.map(a => <ApprovalCard key={a.id} approval={a} onDecide={onDecide} />)}</div> : <div className="rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center dark:border-slate-800 dark:bg-slate-900/40"><CheckCircle2 className="mx-auto mb-4 h-10 w-10 text-emerald-600 dark:text-emerald-400"/><h2 className="font-semibold text-slate-900 dark:text-gray-100">No {filter === "all" ? "" : filter} approvals</h2><p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Approvals recorded in this workspace will appear here.</p></div>}
  </div>;
}
