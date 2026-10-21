"use client";

import React, { useEffect, useRef } from "react";
import OperonLogo from "../ui/OperonLogo";
import { useTheme } from "../../context/ThemeContext";
import {
  LayoutDashboard,
  Activity,
  ShieldAlert,
  Database,
  Wrench,
  Shield,
  Settings,
  LogOut,
  BookOpen,
  X,
  ChevronRight,
  UserCircle,
  Bot,
  Sliders,
  CheckCircle2,
  FileCheck,
} from "lucide-react";

const NAV_SECTIONS = [
  {
    title: "Operations",
    items: [
      { id: "dashboard", label: "Dashboard & Agents", icon: LayoutDashboard },
      { id: "runs", label: "Live Runs", icon: Activity },
      { id: "approvals", label: "Approvals", icon: ShieldAlert, badge: true },
    ],
  },
  {
    title: "Data & Knowledge",
    items: [
      { id: "datasources", label: "Data Sources", icon: Database },
      { id: "knowledge", label: "Knowledge Bases", icon: BookOpen },
      { id: "tools_mcp", label: "Tools & MCP", icon: Wrench },
    ],
  },
  {
    title: "Administration",
    items: [
      { id: "admin_console", label: "Admin Console", icon: Shield },
      { id: "settings", label: "Workspace Settings", icon: Settings },
    ],
  },
];

function NavItem({ item, isActive, onClick, pendingCount }) {
  const Icon = item.icon;
  return (
    <button
      onClick={() => onClick(item.id)}
      className={`
        w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium
        transition-all duration-150 group relative
        ${isActive
          ? "bg-blue-50 text-blue-700 font-semibold shadow-xs border border-blue-200/60 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-400/20"
          : "text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800"
        }
      `}
    >
      <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-blue-600 dark:text-blue-300" : "text-slate-500 group-hover:text-slate-700 dark:text-slate-500 dark:group-hover:text-slate-200"}`} />
      <span className="flex-1 text-left">{item.label}</span>
      {item.badge && pendingCount > 0 && (
        <span className="px-1.5 py-0.5 rounded-full bg-amber-500 text-slate-950 font-bold text-[10px]">
          {pendingCount}
        </span>
      )}
      {isActive && <ChevronRight className="w-3.5 h-3.5 text-blue-600 ml-auto" />}
    </button>
  );
}

export default function OperonSidebar({
  isOpen,
  onClose,
  activeTab,
  onTabChange,
  pendingApprovalsCount,
  user,
  activeWorkspace,
  agents = [],
  selectedAgent,
  onSelectAgent,
  onLogout,
  isMobile,
}) {
  const { theme } = useTheme();
  const sidebarRef = useRef(null);

  useEffect(() => {
    if (!isMobile || !isOpen) return;
    const handler = (e) => {
      if (sidebarRef.current && !sidebarRef.current.contains(e.target)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isMobile, isOpen, onClose]);

  useEffect(() => {
    if (isMobile && isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [isMobile, isOpen]);

  const handleNavClick = (id) => {
    onTabChange(id);
    if (isMobile && onClose) {
      onClose();
    }
  };

  const sidebarContent = (
    <aside
      ref={sidebarRef}
      className={`
        flex flex-col h-full w-64 shrink-0
        bg-white border-r border-slate-200 dark:bg-slate-950 dark:border-slate-800
        transition-colors duration-200
        ${isMobile
          ? `fixed top-0 right-0 h-full z-50 shadow-2xl ${isOpen ? "translate-x-0" : "translate-x-full"}`
          : "sticky top-0 h-screen"
        }
      `}
    >
      {/* Brand Header */}
      <div className="flex items-center justify-between px-5 h-16 border-b border-slate-100 dark:border-slate-800 shrink-0">
        <OperonLogo size={26} variant="dark" />
        <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:border-blue-500/20">
            Enterprise
          </span>
          {isMobile && (
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-slate-800 transition"
              aria-label="Close sidebar"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Navigation Scroll */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">

        {/* Section: My Agent (Section 14) */}
        {agents && agents.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between px-3">
              <span className="text-[11px] font-bold uppercase text-slate-400 tracking-wider">
                My Agent
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                {agents.length} active
              </span>
            </div>

            <div className="space-y-1">
              {agents.slice(0, 3).map((a) => {
                const isSelected = selectedAgent?.id === a.id && activeTab === "agent_detail";
                return (
                  <button
                    key={a.id}
                    onClick={() => {
                      if (onSelectAgent) onSelectAgent(a);
                      handleNavClick("agent_detail");
                    }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition ${
                      isSelected
                        ? "bg-blue-600 text-white font-semibold shadow-xs dark:bg-blue-500/20 dark:text-blue-200"
                        : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                    }`}
                  >
                    <Bot className={`w-3.5 h-3.5 shrink-0 ${isSelected ? "text-white" : "text-blue-600"}`} />
                    <span className="truncate flex-1 text-left">{a.name}</span>
                    <span className={`w-1.5 h-1.5 rounded-full ${a.status === "active" ? (isSelected ? "bg-white" : "bg-emerald-500") : "bg-slate-300"}`} />
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Core Platform Sections */}
        {NAV_SECTIONS.map((sec) => (
          <div key={sec.title} className="space-y-1">
            <p className="text-[11px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-wider px-3 mb-1.5">
              {sec.title}
            </p>
            {sec.items.map((item) => (
              <NavItem
                key={item.id}
                item={item}
                isActive={activeTab === item.id}
                onClick={handleNavClick}
                pendingCount={pendingApprovalsCount}
              />
            ))}
          </div>
        ))}
      </nav>

      {/* User profile & Sign out */}
      {user && (
        <div className="px-3 py-3 border-t border-slate-100 dark:border-slate-800 shrink-0 space-y-2 bg-slate-50 dark:bg-slate-900">
          <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
            <div className="w-7 h-7 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
              {user.full_name ? user.full_name[0].toUpperCase() : "U"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                {user.full_name || user.email}
              </p>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 capitalize truncate">
                {activeWorkspace?.name || "Workspace"} • {activeWorkspace?.role || "owner"}
              </p>
            </div>
          </div>

          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl
                       text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:text-slate-400 dark:hover:text-rose-300 dark:hover:bg-rose-500/10 text-xs font-semibold transition"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      )}
    </aside>
  );

  if (isMobile) {
    return (
      <>
        <div
          className={`fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-xs transition-opacity duration-300 ${
            isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
          }`}
          onClick={onClose}
        />
        {sidebarContent}
      </>
    );
  }

  return sidebarContent;
}
