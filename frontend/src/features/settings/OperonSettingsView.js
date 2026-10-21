"use client";

import React, { useState, useEffect } from "react";
import {
  Building2,
  Users,
  Shield,
  Key,
  CheckCircle2,
  AlertCircle,
  Save,
  Plus,
  Mail,
  X,
  Send,
  Copy,
  RefreshCw,
} from "lucide-react";
import { useOperon } from "../../context/OperonContext";
import { operonApi } from "../../api/operon";
import { API_BASE_URL } from "../../config";

export default function OperonSettingsView() {
  const { user, activeWorkspace } = useOperon();
  const [activeTab, setActiveTab] = useState("workspace"); // workspace | team | security | api_keys
  const [savedMsg, setSavedMsg] = useState("");
  const [apiKeyStatus, setApiKeyStatus] = useState(null);
  const [generatedApiKey, setGeneratedApiKey] = useState("");
  const [apiKeyLoading, setApiKeyLoading] = useState(false);
  const [apiKeyError, setApiKeyError] = useState("");
  const [apiKeyCopied, setApiKeyCopied] = useState(false);

  const [workspaceName, setWorkspaceName] = useState(activeWorkspace?.name || "");
  const [businessTimezone, setBusinessTimezone] = useState("");
  const [retentionDays, setRetentionDays] = useState("");

  // Team & Invites state
  const [members, setMembers] = useState([]);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [inviting, setInviting] = useState(false);
  const [inviteFeedback, setInviteFeedback] = useState(null);

  useEffect(() => {
    // Attempt to load workspace members from backend
    operonApi.auth
      .getMembers?.()
      .then((data) => {
        setMembers(Array.isArray(data) ? data : []);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setWorkspaceName(activeWorkspace?.name || "");
  }, [activeWorkspace?.id, activeWorkspace?.name]);

  useEffect(() => {
    if (activeTab !== "api_keys") return;

    let cancelled = false;
    setGeneratedApiKey("");
    setApiKeyStatus(null);
    setApiKeyLoading(true);
    setApiKeyError("");
    operonApi.auth.getApiKey()
      .then((status) => {
        if (!cancelled) setApiKeyStatus(status);
      })
      .catch((error) => {
        if (!cancelled) setApiKeyError(error.message || "Could not load API key status.");
      })
      .finally(() => {
        if (!cancelled) setApiKeyLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeTab, activeWorkspace?.id]);

  const handleSave = (e) => {
    e.preventDefault();
    setSavedMsg("Workspace profile persistence is not configured on the server yet; no changes were saved.");
    setTimeout(() => setSavedMsg(""), 3500);
  };

  const handleSendInvite = async (e) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviting(true);
    setInviteFeedback(null);

    const companyName = activeWorkspace?.name || "Operon Workspace";
    try {
      const res = await operonApi.auth.inviteMember({
        email: inviteEmail.trim(),
        role: inviteRole,
      });

      setInviteFeedback({
        type: "success",
        msg: res?.message || `Invitation recorded for ${inviteEmail} in ${companyName}.`,
      });

      try {
        const currentMembers = await operonApi.auth.getMembers();
        setMembers(Array.isArray(currentMembers) ? currentMembers : []);
      } catch {
        // Keep the database-confirmed invite response; member refresh can retry on page load.
      }

      setTimeout(() => {
        setInviteEmail("");
        setShowInviteModal(false);
        setInviteFeedback(null);
      }, 2500);
    } catch (err) {
      setInviteFeedback({
        type: "error",
        msg: err.message || "The invitation could not be recorded.",
      });
    } finally {
      setInviting(false);
    }
  };

  const handleGenerateApiKey = async () => {
    if (
      apiKeyStatus?.has_api_key &&
      !window.confirm("Rotating this key will immediately invalidate the currently active key. Continue?")
    ) {
      return;
    }

    setApiKeyLoading(true);
    setApiKeyError("");
    setGeneratedApiKey("");
    try {
      const result = await operonApi.auth.generateApiKey();
      setGeneratedApiKey(result.api_key);
      setApiKeyStatus({
        has_api_key: true,
        key_prefix: result.key_prefix,
        rotated_at: result.rotated_at,
      });
    } catch (error) {
      setApiKeyError(error.message || "Could not generate an API key.");
    } finally {
      setApiKeyLoading(false);
    }
  };

  const handleCopyApiKey = async () => {
    try {
      await navigator.clipboard.writeText(generatedApiKey);
      setApiKeyCopied(true);
      window.setTimeout(() => setApiKeyCopied(false), 2000);
    } catch {
      setApiKeyError("Could not copy the API key. Select and copy it manually.");
    }
  };

  return (
    <div className="space-y-6 animate-fade-in text-slate-800 dark:text-gray-200">
      {/* Top Header */}
      <div className="pb-6 border-b border-slate-200 dark:border-slate-800">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-gray-100">
          Workspace Settings & Administration
        </h1>
        <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">
          Manage workspace profile, team membership, and security settings.
        </p>
      </div>

      {savedMsg && (
        <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-amber-800 dark:text-amber-300 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <span>{savedMsg}</span>
        </div>
      )}

      {/* Settings Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 overflow-x-auto">
        {[
          { id: "workspace", label: "Workspace Profile", icon: Building2 },
          { id: "team", label: "Team Members", icon: Users },
          { id: "security", label: "Security & Sandbox", icon: Shield },
          { id: "api_keys", label: "API Keys & Vault", icon: Key },
        ].map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`pb-3 px-3.5 text-sm font-medium border-b-2 transition flex items-center gap-2 whitespace-nowrap ${
                activeTab === t.id
                  ? "border-cyan-600 text-cyan-700 dark:border-cyan-400 dark:text-cyan-400 font-semibold"
                  : "border-transparent text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-gray-200"
              }`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Tab: Workspace Profile */}
      {activeTab === "workspace" && (
        <div className="bg-white dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 max-w-2xl shadow-xs">
          <form onSubmit={handleSave} className="space-y-5 text-sm">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-gray-300 mb-1.5">Workspace Name</label>
              <input
                type="text"
                required
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-gray-100 focus:outline-none focus:border-cyan-500 text-sm"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-gray-300 mb-1.5">Organization ID</label>
              <input
                type="text"
                disabled
                value={activeWorkspace?.id || ""}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 font-mono text-xs text-slate-500 dark:text-gray-400"
              />
              <p className="text-xs text-slate-500 dark:text-gray-400 mt-1">Immutable organization reference used across multi-tenant database records.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-gray-300 mb-1.5">Primary Timezone</label>
                <select
                  value={businessTimezone}
                  onChange={(e) => setBusinessTimezone(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-gray-200 focus:outline-none focus:border-cyan-500 text-sm"
                >
                  <option value="">Not configured</option>
                  <option value="America/New_York (UTC-5)">America/New_York (UTC-5)</option>
                  <option value="America/Los_Angeles (UTC-8)">America/Los_Angeles (UTC-8)</option>
                  <option value="Europe/London (UTC+0)">Europe/London (UTC+0)</option>
                  <option value="Asia/Tokyo (UTC+9)">Asia/Tokyo (UTC+9)</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 dark:text-gray-300 mb-1.5">Execution Run Audit Retention</label>
                <select
                  value={retentionDays}
                  onChange={(e) => setRetentionDays(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-gray-200 focus:outline-none focus:border-cyan-500 text-sm"
                >
                  <option value="">Not configured</option>
                  <option value="30">30 Days</option>
                  <option value="90">90 Days (Enterprise Default)</option>
                  <option value="365">1 Year (Compliance)</option>
                  <option value="unlimited">Indefinite</option>
                </select>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                type="submit"
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-semibold shadow-sm transition flex items-center gap-2 text-sm"
              >
                <Save className="w-4 h-4" />
                Save Changes
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tab: Team Members */}
      {activeTab === "team" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-slate-600 dark:text-gray-400">
              Workspace Collaborators ({members.length})
            </span>
            <button
              onClick={() => setShowInviteModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white text-sm font-semibold shadow-sm transition"
            >
              <Plus className="w-4 h-4" />
              Invite Member
            </button>
          </div>

          <div className="bg-white dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-gray-400 uppercase tracking-wider text-xs">
                <tr>
                  <th className="py-3.5 px-4 font-semibold">User</th>
                  <th className="py-3.5 px-4 font-semibold">Email</th>
                  <th className="py-3.5 px-4 font-semibold">Role</th>
                  <th className="py-3.5 px-4 font-semibold">Joined / Invited</th>
                  <th className="py-3.5 px-4 font-semibold text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {members.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition">
                    <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-gray-100">{m.name}</td>
                    <td className="py-3.5 px-4 text-slate-600 dark:text-gray-300">{m.email}</td>
                    <td className="py-3.5 px-4">
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold capitalize bg-cyan-50 text-cyan-700 dark:bg-cyan-500/10 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-500/30">
                        {m.role}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 dark:text-gray-400 text-xs">
                      {m.created_at ? new Date(m.created_at).toLocaleDateString() : "Active"}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <span
                        className={`font-semibold text-xs ${
                          m.status === "Invited"
                            ? "text-amber-600 dark:text-amber-400"
                            : "text-emerald-600 dark:text-emerald-400"
                        }`}
                      >
                        {m.status || "Active"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Security & Sandbox */}
      {activeTab === "security" && (
        <div className="bg-white dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 max-w-2xl space-y-5 text-sm shadow-xs">
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-gray-100">Tenant Isolation & Database Sandbox</h3>
            <p className="text-slate-500 dark:text-gray-400 mt-0.5 text-xs">Operon enforces structural security controls on every agent tool execution.</p>
          </div>

          <div className="space-y-3.5 pt-2">
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex items-center justify-between">
              <div>
                <span className="font-semibold text-slate-800 dark:text-gray-200 block text-sm">Read-Only Database Enforcement</span>
                <span className="text-slate-500 dark:text-gray-400 text-xs">Disallows destructive mutations (DROP, ALTER, DELETE, UPDATE) on customer SQL connectors.</span>
              </div>
                <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300 border border-amber-200 dark:border-amber-500/20 font-semibold text-xs shrink-0 ml-3">Not configured</span>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex items-center justify-between">
              <div>
                <span className="font-semibold text-slate-800 dark:text-gray-200 block text-sm">Row-Level Tenant Authorization</span>
                <span className="text-slate-500 dark:text-gray-400 text-xs">Organization boundaries are cryptographically verified on every API request.</span>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 font-semibold text-xs shrink-0 ml-3">Active</span>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex items-center justify-between">
              <div>
                <span className="font-semibold text-slate-800 dark:text-gray-200 block text-sm">Human-in-the-Loop Financial Gating</span>
                <span className="text-slate-500 dark:text-gray-400 text-xs">Actions marked as requiring approval pause for a human decision.</span>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20 font-semibold text-xs shrink-0 ml-3">Active</span>
            </div>
          </div>
        </div>
      )}

      {/* Tab: API Keys */}
      {activeTab === "api_keys" && (
        <div className="bg-white dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 max-w-2xl space-y-5 text-sm shadow-xs">
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-gray-100">Your Operon API Key</h3>
            <p className="text-slate-500 dark:text-gray-400 mt-0.5 text-xs">
              Generate a personal key for {user?.email || "your account"}. It can trigger agents in this workspace only.
            </p>
          </div>

          {apiKeyError && (
            <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
              {apiKeyError}
            </p>
          )}

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-300">
            {apiKeyLoading ? (
              <span className="flex items-center gap-2"><RefreshCw className="h-4 w-4 animate-spin" /> Loading API key status…</span>
            ) : apiKeyStatus?.has_api_key ? (
              <div>
                <p>
                  Personal key active for this workspace: <code className="font-mono">{apiKeyStatus.key_prefix}…</code>
                </p>
                {apiKeyStatus.rotated_at && (
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Generated {new Date(apiKeyStatus.rotated_at).toLocaleString()}
                  </p>
                )}
              </div>
            ) : (
              <p>No API key has been generated for your account in this workspace.</p>
            )}
          </div>

          {generatedApiKey && (
            <div className="space-y-3 rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-500/30 dark:bg-amber-500/10">
              <p className="font-semibold text-amber-900 dark:text-amber-200">
                Copy this key now. It will not be shown again.
              </p>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={generatedApiKey}
                  aria-label="Generated API key"
                  className="min-w-0 flex-1 rounded-lg border border-amber-300 bg-white px-3 py-2 font-mono text-xs text-slate-900 dark:border-amber-500/30 dark:bg-slate-950 dark:text-slate-100"
                />
                <button
                  type="button"
                  onClick={handleCopyApiKey}
                  className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700"
                >
                  <Copy className="h-3.5 w-3.5" />
                  {apiKeyCopied ? "Copied" : "Copy"}
                </button>
              </div>
            </div>
          )}

          <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
            <h4 className="font-semibold text-slate-900 dark:text-slate-100">Trigger an agent</h4>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
              Send the key as a Bearer token. The key is scoped to this workspace and can only start agent runs.
            </p>
            <pre className="mt-3 overflow-x-auto rounded-lg bg-slate-950 p-3 text-xs text-slate-200">
{`curl -X POST "${API_BASE_URL}/api/v1/runs/trigger" \\
  -H "Authorization: Bearer <YOUR_OPERON_API_KEY>" \\
  -H "Content-Type: application/json" \\
  -d '{"agent_id":"<AGENT_ID>","input_payload":{"subject":"Task title","body":"Task details"}}'`}
            </pre>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleGenerateApiKey}
              disabled={apiKeyLoading}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:from-cyan-500 hover:to-indigo-500 disabled:opacity-50"
            >
              <Key className="h-4 w-4" />
              {apiKeyLoading ? "Generating…" : apiKeyStatus?.has_api_key ? "Rotate API Key" : "Generate API Key"}
            </button>
          </div>
        </div>
      )}

      {/* Invite Member Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 animate-slide-up">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-cyan-50 dark:bg-cyan-500/10 border border-cyan-200 dark:border-cyan-500/20 flex items-center justify-center text-cyan-600 dark:text-cyan-400">
                  <Mail className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-base text-slate-900 dark:text-gray-100">
                  Invite Member to Workspace
                </h3>
              </div>
              <button
                onClick={() => setShowInviteModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-gray-200 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {inviteFeedback && (
              <div
                className={`mb-4 p-3 rounded-xl text-xs flex items-center gap-2 ${
                  inviteFeedback.type === "success"
                    ? "bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
                    : "bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-700 dark:text-red-300"
                }`}
              >
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{inviteFeedback.msg}</span>
              </div>
            )}

            <form onSubmit={handleSendInvite} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300 mb-1.5">
                  Recipient Email Address
                </label>
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="colleague@company.com"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-gray-100 placeholder:text-slate-400 text-sm focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300 mb-1.5">
                  Role Assignment
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-gray-200 text-sm focus:outline-none focus:border-cyan-500"
                >
                  <option value="member">Member (Can run and inspect agents)</option>
                  <option value="admin">Administrator (Can manage tools, knowledge & team)</option>
                  <option value="viewer">Viewer (Read-only telemetry access)</option>
                </select>
              </div>

              {/* Email Content Preview */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-xs space-y-1">
                <span className="font-semibold text-slate-500 dark:text-gray-400 block uppercase tracking-wider text-[10px]">
                  Email Notification Preview
                </span>
                <p className="text-slate-700 dark:text-gray-300 italic">
                  &ldquo;{user?.full_name || "A team administrator"} has sent you an invite to join {activeWorkspace?.name || "their company"} on Operon.&rdquo;
                </p>
              </div>

              <div className="flex items-center gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={inviting || !inviteEmail.trim()}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 disabled:opacity-50 text-white text-sm font-semibold transition shadow-md shadow-cyan-600/20 flex items-center justify-center gap-1.5"
                >
                  {inviting ? (
                    <span>Sending email…</span>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Send Invitation</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
