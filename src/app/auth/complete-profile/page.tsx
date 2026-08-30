"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, MapPin, Upload } from "lucide-react";
import { CountrySelect } from "@/components/CountrySelect";
import { authenticatedFetch, getStableSession } from "@/lib/authGuards";
import {
  normalizeCountryCode,
  normalizeCountryName,
  resolveDetectedCountrySelection,
} from "@/lib/countries";
import {
  completeRegistrationHandoffsBeforeNavigation,
} from "@/lib/registrationHandoffClient";
import {
  createRegistrationAccountBinding,
  readPendingRegistrationHandoffs,
} from "@/lib/registrationConversion";
import {
  requiresRegistrationCountryCompletion,
} from "@/lib/registrationCompletion";
import {
  OAUTH_REGISTRATION_PROFILE_KEY,
  OAUTH_REGISTRATION_PROVIDER_KEY,
  OAUTH_REGISTRATION_CONVERSION_ELIGIBLE_KEY,
  OAUTH_REGISTRATION_NOTIFICATION_PENDING_KEY,
  parseRegistrationProfileCompletionDraft,
} from "@/lib/registrationProfile";
import { supabase } from "@/lib/supabaseClient";
import { getSafeLocalRedirectPath } from "@/lib/safeLocalRedirect";
import {
  replacePrivateMeasurementDocument,
  replaceWithPendingMeasurementCompletion,
} from "@/lib/publicAnalytics";
import { authPageFirstPaintT } from "@/lib/i18n/auth-page-first-paint";
import { customerWorkflowExactT } from "@/lib/i18n/customer-workflow-auth-translations";
import { useActiveLocale } from "@/lib/useActiveLocale";

type CountryDetectionState = "detecting" | "detected" | "manual";

const registrationHandoffKeys = {
  conversion: OAUTH_REGISTRATION_CONVERSION_ELIGIBLE_KEY,
  notification: OAUTH_REGISTRATION_NOTIFICATION_PENDING_KEY,
} as const;

function safeNextPath() {
  const value = new URLSearchParams(window.location.search).get("next");
  return getSafeLocalRedirectPath(value) ?? "/dashboard";
}

function readPendingDraft() {
  try {
    return parseRegistrationProfileCompletionDraft(
      window.sessionStorage.getItem(OAUTH_REGISTRATION_PROFILE_KEY)
    );
  } catch {
    return null;
  }
}

function clearPendingDraft() {
  try {
    window.sessionStorage.removeItem(OAUTH_REGISTRATION_PROVIDER_KEY);
    window.sessionStorage.removeItem(OAUTH_REGISTRATION_PROFILE_KEY);
  } catch {
    // Restricted browser storage must not block a completed profile update.
  }
}

function hasPendingGoogleRegistration() {
  try {
    return (
      window.sessionStorage.getItem(OAUTH_REGISTRATION_PROVIDER_KEY) ===
      "google"
    );
  } catch {
    return false;
  }
}

