"use client";

import { useEffect, useRef, useState } from "react";
import { customerWorkflowExactT } from "@/lib/i18n/customer-workflow-auth-translations";
import { useActiveLocale } from "@/lib/useActiveLocale";

type TurnstileWidgetId = string;
type TurnstileAppearance = "always" | "interaction-only";
type TurnstileSize = "compact" | "flexible";

type TurnstileApi = {
  render(
    container: HTMLElement,
    options: {
      sitekey: string;
      action: string;
      theme: "dark";
      appearance: TurnstileAppearance;
      size: TurnstileSize;
      language: string;
      "response-field": false;
      callback(token: string): void;
      "error-callback"(code?: string): void;
      "expired-callback"(): void;
      "timeout-callback"(): void;
      "before-interactive-callback"(): void;
      "after-interactive-callback"(): void;
    }
  ): TurnstileWidgetId;
  reset(widgetId?: TurnstileWidgetId): void;
  remove(widgetId: TurnstileWidgetId): void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const TURNSTILE_SCRIPT_ID = "mg-turnstile-api";
const TURNSTILE_SCRIPT_URL =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

let turnstileScriptPromise: Promise<TurnstileApi> | null = null;

function turnstileLanguage(locale: ReturnType<typeof useActiveLocale>) {
  if (locale === "zh") return "zh-cn";
  // Cloudflare does not currently offer Albanian widget copy.
  if (locale === "sq") return "en";
  return locale;
}

function loadTurnstile() {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (turnstileScriptPromise) return turnstileScriptPromise;

  turnstileScriptPromise = new Promise<TurnstileApi>((resolve, reject) => {
    const finish = () => {
      if (window.turnstile) {
        resolve(window.turnstile);
      } else {
        turnstileScriptPromise = null;
        document.getElementById(TURNSTILE_SCRIPT_ID)?.remove();
        reject(new Error("Security verification did not initialize."));
      }
    };
    const fail = () => {
      turnstileScriptPromise = null;
      document.getElementById(TURNSTILE_SCRIPT_ID)?.remove();
      reject(new Error("Security verification could not be loaded."));
    };

    const existing = document.getElementById(
      TURNSTILE_SCRIPT_ID
    ) as HTMLScriptElement | null;
    if (existing) {
      if (existing.dataset.turnstileLoaded === "true") {
        queueMicrotask(finish);
        return;
      }
      existing.addEventListener("load", finish, { once: true });
      existing.addEventListener("error", fail, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.id = TURNSTILE_SCRIPT_ID;
    script.src = TURNSTILE_SCRIPT_URL;
    script.async = true;
    script.defer = true;
    script.addEventListener(
      "load",
      () => {
        script.dataset.turnstileLoaded = "true";
        finish();
      },
      { once: true }
    );
    script.addEventListener("error", fail, { once: true });
    document.head.appendChild(script);
  });

  return turnstileScriptPromise;
}

export function TurnstileChallenge({
  siteKey,
  action,
  resetKey,
  onToken,
  appearance = "always",
}: {
  siteKey: string;
  action:
    | "auth_login"
    | "auth_register"
    | "auth_register_google"
    | "auth_recovery";
  resetKey: number;
  onToken(token: string | null): void;
  appearance?: TurnstileAppearance;
}) {
  const locale = useActiveLocale();
  const outerRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<TurnstileWidgetId | null>(null);
  const [status, setStatus] = useState("Loading security verification...");
  const [canRetry, setCanRetry] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [interactive, setInteractive] = useState(false);
  const [widgetSize, setWidgetSize] = useState<TurnstileSize>("flexible");
  const onTokenRef = useRef(onToken);

  useEffect(() => {
    onTokenRef.current = onToken;
  }, [onToken]);

  useEffect(() => {
    const outer = outerRef.current;
    if (!outer) return;
    let active = true;
    const updateSize = () => {
      if (!active) return;
      const nextSize: TurnstileSize =
        outer.getBoundingClientRect().width < 324 ? "compact" : "flexible";
      setWidgetSize((currentSize) =>
        currentSize === nextSize ? currentSize : nextSize
      );
    };
    const observer = new ResizeObserver(updateSize);
    observer.observe(outer);
    queueMicrotask(updateSize);
    return () => {
      active = false;
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    let active = true;
    onTokenRef.current(null);

    void loadTurnstile()
      .then((turnstile) => {
        if (!active || !containerRef.current) return;
        widgetIdRef.current = turnstile.render(containerRef.current, {
          sitekey: siteKey,
          action,
          theme: "dark",
          appearance,
          size: widgetSize,
          language: turnstileLanguage(locale),
          "response-field": false,
          callback(token) {
            if (!active) return;
            onTokenRef.current(token);
            setCanRetry(false);
            setInteractive(false);
            setStatus("Security verification complete.");
          },
          "error-callback"() {
            if (!active) return;
            onTokenRef.current(null);
            setCanRetry(true);
            setInteractive(true);
            setStatus("Security verification failed. Please try again.");
          },
          "expired-callback"() {
            if (!active) return;
            onTokenRef.current(null);
            setCanRetry(true);
            setInteractive(true);
            setStatus("Security verification expired. Please complete it again.");
          },
          "timeout-callback"() {
            if (!active) return;
            onTokenRef.current(null);
            setCanRetry(true);
            setInteractive(true);
            setStatus("Security verification timed out. Please complete it again.");
          },
          "before-interactive-callback"() {
            if (!active) return;
            setInteractive(true);
            setStatus("Complete the security verification to continue.");
          },
          "after-interactive-callback"() {
            if (!active || appearance === "always") return;
            setInteractive(false);
          },
        });
        setStatus("Complete the security verification to continue.");
      })
      .catch(() => {
        if (!active) return;
        onTokenRef.current(null);
        setCanRetry(true);
        setStatus("Security verification could not be loaded. Please try again.");
      });

    return () => {
      active = false;
      const widgetId = widgetIdRef.current;
      widgetIdRef.current = null;
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId);
    };
  }, [action, appearance, loadAttempt, locale, siteKey, widgetSize]);

  useEffect(() => {
    const widgetId = widgetIdRef.current;
    if (!widgetId || !window.turnstile) return;
    onTokenRef.current(null);
    window.turnstile.reset(widgetId);
    setCanRetry(false);
    setStatus("Complete the security verification to continue.");
  }, [appearance, resetKey]);

  const retry = () => {
    onTokenRef.current(null);
    const widgetId = widgetIdRef.current;
    if (widgetId && window.turnstile) {
      window.turnstile.reset(widgetId);
      setCanRetry(false);
      setStatus("Complete the security verification to continue.");
      return;
    }
    setCanRetry(false);
    setStatus("Loading security verification...");
    setLoadAttempt((value) => value + 1);
  };

  const showChallengeChrome = appearance === "always" || interactive || canRetry;

  return (
    <div
      ref={outerRef}
      data-turnstile-appearance={appearance}
      className={showChallengeChrome
        ? "rounded-2xl border border-white/10 bg-black/25 p-3"
        : "min-h-0"}
    >
      <div
        ref={containerRef}
        className={showChallengeChrome
          ? "min-h-[65px] w-full min-w-0"
          : "w-full min-w-0 overflow-hidden"}
      />
      <p
        className={showChallengeChrome
          ? "mt-2 text-xs leading-5 text-zinc-500"
          : "sr-only"}
        aria-live="polite"
      >
        {customerWorkflowExactT(locale, status)}
      </p>
      {canRetry && (
        <button
          type="button"
          onClick={retry}
          className="mt-2 text-xs font-black text-red-400 transition hover:text-red-300"
        >
          {customerWorkflowExactT(locale, "Retry security verification")}
        </button>
      )}
    </div>
  );
}
