"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Eye,
  EyeOff,
  Lock,
  Mail,
  User,
  Building2,
  ArrowRight,
  AlertCircle,
  Bot,
  Shield,
  CheckCircle2,
} from "lucide-react";
import { useOperon } from "../../context/OperonContext";
import OperonLogo from "../../components/ui/OperonLogo";

export default function SignupForm() {
  const router = useRouter();
  const { signup } = useOperon();

  const [form, setForm] = useState({
    full_name: "",
    email: "",
    company_name: "",
    password: "",
    confirm_password: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!form.full_name.trim() || !form.email.trim() || !form.company_name.trim() || !form.password) {
      setError("All fields are required.");
      return;
    }

    if (form.password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    if (form.password !== form.confirm_password) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      await signup({
        email: form.email.trim(),
        password: form.password,
        full_name: form.full_name.trim(),
        company_name: form.company_name.trim(),
      });
      router.push("/operon");
    } catch (err) {
      setError(err.message || "Failed to create account. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-200 bg-[radial-gradient(#94a3b8_1px,transparent_1px)] [background-size:16px_16px] flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-5xl bg-white rounded-2xl border border-slate-200 shadow-2xl shadow-slate-900/15 overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-[620px]">
        {/* Left Column: Form */}
        <div className="lg:col-span-7 p-8 sm:p-12 flex flex-col justify-between bg-white">
          <div>
            <div className="mb-6">
              <OperonLogo size={34} />
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-950 mt-5 tracking-tight">
                Create company workspace
              </h1>
              <p className="text-sm font-medium text-slate-600 mt-1.5 leading-relaxed">
                Start configuring AI agents, connecting business systems, and monitoring automated workflows.
              </p>
            </div>

            {error && (
              <div
                role="alert"
                className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-900 text-sm font-semibold flex items-center gap-2.5 shadow-sm"
              >
                <AlertCircle className="w-4 h-4 shrink-0 text-red-700" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="signup-name"
                    className="block text-sm font-bold text-slate-900 mb-1.5"
                  >
                    Your Name
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-600 absolute left-3.5 top-3.5 pointer-events-none" />
                    <input
                      id="signup-name"
                      type="text"
                      required
                      value={form.full_name}
                      onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                      placeholder="Your full name"
                      className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-slate-300 bg-slate-50 text-slate-950 font-semibold text-sm placeholder:text-slate-500 placeholder:font-normal focus:bg-white focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="signup-company"
                    className="block text-sm font-bold text-slate-900 mb-1.5"
                  >
                    Company Name
                  </label>
                  <div className="relative">
                    <Building2 className="w-4 h-4 text-slate-600 absolute left-3.5 top-3.5 pointer-events-none" />
                    <input
                      id="signup-company"
                      type="text"
                      required
                      value={form.company_name}
                      onChange={(e) => setForm({ ...form, company_name: e.target.value })}
                      placeholder="Your company name"
                      className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-slate-300 bg-slate-50 text-slate-950 font-semibold text-sm placeholder:text-slate-500 placeholder:font-normal focus:bg-white focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 transition-all"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label
                  htmlFor="signup-email"
                  className="block text-sm font-bold text-slate-900 mb-1.5"
                >
                  Work Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-600 absolute left-3.5 top-3.5 pointer-events-none" />
                  <input
                    id="signup-email"
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="name@company.com"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 bg-slate-50 text-slate-950 font-semibold text-sm placeholder:text-slate-500 placeholder:font-normal focus:bg-white focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="signup-password"
                    className="block text-sm font-bold text-slate-900 mb-1.5"
                  >
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-600 absolute left-3.5 top-3.5 pointer-events-none" />
                    <input
                      id="signup-password"
                      type={showPassword ? "text" : "password"}
                      required
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      placeholder="Min 8 characters"
                      className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-300 bg-slate-50 text-slate-950 font-semibold text-sm placeholder:text-slate-500 placeholder:font-normal focus:bg-white focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-2.5 text-slate-600 hover:text-slate-950 hover:bg-slate-200/70 p-1 rounded-md transition"
                      aria-label="Toggle password visibility"
                    >
                      {showPassword ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="signup-confirm-password"
                    className="block text-sm font-bold text-slate-900 mb-1.5"
                  >
                    Confirm Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-600 absolute left-3.5 top-3.5 pointer-events-none" />
                    <input
                      id="signup-confirm-password"
                      type={showConfirmPassword ? "text" : "password"}
                      required
                      value={form.confirm_password}
                      onChange={(e) => setForm({ ...form, confirm_password: e.target.value })}
                      placeholder="Repeat password"
                      className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-300 bg-slate-50 text-slate-950 font-semibold text-sm placeholder:text-slate-500 placeholder:font-normal focus:bg-white focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-2.5 top-2.5 text-slate-600 hover:text-slate-950 hover:bg-slate-200/70 p-1 rounded-md transition"
                      aria-label="Toggle confirm password visibility"
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-3 py-3 rounded-xl bg-violet-700 hover:bg-violet-800 active:bg-violet-900 disabled:cursor-not-allowed disabled:opacity-60 text-white text-sm font-bold tracking-wide shadow-md transition flex items-center justify-center gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-900"
              >
                {loading ? (
                  <span>Creating workspace…</span>
                ) : (
                  <>
                    <span>Create Company Workspace</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>

          <div className="pt-6 border-t border-slate-200 text-center">
            <p className="text-sm font-medium text-slate-700">
              Already have an account?{" "}
              <Link
                href="/login"
                className="font-bold text-blue-900 underline underline-offset-4 hover:text-slate-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-900"
              >
                Sign in
              </Link>
            </p>
          </div>
        </div>

        {/* Right Column: Branded Value Panel */}
        <div className="hidden lg:flex lg:col-span-5 bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 p-10 text-white flex-col justify-between relative overflow-hidden border-l border-slate-800">
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/40 text-blue-300 text-[11px] font-bold mb-6">
              <Bot className="w-3.5 h-3.5 text-blue-400" />
              <span>Enterprise Ready</span>
            </div>

            <h2 className="text-2xl font-extrabold tracking-tight text-white leading-snug">
              Deploy autonomous AI agents with full human oversight and security boundaries.
            </h2>

            <div className="mt-8 space-y-4 text-sm text-slate-200">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                <span>
                  <strong className="text-white font-bold">Tenant Isolated:</strong> Every organization receives dedicated workspace security and database boundaries.
                </span>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                <span>
                  <strong className="text-white font-bold">Built-in RAG & Tools:</strong> Connect internal knowledge and Model Context Protocol servers in minutes.
                </span>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                <span>
                  <strong className="text-white font-bold">Zero Maintenance Runtime:</strong> Operon orchestrates LangGraph execution, retries, and telemetry.
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