export default function CompleteProfilePage() {
  const router = useRouter();
  const locale = useActiveLocale();
  const firstPaintT = (source: string) => authPageFirstPaintT(locale, source);
  const [country, setCountry] = useState("");
  const [countryDetection, setCountryDetection] =
    useState<CountryDetectionState>("detecting");
  const [checkingUser, setCheckingUser] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const countryManuallySelectedRef = useRef(false);
  const countrySelectRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    let active = true;

    void getStableSession()
      .then(({ session, error }) => {
        if (!active) return;
        if (!session?.user) {
          if (error) {
            setMessage("Your session could not be verified. Please log in again.");
            setCheckingUser(false);
            return;
          }
          if (!replacePrivateMeasurementDocument("/login")) {
            router.replace("/login");
          }
          return;
        }
        if (
          !hasPendingGoogleRegistration() &&
          !requiresRegistrationCountryCompletion(session.user)
        ) {
          const next = safeNextPath();
          if (!replacePrivateMeasurementDocument(next)) {
            router.replace(next);
          }
          return;
        }
        setCheckingUser(false);
      })
      .catch(() => {
        if (!active) return;
        setMessage("Your session could not be verified. Please log in again.");
        setCheckingUser(false);
      });

    return () => {
      active = false;
    };
  }, [router]);

  useEffect(() => {
    const pendingCountry = readPendingDraft()?.country;
    if (pendingCountry) {
      countryManuallySelectedRef.current = true;
      let active = true;
      void Promise.resolve().then(() => {
        if (!active) return;
        setCountry(pendingCountry);
        setCountryDetection("manual");
      });
      return () => {
        active = false;
      };
    }

    let active = true;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 4_000);

    void fetch("/api/public/country", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) return null;
        return (await response.json()) as { countryCode?: unknown };
      })
      .then((payload) => {
        if (!active) return;
        const detectedCountryCode = normalizeCountryCode(payload?.countryCode);
        if (!detectedCountryCode || countryManuallySelectedRef.current) {
          setCountryDetection("manual");
          return;
        }

        setCountry((currentCountry) =>
          resolveDetectedCountrySelection({
            currentCountry,
            detectedCountryCode,
            manuallySelected: countryManuallySelectedRef.current,
          })
        );
        setCountryDetection("detected");
      })
      .catch(() => {
        if (active) setCountryDetection("manual");
      })
      .finally(() => window.clearTimeout(timeout));

    return () => {
      active = false;
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, []);

  const countryHint =
    countryDetection === "detecting"
      ? customerWorkflowExactT(locale, "Detecting your country...")
      : countryDetection === "detected"
        ? customerWorkflowExactT(
            locale,
            "Country selected automatically. You can change it."
          )
        : customerWorkflowExactT(
            locale,
            "Select the country used for your customer profile."
          );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving || checkingUser) return;

    const selectedCountry = normalizeCountryName(country);
    if (!selectedCountry) {
      setMessage("Please select your country.");
      setCountryDetection("manual");
      window.setTimeout(() => countrySelectRef.current?.focus(), 0);
      return;
    }

    setSaving(true);
    setMessage("");

    let completionResponse: Response;
    try {
      completionResponse = await authenticatedFetch(
        "/api/auth/oauth-registration/finalize",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ country: selectedCountry }),
        }
      );
    } catch {
      setMessage("Your country could not be saved. Please try again.");
      setSaving(false);
      return;
    }
    if (!completionResponse.ok) {
      setMessage("Your country could not be saved. Please try again.");
      setSaving(false);
      return;
    }

    const refreshedSession = await supabase.auth.refreshSession();
    if (refreshedSession.error || !refreshedSession.data.session?.user) {
      setMessage("Your updated account could not be verified. Please log in again.");
      setSaving(false);
      return;
    }

    const registrationAccountBinding = await createRegistrationAccountBinding(
      refreshedSession.data.session.user.id
    );
    const pendingRegistrationHandoffs = readPendingRegistrationHandoffs(
      window.sessionStorage,
      registrationHandoffKeys,
      registrationAccountBinding
    );
    const next = safeNextPath();
    const callbackDestination =
      `/auth/callback?next=${encodeURIComponent(next)}`;
    let measurementBridgeStarted = false;
    const startMeasurementBridge = () => {
      if (measurementBridgeStarted) return true;
      measurementBridgeStarted = replaceWithPendingMeasurementCompletion(
        callbackDestination
      );
      return measurementBridgeStarted;
    };
    clearPendingDraft();
    if (
      pendingRegistrationHandoffs.conversion ||
      pendingRegistrationHandoffs.notificationSource
    ) {
      await completeRegistrationHandoffsBeforeNavigation(
        {
          storage: window.sessionStorage,
          keys: registrationHandoffKeys,
          accountBinding: registrationAccountBinding,
        },
        { onConversionHandoffCompleted: startMeasurementBridge }
      );
      if (startMeasurementBridge()) return;
    }

    if (!replacePrivateMeasurementDocument(callbackDestination)) {
      router.replace(callbackDestination);
    }
  };

  if (checkingUser) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#050505] text-white">
        <Loader2
          role="status"
          aria-live="polite"
          className="h-8 w-8 animate-spin text-red-500"
          aria-label={firstPaintT("Checking account")}
        />
      </main>
    );
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-x-hidden bg-[#050505] px-4 py-10 text-white">
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_25%_0%,rgba(160,18,28,0.28),transparent_32%),linear-gradient(135deg,#050505,#0d0d0f_48%,#160608)]" />

      <form
        onSubmit={handleSubmit}
        className="w-full max-w-lg rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-black/50 backdrop-blur-xl sm:p-8"
      >
        <Link href="/" className="mb-7 flex w-fit items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-red-800/50 bg-[#111]">
            <Upload aria-hidden="true" className="h-7 w-7 text-red-600" />
          </span>
          <span>
            <span className="block text-xl font-black">
              MG <span className="text-red-600">AUTOTECH</span>
            </span>
            <span className="block text-xs text-zinc-400">
              {firstPaintT("Customer Account")}
            </span>
          </span>
        </Link>

        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-red-800/50 bg-red-950/25 text-red-400">
          <MapPin aria-hidden="true" className="h-6 w-6" />
        </div>
        <h1 className="text-3xl font-black">
          {firstPaintT("Confirm your country")}
        </h1>
        <p className="mt-3 text-sm leading-6 text-zinc-400">
          {firstPaintT(
            "Your country is required to finish creating your customer account."
          )}
        </p>

        <div className="mt-7">
          <CountrySelect
            value={country}
            onChange={(value) => {
              countryManuallySelectedRef.current = true;
              setCountry(value);
              setCountryDetection("manual");
              setMessage("");
            }}
            required
            detecting={countryDetection === "detecting"}
            hint={countryHint}
            variant="settings"
            selectRef={countrySelectRef}
          />
        </div>

        {message && (
          <p
            role="alert"
            aria-live="assertive"
            className="mt-4 rounded-2xl border border-red-900/60 bg-red-950/25 px-4 py-3 text-sm text-red-200"
          >
            {customerWorkflowExactT(locale, message)}
          </p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#b1121b] px-5 text-sm font-black text-white transition hover:bg-[#c91824] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? (
            <Loader2 aria-hidden="true" className="h-5 w-5 animate-spin" />
          ) : (
            <CheckCircle2 aria-hidden="true" className="h-5 w-5" />
          )}
          {saving
            ? firstPaintT("Saving country...")
            : firstPaintT("Finish account setup")}
        </button>
      </form>
    </main>
  );
}
