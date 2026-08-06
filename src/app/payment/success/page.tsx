"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  CheckCircle2,
  CreditCard,
  LayoutDashboard,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { trackPurchaseCompleted } from "@/lib/publicAnalytics";

type ConfirmState = "checking" | "success" | "error" | "missing";

export default function PaymentSuccessPage() {
  const [state, setState] = useState<ConfirmState>("checking");
  const [message, setMessage] = useState("Confirming your payment...");
  const [credits, setCredits] = useState<number | null>(null);

  useEffect(() => {
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
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        const data = await response.json();

        if (!response.ok) {
          setState("error");
          setMessage(data.error ?? "Payment could not be confirmed.");
          return;
        }

        setCredits(Number(data.credits ?? 0));
        setState("success");
        setMessage("Payment confirmed. Credits were added to your account.");
        const conversionValue = Number(data.conversion?.value);
        const conversionCurrency = String(data.conversion?.currency ?? "");
        if (Number.isFinite(conversionValue) && conversionValue >= 0 && /^[A-Z]{3}$/.test(conversionCurrency)) {
          void trackPurchaseCompleted({
            anonymousPaymentSeed: sessionId,
            value: conversionValue,
            currency: conversionCurrency,
          });
        }
      } catch (error) {
        setState("error");
        setMessage(
          error instanceof Error ? error.message : "Payment could not be confirmed."
        );
      }
    };

    confirmPayment();
  }, []);

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
            ? "Confirming payment"
            : isSuccess
              ? "Payment successful"
              : "Payment needs review"}
        </h1>

        <p className="mt-4 text-sm leading-6 text-zinc-300">{message}</p>

        {isSuccess && credits !== null && (
          <div className="mt-6 rounded-2xl border border-emerald-700/30 bg-emerald-950/30 p-4">
            <div className="text-sm text-emerald-200">Added credits</div>
            <div className="mt-1 text-4xl font-black text-emerald-300">
              +{credits}
            </div>
          </div>
        )}

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/dashboard"
            className="rounded-xl bg-[#b1121b] px-5 py-3 font-black text-white transition hover:bg-[#c91824]"
          >
            <LayoutDashboard className="mr-2 inline h-4 w-4" />
            Dashboard
          </Link>

          <Link
            href="/dashboard/credits"
            className="rounded-xl border border-white/10 bg-white/[0.04] px-5 py-3 font-black text-white transition hover:bg-white/10"
          >
            <CreditCard className="mr-2 inline h-4 w-4" />
            Buy More Credits
          </Link>
        </div>
      </div>
    </main>
  );
}
