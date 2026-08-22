"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2, MailCheck, RefreshCcw, ShieldCheck } from "lucide-react";
import {
  resendDeviceCode,
  startDeviceVerification,
  verifyDeviceCode,
  type DeviceVerificationState,
} from "@/lib/deviceVerificationClient";
import { signOutLocalStable } from "@/lib/authGuards";

function safeNextPath(value: string | undefined) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/dashboard";
}

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
  const codeInputRef = useRef<HTMLInputElement | null>(null);
  const [state, setState] = useState<DeviceVerificationState | null>(null);
  const [code, setCode] = useState("");
  const [rememberDevice, setRememberDevice] = useState(false);
  const [message, setMessage] = useState("");
  const [working, setWorking] = useState<"start" | "verify" | "resend" | null>("start");
  const [retryAt, setRetryAt] = useState(0);
  const [secondsRemaining, setSecondsRemaining] = useState(0);

  const finish = useCallback(() => {
    if (onVerified) {
      onVerified();
      return;
    }
    router.replace(safeNextPath(nextPath));
    router.refresh();
  }, [nextPath, onVerified, router]);

  const applyState = useCallback((next: DeviceVerificationState) => {
    setState(next);
    const delay = Math.max(0, Number(next.retryAfterSeconds ?? 0));
    const nextRetryAt = delay > 0 ? Date.now() + delay * 1000 : 0;
    setRetryAt(nextRetryAt);
    setSecondsRemaining(delay);
    if (next.error) setMessage(next.error);
  }, []);

  const leaveRevokedSession = useCallback(async () => {
    await signOutLocalStable();
    router.replace("/login");
    router.refresh();
  }, [router]);

  const begin = useCallback(async () => {
    setWorking("start");
    setMessage("");
    try {
      const next = await startDeviceVerification();
      if (next.status === "revoked") {
        await leaveRevokedSession();
        return;
      }
      if (next.status !== "required") {
        finish();
        return;
      }
      applyState(next);
      window.setTimeout(() => codeInputRef.current?.focus(), 0);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The verification e-mail could not be sent.");
    } finally {
      setWorking(null);
    }
  }, [applyState, finish, leaveRevokedSession]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void begin(), 0);
    return () => window.clearTimeout(timeout);
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
    setWorking("verify");
    setMessage("");
    try {
      const next = await verifyDeviceCode({
        challengeId: state.challengeId,
        code,
        rememberDevice: allowRememberDevice && rememberDevice,
      });
      if (next.status === "revoked") {
        await leaveRevokedSession();
        return;
      }
      if (next.status === "verified" || next.status === "not_required") {
        finish();
        return;
      }
      applyState({ ...state, ...next });
      setCode("");
      window.setTimeout(() => codeInputRef.current?.focus(), 0);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The code could not be verified.");
    } finally {
      setWorking(null);
    }
  };

  const resend = async () => {
    if (!state?.challengeId || secondsRemaining > 0 || working) return;
    setWorking("resend");
    setMessage("");
    try {
      const next = await resendDeviceCode(state.challengeId);
      if (next.status === "revoked") {
        await leaveRevokedSession();
        return;
      }
      applyState({ ...state, ...next });
      setCode("");
      if (next.sentNewCode) {
        setMessage("A new code was accepted for sending to your e-mail.");
      } else if (next.outcome === "delivery_pending") {
        setMessage("The security e-mail is still being prepared. Please wait.");
      } else if (next.outcome === "stale_challenge") {
        setMessage("That resend request was out of date. Use the current code or try again.");
      } else if (next.rateLimited) {
        setMessage("Please wait before requesting another security code.");
      }
      window.setTimeout(() => codeInputRef.current?.focus(), 0);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "A new code could not be sent.");
    } finally {
      setWorking(null);
    }
  };

  const handleDifferentAccount = async () => {
    await signOutLocalStable();
    router.replace("/login");
    router.refresh();
  };

  const canVerify = Boolean(state?.challengeId && state.canVerify !== false);
  const statusDescription = state?.outcome === "delivery_pending"
    ? "Your security e-mail is being prepared. The code field will be available after it is accepted for sending."
    : state?.rateLimited && !canVerify
      ? "Too many security-code requests were made. Wait for the timer before trying again."
      : "We are checking whether this device is already trusted.";

  return (
    <section className="w-full" aria-labelledby="device-verification-title">
      <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border border-red-800/50 bg-red-950/30 text-red-400">
        {working === "start" ? <Loader2 className="h-7 w-7 animate-spin" /> : <MailCheck className="h-7 w-7" />}
      </div>
      <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-red-800/50 bg-red-950/25 px-3 py-1.5 text-xs font-black text-red-100">
        <ShieldCheck className="h-4 w-4 text-red-500" /> New device protection
      </div>
      <h2 id="device-verification-title" className="text-4xl font-black">Check your e-mail</h2>
      <p className="mt-3 text-sm leading-7 text-zinc-400">
        {state?.maskedEmail && canVerify ? (
          <>
            {state.sentNewCode
              ? "A 6-digit security code was accepted for sending to"
              : "A 6-digit security code was already sent to"}{" "}
            <span data-no-translate>{state.maskedEmail}</span>.
          </>
        ) : statusDescription}
      </p>

      {canVerify && (
        <form onSubmit={submit} className="mt-7 space-y-4">
          <label className="block">
            <span className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-zinc-500">Security code</span>
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
                aria-label="6-digit security code"
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
                <span className="block text-sm font-black text-white">Trust this device for 30 days</span>
                <span className="mt-1 block text-xs leading-5 text-zinc-500">Use this only on a private device you control.</span>
              </span>
            </label>
          )}

          <button
            disabled={working !== null || code.length !== 6}
            className="flex h-14 w-full items-center justify-center rounded-2xl bg-[#b1121b] px-5 font-black text-white transition hover:bg-[#c91824] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {working === "verify" ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Verifying...</> : "Verify and continue"}
          </button>
        </form>
      )}

      {message && (
        <div aria-live="polite" className="mt-5 rounded-2xl border border-amber-700/40 bg-amber-950/20 p-4 text-sm text-amber-100">
          {message}
          {typeof state?.attemptsRemaining === "number" && state.attemptsRemaining > 0
            ? <>{" "}<span data-no-translate>{state.attemptsRemaining}</span>{" "}attempts left.</>
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
            {secondsRemaining > 0 ? <><span>Resend code in</span>{" "}<span data-no-translate>{formatCountdown(secondsRemaining)}</span></> : "Resend code"}
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
              ? <><span>Try again in</span>{" "}<span data-no-translate>{formatCountdown(secondsRemaining)}</span></>
              : "Try again"}
          </button>
        )}
        <button type="button" onClick={() => void handleDifferentAccount()} className="text-zinc-400 hover:text-white">
          Use a different account
        </button>
      </div>
    </section>
  );
}
