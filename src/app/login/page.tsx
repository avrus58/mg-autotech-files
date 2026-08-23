"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getAuthenticatedHome,
  primeStableSession,
  signOutIfEmailUnverified,
} from "@/lib/authGuards";
import { TurnstileChallenge } from "@/components/auth/TurnstileChallenge";
import { DeviceVerificationPanel } from "@/components/auth/DeviceVerificationPanel";
import { GoogleIdentityButton } from "@/components/auth/GoogleIdentityButton";
import { AuthBackdrop } from "@/components/auth/AuthBackdrop";
import {
  AUTH_CAPTCHA_REQUIRED_MESSAGE,
  authCaptchaBlocksSubmission,
  getAuthCaptchaToken,
  getPublicAuthCaptchaConfig,
} from "@/lib/authCaptcha";
import {
  AUTH_LOGIN_FAILURE_STORAGE_KEY,
  EMPTY_AUTH_LOGIN_FAILURE_STATE,
  authLoginNeedsVisibleChallenge,
  clearAuthLoginFailures,
  getAuthLoginFailureWindowRemaining,
  getBrowserAuthLoginFailureStorage,
  isInvalidPasswordCredentialError,
  readAuthLoginFailureState,
  recordAuthLoginFailure,
} from "@/lib/authLoginProtection";
import { supabase } from "@/lib/supabaseClient";
import { getPublicGoogleIdentityConfig } from "@/lib/googleIdentity";
import { getSafeLocalRedirectPath } from "@/lib/safeLocalRedirect";
import {
  ArrowRight,
  Lock,
  Loader2,
  Mail,
  ShieldCheck,
  Upload,
} from "lucide-react";

function getRequestedRedirect() {
  if (typeof window === "undefined") return null;

  const value = new URLSearchParams(window.location.search).get("redirect");
  return getSafeLocalRedirectPath(value);
}

