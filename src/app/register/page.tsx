"use client";

import Link from "next/link";
import { useState } from "react";
import { getAuthRedirect } from "@/lib/authGuards";
import { supabase } from "@/lib/supabaseClient";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Cpu,
  Lock,
  Loader2,
  Mail,
  ShieldCheck,
  Upload,
  User,
  Zap,
} from "lucide-react";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (loading) return;

    setLoading(true);
    setMessage("");
    setSuccess(false);

    const cleanEmail = email.trim().toLowerCase();
    const cleanFullName = fullName.trim();

    if (!cleanFullName) {
      setMessage("Please enter your full name or company name.");
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setMessage("Password must be at least 6 characters.");
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        emailRedirectTo: getAuthRedirect("/auth/callback?next=/dashboard"),
        data: {
          full_name: cleanFullName,
          role: "customer",
        },
      },
    });

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setMessage(
      "Account created. Please verify your e-mail address before logging in."
    );
    setPassword("");
    setLoading(false);
  };

  const handleGoogleRegister = async () => {
    if (googleLoading) return;

    setGoogleLoading(true);
    setMessage("");
    setSuccess(false);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: getAuthRedirect("/auth/callback?next=/dashboard"),
      },
    });

    if (error) {
      setMessage(error.message);
      setGoogleLoading(false);
    }
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#050505] px-4 py-10 text-white">
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_20%_0%,rgba(160,18,28,0.28),transparent_32%),radial-gradient(circle_at_80%_100%,rgba(160,18,28,0.18),transparent_30%),linear-gradient(135deg,#050505,#0d0d0f_48%,#160608)]" />

      <div className="grid w-full max-w-6xl overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.04] shadow-2xl shadow-black/50 backdrop-blur-xl lg:grid-cols-[1.1fr_0.9fr]">
        <section className="relative hidden min-h-[660px] overflow-hidden border-r border-white/10 bg-black/40 p-10 lg:block">
          <div className="absolute -left-20 -top-20 h-72 w-72 rounded-full bg-red-700/20 blur-3xl" />
          <div className="absolute -bottom-20 -right-20 h-72 w-72 rounded-full bg-red-950/40 blur-3xl" />
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-red-500/60 to-transparent" />

          <Link href="/" className="relative flex items-center gap-3">
            <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-red-800/50 bg-[#111] shadow-lg shadow-red-950/40">
              <Upload className="h-8 w-8 text-red-600" />
            </div>

            <div>
              <div className="text-2xl font-black tracking-wide">
                MG <span className="text-red-600">AUTOTECH</span>
              </div>
              <div className="text-xs text-zinc-400">
                ECU File Service Platform
              </div>
            </div>
          </Link>

          <div className="relative mt-20">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-red-800/50 bg-red-950/25 px-4 py-2 text-sm font-bold text-red-100">
              <ShieldCheck className="h-4 w-4 text-red-500" />
              Verified customer workspace
            </div>

            <h1 className="max-w-xl text-5xl font-black leading-tight">
              Create your MG AutoTech customer account.
            </h1>

            <p className="mt-6 max-w-lg leading-8 text-zinc-400">
              Register to access the professional file service dashboard, upload
              ECU / TCU files, manage credits and follow your requests securely.
            </p>
          </div>

          <div className="relative mt-14 grid gap-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
              <Cpu className="mb-3 h-6 w-6 text-red-500" />
              <div className="font-black">Smart Vehicle Database</div>
              <p className="mt-2 text-sm leading-6 text-zinc-500">
                Select brand, model, generation and engine with automatic ECU
                and performance data.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
              <Zap className="mb-3 h-6 w-6 text-red-500" />
              <div className="font-black">Premium File Workflow</div>
              <p className="mt-2 text-sm leading-6 text-zinc-500">
                Submit original files, choose tuning services and receive your
                modified file through your dashboard.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
              <Building2 className="mb-3 h-6 w-6 text-red-500" />
              <div className="font-black">For private and business customers</div>
              <p className="mt-2 text-sm leading-6 text-zinc-500">
                Built for clean order handling, credit tracking and professional
                ECU service communication.
              </p>
            </div>
          </div>
        </section>

        <section className="p-6 sm:p-10">
          <div className="mx-auto max-w-md">
            <div className="mb-8 lg:hidden">
              <Link href="/" className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-red-800/50 bg-[#111]">
                  <Upload className="h-7 w-7 text-red-600" />
                </div>
                <div>
                  <div className="text-xl font-black">
                    MG <span className="text-red-600">AUTOTECH</span>
                  </div>
                  <div className="text-xs text-zinc-400">Customer Register</div>
                </div>
              </Link>
            </div>

            <div className="mb-8">
              <div className="mb-3 text-sm font-bold text-red-400">
                Start your file service account
              </div>
              <h2 className="text-4xl font-black">Create Account</h2>
              <p className="mt-3 leading-7 text-zinc-400">
                Register once and use your dashboard for file uploads, credits
                and tuning requests.
              </p>
            </div>

            <form onSubmit={handleRegister} className="space-y-4">
              <label className="block">
                <div className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-zinc-500">
                  Full Name / Company
                </div>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-500" />
                  <input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Your name or company"
                    className="h-14 w-full rounded-2xl border border-white/10 bg-black/35 pl-12 pr-4 text-sm font-bold text-white outline-none transition placeholder:text-zinc-600 focus:border-red-700"
                    required
                  />
                </div>
              </label>

              <label className="block">
                <div className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-zinc-500">
                  E-mail
                </div>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-500" />
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    type="email"
                    className="h-14 w-full rounded-2xl border border-white/10 bg-black/35 pl-12 pr-4 text-sm font-bold text-white outline-none transition placeholder:text-zinc-600 focus:border-red-700"
                    required
                  />
                </div>
              </label>

              <label className="block">
                <div className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-zinc-500">
                  Password
                </div>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-500" />
                  <input
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimum 6 characters"
                    type="password"
                    className="h-14 w-full rounded-2xl border border-white/10 bg-black/35 pl-12 pr-4 text-sm font-bold text-white outline-none transition placeholder:text-zinc-600 focus:border-red-700"
                    required
                  />
                </div>
              </label>

              <button
                disabled={loading}
                className="group flex h-14 w-full items-center justify-center rounded-2xl bg-[#b1121b] px-5 font-black text-white shadow-xl shadow-red-950/40 transition hover:bg-[#c91824] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Creating account...
                  </>
                ) : (
                  <>
                    Create Account
                    <ArrowRight className="ml-2 h-5 w-5 transition group-hover:translate-x-1" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-4 flex items-center gap-3 text-xs font-black uppercase tracking-[0.16em] text-zinc-600">
              <span className="h-px flex-1 bg-white/10" />
              or
              <span className="h-px flex-1 bg-white/10" />
            </div>

            <button
              type="button"
              onClick={handleGoogleRegister}
              disabled={googleLoading}
              className="mt-4 flex h-14 w-full items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-5 font-black text-white transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {googleLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-sm font-black text-black">
                  G
                </span>
              )}
              Continue with Google
            </button>

            {message && (
              <div
                className={`mt-5 rounded-2xl border p-4 text-sm ${
                  success
                    ? "border-green-800/50 bg-green-950/25 text-green-100"
                    : "border-red-800/50 bg-red-950/30 text-red-100"
                }`}
              >
                <div className="flex gap-3">
                  {success && (
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-400" />
                  )}
                  <span>{message}</span>
                </div>
              </div>
            )}

            <div className="mt-8 rounded-2xl border border-white/10 bg-black/30 p-5 text-center text-sm text-zinc-400">
              Already have an account?{" "}
              <Link href="/login" className="font-black text-red-400">
                Login
              </Link>
            </div>

            <p className="mt-5 text-center text-xs leading-5 text-zinc-600">
              By creating an account, you can submit ECU / TCU file requests and
              manage your MG AutoTech credit balance securely.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
