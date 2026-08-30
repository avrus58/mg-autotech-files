"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { intlLocaleByCode } from "@/lib/i18nConfig";
import { customerRuntimeExactT } from "@/lib/i18n/customer-runtime-translations";
import { useActiveLocale } from "@/lib/useActiveLocale";

const GOOGLE_IDENTITY_SCRIPT_ID = "mg-google-identity-services";
const GOOGLE_IDENTITY_SCRIPT_URL = "https://accounts.google.com/gsi/client";
let googleIdentityScriptPromise: Promise<void> | null = null;

type GoogleCredentialResponse = {
  credential?: string;
};

type GoogleIdentityApi = {
  accounts: {
    id: {
      initialize: (configuration: {
        client_id: string;
        callback: (response: GoogleCredentialResponse) => void;
        nonce: string;
        auto_select: boolean;
        cancel_on_tap_outside: boolean;
      }) => void;
      renderButton: (
        parent: HTMLElement,
        options: {
          type: "standard";
          theme: "filled_black";
          size: "large";
          text: "continue_with";
          shape: "rectangular";
          logo_alignment: "left";
          width: number;
          locale: string;
        }
      ) => void;
      cancel: () => void;
    };
  };
};

declare global {
  interface Window {
    google?: GoogleIdentityApi;
  }
}

type GoogleIdentityButtonProps = {
  clientId: string;
  disabled: boolean;
  loading: boolean;
  resetKey: number;
  onCredential: (credential: string, nonce: string) => void;
  onError: (reason: "credential" | "load") => void;
  onReady?: () => void;
};

function base64Url(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return window
    .btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/u, "");
}

async function createNoncePair() {
  const random = new Uint8Array(32);
  window.crypto.getRandomValues(random);
  const nonce = base64Url(random);
  const digest = await window.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(nonce)
  );
  const hashedNonce = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return { nonce, hashedNonce };
}

function loadGoogleIdentityScript() {
  if (window.google?.accounts.id) return Promise.resolve();
  if (googleIdentityScriptPromise) return googleIdentityScriptPromise;

  let script = document.getElementById(
    GOOGLE_IDENTITY_SCRIPT_ID
  ) as HTMLScriptElement | null;

  googleIdentityScriptPromise = new Promise<void>((resolve, reject) => {
    let timeoutId: number | null = null;
    function cleanup() {
      if (timeoutId !== null) window.clearTimeout(timeoutId);
      script?.removeEventListener("load", handleLoad);
      script?.removeEventListener("error", handleError);
    }
    function fail() {
      cleanup();
      script?.remove();
      googleIdentityScriptPromise = null;
      reject(new Error("google"));
    }
    function handleLoad() {
      if (window.google?.accounts.id) {
        cleanup();
        resolve();
        return;
      }
      fail();
    }
    function handleError() {
      fail();
    }

    const shouldAppend = !script;
    if (!script) {
      script = document.createElement("script");
      script.id = GOOGLE_IDENTITY_SCRIPT_ID;
      script.src = GOOGLE_IDENTITY_SCRIPT_URL;
      script.async = true;
      script.defer = true;
    }

    script.addEventListener("load", handleLoad, { once: true });
    script.addEventListener("error", handleError, { once: true });
    timeoutId = window.setTimeout(fail, 10_000);
    if (shouldAppend) document.head.appendChild(script);
  });

  return googleIdentityScriptPromise;
}

