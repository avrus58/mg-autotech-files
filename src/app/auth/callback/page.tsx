"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, ShieldCheck, Upload } from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";
import {
  authenticatedFetch,
  primeStableSession,
  signOutLocalStable,
} from "@/lib/authGuards";
import {
  startDeviceVerification,
  startPasswordChangeVerification,
} from "@/lib/deviceVerificationClient";
import {
  completeRegistrationHandoffsBeforeNavigation,
} from "@/lib/registrationHandoffClient";
import {
  createRegistrationAccountBinding,
  isVerifiedEmailRegistrationCallback,
  markRegistrationHandoffsPending,
  readPendingRegistrationHandoffs,
  readRegistrationSessionValue,
  removeRegistrationSessionValues,
  writeRegistrationSessionValue,
} from "@/lib/registrationConversion";
import { getSafeLocalRedirectPath } from "@/lib/safeLocalRedirect";
import {
  replacePrivateMeasurementDocument,
  replaceWithPendingMeasurementCompletion,
  sanitizeSensitiveMeasurementLocation,
} from "@/lib/publicAnalytics";
import {
  OAUTH_REGISTRATION_PROFILE_KEY,
  OAUTH_REGISTRATION_PROVIDER_KEY,
  OAUTH_REGISTRATION_CONVERSION_ELIGIBLE_KEY,
  OAUTH_REGISTRATION_NOTIFICATION_PENDING_KEY,
  parseRegistrationProfileDraft,
} from "@/lib/registrationProfile";
import {
  buildPendingRegistrationCountryMetadata,
  buildRegistrationCompletionUpdates,
  isGoogleRegistrationProfileFinalizationWindowOpen,
  requiresRegistrationCountryCompletion,
} from "@/lib/registrationCompletion";
import { customerWorkflowExactT } from "@/lib/i18n/customer-workflow-auth-translations";
import { useActiveLocale } from "@/lib/useActiveLocale";
import {
  registrationFinalizeErrorMessage,
  type OAuthRegistrationFinalizeErrorPayload,
} from "@/lib/oauthRegistrationFinalizeErrors";

function countryCompletionPath(next: string) {
  return `/auth/complete-profile?next=${encodeURIComponent(next)}`;
}

const registrationHandoffKeys = {
  conversion: OAUTH_REGISTRATION_CONVERSION_ELIGIBLE_KEY,
  notification: OAUTH_REGISTRATION_NOTIFICATION_PENDING_KEY,
} as const;

