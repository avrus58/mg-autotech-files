"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import {
  CheckCircle2,
  CreditCard,
  LayoutDashboard,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { authenticatedFetch } from "@/lib/authGuards";
import {
  flushPendingVerifiedConversions,
  isApprovedAnalyticsHost,
  isValidGoogleAdsId,
  isValidGoogleAnalyticsMeasurementId,
  measurementConsentChangedEvent,
  readMeasurementConsentSnapshot,
  sanitizeSensitiveMeasurementLocation,
  trackPurchaseCompleted,
  replaceWithPendingMeasurementCompletion,
} from "@/lib/publicAnalytics";
import { createRequestCompletionConsentHandoff } from "@/lib/requestCompletionConsent";
import { customerWorkflowExactT } from "@/lib/i18n/customer-workflow-credits-translations";
import { useActiveLocale } from "@/lib/useActiveLocale";

type ConfirmState = "checking" | "success" | "error" | "missing";
const paymentCompletionConsentFailOpenMs = 15_000;

function paymentCompletionConsentIsAvailable(hostname: string) {
  return isApprovedAnalyticsHost(hostname) && (
    isValidGoogleAnalyticsMeasurementId(
      process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID
    ) || isValidGoogleAdsId(process.env.NEXT_PUBLIC_GOOGLE_ADS_ID)
  );
}