export default function LoginPage() {
  const router = useRouter();
  const authCaptchaConfig = getPublicAuthCaptchaConfig();
  const googleIdentityConfig = getPublicGoogleIdentityConfig();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [messageIsSuccess, setMessageIsSuccess] = useState(false);
  const [googleMessage, setGoogleMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [deviceVerificationNextPath, setDeviceVerificationNextPath] = useState<string | null>(null);
  const passwordChangeVerification = typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("purpose") === "password_change";
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaResetKey, setCaptchaResetKey] = useState(0);
  const [passwordFailureState, setPasswordFailureState] = useState(
    EMPTY_AUTH_LOGIN_FAILURE_STATE
  );
  const authRequestInFlightRef = useRef(false);
  const captchaEscalationNoticeRef = useRef<HTMLDivElement | null>(null);
  const visibleCaptchaRequired =
    authCaptchaConfig.status === "ready" &&
    authLoginNeedsVisibleChallenge(passwordFailureState.failures);

  useEffect(() => {
    const storage = getBrowserAuthLoginFailureStorage();
    const syncFailureState = () => {
      setPasswordFailureState(readAuthLoginFailureState(storage));
    };
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== AUTH_LOGIN_FAILURE_STORAGE_KEY) return;
      syncFailureState();
    };

    syncFailureState();
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  useEffect(() => {
    const remaining = getAuthLoginFailureWindowRemaining(passwordFailureState);
    if (remaining === null) return;

    const timeoutId = window.setTimeout(() => {
      setPasswordFailureState(
        readAuthLoginFailureState(getBrowserAuthLoginFailureStorage())
      );
    }, remaining + 50);
    return () => window.clearTimeout(timeoutId);
  }, [passwordFailureState]);

  useEffect(() => {
    if (!visibleCaptchaRequired) return;
    const frameId = window.requestAnimationFrame(() => {
      captchaEscalationNoticeRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [visibleCaptchaRequired]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedRedirect = getRequestedRedirect();
    const querySuccess = params.get("reset") === "success";
    const queryMessage = params.get("verify_email") === "1"
      ? "Please verify your e-mail address before accessing your account."
      : params.get("reset") === "success"
        ? "Password updated successfully. You can login now."
        : "";

    let active = true;

    const redirectAuthenticatedUser = async () => {
      const { data } = await supabase.auth.getUser();
      const user = data.user;

      if (!active) return;

      if (!user) {
        setMessageIsSuccess(querySuccess);
        setMessage(queryMessage);
        return;
      }

      if (await signOutIfEmailUnverified(user)) {
        setMessageIsSuccess(false);
        setMessage("Please verify your e-mail address before accessing your account.");
        return;
      }

      clearAuthLoginFailures(getBrowserAuthLoginFailureStorage());
      setPasswordFailureState(EMPTY_AUTH_LOGIN_FAILURE_STATE);
      setDeviceVerificationNextPath(
        requestedRedirect ?? (await getAuthenticatedHome(user.id))
      );
    };

    void redirectAuthenticatedUser();

    return () => {
      active = false;
    };
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (loading || authRequestInFlightRef.current) return;
    setMessageIsSuccess(false);

    let requestCaptchaToken: string | undefined;
    try {
      requestCaptchaToken = getAuthCaptchaToken(
        authCaptchaConfig,
        captchaToken
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Security verification failed."
      );
      return;
    }

    authRequestInFlightRef.current = true;
    if (requestCaptchaToken) setCaptchaToken(null);

    setLoading(true);
    setMessage("");

    const response = await supabase.auth
      .signInWithPassword({
        email: email.trim(),
        password,
        options: requestCaptchaToken
          ? { captchaToken: requestCaptchaToken }
          : undefined,
      })
      .catch(() => null)
      .finally(() => {
        authRequestInFlightRef.current = false;
        if (!requestCaptchaToken) return;
        setCaptchaResetKey((value) => value + 1);
      });

    if (!response) {
      setMessage("Login could not be completed. Please try again.");
      setLoading(false);
      return;
    }
    const { data, error } = response;

    if (error) {
      if (isInvalidPasswordCredentialError(error)) {
        setPasswordFailureState((currentState) =>
          recordAuthLoginFailure(
            getBrowserAuthLoginFailureStorage(),
            currentState
          )
        );
      }
      setMessage(
        error.message.toLowerCase().includes("email not confirmed")
          ? "Please verify your e-mail address before logging in."
          : error.message
      );
      setLoading(false);
      return;
    }

    primeStableSession(data.session);

    clearAuthLoginFailures(getBrowserAuthLoginFailureStorage());
    setPasswordFailureState(EMPTY_AUTH_LOGIN_FAILURE_STATE);

    if (data.user && (await signOutIfEmailUnverified(data.user))) {
      setMessage("Please verify your e-mail address before accessing your account.");
      setLoading(false);
      return;
    }

    setDeviceVerificationNextPath(
      getRequestedRedirect() ?? (await getAuthenticatedHome(data.user!.id))
    );
    setLoading(false);
  };

  const handleGoogleLogin = async (credential: string, nonce: string) => {
    if (googleLoading || loading || authRequestInFlightRef.current) return;

    if (googleIdentityConfig.status !== "ready") {
      setGoogleMessage(
        googleIdentityConfig.status === "misconfigured"
          ? googleIdentityConfig.message
          : "Google sign-in is temporarily unavailable. You can continue with e-mail."
      );
      return;
    }

    let requestCaptchaToken: string | undefined;
    try {
      requestCaptchaToken = getAuthCaptchaToken(
        authCaptchaConfig,
        captchaToken
      );
    } catch (error) {
      setGoogleMessage(
        error instanceof Error ? error.message : "Security verification failed."
      );
      setCaptchaResetKey((value) => value + 1);
      return;
    }

    authRequestInFlightRef.current = true;
    if (requestCaptchaToken) setCaptchaToken(null);
    setGoogleLoading(true);
    setGoogleMessage("");

    const response = await Promise.resolve()
      .then(() =>
        supabase.auth.signInWithIdToken({
          provider: "google",
          token: credential,
          nonce,
          ...(requestCaptchaToken
            ? { options: { captchaToken: requestCaptchaToken } }
            : {}),
        })
      )
      .catch(() => null)
      .finally(() => {
        if (!requestCaptchaToken) return;
        setCaptchaResetKey((value) => value + 1);
      });

    if (!response) {
      authRequestInFlightRef.current = false;
      setGoogleMessage("Google sign-in could not be completed. Please try again.");
      setGoogleLoading(false);
      return;
    }

    const { data, error } = response;

    if (error || !data.session) {
      authRequestInFlightRef.current = false;
      setGoogleMessage("Google sign-in could not be completed. Please try again.");
      setGoogleLoading(false);
      return;
    }

    primeStableSession(data.session);

    clearAuthLoginFailures(getBrowserAuthLoginFailureStorage());
    setPasswordFailureState(EMPTY_AUTH_LOGIN_FAILURE_STATE);
    router.replace(
      `/auth/callback?next=${encodeURIComponent(getRequestedRedirect() ?? "/dashboard")}`
    );
  };

  if (deviceVerificationNextPath) {
    return (
      <main className="relative isolate flex min-h-screen items-center justify-center overflow-x-hidden bg-[#050505] px-3 py-5 text-white sm:px-4">
        <AuthBackdrop />
        <div className="relative z-10 w-full max-w-md rounded-[1.6rem] border border-white/10 bg-white/[0.04] p-7 shadow-2xl shadow-black/50 backdrop-blur-xl sm:p-9">
          <DeviceVerificationPanel
            nextPath={deviceVerificationNextPath}
            allowRememberDevice={!passwordChangeVerification}
          />
        </div>
      </main>
    );
  }

  return (
    <main className="relative isolate flex min-h-screen items-start justify-center overflow-x-hidden bg-[#050505] px-3 py-3 text-white sm:px-4 sm:py-5 lg:items-center lg:py-6">
      <AuthBackdrop />

      <div className="relative z-10 w-full max-w-[560px] overflow-hidden rounded-[1.4rem] border border-white/10 bg-white/[0.04] shadow-2xl shadow-black/50 backdrop-blur-xl lg:rounded-[1.6rem]">
        <header className="flex items-center justify-between gap-4 border-b border-white/10 bg-black/25 px-4 py-3.5 sm:px-6">
          <Link
            href="/"
            className="flex min-w-0 items-center gap-3 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-red-500/60"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-red-800/50 bg-[#111] shadow-lg shadow-red-950/30">
              <Upload className="h-5 w-5 text-red-600" />
            </div>
            <div className="min-w-0">
              <div className="text-lg font-black tracking-wide">
                MG <span className="text-red-600">AUTOTECH</span>
              </div>
              <div className="truncate text-[11px] text-zinc-500">
                Customer Login
              </div>
            </div>
          </Link>

          <div className="hidden shrink-0 items-center gap-2 rounded-full border border-red-900/40 bg-red-950/20 px-3 py-1.5 text-[11px] font-bold text-red-100 sm:inline-flex">
            <ShieldCheck className="h-3.5 w-3.5 text-red-500" />
            Secure customer access
          </div>
        </header>

        <section className="p-4 sm:p-6 lg:p-7">
          <div className="mx-auto max-w-[440px]">
            <div className="mb-6">
              <div className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-red-400">
                Welcome back
              </div>
              <h1 className="text-3xl font-black leading-tight">Login</h1>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                Access your file service dashboard and continue your ECU tuning
                requests.
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label
                  htmlFor="login-email"
                  className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-zinc-500"
                >
                  E-mail
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-500" />
                  <input
                    id="login-email"
                    name="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    type="email"
                    autoComplete="email"
                    className="h-12 w-full rounded-xl border border-white/10 bg-black/35 pl-12 pr-4 text-sm font-bold text-white outline-none transition placeholder:text-zinc-600 hover:border-white/20 focus:border-red-700 focus-visible:ring-2 focus-visible:ring-red-500/25"
                    required
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="login-password"
                  className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-zinc-500"
                >
                  Password
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-500" />
                  <input
                    id="login-password"
                    name="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Your password"
                    type="password"
                    autoComplete="current-password"
                    className="h-12 w-full rounded-xl border border-white/10 bg-black/35 pl-12 pr-4 text-sm font-bold text-white outline-none transition placeholder:text-zinc-600 hover:border-white/20 focus:border-red-700 focus-visible:ring-2 focus-visible:ring-red-500/25"
                    required
                  />
                </div>
              </div>

              {visibleCaptchaRequired && (
                <div
                  ref={captchaEscalationNoticeRef}
                  role="alert"
                  tabIndex={-1}
                  className="rounded-2xl border border-amber-700/50 bg-amber-950/25 p-4 text-sm font-bold text-amber-100 outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                >
                  {AUTH_CAPTCHA_REQUIRED_MESSAGE}
                </div>
              )}

              {authCaptchaConfig.status === "ready" && (
                <TurnstileChallenge
                  siteKey={authCaptchaConfig.siteKey}
                  action="auth_login"
                  resetKey={captchaResetKey}
                  onToken={setCaptchaToken}
                  appearance={visibleCaptchaRequired ? "always" : "interaction-only"}
                />
              )}

              {authCaptchaConfig.status === "misconfigured" && (
                <div
                  role="alert"
                  className="rounded-2xl border border-red-800/50 bg-red-950/30 p-4 text-sm text-red-100"
                >
                  {authCaptchaConfig.message}
                </div>
              )}

              <button
                type="submit"
                disabled={
                  loading ||
                  authCaptchaBlocksSubmission(authCaptchaConfig, captchaToken)
                }
                className="group flex h-12 w-full items-center justify-center rounded-xl bg-[#b1121b] px-5 font-black text-white shadow-xl shadow-red-950/40 outline-none transition hover:bg-[#c91824] focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0b0c] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Logging in...
                  </>
                ) : (
                  <>
                    Login
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

            <div className="mt-4 space-y-3">
              {googleIdentityConfig.status === "ready" &&
                authCaptchaConfig.status !== "misconfigured" && (
                  <GoogleIdentityButton
                    clientId={googleIdentityConfig.clientId}
                    disabled={
                      googleLoading ||
                      loading ||
                      authCaptchaBlocksSubmission(
                        authCaptchaConfig,
                        captchaToken
                      )
                    }
                    loading={googleLoading}
                    resetKey={captchaResetKey}
                    onCredential={(credential, nonce) =>
                      void handleGoogleLogin(credential, nonce)
                    }
                    onReady={() =>
                      setGoogleMessage((current) =>
                        current.startsWith("Google sign-in could not be loaded")
                          ? ""
                          : current
                      )
                    }
                    onError={(reason) => {
                      if (reason === "credential") {
                        setCaptchaToken(null);
                        setCaptchaResetKey((value) => value + 1);
                      }
                      setGoogleMessage(
                        reason === "load"
                          ? "Google sign-in could not be loaded. You can retry or continue with e-mail."
                          : "Google sign-in could not be completed. Please try again."
                      );
                    }}
                  />
                )}

              {googleIdentityConfig.status === "misconfigured" && (
                <div
                  role="alert"
                  className="rounded-xl border border-red-800/50 bg-red-950/30 p-4 text-sm text-red-100"
                >
                  {googleIdentityConfig.message}
                </div>
              )}

              {googleMessage && (
                <div
                  role="alert"
                  aria-live="assertive"
                  className="rounded-xl border border-red-800/50 bg-red-950/30 p-4 text-sm text-red-100"
                >
                  {googleMessage}
                </div>
              )}
            </div>

            <div className="mt-5 text-center">
              <Link
                href="/forgot-password"
                className="rounded-md text-sm font-black text-red-400 outline-none transition hover:text-red-300 focus-visible:ring-2 focus-visible:ring-red-500/50"
              >
                Forgot password?
              </Link>
            </div>

            {message && (
              <div
                role={messageIsSuccess ? "status" : "alert"}
                aria-live={messageIsSuccess ? "polite" : "assertive"}
                className={`mt-5 rounded-xl border p-4 text-sm ${
                  messageIsSuccess
                    ? "border-green-800/50 bg-green-950/25 text-green-100"
                    : "border-red-800/50 bg-red-950/30 text-red-100"
                }`}
              >
                {message}
              </div>
            )}

            <div className="mt-6 text-center text-sm text-zinc-400">
              No account yet?{" "}
              <Link
                href="/register"
                className="rounded-md font-black text-red-400 outline-none transition hover:text-red-300 focus-visible:ring-2 focus-visible:ring-red-500/50"
              >
                Create customer account
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
