"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Eye,
  EyeOff,
  Lock,
  Mail,
  ArrowRight,
  AlertCircle,
  Bot,
  Shield,
  CheckCircle2,
} from "lucide-react";
import { useOperon } from "../../context/OperonContext";
import { getOperonToken } from "../../api/operon";
import OperonLogo from "../../components/ui/OperonLogo";

export default function LoginForm() {
  const router = useRouter();
  const { login } = useOperon();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const sessionStatus = new URLSearchParams(window.location.search).get("session");
    if (sessionStatus === "missing" && getOperonToken()) {
      router.replace("/operon");
      return;
    }

    if (sessionStatus === "invalid") {
      setError("Sign-in succeeded, but the server rejected the session token. Please sign in again.");
    }
  }, [router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Please enter your email and password.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await login({ email, password });
      router.push("/operon");
    } catch (err) {
      setError(err.message || "Invalid email or password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-200 bg-[radial-gradient(#94a3b8_1px,transparent_1px)] [background-size:16px_16px] flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-5xl bg-white rounded-2xl shadow-2xl shadow-slate-900/15 overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-[580px]">
        {/* Left Column: Form */}
        <div className="lg:col-span-7 p-8 sm:p-12 flex flex-col justify-between bg-white">
          <div>
            <div className="mb-8">
              <OperonLogo size={34} />
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-950 mt-6 tracking-tight">
                Sign in to Operon
              </h1>
              <p className="text-sm font-medium text-slate-600 mt-1.5 leading-relaxed">
                Access your company workspace, agent orchestrator, and real-time operations telemetry.
              </p>
            </div>

            {error && (
              <div
                role="alert"
                className="mb-6 p-3.5 rounded-xl bg-red-50 border-2 border-red-300 text-red-900 text-sm font-semibold flex items-center gap-2.5 shadow-sm"
              >
                <AlertCircle className="w-4 h-4 shrink-0 text-red-700" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="login-email"
                  className="block text-sm font-bold text-slate-900 mb-1.5"
                >
                  Work Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-600 absolute left-3.5 top-3.5 pointer-events-none" />
                  <input
                    id="login-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@company.com"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-700 bg-white text-slate-950 font-semibold text-sm placeholder:text-slate-600 placeholder:font-normal focus:bg-white focus:outline-none focus:border-slate-950 focus:ring-4 focus:ring-slate-900/30 transition-all shadow-inner"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    htmlFor="login-password"
                    className="block text-sm font-bold text-slate-900"
                  >
                    Password
                  </label>
                  <Link
                    href="/forgot-password"
                    className="text-sm font-bold text-blue-900 underline underline-offset-4 hover:text-slate-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-900 transition"
                  >
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-600 absolute left-3.5 top-3.5 pointer-events-none" />
                  <input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full pl-10 pr-11 py-2.5 rounded-xl border border-slate-700 bg-white text-slate-950 font-semibold text-sm placeholder:text-slate-600 placeholder:font-normal focus:bg-white focus:outline-none focus:border-slate-950 focus:ring-4 focus:ring-slate-900/30 transition-all shadow-inner"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-slate-800 hover:text-slate-950 hover:bg-slate-200 p-1 rounded-md transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-900"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="rounded border-2 border-slate-700 text-slate-950 focus:ring-2 focus:ring-slate-900 w-4 h-4 accent-slate-950"
                  />
                  <span className="text-sm font-medium text-slate-800">
                    Remember this device
                  </span>
                </label>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-3 rounded-xl bg-blue-700 hover:bg-blue-800 active:bg-blue-900 disabled:cursor-not-allowed disabled:opacity-60 text-white text-sm font-bold tracking-wide shadow-md border-2 border-blue-900 transition flex items-center justify-center gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-900"
              >
                {loading ? (
                  <span>Signing in…</span>
                ) : (
                  <>
                    <span>Sign in to Workspace</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>

          <div className="pt-6 border-t border-slate-200 text-center">
            <p className="text-sm font-medium text-slate-700">
              Don't have an account?{" "}
              <Link
                href="/signup"
                className="font-bold text-blue-900 underline underline-offset-4 hover:text-slate-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-900"
              >
                Create company workspace
              </Link>
            </p>
          </div>
        </div>

        {/* Right Column: Branded Value Panel */}
        <div className="hidden lg:flex lg:col-span-5 bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 p-10 text-white flex-col justify-between relative overflow-hidden border-l border-slate-800">
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/40 text-blue-300 text-[11px] font-bold mb-6">
              <Bot className="w-3.5 h-3.5 text-blue-400"/>
              <span>Multi-Tenant Agent Orchestration</span>
            </div>

            <h2 className="text-2xl font-extrabold tracking-tight text-white leading-snug">
              Continuous, authorized AI workflows for modern business teams.
            </h2>

            <div className="mt-8 space-y-4 text-sm text-slate-200">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                <span>
                  <strong className="text-white font-bold">Support, Sales & Operations:</strong> Pre-built agents trained on business workflows.
                </span>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                <span>
                  <strong className="text-white font-bold">Human Approval Gates:</strong> Financial actions and high-risk API calls require staff authorization.
                </span>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                <span>
                  <strong className="text-white font-bold">Data Sandbox & MCP:</strong> Secure datasm allowlists and Model Context Protocol integrations.
                </span>
              </div>
            </div>
          </div>

          <div className="relative z-10 pt-6 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between font-medium">
            <span>OPERON Enterprise v1.0</span>
            <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
              <Shield className="w-3.5 h-3.5" /> SOC2 Compliant
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
