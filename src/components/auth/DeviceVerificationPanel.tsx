"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2, MailCheck, RefreshCcw, ShieldCheck } from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import {
  resendDeviceCode,
  startDeviceVerification,
  verifyDeviceCode,
  type DeviceVerificationState,
} from "@/lib/deviceVerificationClient";
import {
  getStableSession,
  getStableSessionSnapshot,
  isCurrentBrowserSession,
  signOutLocalIfSessionMatches,
  signOutLocalStable,
} from "@/lib/authGuards";
import { getSafeLocalRedirectPath } from "@/lib/safeLocalRedirect";
import { replacePrivateMeasurementDocument } from "@/lib/publicAnalytics";
import {
  customerWorkflowExactT,
  customerWorkflowT,
} from "@/lib/i18n/customer-workflow-auth-translations";
import { intlLocaleByCode } from "@/lib/i18nConfig";
import { useActiveLocale } from "@/lib/useActiveLocale";
import { supabase } from "@/lib/supabaseClient";
import { reportPlatformFailure } from "@/components/PlatformReliabilityMonitor";

function formatCountdown(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.ceil(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function DeviceVerificationPanel({
  nextPath,
  onVerified,
  allowRememberDevice = true,
}: {
  nextPath?: string;
  onVerified?: () => void;
  allowRememberDevice?: boolean;
}) {
  const router = useRouter();
  const locale = useActiveLocale();
  const codeInputRef = useRef<HTMLInputElement | null>(null);
  const activeRef = useRef(false);
  const operationRef = useRef(0);
  const verificationSessionRef = useRef<Session | null>(null);
  const [state, setState] = useState<DeviceVerificationState | null>(null);
  const [code, setCode] = useState("");
  const [rememberDevice, setRememberDevice] = useState(false);
  const [message, setMessage] = useState("");
  const [working, setWorking] = useState<"start" | "verify" | "resend" | null>("start");
  const [retryAt, setRetryAt] = useState(0);
  const [secondsRemaining, setSecondsRemaining] = useState(0);

  const isActiveOperation = useCallback((operation: number, session?: Session | null) => (
    activeRef.current && operationRef.current === operation &&
    (!session || isCurrentBrowserSession(session))
  ), []);

  useEffect(() => {
    activeRef.current = true;
    return () => {
      activeRef.current = false;
      operationRef.current += 1;
    };
  }, []);

  const finish = useCallback(() => {
    if (onVerified) {
      onVerified();
      return;
    }
    const destination = getSafeLocalRedirectPath(nextPath) ?? "/dashboard";
    if (replacePrivateMeasurementDocument(destination)) return;
    router.replace(destination);
    router.refresh();
  }, [nextPath, onVerified, router]);

  const applyState = useCallback((next: DeviceVerificationState) => {
    setState(next);
    const delay = Math.max(0, Number(next.retryAfterSeconds ?? 0));
    const nextRetryAt = delay > 0 ? Date.now() + delay * 1000 : 0;
    setRetryAt(nextRetryAt);
    setSecondsRemaining(delay);
    if (next.error) {
      setMessage(
        customerWorkflowExactT(
          locale,
          "The security request could not be completed. Please try again.",
        ),
      );
    }
  }, [locale]);

  const leaveRevokedSession = useCallback(async (session: Session, operation: number) => {
    if (!isActiveOperation(operation, session)) return;
    const signedOut = await signOutLocalIfSessionMatches(session);
    if (!signedOut || !isActiveOperation(operation) || getStableSessionSnapshot()) return;
    if (replacePrivateMeasurementDocument("/login")) return;
    router.replace("/login");
    router.refresh();
  }, [isActiveOperation, router]);

  const begin = useCallback(async () => {
    const operation = ++operationRef.current;
    let session: Session | null = null;
    setWorking("start");
    setMessage("");
    try {
      const resolved = await getStableSession();
      if (!isActiveOperation(operation)) return;
      session = resolved.session;
      if (!session) throw resolved.error;
      if (!isActiveOperation(operation, session)) return;
      verificationSessionRef.current = session;
      const next = await startDeviceVerification();
      if (!isActiveOperation(operation, session)) return;
      if (next.status === "revoked") {
        await leaveRevokedSession(session, operation);
        return;
      }
      if (next.status !== "required") {
        finish();
        return;
      }
      applyState(next);
      window.setTimeout(() => {
        if (isActiveOperation(operation, session)) codeInputRef.current?.focus();
      }, 0);
    } catch (error) {
      if (!isActiveOperation(operation, session)) return;
      // The existing reporter emits only an allowlisted category and route,
      // never the exception text, token, e-mail address or verification code.
      reportPlatformFailure("client_error", error ?? new Error("Auth session unavailable"));
      setMessage(
        customerWorkflowExactT(
          locale,
          "The security request could not be completed. Please try again.",
        ),
      );
    } finally {
      if (isActiveOperation(operation, session)) setWorking(null);
    }
  }, [applyState, finish, isActiveOperation, leaveRevokedSession, locale]);

  useEffect(() => {
    let timeout = window.setTimeout(() => void begin(), 0);
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      // Supabase work must run outside its auth callback/lock. Recheck the
      // logical session after the shared auth listener has adopted the event.
      window.clearTimeout(timeout);
      timeout = window.setTimeout(() => {
        if (!activeRef.current) return;
        if (verificationSessionRef.current && isCurrentBrowserSession(verificationSessionRef.current)) return;
        operationRef.current += 1;
        verificationSessionRef.current = null;
        setState(null);
        setCode("");
        setRememberDevice(false);
        setMessage("");
        setRetryAt(0);
        setSecondsRemaining(0);
        // An empty initial SDK snapshot does not revoke a freshly primed login.
        // Match authGuards: only a real sign-out discards that stable session.
        const currentSession = session ?? (_event === "INITIAL_SESSION" ? getStableSessionSnapshot() : null);
        setWorking(currentSession ? "start" : null);
        if (currentSession) void begin();
      }, 0);
    });
    return () => {
      window.clearTimeout(timeout);
      subscription.unsubscribe();
      operationRef.current += 1;
      // Retire the session marker with its operation. A replacement effect's
      // INITIAL_SESSION must not mistake the cancelled attempt for active work.
      verificationSessionRef.current = null;
    };
  }, [begin]);

  useEffect(() => {
    if (!retryAt) return;
    const update = () => setSecondsRemaining(Math.max(0, Math.ceil((retryAt - Date.now()) / 1000)));
    update();
    const interval = window.setInterval(update, 1000);
    return () => window.clearInterval(interval);
  }, [retryAt]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!state?.challengeId || !/^\d{6}$/.test(code) || working) return;
    const operation = ++operationRef.current;
    let session: Session | null = null;
    setWorking("verify");
    setMessage("");
    try {
      const resolved = await getStableSession();
      if (!isActiveOperation(operation)) return;
      session = resolved.session;
      if (!session) throw resolved.error;
      if (!isActiveOperation(operation, session)) return;
      const next = await verifyDeviceCode({
        challengeId: state.challengeId,
        code,
        rememberDevice: allowRememberDevice && rememberDevice,
      });
      if (!isActiveOperation(operation, session)) return;
      if (next.status === "revoked") {
        await leaveRevokedSession(session, operation);
        return;
      }
      if (next.status === "verified" || next.status === "not_required") {
        finish();
        return;
      }
      applyState({ ...state, ...next });
      setCode("");
      window.setTimeout(() => {
        if (isActiveOperation(operation, session)) codeInputRef.current?.focus();
      }, 0);
    } catch {
      if (!isActiveOperation(operation, session)) return;
      setMessage(
        customerWorkflowExactT(locale, "The code could not be verified."),
      );
    } finally {
      if (isActiveOperation(operation, session)) setWorking(null);
    }
  };

  const resend = async () => {
    if (!state?.challengeId || secondsRemaining > 0 || working) return;
    const operation = ++operationRef.current;
    let session: Session | null = null;
    setWorking("resend");
    setMessage("");
    try {
      const resolved = await getStableSession();
      if (!isActiveOperation(operation)) return;
      session = resolved.session;
      if (!session) throw resolved.error;
      if (!isActiveOperation(operation, session)) return;
      const next = await resendDeviceCode(state.challengeId);
      if (!isActiveOperation(operation, session)) return;
      if (next.status === "revoked") {
        await leaveRevokedSession(session, operation);
        return;
      }
      applyState({ ...state, ...next });
      setCode("");
      if (next.sentNewCode) {
        setMessage(
          customerWorkflowExactT(
            locale,
            "A new code was accepted for sending to your e-mail.",
          ),
        );
      } else if (next.outcome === "delivery_pending") {
        setMessage(
          customerWorkflowExactT(
            locale,
            "The security e-mail is still being prepared. Please wait.",
          ),
        );
      } else if (next.outcome === "stale_challenge") {
        setMessage(
          customerWorkflowExactT(
            locale,
            "That resend request was out of date. Use the current code or try again.",
          ),
        );
      } else if (next.rateLimited) {
        setMessage(
          customerWorkflowExactT(
            locale,
            "Please wait before requesting another security code.",
          ),
        );
      }
      window.setTimeout(() => {
        if (isActiveOperation(operation, session)) codeInputRef.current?.focus();
      }, 0);
    } catch {
      if (!isActiveOperation(operation, session)) return;
      setMessage(
        customerWorkflowExactT(locale, "A new code could not be sent."),
      );
    } finally {
      if (isActiveOperation(operation, session)) setWorking(null);
    }
  };

  const handleDifferentAccount = async () => {
    const operation = ++operationRef.current;
    await signOutLocalStable();
    if (!isActiveOperation(operation) || getStableSessionSnapshot()) return;
    if (replacePrivateMeasurementDocument("/login")) return;
    router.replace("/login");
    router.refresh();
  };

  const canVerify = Boolean(state?.challengeId && state.canVerify !== false);
  const statusDescription = state?.outcome === "delivery_pending"
    ? "Your security e-mail is being prepared. The code field will be available after it is accepted for sending."
    : state?.rateLimited && !canVerify
      ? "Too many security-code requests were made. Wait for the timer before trying again."
      : message
        ? "Complete the security verification to continue."
        : "We are checking whether this device is already trusted.";

  return (
    <section className="w-full" aria-labelledby="device-verification-title">
      <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border border-red-800/50 bg-red-950/30 text-red-400">
        {working === "start" ? <Loader2 className="h-7 w-7 animate-spin" /> : <MailCheck className="h-7 w-7" />}
      </div>
      <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-red-800/50 bg-red-950/25 px-3 py-1.5 text-xs font-black text-red-100">
        <ShieldCheck className="h-4 w-4 text-red-500" />
        {customerWorkflowExactT(locale, "New device protection")}
      </div>
      <h2 id="device-verification-title" className="break-words text-3xl font-black sm:text-4xl">
        {canVerify
          ? customerWorkflowExactT(locale, "Check your e-mail")
          : customerWorkflowExactT(locale, "Account verification")}
      </h2>
      <p className="mt-3 text-sm leading-7 text-zinc-400">
        {state?.maskedEmail && canVerify ? (
          <>
            {state.sentNewCode
              ? customerWorkflowT(locale, "codeAcceptedForEmail", {})
              : customerWorkflowT(locale, "codeSentToEmail", {})}{" "}
            <span data-no-translate>{state.maskedEmail}</span>.
          </>
        ) : customerWorkflowExactT(locale, statusDescription)}
      </p>

      {canVerify && (
        <form onSubmit={submit} className="mt-7 space-y-4">
          <label className="block">
            <span className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-zinc-500">
              {customerWorkflowExactT(locale, "Security code")}
            </span>
            <div className="relative">
              <KeyRound className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-500" />
              <input
                ref={codeInputRef}
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                aria-label={customerWorkflowExactT(locale, "6-digit security code")}
                className="h-14 w-full rounded-2xl border border-white/10 bg-black/35 pl-12 pr-4 text-center text-xl font-black tracking-[0.45em] text-white outline-none transition focus:border-red-700"
                required
              />
            </div>
          </label>

          {allowRememberDevice && (
            <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-white/10 bg-black/25 p-4">
              <input
                type="checkbox"
                checked={rememberDevice}
                onChange={(event) => setRememberDevice(event.target.checked)}
                className="mt-1 h-4 w-4 accent-red-600"
              />
              <span>
                <span className="block text-sm font-black text-white">
                  {customerWorkflowExactT(locale, "Trust this device for 30 days")}
                </span>
                <span className="mt-1 block text-xs leading-5 text-zinc-500">
                  {customerWorkflowExactT(locale, "Use this only on a private device you control.")}
                </span>
              </span>
            </label>
          )}

          <button
            disabled={working !== null || code.length !== 6}
            className="flex h-14 w-full items-center justify-center rounded-2xl bg-[#b1121b] px-5 font-black text-white transition hover:bg-[#c91824] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {working === "verify" ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                {customerWorkflowExactT(locale, "Verifying...")}
              </>
            ) : (
              customerWorkflowExactT(locale, "Verify and continue")
            )}
          </button>
        </form>
      )}

      {message && (
        <div aria-live="polite" className="mt-5 rounded-2xl border border-amber-700/40 bg-amber-950/20 p-4 text-sm text-amber-100">
          {message}
          {typeof state?.attemptsRemaining === "number" && state.attemptsRemaining > 0
            ? <> {customerWorkflowT(locale, "attemptsLeft", { count: state.attemptsRemaining.toLocaleString(intlLocaleByCode[locale]) })}</>
            : null}
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm font-black">
        {canVerify ? (
          <button
            type="button"
            onClick={() => void resend()}
            disabled={secondsRemaining > 0 || working !== null}
            className="inline-flex items-center text-red-400 disabled:text-zinc-600"
          >
            {working === "resend" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
            {secondsRemaining > 0
              ? customerWorkflowT(locale, "resendCodeIn", { time: formatCountdown(secondsRemaining) })
              : customerWorkflowExactT(locale, "Resend code")}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void begin()}
            disabled={working !== null || secondsRemaining > 0}
            className="inline-flex items-center text-red-400 disabled:text-zinc-600"
          >
            <RefreshCcw className="mr-2 h-4 w-4" />
            {secondsRemaining > 0
              ? customerWorkflowT(locale, "tryAgainIn", { time: formatCountdown(secondsRemaining) })
              : customerWorkflowExactT(locale, "Try again")}
          </button>
        )}
        <button type="button" onClick={() => void handleDifferentAccount()} className="text-zinc-400 hover:text-white">
          {customerWorkflowExactT(locale, "Use a different account")}
        </button>
      </div>
    </section>
  );
}
