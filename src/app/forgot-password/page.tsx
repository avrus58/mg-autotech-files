"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, CheckCircle2, Loader2, Mail, ShieldCheck, Upload } from "lucide-react";
import { getAuthRedirect } from "@/lib/authGuards";
import { supabase } from "@/lib/supabaseClient";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleResetRequest = async (event: React.FormEvent) => {
    event.preventDefault();

    if (loading) return;

    setLoading(true);
    setMessage("");
    setSuccess(false);

    const { error } = await supabase.auth.resetPasswordForEmail(
      email.trim().toLowerCase(),
      {
        redirectTo: getAuthRedirect("/auth/callback?next=/reset-password"),
      }
    );

    setLoading(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setSuccess(true);
    setMessage("Password reset link sent. Please check your e-mail inbox.");
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#050505] px-4 py-10 text-white">
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_20%_0%,rgba(160,18,28,0.28),transparent_32%),linear-gradient(135deg,#050505,#0d0d0f_48%,#160608)]" />

      <section className="w-full max-w-md rounded-[2rem] border border-white/10 bg-white/[0.04] p-7 shadow-2xl shadow-black/50 backdrop-blur-xl sm:p-9">
        <Link href="/" className="mb-8 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-red-800/50 bg-[#111]">
            <Upload className="h-7 w-7 text-red-600" />
          </div>
          <div>
            <div className="text-xl font-black">
              MG <span className="text-red-600">AUTOTECH</span>
            </div>
            <div className="text-xs text-zinc-400">Password Recovery</div>
          </div>
        </Link>

        <div className="mb-7">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-red-800/50 bg-red-950/25 px-3 py-1.5 text-xs font-black text-red-100">
            <ShieldCheck className="h-4 w-4 text-red-500" />
            Secure reset
          </div>
          <h1 className="text-4xl font-black">Forgot password?</h1>
          <p className="mt-3 text-sm leading-7 text-zinc-400">
            Enter your account e-mail and we will send a secure password reset link.
          </p>
        </div>

        <form onSubmit={handleResetRequest} className="space-y-4">
          <label className="block">
            <div className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-zinc-500">
              E-mail
            </div>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-500" />
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                type="email"
                className="h-14 w-full rounded-2xl border border-white/10 bg-black/35 pl-12 pr-4 text-sm font-bold text-white outline-none transition placeholder:text-zinc-600 focus:border-red-700"
                required
              />
            </div>
          </label>

          <button
            disabled={loading}
            className="flex h-14 w-full items-center justify-center rounded-2xl bg-[#b1121b] px-5 font-black text-white shadow-xl shadow-red-950/40 transition hover:bg-[#c91824] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Sending link...
              </>
            ) : (
              "Send reset link"
            )}
          </button>
        </form>

        {message && (
          <div
            className={`mt-5 rounded-2xl border p-4 text-sm ${
              success
                ? "border-green-800/50 bg-green-950/25 text-green-100"
                : "border-red-800/50 bg-red-950/30 text-red-100"
            }`}
          >
            <div className="flex gap-3">
              {success && <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-400" />}
              <span>{message}</span>
            </div>
          </div>
        )}

        <Link
          href="/login"
          className="mt-7 inline-flex items-center text-sm font-black text-red-400"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to login
        </Link>
      </section>
    </main>
  );
}
