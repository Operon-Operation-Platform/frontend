"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { OperonProvider, useOperon } from "../../context/OperonContext";
import { operonApi, setOperonToken } from "../../api/operon";

import OperonNavbar      from "../../components/operon/OperonNavbar";
import OperonSidebar     from "../../components/operon/OperonSidebar";
import OperonDashboard   from "../../components/operon/OperonDashboard";
import AgentBuilderWorkspace from "../../components/operon/AgentBuilderWorkspace";
import LiveRunModal      from "../../components/operon/LiveRunModal";
import ToolsMcpManager   from "../../components/operon/ToolsMcpManager";
import ApprovalsView     from "../../components/operon/ApprovalsView";
import PlatformAdminConsole from "../../components/operon/PlatformAdminConsole";
import DataSourcesView   from "../../components/operon/DataSourcesView";
import KnowledgeBasesView from "../../components/operon/KnowledgeBasesView";
import RunsView          from "../../components/operon/RunsView";
import AgentDetailView   from "../../components/operon/AgentDetailView";
import OperonSettingsView from "../../features/settings/OperonSettingsView";

function OperonApp() {
  const router = useRouter();
  const { user, workspaces, activeWorkspace, loading, sessionError, sessionExpired, checkSession, switchWorkspace } = useOperon();

  // ── Auth & workspace state ───────────────────────────────────────────
  const [activeTab, setActiveTab]           = useState("dashboard");

  // ── Data state ───────────────────────────────────────────────────────
  const [agents, setAgents]               = useState([]);
  const [runs, setRuns]                   = useState([]);
  const [approvals, setApprovals]         = useState([]);
  const [tools, setTools]                 = useState([]);
  const [mcpServers, setMcpServers]       = useState([]);
  const [toolRequests, setToolRequests]   = useState([]);
  const [adminTenants, setAdminTenants]   = useState([]);
  const [adminMetrics, setAdminMetrics]   = useState({});
  const [adminToolRequests, setAdminToolRequests] = useState([]);

  // ── UI state ─────────────────────────────────────────────────────────
  const [showWizard, setShowWizard]       = useState(false);
  const [selectedRun, setSelectedRun]     = useState(null);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [sidebarOpen, setSidebarOpen]     = useState(false);

  useEffect(() => {
    if (!loading && !user && !sessionError) {
      router.replace("/login?session=missing");
    } else if (!loading && !user && sessionExpired) {
      router.replace("/login?session=invalid");
    }
  }, [loading, user, sessionError, sessionExpired, router]);

  // Sync tab from URL
  useEffect(() => {
    if (typeof window !== "undefined") {
      const tab = new URLSearchParams(window.location.search).get("tab");
      if (tab) setActiveTab(tab);
    }
  }, []);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab !== "agent_detail") setSelectedAgent(null);
    if (typeof window !== "undefined") {
      const url = new URL(window.location);
      url.searchParams.set("tab", tab);
      window.history.replaceState({}, "", url);
    }
  };

  // ── Data fetching ────────────────────────────────────────────────────
  const refreshAll = useCallback(async () => {
    if (!user) return;
    try {
      const [agentRes, runsRes, approvalsRes, toolsRes, mcpRes, reqRes] =
        await Promise.allSettled([
          operonApi.agents.getAgents(),
          operonApi.runs.getRuns(),
          operonApi.approvals.getApprovals(),
          operonApi.toolsAndMcp.getTools(),
          operonApi.toolsAndMcp.getMcpServers(),
          operonApi.toolsAndMcp.getToolRequests(),
        ]);
      if (agentRes.status    === "fulfilled") setAgents(agentRes.value || []);
      if (runsRes.status     === "fulfilled") setRuns(runsRes.value || []);
      if (approvalsRes.status === "fulfilled") setApprovals(approvalsRes.value || []);
      if (toolsRes.status    === "fulfilled") setTools(toolsRes.value || []);
      if (mcpRes.status      === "fulfilled") setMcpServers(mcpRes.value || []);
      if (reqRes.status      === "fulfilled") setToolRequests(reqRes.value || []);
    } catch { /* resilient */ }
  }, [user]);

  const refreshAdmin = useCallback(async () => {
    try {
      const [statsRes, tenantsRes, reqRes] = await Promise.allSettled([
        operonApi.platformAdmin.getStats(),
        operonApi.platformAdmin.getTenants(),
        operonApi.platformAdmin.getToolRequests(),
      ]);
      if (statsRes.status   === "fulfilled") setAdminMetrics(statsRes.value || {});
      if (tenantsRes.status === "fulfilled") setAdminTenants(tenantsRes.value || []);
      if (reqRes.status     === "fulfilled") setAdminToolRequests(reqRes.value || []);
    } catch { /* resilient */ }
  }, []);

  useEffect(() => { if (user) refreshAll(); }, [user, refreshAll]);
  useEffect(() => {
    if (user && activeTab === "admin_console") refreshAdmin();
  }, [user, activeTab, refreshAdmin]);

  // ── Auth actions ─────────────────────────────────────────────────────
  const handleLogout = () => {
    setOperonToken(null);
    setAgents([]); setRuns([]); setApprovals([]);
    setSelectedAgent(null);
    router.replace("/login");
  };

  const handleSwitchWorkspace = async (wsId) => {
    try {
      await switchWorkspace(wsId);
      await refreshAll();
    } catch {}
  };

  // ── Domain handlers ──────────────────────────────────────────────────
  const handleTriggerRun = async (agent, inputPayload = {}) => {
    const res = await operonApi.runs.triggerRun({
        agent_id: agent.id,
        input_payload: inputPayload,
      });
    const runDetails = await operonApi.runs.getRunDetails(res.run_id);
    setSelectedRun(runDetails);
    await refreshAll();
  };

  const handleApprovalDecide = async (id, decision, comment) => {
    try {
      await operonApi.approvals.decide(id, decision, comment);
      await refreshAll();
    } catch (error) { console.error("Unable to save approval decision", error); }
  };

  const handleToolToggle = (tool) => {
    setTools((prev) => prev.map((t) => t.id === tool.id ? { ...t, enabled: !t.enabled } : t));
  };

  const handleRequestTool = async (form) => {
    try {
      await operonApi.toolsAndMcp.requestTool({
        tool_name: form.name,
        description: form.description,
        use_case: [form.system && `Target system: ${form.system}`, form.inputs && `Inputs: ${form.inputs}`, form.expected_output && `Expected output: ${form.expected_output}`].filter(Boolean).join("\n"),
      });
      await refreshAll();
    } catch (error) {
      console.error("Unable to submit tool request", error);
      throw error;
    }
  };

  const handleApproveToolRequest = async (id) => {
    try { await operonApi.platformAdmin.decideToolRequest(id, "approved", ""); refreshAdmin(); } catch {}
  };

  const handleRejectToolRequest = async (id) => {
    try { await operonApi.platformAdmin.decideToolRequest(id, "rejected", ""); refreshAdmin(); } catch {}
  };

  const handleSelectAgent = (agent) => {
    setSelectedAgent(agent);
    setActiveTab("agent_detail");
  };

  // ── Loading / auth guard ─────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-2 border-cyan-500/30 border-t-cyan-500 animate-spin" />
          <p className="text-slate-600 dark:text-gray-400 text-sm font-medium">Loading Operon…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    if (sessionError) {
      return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6">
          <div className="max-w-md text-center">
            <p role="alert" className="text-sm text-red-700 dark:text-red-400">
              Could not verify your session: {sessionError}
            </p>
            <button
              type="button"
              onClick={checkSession}
              className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
            >
              Try again
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <p className="text-sm text-slate-500 dark:text-gray-400">Redirecting to sign in…</p>
      </div>
    );
  }

  // ── Content router ───────────────────────────────────────────────────
  const renderContent = () => {
    switch (activeTab) {
      case "dashboard":
        return (
          <OperonDashboard
            agents={agents} recentRuns={runs} pendingApprovals={approvals}
            onOpenWizard={() => setShowWizard(true)}
            onOpenRun={(r) => setSelectedRun(r)}
            onSelectAgent={handleSelectAgent}
            onApprovalClick={() => handleTabChange("approvals")}
          />
        );
      case "runs":
        return (
          <RunsView
            runs={runs} agents={agents}
            onOpenRun={(r) => setSelectedRun(r)}
            onRefresh={refreshAll}
          />
        );
      case "approvals":
        return (
          <ApprovalsView
            approvals={approvals}
            onDecide={handleApprovalDecide}
            onRefresh={refreshAll}
          />
        );
      case "datasources":
        return <DataSourcesView onRefresh={refreshAll} />;
      case "knowledge":
        return <KnowledgeBasesView onRefresh={refreshAll} />;
      case "tools_mcp":
        return (
          <ToolsMcpManager
            tools={tools} mcpServers={mcpServers} toolRequests={toolRequests}
            onToggleTool={handleToolToggle}
            onConnectMcp={async (server) => { await operonApi.toolsAndMcp.connectMcpServer(server); await refreshAll(); }}
            onDisconnectMcp={async (server) => { await operonApi.toolsAndMcp.disconnectMcpServer(server.id); await refreshAll(); }}
            onApproveMcpTool={async (server, tool, approved) => { await operonApi.toolsAndMcp.approveMcpTool(server.id, tool.id, approved); await refreshAll(); }}
            onRequestTool={handleRequestTool}
            onRefresh={refreshAll}
          />
        );
      case "admin_console":
        return (
          <PlatformAdminConsole
            metrics={adminMetrics} tenants={adminTenants}
            toolRequests={adminToolRequests}
            onApproveToolRequest={handleApproveToolRequest}
            onRejectToolRequest={handleRejectToolRequest}
            onRefresh={refreshAdmin}
          />
        );
      case "settings":
        return <OperonSettingsView />;
      case "agent_detail":
        return selectedAgent && agents.some((item) => item.id === selectedAgent.id) ? (
          <AgentDetailView
            key={selectedAgent.id}
            agent={selectedAgent}
            onOpenRun={(r) => setSelectedRun(r)}
            onBack={() => handleTabChange("dashboard")}
            onRefresh={refreshAll}
          />
        ) : <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center dark:border-slate-800 dark:bg-slate-900"><p className="text-slate-700 dark:text-slate-300">This agent is no longer available in this workspace.</p><button onClick={() => handleTabChange("dashboard")} className="mt-4 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white">Back to agents</button></div>;
      default:
        return (
          <OperonDashboard
            agents={agents} recentRuns={runs} pendingApprovals={approvals}
            onOpenWizard={() => setShowWizard(true)}
            onOpenRun={(r) => setSelectedRun(r)}
            onSelectAgent={handleSelectAgent}
            onTriggerRun={handleTriggerRun}
            onApprovalClick={() => handleTabChange("approvals")}
          />
        );
    }
  };

  // ── Main layout ──────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-gray-200 flex transition-colors duration-200">

      {/* ── Desktop sidebar (left, always visible) ── */}
      <div className="hidden md:flex md:flex-col md:w-64 md:shrink-0">
        <OperonSidebar
          isOpen={true}
          onClose={() => {}}
          activeTab={activeTab}
          onTabChange={handleTabChange}
          pendingApprovalsCount={approvals.length}
          user={user}
          activeWorkspace={activeWorkspace}
          agents={agents}
          selectedAgent={selectedAgent}
          onSelectAgent={handleSelectAgent}
          onLogout={handleLogout}
          isMobile={false}
        />
      </div>

      {/* ── Mobile sidebar (right slide-in drawer) ── */}
      <OperonSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        activeTab={activeTab}
        onTabChange={handleTabChange}
        pendingApprovalsCount={approvals.length}
        user={user}
        activeWorkspace={activeWorkspace}
        agents={agents}
        selectedAgent={selectedAgent}
        onSelectAgent={handleSelectAgent}
        onLogout={handleLogout}
        isMobile={true}
      />

      {/* ── Main content column ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar with company switcher, theme toggle, and Create Agent */}
        <OperonNavbar
          onOpenSidebar={() => setSidebarOpen(true)}
          user={user}
          activeWorkspace={activeWorkspace}
          workspaces={workspaces}
          onSwitchWorkspace={handleSwitchWorkspace}
          onOpenWizard={() => setShowWizard(true)}
          activeTab={activeTab}
        />

        {/* Page content */}
        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 overflow-auto">
          {renderContent()}
        </main>
      </div>

      {/* ── Modals ── */}
      {showWizard && (
        <AgentBuilderWorkspace
          onClose={() => setShowWizard(false)}
          onAgentPublished={(newAgent) => {
            setShowWizard(false);
            refreshAll();
            if (newAgent) handleSelectAgent(newAgent);
          }}
        />
      )}
      {selectedRun && (
        <LiveRunModal run={selectedRun} onClose={() => setSelectedRun(null)} />
      )}
    </div>
  );
}

// ── Wrap with OperonProvider to fix useOperon error ──────────────────────────
export default function OperonPage() {
  return (
    <OperonProvider>
      <OperonApp />
    </OperonProvider>
  );
}
