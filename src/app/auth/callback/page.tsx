"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, ShieldCheck, Upload } from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";
import { authenticatedFetch, signOutLocalStable } from "@/lib/authGuards";
import {
  startDeviceVerification,
  startPasswordChangeVerification,
} from "@/lib/deviceVerificationClient";
import { recordGrowthAccountCreated } from "@/lib/growth/client";
import { trackRegistrationCompleted } from "@/lib/publicAnalytics";
import { getSafeLocalRedirectPath } from "@/lib/safeLocalRedirect";
import {
  OAUTH_REGISTRATION_PROFILE_KEY,
  OAUTH_REGISTRATION_PROVIDER_KEY,
  parseRegistrationProfileDraft,
} from "@/lib/registrationProfile";
import {
  buildPendingRegistrationCountryMetadata,
  buildRegistrationCompletionUpdates,
  isGoogleRegistrationProfileFinalizationWindowOpen,
  requiresRegistrationCountryCompletion,
} from "@/lib/registrationCompletion";

function countryCompletionPath(next: string) {
  return `/auth/complete-profile?next=${encodeURIComponent(next)}`;
}

export default function AuthCallbackPage() {
  const router = useRouter();
  const [message, setMessage] = useState("Verifying your access...");

  useEffect(() => {
    const handleCallback = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const next = getSafeLocalRedirectPath(params.get("next")) ?? "/dashboard";
      let session: Session | null = null;

      if (code) {
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);

        if (error) {
          setMessage(error.message);
          return;
        }

        session = data.session;
      } else {
        const { data } = await supabase.auth.getSession();

        if (!data.session) {
          router.replace("/login");
          return;
        }

        session = data.session;
      }

      const oauthSignupProvider = window.sessionStorage.getItem(
        OAUTH_REGISTRATION_PROVIDER_KEY
      );
      const oauthProfile = parseRegistrationProfileDraft(
        window.sessionStorage.getItem(OAUTH_REGISTRATION_PROFILE_KEY)
      );

      if (session?.user) {
        let currentSession: Session = session;
        let completedGoogleRegistration = false;
        const openCountryCompletion = async () => {
          try {
            window.sessionStorage.setItem(
              OAUTH_REGISTRATION_PROVIDER_KEY,
              "google"
            );
          } catch {
            // Persistent Auth metadata and the workspace guard remain active.
          }
          await supabase.auth.updateUser({
            data: buildPendingRegistrationCountryMetadata(
              currentSession.user.user_metadata
            ),
          });
          setMessage("Opening country confirmation...");
          router.replace(countryCompletionPath(next));
        };

        if (
          oauthSignupProvider === "google" &&
          oauthProfile &&
          isGoogleRegistrationProfileFinalizationWindowOpen(currentSession.user)
        ) {
          const updates = buildRegistrationCompletionUpdates({
            country: oauthProfile.country,
            draft: oauthProfile,
            existingMetadata: currentSession.user.user_metadata,
          });
          if (!updates) {
            await openCountryCompletion();
            return;
          }

          const profileResponse = await authenticatedFetch(
            "/api/auth/oauth-registration/finalize",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ profile: oauthProfile }),
            }
          );
          if (!profileResponse.ok) {
            const payload = await profileResponse.json().catch(() => ({})) as {
              error?: string;
            };
            setMessage(payload.error || "Registration profile could not be finalized.");
            return;
          }
          const refreshedSession = await supabase.auth.refreshSession();
          if (refreshedSession.error || !refreshedSession.data.session?.user) {
            setMessage("Your updated account could not be verified. Please log in again.");
            return;
          }
          currentSession = refreshedSession.data.session;
          completedGoogleRegistration = true;
          window.sessionStorage.removeItem(OAUTH_REGISTRATION_PROVIDER_KEY);
          window.sessionStorage.removeItem(OAUTH_REGISTRATION_PROFILE_KEY);
        }

        if (
          !completedGoogleRegistration &&
          ((oauthSignupProvider === "google") ||
            requiresRegistrationCountryCompletion(currentSession.user))
        ) {
          await openCountryCompletion();
          return;
        }

        const createdAt = new Date(currentSession.user.created_at).getTime();
        const isRecentSignup = Date.now() - createdAt < 15 * 60 * 1000;
        const confirmedAt = new Date(
          currentSession.user.email_confirmed_at || currentSession.user.confirmed_at || 0
        ).getTime();
        const isRecentEmailConfirmation =
          confirmedAt > 0 && Date.now() - confirmedAt < 15 * 60 * 1000;

        if (isRecentSignup || isRecentEmailConfirmation) {
          try {
            await authenticatedFetch("/api/email/new-customer", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                source: oauthSignupProvider === "google" ? "google" : "email",
              }),
            });
          } catch {
            // Notification delivery is idempotent and can be retried on resume.
          }
        }

        try {
          const deviceState = next === "/reset-password"
            ? await startPasswordChangeVerification()
            : await startDeviceVerification();
          if (deviceState.status === "revoked") {
            await signOutLocalStable();
            router.replace("/login");
            return;
          }
          if (deviceState.status === "required") {
            const resumePath = `/auth/callback?next=${encodeURIComponent(next)}`;
            const loginParams = new URLSearchParams({
              device: "1",
              redirect: resumePath,
            });
            if (next === "/reset-password") {
              loginParams.set("purpose", "password_change");
            }
            router.replace(`/login?${loginParams.toString()}`);
            return;
          }
        } catch (error) {
          setMessage(
            error instanceof Error
              ? error.message
              : "Account security verification is temporarily unavailable."
          );
          return;
        }

        if (oauthSignupProvider && oauthSignupProvider !== "google") {
          window.sessionStorage.removeItem("mg_register_oauth_provider");
        }
        if (oauthSignupProvider !== "google") {
          window.sessionStorage.removeItem(OAUTH_REGISTRATION_PROFILE_KEY);
        }

        if (isRecentSignup || isRecentEmailConfirmation) {
          void recordGrowthAccountCreated();
          void trackRegistrationCompleted();
        }
      }

      router.replace(next);
    };

    handleCallback();
  }, [router]);

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#050505] px-4 text-white">
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_25%_0%,rgba(160,18,28,0.28),transparent_32%),linear-gradient(135deg,#050505,#0d0d0f_48%,#160608)]" />

      <div className="w-full max-w-md rounded-[2rem] border border-white/10 bg-white/[0.04] p-8 text-center shadow-2xl shadow-black/50 backdrop-blur-xl">
        <Link href="/" className="mx-auto mb-7 flex w-fit items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-red-800/50 bg-[#111]">
            <Upload className="h-7 w-7 text-red-600" />
          </div>
          <div className="text-left">
            <div className="text-xl font-black">
              MG <span className="text-red-600">AUTOTECH</span>
            </div>
            <div className="text-xs text-zinc-400">Secure Auth</div>
          </div>
        </Link>

        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-red-800/50 bg-red-950/25 text-red-400">
          {message === "Verifying your access..." ? (
            <Loader2 className="h-7 w-7 animate-spin" />
          ) : (
            <ShieldCheck className="h-7 w-7" />
          )}
        </div>

        <h1 className="text-3xl font-black">Account verification</h1>
        <p className="mt-4 text-sm leading-7 text-zinc-400">{message}</p>

        {message !== "Verifying your access..." && (
          <Link
            href="/login"
            className="mt-6 inline-flex h-12 items-center justify-center rounded-2xl bg-[#b1121b] px-5 text-sm font-black text-white transition hover:bg-[#c91824]"
          >
            Back to login
          </Link>
        )}
      </div>
    </main>
  );
}
