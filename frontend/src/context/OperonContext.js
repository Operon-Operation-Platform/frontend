"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { operonApi, getOperonToken, setOperonToken } from "../api/operon";

const OperonContext = createContext(null);

export function OperonProvider({ children }) {
  const router = useRouter();
  const pathname = usePathname();

  const [user, setUser] = useState(null);
  const [workspaces, setWorkspaces] = useState([]);
  const [activeWorkspace, setActiveWorkspace] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionError, setSessionError] = useState("");
  const [sessionExpired, setSessionExpired] = useState(false);

  // Global platform state
  const [agents, setAgents] = useState([]);
  const [runs, setRuns] = useState([]);
  const [approvals, setApprovals] = useState([]);
  const [tools, setTools] = useState([]);
  const [mcpServers, setMcpServers] = useState([]);
  const [toolRequests, setToolRequests] = useState([]);
  const [stats, setStats] = useState({});

  // Bootstrap session
  const checkSession = useCallback(async () => {
    const token = getOperonToken();
    if (!token) {
      setUser(null);
      setSessionError("");
      setSessionExpired(false);
      setLoading(false);
      return;
    }

    setSessionError("");
    setSessionExpired(false);
    try {
      const data = await operonApi.auth.getMe();
      const sessionUser = data?.user ?? (
        data && typeof data === "object" && ("id" in data || "email" in data)
          ? data
          : null
      );
      if (!sessionUser) {
        const fields = data && typeof data === "object" ? Object.keys(data).join(", ") : typeof data;
        throw new Error(
          `Unexpected response from /api/v1/auth/me: HTTP 200 JSON did not include a user (received: ${fields || "empty object"}).`,
        );
      }
      setUser(sessionUser);
      setWorkspaces(data.workspaces || []);
      setActiveWorkspace(data.active_workspace);
    } catch (error) {
      if (error.status === 401) {
        setOperonToken(null);
        setSessionExpired(true);
        setSessionError("The server rejected the saved session token. Please sign in again.");
      } else {
        setSessionError(error.message || "Unable to verify your session.");
      }
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  // Refresh domain data
  const refreshData = useCallback(async () => {
    if (!getOperonToken()) return;
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

      if (agentRes.status === "fulfilled") setAgents(agentRes.value || []);
      if (runsRes.status === "fulfilled") setRuns(runsRes.value || []);
      if (approvalsRes.status === "fulfilled") setApprovals(approvalsRes.value || []);
      if (toolsRes.status === "fulfilled") setTools(toolsRes.value || []);
      if (mcpRes.status === "fulfilled") setMcpServers(mcpRes.value || []);
      if (reqRes.status === "fulfilled") setToolRequests(reqRes.value || []);
    } catch {}
  }, []);

  useEffect(() => {
    if (user) {
      refreshData();
    }
  }, [user, refreshData]);

  const login = async (credentials) => {
    const data = await operonApi.auth.login(credentials);
    if (!data?.access_token || !data?.user) {
      throw new Error("The login response did not include a user and access token.");
    }
    setSessionError("");
    setSessionExpired(false);
    setOperonToken(data.access_token);
    setUser(data.user);
    setWorkspaces(data.workspaces || []);
    setActiveWorkspace(data.active_workspace);
    await refreshData();
    return data;
  };

  const signup = async (payload) => {
    const data = await operonApi.auth.signup(payload);
    if (!data?.access_token || !data?.user) {
      throw new Error("The signup response did not include a user and access token.");
    }
    setSessionError("");
    setSessionExpired(false);
    setOperonToken(data.access_token);
    setUser(data.user);
    setWorkspaces(data.workspaces || []);
    setActiveWorkspace(data.active_workspace);
    await refreshData();
    return data;
  };

  const logout = () => {
    setOperonToken(null);
    setUser(null);
    setWorkspaces([]);
    setActiveWorkspace(null);
    setAgents([]);
    setRuns([]);
    setApprovals([]);
    router.push("/login");
  };

  const switchWorkspace = async (workspaceId) => {
    const data = await operonApi.auth.switchWorkspace(workspaceId);
    if (!data?.access_token || !data?.active_workspace) {
      throw new Error("Workspace switch response did not include a session token and workspace.");
    }
    setOperonToken(data.access_token);
    setActiveWorkspace(data.active_workspace);
    await refreshData();
  };

  return (
    <OperonContext.Provider
      value={{
        user,
        workspaces,
        activeWorkspace,
        loading,
        sessionError,
        sessionExpired,
        checkSession,
        agents,
        runs,
        approvals,
        tools,
        mcpServers,
        toolRequests,
        stats,
        login,
        signup,
        logout,
        switchWorkspace,
        refreshData,
      }}
    >
      {children}
    </OperonContext.Provider>
  );
}

export function useOperon() {
  const context = useContext(OperonContext);
  if (!context) {
    throw new Error("useOperon must be used within an OperonProvider");
  }
  return context;
}