export default function AuthCallbackPage() {
  const router = useRouter();
  const locale = useActiveLocale();
  const [message, setMessage] = useState("Verifying your access...");

  useEffect(() => {
    const handleCallback = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const next = getSafeLocalRedirectPath(params.get("next")) ?? "/dashboard";
      let callbackFlowReadyForMeasurement = false;
      let measurementBridgeStarted = false;
      const startMeasurementBridge = () => {
        if (!callbackFlowReadyForMeasurement || measurementBridgeStarted) {
          return measurementBridgeStarted;
        }
        measurementBridgeStarted =
          replaceWithPendingMeasurementCompletion(next);
        return measurementBridgeStarted;
      };
      let session: Session | null = null;

      if (code) {
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);

        if (error) {
          setMessage(
            "We could not verify your access. Please return to login and try again."
          );
          return;
        }

        session = data.session;
        sanitizeSensitiveMeasurementLocation();
        primeStableSession(session);
      } else {
        const { data } = await supabase.auth.getSession();

        if (!data.session) {
          if (!replacePrivateMeasurementDocument("/login")) {
            router.replace("/login");
          }
          return;
        }

        session = data.session;
        sanitizeSensitiveMeasurementLocation();
        primeStableSession(session);
      }

      const oauthSignupProvider = readRegistrationSessionValue(
        window.sessionStorage,
        OAUTH_REGISTRATION_PROVIDER_KEY
      );
      const oauthProfile = parseRegistrationProfileDraft(
        readRegistrationSessionValue(
          window.sessionStorage,
          OAUTH_REGISTRATION_PROFILE_KEY
        )
      );

      if (session?.user) {
        let currentSession: Session = session;
        const registrationAccountBinding =
          await createRegistrationAccountBinding(currentSession.user.id);
        let completedGoogleRegistration = false;
        const openCountryCompletion = async () => {
          try {
            writeRegistrationSessionValue(
              window.sessionStorage,
              OAUTH_REGISTRATION_PROVIDER_KEY,
              "google"
            );
            const freshGoogleRegistration =
              oauthSignupProvider === "google" &&
              isGoogleRegistrationProfileFinalizationWindowOpen(
                currentSession.user
              );
            if (freshGoogleRegistration) {
              markRegistrationHandoffsPending(
                window.sessionStorage,
                registrationHandoffKeys,
                "google",
                registrationAccountBinding ?? ""
              );
            } else {
              removeRegistrationSessionValues(
                window.sessionStorage,
                [
                  OAUTH_REGISTRATION_CONVERSION_ELIGIBLE_KEY,
                  OAUTH_REGISTRATION_NOTIFICATION_PENDING_KEY,
                ]
              );
            }
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

          let profileResponse: Response;
          try {
            profileResponse = await authenticatedFetch(
              "/api/auth/oauth-registration/finalize",
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ profile: oauthProfile }),
              }
            );
          } catch {
            setMessage("Registration profile could not be finalized. Please try again.");
            return;
          }
          if (!profileResponse.ok) {
            const payload = await profileResponse.json().catch(
              () => ({}),
            ) as OAuthRegistrationFinalizeErrorPayload;
            setMessage(registrationFinalizeErrorMessage(payload.errorCode));
            return;
          }
          const refreshedSession = await supabase.auth.refreshSession();
          if (refreshedSession.error || !refreshedSession.data.session?.user) {
            setMessage("Your updated account could not be verified. Please log in again.");
            return;
          }
          currentSession = refreshedSession.data.session;
          primeStableSession(currentSession);
          completedGoogleRegistration = true;
          removeRegistrationSessionValues(
            window.sessionStorage,
            [
              OAUTH_REGISTRATION_PROVIDER_KEY,
              OAUTH_REGISTRATION_PROFILE_KEY,
            ]
          );
        }

        if (
          !completedGoogleRegistration &&
          ((oauthSignupProvider === "google") ||
            requiresRegistrationCountryCompletion(currentSession.user))
        ) {
          await openCountryCompletion();
          return;
        }

        const registrationConversionEligible =
          completedGoogleRegistration ||
          isVerifiedEmailRegistrationCallback({
            user: currentSession.user,
            hasAuthCode: Boolean(code),
            nextPath: next,
          });

        if (registrationConversionEligible) {
          markRegistrationHandoffsPending(
            window.sessionStorage,
            registrationHandoffKeys,
            completedGoogleRegistration ? "google" : "email",
            registrationAccountBinding ?? ""
          );
        }

        const pendingRegistrationHandoffs = readPendingRegistrationHandoffs(
          window.sessionStorage,
          registrationHandoffKeys,
          registrationAccountBinding
        );
        if (
          pendingRegistrationHandoffs.conversion ||
          pendingRegistrationHandoffs.notificationSource
        ) {
          // Pending markers contain only a short-lived timestamp and provider
          // class. They survive the no-code device-resume boundary, while the
          // one-time PKCE exchange above is never repeated.
          await completeRegistrationHandoffsBeforeNavigation(
            {
              storage: window.sessionStorage,
              keys: registrationHandoffKeys,
              accountBinding: registrationAccountBinding,
            },
            {
              onConversionHandoffCompleted: () => {
                startMeasurementBridge();
              },
            }
          );
        }

        try {
          const deviceState = next === "/reset-password"
            ? await startPasswordChangeVerification()
            : await startDeviceVerification();
          if (deviceState.status === "revoked") {
            await signOutLocalStable();
            if (!replacePrivateMeasurementDocument("/login")) {
              router.replace("/login");
            }
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
            const loginDestination = `/login?${loginParams.toString()}`;
            if (!replacePrivateMeasurementDocument(loginDestination)) {
              router.replace(loginDestination);
            }
            return;
          }
        } catch {
          setMessage("Account security verification is temporarily unavailable.");
          return;
        }

        if (oauthSignupProvider && oauthSignupProvider !== "google") {
          removeRegistrationSessionValues(window.sessionStorage, [
            OAUTH_REGISTRATION_PROVIDER_KEY,
          ]);
        }
        if (oauthSignupProvider !== "google") {
          removeRegistrationSessionValues(window.sessionStorage, [
            OAUTH_REGISTRATION_PROFILE_KEY,
          ]);
        }

      }

      callbackFlowReadyForMeasurement = true;
      if (startMeasurementBridge()) return;
      if (replaceWithPendingMeasurementCompletion(next)) return;
      if (!replacePrivateMeasurementDocument(next)) {
        router.replace(next);
      }
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
            <div className="text-xs text-zinc-400">
              {customerWorkflowExactT(locale, "Secure Auth")}
            </div>
          </div>
        </Link>

        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-red-800/50 bg-red-950/25 text-red-400">
          {message === "Verifying your access..." ? (
            <Loader2 className="h-7 w-7 animate-spin" />
          ) : (
            <ShieldCheck className="h-7 w-7" />
          )}
        </div>

        <h1 className="text-3xl font-black">
          {customerWorkflowExactT(locale, "Account verification")}
        </h1>
        <p
          className="mt-4 text-sm leading-7 text-zinc-400"
        >
          {customerWorkflowExactT(locale, message)}
        </p>

        {message !== "Verifying your access..." && (
          <Link
            href="/login"
            className="mt-6 inline-flex h-12 items-center justify-center rounded-2xl bg-[#b1121b] px-5 text-sm font-black text-white transition hover:bg-[#c91824]"
          >
            {customerWorkflowExactT(locale, "Back to login")}
          </Link>
        )}
      </div>
    </main>
  );
}