export default function PaymentSuccessPage() {
  const locale = useActiveLocale();
  const firstPaintT = (source: string) => customerWorkflowExactT(locale, source);
  const [state, setState] = useState<ConfirmState>("checking");
  const [message, setMessage] = useState("Confirming your payment...");
  const [credits, setCredits] = useState<number | null>(null);
  const [awaitingConsentAfterSuccess, setAwaitingConsentAfterSuccess] =
    useState(false);
  const paymentCompletionContinueRef = useRef<(() => void) | null>(null);
  const paymentCompletionDestinationRef = useRef("/dashboard/credits");

  useEffect(() => {
    let cancelled = false;
    const confirmPayment = async () => {
      const params = new URLSearchParams(window.location.search);
      const provider = params.get("provider") || "stripe";
      const sessionId = params.get("session_id");

      const endpoint = "/api/stripe/confirm-session";
      let payload: Record<string, string> = {};

      if (provider !== "stripe") {
        setState("error");
        setMessage("This legacy payment method is no longer supported. Please use card payment or bank transfer.");
        return;
      }

      if (sessionId) {
        payload = { sessionId };
      } else {
        setState("missing");
        setMessage("Payment session id is missing.");
        return;
      }

      try {
        let response: Response | null = null;
        let data: Record<string, unknown> = {};
        for (let attempt = 0; attempt < 4; attempt += 1) {
          response = await authenticatedFetch(endpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          });
          data = await response.json();
          if (response.ok) break;
          if (response.status !== 409 || attempt === 3) break;
          const retryAfter = Math.min(
            5,
            Math.max(1, Number(response.headers.get("Retry-After")) || 2)
          );
          if (!cancelled) {
            setMessage("Payment is still being reconciled securely. Checking again...");
          }
          await new Promise((resolve) => window.setTimeout(resolve, retryAfter * 1000));
          if (cancelled) return;
        }

        if (!response?.ok) {
          if (!cancelled) {
            setState("error");
            setMessage("Payment could not be confirmed.");
          }
          return;
        }

        sanitizeSensitiveMeasurementLocation();

        const conversion = data.conversion && typeof data.conversion === "object"
          ? data.conversion as { value?: unknown; currency?: unknown }
          : null;
        const conversionValue = Number(conversion?.value);
        const conversionCurrency = String(conversion?.currency ?? "");
        if (Number.isFinite(conversionValue) && conversionValue >= 0 && /^[A-Z]{3}$/.test(conversionCurrency)) {
          await trackPurchaseCompleted({
            anonymousPaymentSeed: sessionId,
            value: conversionValue,
            currency: conversionCurrency,
          }).catch(() => false);
        }
        if (cancelled) return;
        const completionConsent = readMeasurementConsentSnapshot();
        const consentChoiceAvailable = paymentCompletionConsentIsAvailable(
          window.location.hostname
        );
        setCredits(Number(data.credits ?? 0));
        setState("success");
        setMessage("Payment confirmed. Credits were added to your account.");
        if (completionConsent.needsDecision && consentChoiceAvailable) {
          setAwaitingConsentAfterSuccess(true);
          return;
        }
        if (replaceWithPendingMeasurementCompletion("/dashboard/credits")) {
          return;
        }
      } catch {
        setState("error");
        setMessage("Payment could not be confirmed.");
      }
    };

    confirmPayment();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!awaitingConsentAfterSuccess) return;

    const continueAfterConsent = createRequestCompletionConsentHandoff({
      readConsent: readMeasurementConsentSnapshot,
      flushVerifiedConversions: flushPendingVerifiedConversions,
      navigate: () => {
        const destination = paymentCompletionDestinationRef.current;
        setAwaitingConsentAfterSuccess(false);
        if (!replaceWithPendingMeasurementCompletion(destination)) {
          window.location.assign(destination);
        }
      },
    });
    const handleConsentChoice = () => {
      void continueAfterConsent(true);
    };
    paymentCompletionContinueRef.current = handleConsentChoice;
    const failOpenTimer = window.setTimeout(() => {
      void continueAfterConsent(true);
    }, paymentCompletionConsentFailOpenMs);

    void continueAfterConsent(false);
    window.addEventListener(measurementConsentChangedEvent, handleConsentChoice);
    return () => {
      window.clearTimeout(failOpenTimer);
      if (paymentCompletionContinueRef.current === handleConsentChoice) {
        paymentCompletionContinueRef.current = null;
      }
      window.removeEventListener(
        measurementConsentChangedEvent,
        handleConsentChoice
      );
    };
  }, [awaitingConsentAfterSuccess]);

  const continueToPrivateDestination = (
    event: MouseEvent<HTMLAnchorElement>,
    destination: string
  ) => {
    if (!awaitingConsentAfterSuccess) return;
    event.preventDefault();
    paymentCompletionDestinationRef.current = destination;
    const continueAfterConsent = paymentCompletionContinueRef.current;
    if (continueAfterConsent) continueAfterConsent();
    else window.setTimeout(() => paymentCompletionContinueRef.current?.(), 0);
  };

  const isSuccess = state === "success";
  const isChecking = state === "checking";

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#050505] px-4 text-white">
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_20%_0%,rgba(160,18,28,0.24),transparent_32%),linear-gradient(135deg,#050505,#0d0d0f_48%,#160608)]" />

      <div
        className={`max-w-lg rounded-[2rem] border p-8 text-center shadow-2xl shadow-black/30 ${
          isSuccess
            ? "border-emerald-700/30 bg-emerald-950/20"
            : state === "error" || state === "missing"
              ? "border-red-900/40 bg-red-950/20"
              : "border-white/10 bg-white/[0.04]"
        }`}
      >
        {isChecking ? (
          <Loader2 className="mx-auto mb-5 h-16 w-16 animate-spin text-red-500" />
        ) : isSuccess ? (
          <CheckCircle2 className="mx-auto mb-5 h-16 w-16 text-emerald-400" />
        ) : (
          <AlertTriangle className="mx-auto mb-5 h-16 w-16 text-red-500" />
        )}

        <h1 className="text-4xl font-black">
          {isChecking
            ? firstPaintT("Confirming payment")
            : isSuccess
              ? firstPaintT("Payment successful")
              : firstPaintT("Payment needs review")}
        </h1>

        <p
          role={isChecking ? "status" : isSuccess ? "status" : "alert"}
          aria-live={isChecking || isSuccess ? "polite" : "assertive"}
          className="mt-4 text-sm leading-6 text-zinc-300"
        >
          {firstPaintT(message)}
        </p>

        {isSuccess && credits !== null && (
          <div className="mt-6 rounded-2xl border border-emerald-700/30 bg-emerald-950/30 p-4">
            <div className="text-sm text-emerald-200">
              {firstPaintT("Added credits")}
            </div>
            <div className="mt-1 text-4xl font-black text-emerald-300">
              +{credits}
            </div>
          </div>
        )}

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/dashboard"
            onClick={(event) =>
              continueToPrivateDestination(event, "/dashboard")
            }
            className="rounded-xl bg-[#b1121b] px-5 py-3 font-black text-white transition hover:bg-[#c91824]"
          >
            <LayoutDashboard className="mr-2 inline h-4 w-4" />
            {firstPaintT("Dashboard")}
          </Link>

          <Link
            href="/dashboard/credits"
            onClick={(event) =>
              continueToPrivateDestination(event, "/dashboard/credits")
            }
            className="rounded-xl border border-white/10 bg-white/[0.04] px-5 py-3 font-black text-white transition hover:bg-white/10"
          >
            <CreditCard className="mr-2 inline h-4 w-4" />
            {firstPaintT("Buy More Credits")}
          </Link>
        </div>
      </div>
    </main>
  );
}
