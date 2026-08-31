"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Lock, ShieldCheck, Upload } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { authenticatedFetch, signOutLocalStable, signOutStable } from "@/lib/authGuards";
import {
  CUSTOMER_REPLACEMENT_PASSWORD_MAX_LENGTH,
  CUSTOMER_REPLACEMENT_PASSWORD_MIN_LENGTH,
  validateCustomerReplacementPassword,
} from "@/lib/customerPasswordSecurity";
import {
  customerWorkflowT,
} from "@/lib/i18n/customer-workflow-auth-translations";
import {
  customerAuthFeedbackT,
  type CustomerAuthFeedback,
} from "@/lib/i18n/customer-auth-feedback";
import { authPageFirstPaintT } from "@/lib/i18n/auth-page-first-paint";
import { useActiveLocale } from "@/lib/useActiveLocale";

export default function ResetPasswordPage() {
  const router = useRouter();
  const locale = useActiveLocale();
  const firstPaintT = (source: string) => authPageFirstPaintT(locale, source);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState<CustomerAuthFeedback | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();

      if (!data.session) {
        router.replace("/forgot-password");
        return;
      }

      setCheckingSession(false);
    };

    checkSession();
  }, [router]);

  const handlePasswordUpdate = async (event: React.FormEvent) => {
    event.preventDefault();

    if (loading) return;

    setMessage(null);

    const validation = validateCustomerReplacementPassword(password);
    if (!validation.valid) {
      setMessage({
        kind: "password-validation",
        source:
          validation.errors[0] ||
          "Password does not meet the security requirements.",
      });
      return;
    }

    if (password !== confirmPassword) {
      setMessage({ kind: "exact", source: "Passwords do not match." });
      return;
    }

    setLoading(true);

    const updateResponse = await authenticatedFetch(
      "/api/account/security/password",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      }
    ).catch(() => null);
    const payload = await updateResponse?.json().catch(() => ({})) as
      | { error?: string; sessionRevoked?: boolean }
      | undefined;
    if (!updateResponse?.ok) {
      if (payload?.sessionRevoked) {
        await signOutLocalStable();
        router.replace("/forgot-password?retry=security");
        return;
      }
      setMessage({
        kind: "exact",
        source: "Password could not be updated safely. Please try again.",
      });
      setLoading(false);
      return;
    }

    await signOutStable();
    router.replace("/login?reset=success");
  };

  if (checkingSession) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#050505] text-white">
        <div className="text-center">
          <Loader2 className="mx-auto mb-5 h-10 w-10 animate-spin text-red-500" />
          <p className="text-sm text-zinc-400">
            {firstPaintT("Checking reset session...")}
          </p>
        </div>
      </main>
    );
  }

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
            <div className="text-xs text-zinc-400">
              {firstPaintT("New Password")}
            </div>
          </div>
        </Link>

        <div className="mb-7">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-red-800/50 bg-red-950/25 px-3 py-1.5 text-xs font-black text-red-100">
            <ShieldCheck className="h-4 w-4 text-red-500" />
            {firstPaintT("Secure account update")}
          </div>
          <h1 className="text-4xl font-black">
            {firstPaintT("Set new password")}
          </h1>
          <p className="mt-3 text-sm leading-7 text-zinc-400">
            {firstPaintT(
              "Choose a new password for your MG AutoTech customer account."
            )}
          </p>
        </div>

        <form onSubmit={handlePasswordUpdate} className="space-y-4">
          <label className="block">
            <div className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-zinc-500">
              {firstPaintT("New password")}
            </div>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-500" />
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={customerWorkflowT(locale, "minimumCharacters", { count: CUSTOMER_REPLACEMENT_PASSWORD_MIN_LENGTH })}
                type="password"
                minLength={CUSTOMER_REPLACEMENT_PASSWORD_MIN_LENGTH}
                maxLength={CUSTOMER_REPLACEMENT_PASSWORD_MAX_LENGTH}
                autoComplete="new-password"
                className="h-14 w-full rounded-2xl border border-white/10 bg-black/35 pl-12 pr-4 text-sm font-bold text-white outline-none transition placeholder:text-zinc-600 focus:border-red-700"
                required
              />
            </div>
          </label>

          <label className="block">
            <div className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-zinc-500">
              {firstPaintT("Confirm password")}
            </div>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-500" />
              <input
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder={firstPaintT("Repeat new password")}
                type="password"
                minLength={CUSTOMER_REPLACEMENT_PASSWORD_MIN_LENGTH}
                maxLength={CUSTOMER_REPLACEMENT_PASSWORD_MAX_LENGTH}
                autoComplete="new-password"
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
                {firstPaintT("Updating password...")}
              </>
            ) : (
              firstPaintT("Update password")
            )}
          </button>
        </form>

        {message && (
          <div
            role="alert"
            aria-live="assertive"
            className="mt-5 rounded-2xl border border-red-800/50 bg-red-950/30 p-4 text-sm text-red-100"
          >
            {customerAuthFeedbackT(locale, message)}
          </div>
        )}

        <Link
          href="/login"
          className="mt-7 inline-flex items-center text-sm font-black text-red-400"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          {firstPaintT("Back to login")}
        </Link>
      </section>
    </main>
  );
}
