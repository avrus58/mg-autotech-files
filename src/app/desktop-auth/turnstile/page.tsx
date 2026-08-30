"use client";

import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { ShieldCheck } from "lucide-react";
import { TurnstileChallenge } from "@/components/auth/TurnstileChallenge";
import { getHostedTurnstileConfig } from "@/lib/authCaptcha";
import { customerWorkflowExactT } from "@/lib/i18n/customer-workflow-auth-translations";
import { useActiveLocale } from "@/lib/useActiveLocale";

type DesktopCaptchaBridge = {
  complete(input: { state: string; token: string }): Promise<{
    ok: boolean;
    error?: string;
  }>;
  cancel(input: { state: string }): Promise<{ ok: boolean }>;
};

function readDesktopChallengeState(hash: string) {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const state = params.get("state") ?? "";
  const action = params.get("action") ?? "";
  if (!/^[a-f0-9]{64}$/.test(state) || action !== "auth_login") return null;
  return { state, action: "auth_login" as const };
}

function subscribeToStaticDesktopContext() {
  return () => undefined;
}

function getDesktopCaptchaBridge() {
  if (typeof window === "undefined") return undefined;
  return (window as Window & { mgCaptcha?: DesktopCaptchaBridge }).mgCaptcha;
}

export default function DesktopTurnstilePage() {
  const locale = useActiveLocale();
  const t = (source: string) => customerWorkflowExactT(locale, source);
  const config = getHostedTurnstileConfig();
  const hash = useSyncExternalStore(
    subscribeToStaticDesktopContext,
    () => window.location.hash,
    () => ""
  );
  const bridgeAvailable = useSyncExternalStore(
    subscribeToStaticDesktopContext,
    () => Boolean(getDesktopCaptchaBridge()),
    () => false
  );
  const challenge = useMemo(() => readDesktopChallengeState(hash), [hash]);
  const [message, setMessage] = useState("");
  const [resetKey, setResetKey] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const handleToken = useCallback(
    async (token: string | null) => {
      if (!token || !challenge || submitting || config.status !== "ready") return;
      const bridge = getDesktopCaptchaBridge();
      if (!bridge) return;

      setSubmitting(true);
      setMessage("Returning verification to the desktop app...");
      try {
        const result = await bridge.complete({ state: challenge.state, token });
        if (result.ok) return;
        setSubmitting(false);
        setMessage("Security verification could not be returned.");
        setResetKey((value) => value + 1);
      } catch {
        setSubmitting(false);
        setMessage("Security verification could not be returned. Please try again.");
        setResetKey((value) => value + 1);
      }
    },
    [challenge, config.status, submitting]
  );

  const handleCancel = async () => {
    const bridge = getDesktopCaptchaBridge();
    if (!bridge || !challenge) return;
    try {
      await bridge.cancel({ state: challenge.state });
    } catch {
      setMessage("The verification window could not be closed automatically.");
    }
  };

  const canRenderChallenge =
    Boolean(challenge && bridgeAvailable) && config.status === "ready";
  const visibleMessage = message || (
    !challenge || !bridgeAvailable
      ? "Open this security check from the MG AutoTech desktop app."
      : config.status !== "ready"
        ? "Security verification is unavailable."
        : "Complete the security check to continue your desktop login."
  );

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#050505] px-5 py-8 text-white">
      <section className="w-full max-w-sm rounded-[2rem] border border-white/10 bg-[#0d0d0f] p-7 shadow-2xl shadow-black/60">
        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-red-800/50 bg-red-950/25">
          <ShieldCheck className="h-6 w-6 text-red-400" />
        </div>
        <div className="text-xs font-black uppercase tracking-[0.16em] text-red-400">
          MG AutoTech
        </div>
        <h1 className="mt-2 text-2xl font-black">{t("Secure desktop login")}</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-400" aria-live="polite">
          {t(visibleMessage)}
        </p>

        {canRenderChallenge && challenge && (
          <div className="mt-6">
            <TurnstileChallenge
              siteKey={config.siteKey}
              action={challenge.action}
              resetKey={resetKey}
              onToken={handleToken}
            />
          </div>
        )}

        <button
          type="button"
          onClick={() => void handleCancel()}
          disabled={!challenge || submitting}
          className="mt-5 h-11 w-full rounded-xl border border-white/10 bg-white/[0.04] text-sm font-black transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {t("Cancel")}
        </button>
      </section>
    </main>
  );
}
