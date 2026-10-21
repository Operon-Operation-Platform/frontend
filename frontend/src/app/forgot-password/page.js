"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Mail, ArrowLeft, CheckCircle2 } from "lucide-react";
import OperonLogo from "../../components/ui/OperonLogo";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    setTimeout(() => {
      setSubmitted(true);
      setLoading(false);
    }, 600);
  };

  return (
    <div className="min-h-screen bg-slate-100/90 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:16px_16px] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl border-2 border-slate-300 shadow-2xl shadow-slate-900/15 p-8 space-y-6">
        <div>
          <OperonLogo size={34} />
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-950 mt-6 tracking-tight">
            Reset your password
          </h1>
          <p className="text-xs font-medium text-slate-600 mt-1.5 leading-relaxed">
            Enter your work email address and we'll send you instructions to reset your password.
          </p>
        </div>

        {submitted ? (
          <div className="p-4 rounded-xl bg-green-50 border-2 border-green-300 text-green-950 text-xs space-y-2.5 font-medium shadow-sm">
            <div className="flex items-center gap-2 font-bold text-green-800 text-sm">
              <CheckCircle2 className="w-5 h-5 text-green-700" />
              <span>Password reset email dispatched</span>
            </div>
            <p className="text-green-900 leading-relaxed">
              If an account exists for <strong className="font-bold">{email}</strong>, you will receive a secure password reset link.
            </p>
            <div className="pt-2">
              <Link
                href="/login"
                className="font-bold text-blue-700 hover:text-blue-900 underline-offset-4 hover:underline flex items-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back to sign in
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div>
              <label htmlFor="reset-email" className="block font-bold text-slate-900 mb-1.5">
                Work Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-600 absolute left-3.5 top-3.5 pointer-events-none" />
                <input
                  id="reset-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border-2 border-slate-300 bg-slate-50 text-slate-950 font-semibold text-xs placeholder:text-slate-500 placeholder:font-normal focus:bg-white focus:outline-none focus:border-blue-700 focus:ring-4 focus:ring-blue-600/20 transition-all shadow-inner"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !email}
              className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 text-white font-bold tracking-wide shadow-md shadow-blue-600/25 border border-blue-700 transition flex items-center justify-center gap-2 focus:outline-none focus:ring-4 focus:ring-blue-500/25"
            >
              {loading ? "Sending link…" : "Send Reset Link"}
            </button>

            <div className="pt-4 border-t border-slate-200 text-center">
              <Link
                href="/login"
                className="font-bold text-blue-700 hover:text-blue-900 underline-offset-4 hover:underline inline-flex items-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Return to login
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