export function GoogleIdentityButton({
  clientId,
  disabled,
  loading,
  resetKey,
  onCredential,
  onError,
  onReady,
}: GoogleIdentityButtonProps) {
  const locale = useActiveLocale();
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const onCredentialRef = useRef(onCredential);
  const onErrorRef = useRef(onError);
  const onReadyRef = useRef(onReady);
  const focusAfterRetryRef = useRef(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    onCredentialRef.current = onCredential;
    onErrorRef.current = onError;
    onReadyRef.current = onReady;
  }, [onCredential, onError, onReady]);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    const container = containerRef.current;
    if (!wrapper || !container) return;

    let active = true;
    let focusFrameId: number | null = null;
    let resizeTimer: number | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let renderedWidth: number | null = null;
    queueMicrotask(() => {
      if (active) {
        setReady(false);
        setFailed(false);
      }
    });

    const setup = async () => {
      try {
        const [{ nonce, hashedNonce }] = await Promise.all([
          createNoncePair(),
          loadGoogleIdentityScript(),
        ]);
        if (!active) return;
        if (!window.google?.accounts.id) throw new Error("google");

        const getButtonWidth = () =>
          Math.max(
            200,
            Math.min(400, Math.floor(wrapper.getBoundingClientRect().width))
          );

        const renderButton = (force = false) => {
          if (!active || !window.google?.accounts.id) return;
          const width = getButtonWidth();
          if (!force && width === renderedWidth) return;
          renderedWidth = width;
          container.replaceChildren();
          window.google.accounts.id.renderButton(container, {
            type: "standard",
            theme: "filled_black",
            size: "large",
            text: "continue_with",
            shape: "rectangular",
            logo_alignment: "left",
            width,
            locale: intlLocaleByCode[locale].replace("-", "_"),
          });
          setReady(true);
          onReadyRef.current?.();
          if (focusAfterRetryRef.current) {
            focusAfterRetryRef.current = false;
            focusFrameId = window.requestAnimationFrame(() => {
              const iframe = container.querySelector<HTMLIFrameElement>("iframe");
              (iframe ?? wrapperRef.current)?.focus();
            });
          }
        };

        window.google.accounts.id.initialize({
          client_id: clientId,
          nonce: hashedNonce,
          auto_select: false,
          cancel_on_tap_outside: true,
          callback: (response) => {
            if (!active) return;
            const credential = response.credential?.trim();
            if (!credential) {
              onErrorRef.current("credential");
              return;
            }
            onCredentialRef.current(credential, nonce);
          },
        });

        renderButton(true);
        resizeObserver = new ResizeObserver(() => {
          if (getButtonWidth() === renderedWidth) return;
          if (resizeTimer !== null) window.clearTimeout(resizeTimer);
          resizeTimer = window.setTimeout(renderButton, 80);
        });
        resizeObserver.observe(wrapper);
      } catch {
        if (active) {
          setFailed(true);
          onErrorRef.current("load");
        }
      }
    };

    void setup();

    return () => {
      active = false;
      if (resizeTimer !== null) window.clearTimeout(resizeTimer);
      if (focusFrameId !== null) window.cancelAnimationFrame(focusFrameId);
      resizeObserver?.disconnect();
      window.google?.accounts.id.cancel();
      container.replaceChildren();
    };
  }, [clientId, loadAttempt, locale, resetKey]);

  const showPlaceholder = disabled || loading || !ready;
  const placeholderMessage = customerRuntimeExactT(locale, loading
    ? "Opening Google sign-in..."
    : failed
      ? "Google sign-in is unavailable. Use e-mail or try again."
      : !ready
        ? "Loading secure Google sign-in..."
        : "Complete the security verification to continue with Google.");

  return (
    <div
      ref={wrapperRef}
      role="group"
      aria-label={customerRuntimeExactT(locale, "Google sign-in")}
      aria-busy={!failed && (loading || !ready)}
      tabIndex={-1}
      className="relative flex h-12 w-full items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-white/[0.04]"
    >
      <div
        ref={containerRef}
        translate="no"
        data-no-translate
        aria-hidden={showPlaceholder}
        className={`flex h-10 w-full justify-center ${
          showPlaceholder ? "invisible" : ""
        }`}
      />
      {showPlaceholder && failed ? (
        <button
          type="button"
          onClick={() => {
            focusAfterRetryRef.current = true;
            setLoadAttempt((value) => value + 1);
          }}
          className="absolute inset-0 flex items-center justify-center gap-2 px-4 text-sm font-black text-red-300 outline-none transition hover:text-red-200 focus-visible:ring-2 focus-visible:ring-red-500/60"
        >
          {customerRuntimeExactT(locale, "Retry Google sign-in")}
        </button>
      ) : showPlaceholder ? (
        <div
          role="status"
          aria-live="polite"
          className="absolute inset-0 flex items-center justify-center gap-3 px-4 text-center text-sm font-black text-zinc-400"
        >
          {loading || !ready ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-sm font-black text-black">
              G
            </span>
          )}
          {placeholderMessage}
        </div>
      ) : null}
    </div>
  );
}
