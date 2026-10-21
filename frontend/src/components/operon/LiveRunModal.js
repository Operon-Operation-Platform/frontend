"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  X, CheckCircle2, XCircle, Clock, AlertTriangle, ChevronDown,
  ChevronRight, Activity, Zap, Code2, Eye, Loader2,
} from "lucide-react";

const STEP_STATUS_CONFIG = {
  completed: { icon: CheckCircle2, color: "text-emerald-500 dark:text-emerald-400", line: "bg-emerald-300 dark:bg-emerald-500/30" },
  failed:    { icon: XCircle,      color: "text-red-500 dark:text-red-400",         line: "bg-red-300 dark:bg-red-500/30" },
  running:   { icon: Loader2,      color: "text-cyan-500 dark:text-cyan-400",       line: "bg-cyan-300 dark:bg-cyan-500/30" },
  pending:   { icon: Clock,        color: "text-slate-400 dark:text-gray-500",      line: "bg-slate-300 dark:bg-slate-700" },
  skipped:   { icon: ChevronRight, color: "text-slate-400 dark:text-gray-500",      line: "bg-slate-300 dark:bg-slate-700" },
};

function StepRow({ step, index, isLast }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = STEP_STATUS_CONFIG[step.status] || STEP_STATUS_CONFIG.pending;
  const Icon = cfg.icon;
  const isRunning = step.status === "running";

  return (
    <div className="flex gap-3">
      {/* Timeline line */}
      <div className="flex flex-col items-center">
        <div className={`flex-shrink-0 w-8 h-8 rounded-full border-2 ${
          isRunning
            ? "border-cyan-500 bg-cyan-500/10"
            : "border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800"
        } flex items-center justify-center z-10`}>
          <Icon className={`w-4 h-4 ${cfg.color} ${isRunning ? "animate-spin" : ""}`} />
        </div>
        {!isLast && <div className={`w-0.5 flex-1 ${cfg.line} mt-1 mb-1 min-h-[16px] transition-colors duration-200`} />}
      </div>

      {/* Step content */}
      <div className="flex-1 pb-4">
        <div
          className={`flex items-start justify-between cursor-pointer ${step.payload ? "hover:opacity-80" : ""}`}
          onClick={() => step.payload && setExpanded(!expanded)}
        >
          <div>
            <p className={`text-sm sm:text-base font-semibold ${
              isRunning ? "text-cyan-600 dark:text-cyan-400" : "text-slate-800 dark:text-gray-200"
            }`}>
              {step.name}
            </p>
            <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">
              {step.duration_ms ? `${step.duration_ms.toFixed(0)}ms` : isRunning ? "In progress…" : ""}
              {step.tool_name && <span className="ml-2 font-mono text-slate-600 dark:text-gray-400">{step.tool_name}</span>}
            </p>
          </div>
          {step.payload && (
            <button className="text-slate-400 hover:text-slate-600 dark:hover:text-gray-200 mt-0.5 flex-shrink-0">
              {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          )}
        </div>

        {/* Payload Inspector */}
        {expanded && step.payload && (
          <div className="mt-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900/60">
              <Code2 className="w-3.5 h-3.5 text-slate-500 dark:text-gray-400" />
              <span className="text-xs font-mono text-slate-600 dark:text-gray-400">Payload</span>
            </div>
            <pre className="p-3 text-xs font-mono text-emerald-600 dark:text-emerald-400 overflow-auto max-h-48 leading-relaxed">
              {JSON.stringify(step.payload, null, 2)}
            </pre>
          </div>
        )}

        {step.error && (
          <div className="mt-2 p-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl">
            <p className="text-xs text-red-600 dark:text-red-400 font-mono leading-relaxed">{step.error}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function LiveRunModal({ run, onClose }) {
  const [liveSteps, setLiveSteps] = useState(run?.steps || []);
  const [liveStatus, setLiveStatus] = useState(run?.status || "running");
  const [tab, setTab] = useState("timeline");
  const eventSourceRef = useRef(null);

  useEffect(() => {
    if (!run?.run_id) return;
    if (run.status === "running" || !run.steps?.length) {
      try {
        const token = localStorage.getItem("operon_token") || "";
        const url = `/api/v1/runs/${run.run_id}/stream`;
        const es = new EventSource(`${url}?token=${token}`);
        eventSourceRef.current = es;

        es.onmessage = (evt) => {
          try {
            const data = JSON.parse(evt.data);
            if (data.type === "step") {
              setLiveSteps(prev => {
                const idx = prev.findIndex(s => s.name === data.name);
                if (idx >= 0) {
                  const next = [...prev];
                  next[idx] = { ...next[idx], ...data };
                  return next;
                }
                return [...prev, data];
              });
            } else if (data.type === "status") {
              setLiveStatus(data.status);
              if (data.status !== "running") es.close();
            }
          } catch {}
        };

        es.onerror = () => es.close();
        return () => es.close();
      } catch {}
    } else {
      setLiveSteps(run.steps || []);
      setLiveStatus(run.status);
    }
  }, [run]);

  if (!run) return null;

  const TABS = [
    { id: "timeline", label: "Timeline",       icon: Activity },
    { id: "input",    label: "Input Payload",   icon: Eye },
    { id: "output",   label: "Output",          icon: Zap },
  ];

  const statusColors = {
    running:   "text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-500/10 border-cyan-200 dark:border-cyan-500/20",
    succeeded: "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20",
    failed:    "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20",
  };

  return (
    <div
      className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-start sm:items-center justify-center p-4 sm:p-6 pt-16 sm:pt-20 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl my-auto animate-slide-up text-slate-800 dark:text-gray-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-5 sm:p-6 border-b border-slate-200 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <h2 className="font-bold text-slate-900 dark:text-gray-100 text-lg sm:text-xl">
                Run Details & Execution Traces
              </h2>
              <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${statusColors[liveStatus] || statusColors.running}`}>
                {liveStatus}
              </span>
            </div>
            <p className="text-xs font-mono text-slate-500 dark:text-gray-400">{run.run_id}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-gray-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 px-5 sm:px-6 pt-4 border-b border-slate-200 dark:border-slate-800">
          {TABS.map(t => {
            const TIcon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition mb-3 ${
                  tab === t.id
                    ? "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-gray-100 shadow-xs"
                    : "text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-gray-200"
                }`}
              >
                <TIcon className="w-4 h-4" /> {t.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6">
          {tab === "timeline" && (
            <div>
              {liveStatus === "running" && liveSteps.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <Loader2 className="w-8 h-8 text-cyan-600 dark:text-cyan-400 animate-spin" />
                  <p className="text-slate-500 dark:text-gray-400 text-sm font-medium">Streaming execution steps…</p>
                </div>
              )}
            {liveSteps.map((step, i) => (
                <StepRow key={step.name || step.step_name || i} step={{ ...step, name: step.name || step.step_name }} index={i} isLast={i === liveSteps.length - 1} />
              ))}
            </div>
          )}
          {tab === "input" && (
            <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
              <div className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900/60">
                <span className="text-xs font-mono text-slate-600 dark:text-gray-400">Input Payload</span>
              </div>
              <pre className="p-4 text-xs font-mono text-cyan-700 dark:text-cyan-300 overflow-auto leading-relaxed">
                {JSON.stringify(run.input_payload || {}, null, 2)}
              </pre>
            </div>
          )}
          {tab === "output" && (
            <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
              <div className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900/60">
                <span className="text-xs font-mono text-slate-600 dark:text-gray-400">Final Output</span>
              </div>
              <pre className="p-4 text-xs font-mono text-emerald-700 dark:text-emerald-400 overflow-auto leading-relaxed">
                {JSON.stringify(run.output_payload || run.output || run.result || {}, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 sm:px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="text-xs text-slate-500 dark:text-gray-400">
            {run.started_at ? `Started ${new Date(run.started_at).toLocaleString()}` : ""}
            {run.duration_ms ? ` · ${(run.duration_ms / 1000).toFixed(2)}s` : ""}
          </div>
          <button
            onClick={onClose}
            className="text-xs sm:text-sm font-semibold text-slate-600 dark:text-gray-300 hover:text-slate-900 dark:hover:text-gray-100 transition px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
