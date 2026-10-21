"use client";

import React, { useState, useRef, useEffect } from "react";
import OperonLogo from "../ui/OperonLogo";
import { useTheme } from "../../context/ThemeContext";
import {
  Menu,
  Sun,
  Moon,
  Plus,
  Building2,
  ChevronDown,
  CheckCircle2,
} from "lucide-react";

const TAB_TITLES = {
  dashboard: { title: "Agents & Workflows", desc: "Manage autonomous business agents" },
  runs: { title: "Live Runs & Traces", desc: "Real-time execution telemetry" },
  approvals: { title: "Human Approvals", desc: "Review sensitive agent actions" },
  datasources: { title: "Data Sources", desc: "Sandbox databases and connectors" },
  knowledge: { title: "Knowledge Bases", desc: "Vector indexes and document retrieval" },
  tools_mcp: { title: "Tools & MCP", desc: "Model Context Protocol tools" },
  admin_console: { title: "Admin Console", desc: "Platform governance and tenancy" },
  settings: { title: "Settings", desc: "Workspace configuration and team members" },
  agent_detail: { title: "Agent Details", desc: "Configuration and execution history" },
};

export default function OperonNavbar({
  onOpenSidebar,
  user,
  activeWorkspace,
  workspaces = [],
  onSwitchWorkspace,
  onCreateWorkspaceClick,
  onOpenWizard,
  activeTab = "dashboard",
}) {
  const { theme, toggleTheme } = useTheme();
  const [showWsMenu, setShowWsMenu] = useState(false);
  const menuRef = useRef(null);

  // Close workspace dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowWsMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const tabInfo = TAB_TITLES[activeTab] || { title: "Operon Platform", desc: "" };

  return (
    <header className="sticky top-0 z-30 h-16 flex items-center justify-between px-4 sm:px-6 lg:px-8
                       bg-white/90 dark:bg-slate-950/90 backdrop-blur-xl
                       border-b border-slate-200 dark:border-slate-800/80
                       transition-colors duration-200">
      {/* Left side */}
      <div className="flex items-center gap-3">
        {/* Mobile hamburger */}
        <button
          id="hamburger-btn"
          onClick={onOpenSidebar}
          className="md:hidden p-2 rounded-xl text-slate-600 dark:text-gray-300
                     hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          aria-label="Open navigation"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Mobile logo */}
        <div className="md:hidden">
          <OperonLogo size={24} variant={theme === "dark" ? "light" : "dark"} />
        </div>

        {/* Desktop title */}
        <div className="hidden md:block">
          <h1 className="text-base font-bold text-slate-900 dark:text-gray-200 leading-tight">
            {tabInfo.title}
          </h1>
          {tabInfo.desc && (
            <p className="text-xs text-slate-500 dark:text-gray-400">
              {tabInfo.desc}
            </p>
          )}
        </div>
      </div>

      {/* Right side: Company Toggle, Theme Toggle, Create Agent */}
      <div className="flex items-center gap-2.5 sm:gap-3">
        {/* Company / Workspace Switcher */}
        {user && (
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowWsMenu((prev) => !prev)}
              className="flex items-center gap-2 px-3 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-semibold
                         bg-slate-100 hover:bg-slate-200 border border-slate-200
                         dark:bg-slate-900/90 dark:border-slate-800 dark:hover:border-slate-700
                         text-slate-800 dark:text-gray-200 transition shadow-xs max-w-[170px] sm:max-w-[220px]"
              title="Switch Organization / Company Workspace"
            >
              <Building2 className="w-4 h-4 text-cyan-600 dark:text-cyan-400 shrink-0" />
              <span className="truncate">{activeWorkspace?.name || "Workspace"}</span>
              <ChevronDown
                className={`w-3.5 h-3.5 text-slate-500 dark:text-gray-400 transition-transform ${
                  showWsMenu ? "rotate-180" : ""
                }`}
              />
            </button>

            {showWsMenu && (
              <div className="absolute right-0 mt-2 w-56 rounded-2xl
                             bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800
                             shadow-xl shadow-slate-950/10 dark:shadow-black/40 py-1.5 z-50 animate-slide-up">
                <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-gray-400">
                  Switch Company
                </div>
                {workspaces?.map((ws) => (
                  <button
                    key={ws.id}
                    onClick={() => {
                      onSwitchWorkspace(ws.id);
                      setShowWsMenu(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between
                                hover:bg-slate-100 dark:hover:bg-slate-800 transition ${
                                  ws.id === activeWorkspace?.id
                                    ? "text-cyan-600 dark:text-cyan-400 font-semibold bg-cyan-50/50 dark:bg-cyan-500/10"
                                    : "text-slate-700 dark:text-gray-300"
                                }`}
                  >
                    <span className="truncate">{ws.name}</span>
                    {ws.id === activeWorkspace?.id && (
                      <CheckCircle2 className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400 shrink-0" />
                    )}
                  </button>
                ))}
                {onCreateWorkspaceClick && (
                  <div className="border-t border-slate-100 dark:border-slate-800 mt-1 pt-1 px-1">
                    <button
                      onClick={() => {
                        setShowWsMenu(false);
                        onCreateWorkspaceClick();
                      }}
                      className="w-full text-left px-2 py-1.5 text-xs flex items-center gap-2
                                 text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-gray-200
                                 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      New Workspace
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Theme Toggle (Light / Dark mode) */}
        <button
          onClick={toggleTheme}
          aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
          className="p-2 sm:p-2.5 rounded-xl border border-slate-200 dark:border-slate-800
                     bg-slate-100 dark:bg-slate-900/90 hover:bg-slate-200 dark:hover:bg-slate-800
                     text-slate-700 dark:text-gray-200 transition shadow-xs flex items-center justify-center"
        >
          {theme === "dark" ? (
            <Sun className="w-4 h-4 text-amber-400" />
          ) : (
            <Moon className="w-4 h-4 text-slate-600" />
          )}
        </button>

        {/* Create Agent button — at the top right end */}
        {user && (
          <button
            onClick={onOpenWizard}
            className="flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl
                       bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500
                       text-white text-xs sm:text-sm font-semibold shadow-md shadow-cyan-600/20
                       transition active:scale-95 shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Create Agent</span>
          </button>
        )}
      </div>
    </header>
  );
}
