"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { authenticatedFetch, getStableSession, notifySessionRequired, signOutIfEmailUnverified } from "@/lib/authGuards";
import type { CreditPackage } from "@/lib/creditPackages";
import {
  calculateCreditTotalEuro,
  isStripeEuroAmountSupported,
} from "@/lib/commercialPricing";
import { supabase } from "@/lib/supabaseClient";
import { CustomerPortalPageHeader } from "@/components/dashboard/CustomerPortalPageHeader";
import {
  CheckCircle2,
  Copy,
  CreditCard,
  Crown,
  Landmark,
  Loader2,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";

const utilization = [
  { title: "Stage 1", credits: "10 Credit", icon: Crown },
  { title: "DPF OFF", credits: "6 Credit", icon: Sparkles },
  { title: "AdBlue OFF", credits: "11 Credit", icon: Sparkles },
  { title: "EGR OFF", credits: "6 Credit", icon: Sparkles },
  { title: "DTC OFF", credits: "4 Credit", icon: Sparkles },
];

const paymentMethods = [
  {
    id: "stripe",
    title: "Credit Card",
    subtitle: "Secure Stripe checkout",
    badge: "Automatic",
    icon: CreditCard,
  },
  {
    id: "bank",
    title: "Bank Transfer",
    subtitle: "SEPA transfer",
    badge: "Manual check",
    icon: Landmark,
  },
] as const;

type PaymentMethod = (typeof paymentMethods)[number]["id"];
type PricingSource = "global" | "customer_adjustment" | "customer_fixed";
type CreditQuote = {
  quoteId: string;
  currency: string;
  promotionLabel: string | null;
  customBaseUnitPriceEuro: number;
  globalCustomUnitPriceEuro: number;
  customUnitPriceEuro: number;
  pricingSource: PricingSource;
  customerPricingActive: boolean;
  customerPaymentPolicyActive: boolean;
  paymentMethods: Record<PaymentMethod, boolean>;
  packages: Array<CreditPackage & { priceEuro: number; unitPriceEuro: number }>;
};

type QuoteState = "loading" | "ready" | "error";
type PageNotice = { kind: "success" | "error" | "info"; text: string };

function isFinitePositive(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function isCreditQuote(value: unknown): value is CreditQuote {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const quote = value as Partial<CreditQuote>;
  if (
    typeof quote.quoteId !== "string" ||
    !/^[a-f0-9]{40}$/.test(quote.quoteId) ||
    quote.currency !== "EUR" ||
    !(
      quote.promotionLabel === null ||
      typeof quote.promotionLabel === "string"
    ) ||
    !isFinitePositive(quote.customBaseUnitPriceEuro) ||
    !isFinitePositive(quote.globalCustomUnitPriceEuro) ||
    !isFinitePositive(quote.customUnitPriceEuro) ||
    !["global", "customer_adjustment", "customer_fixed"].includes(
      quote.pricingSource ?? "",
    ) ||
    typeof quote.customerPricingActive !== "boolean" ||
    typeof quote.customerPaymentPolicyActive !== "boolean" ||
    !quote.paymentMethods ||
    typeof quote.paymentMethods.stripe !== "boolean" ||
    typeof quote.paymentMethods.bank !== "boolean" ||
    !Array.isArray(quote.packages) ||
    quote.packages.length === 0
  ) {
    return false;
  }

  return quote.packages.every(
    (item) =>
      item &&
      typeof item.id === "string" &&
      typeof item.name === "string" &&
      Number.isInteger(item.credits) &&
      item.credits > 0 &&
      isFinitePositive(item.basePriceEuro) &&
      isFinitePositive(item.priceEuro) &&
      isFinitePositive(item.unitPriceEuro) &&
      typeof item.description === "string" &&
      (item.highlight === undefined || typeof item.highlight === "boolean"),
  );
}

async function readResponseBody(response: Response) {
  return (await response.json().catch(() => ({}))) as Record<string, unknown>;
}

function responseError(payload: Record<string, unknown>, fallback: string) {
  return typeof payload.error === "string" && payload.error.trim()
    ? payload.error
    : fallback;
}

function formatEuro(value: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(value);
}

function formatCreditUnitEuro(value: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(value);
}

function formatCustomerReference(customerId: string) {
  const cleanId = customerId.trim().toUpperCase();
  if (!cleanId) throw new Error("Customer ID could not be verified.");
  if (/^MGA-\d{5,}$/.test(cleanId)) return cleanId;
  if (/^\d+$/.test(cleanId)) return `MGA-${cleanId.padStart(5, "0")}`;
  return cleanId;
}

export default function BuyCreditsPage() {
  const router = useRouter();

  const [loadingPackage, setLoadingPackage] = useState<string | null>(null);
  const [customCredits, setCustomCredits] = useState("17");
  const [notice, setNotice] = useState<PageNotice | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("stripe");
  const [copiedBankReference, setCopiedBankReference] = useState(false);
  const [quote, setQuote] = useState<CreditQuote | null>(null);
  const [quoteState, setQuoteState] = useState<QuoteState>("loading");
  const [quoteError, setQuoteError] = useState("");
  const quoteRequestId = useRef(0);
  const checkoutInFlight = useRef(false);

  const loadQuote = useCallback(async (preserveNotice = false) => {
    const requestId = ++quoteRequestId.current;
    setQuote(null);
    setQuoteState("loading");
    setQuoteError("");
    if (!preserveNotice) setNotice(null);

    try {
      const response = await authenticatedFetch("/api/credits/quote", {
        cache: "no-store",
      });
      const payload = await readResponseBody(response);
      if (!response.ok) {
        throw new Error(
          responseError(payload, "Credit prices could not be loaded."),
        );
      }
      if (!isCreditQuote(payload.quote)) {
        throw new Error("Credit prices could not be verified. Please retry.");
      }
      if (requestId !== quoteRequestId.current) return null;

      const nextQuote = payload.quote;
      setQuote(nextQuote);
      setPaymentMethod((current) =>
        nextQuote.paymentMethods[current]
          ? current
          : paymentMethods.find(
              (method) => nextQuote.paymentMethods[method.id],
            )?.id ?? current,
      );
      setQuoteState("ready");
      return nextQuote;
    } catch (error) {
      if (requestId !== quoteRequestId.current) return null;
      setQuote(null);
      setQuoteState("error");
      setQuoteError(
        error instanceof Error
          ? error.message
          : "Credit prices could not be loaded.",
      );
      return null;
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadQuote();
    }, 0);
    return () => {
      window.clearTimeout(timeoutId);
      quoteRequestId.current += 1;
    };
  }, [loadQuote]);

  const customCreditAmount = Number(customCredits);
  const customValid =
    Number.isFinite(customCreditAmount) &&
    customCreditAmount >= 1 &&
    customCreditAmount <= 1000 &&
    Number.isInteger(customCreditAmount);

  const customPrice = useMemo(() => {
    if (!customValid || !quote) return 0;
    return calculateCreditTotalEuro(customCreditAmount, quote.customUnitPriceEuro);
  }, [customCreditAmount, customValid, quote]);

  const packages = quote?.packages ?? [];
  const availablePaymentMethods = paymentMethods.filter(
    (method) => quote?.paymentMethods[method.id],
  );
  const selectedPayment = availablePaymentMethods.find(
    (method) => method.id === paymentMethod,
  );
  const bestValuePackage = packages.find((pack) => pack.credits === 500);
  const pricingLabel =
    quote?.pricingSource === "customer_fixed"
      ? "Your fixed partner rate is active on this account."
      : quote?.pricingSource === "customer_adjustment"
        ? "Your account-specific partner adjustment is active."
        : null;

  const bankDetails = {
    accountName: process.env.NEXT_PUBLIC_BANK_ACCOUNT_NAME || "MG AutoTech",
    bankName:
      process.env.NEXT_PUBLIC_BANK_NAME ||
      "Bank details will be confirmed by admin",
    iban:
      process.env.NEXT_PUBLIC_BANK_IBAN ||
      "IBAN will be provided after contact",
    bic: process.env.NEXT_PUBLIC_BANK_BIC || "BIC",
  };

  const getCustomerReference = async (userId: string) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("customer_id")
      .eq("id", userId)
      .single();

    if (error) {
      throw new Error(error.message);
    }

    if (!data?.customer_id) {
      throw new Error("Customer ID could not be loaded.");
    }

    return formatCustomerReference(data.customer_id as string);
  };

  const refreshStaleQuote = async () => {
    setNotice({
      kind: "info",
      text: "Credit prices changed while you were reviewing them. Loading the latest verified prices now.",
    });
    const refreshedQuote = await loadQuote(true);
    if (refreshedQuote) {
      setNotice({
        kind: "info",
        text: "Credit prices were refreshed. Please review the latest total before continuing.",
      });
    } else {
      setNotice({
        kind: "error",
        text: "Credit prices changed, but the latest prices could not be loaded. Retry before continuing.",
      });
    }
  };

  const startCheckout = async (payload: {
    packageId?: string;
    customCredits?: number;
  }) => {
    if (quoteState !== "ready" || !quote) {
      setNotice({
        kind: "error",
        text: "Verified credit prices are not available yet. Retry before starting a payment.",
      });
      return;
    }
    if (checkoutInFlight.current) return;

    const checkoutQuote = quote;
    const checkoutAmount = payload.packageId
      ? checkoutQuote.packages.find((item) => item.id === payload.packageId)?.priceEuro
      : payload.customCredits
        ? calculateCreditTotalEuro(payload.customCredits, checkoutQuote.customUnitPriceEuro)
        : null;
    if (!checkoutAmount) {
      setNotice({ kind: "error", text: "The selected credit total could not be verified." });
      return;
    }
    if (paymentMethod === "stripe" && !isStripeEuroAmountSupported(checkoutAmount)) {
      setNotice({
        kind: "error",
        text: "This total is outside Stripe's supported EUR range. Choose Bank Transfer or change the amount.",
      });
      return;
    }
    const loadingId =
      payload.packageId ?? `custom_${payload.customCredits ?? "credits"}`;

    checkoutInFlight.current = true;
    setLoadingPackage(loadingId);
    setNotice(null);

    try {
      const user = (await getStableSession()).session?.user;

      if (!user) {
        notifySessionRequired();
        return;
      }

      if (await signOutIfEmailUnverified(user)) {
        router.push("/login?verify_email=1");
        return;
      }

      if (paymentMethod === "bank") {
        const response = await authenticatedFetch("/api/email/bank-transfer", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ...payload,
            quoteId: checkoutQuote.quoteId,
          }),
        });
        const data = await readResponseBody(response);

        if (response.status === 409 || data.code === "credit_quote_stale") {
          await refreshStaleQuote();
          return;
        }
        if (!response.ok) {
          throw new Error(
            responseError(
              data,
              "Bank transfer instructions could not be prepared.",
            ),
          );
        }
        if (
          data.success !== true ||
          typeof data.customerId !== "string" ||
          !Number.isInteger(data.credits) ||
          !isFinitePositive(data.amountEuro)
        ) {
          throw new Error(
            "Bank transfer instructions could not be verified. Please retry.",
          );
        }

        const reference = formatCustomerReference(data.customerId);
        setNotice({
          kind: "success",
          text: `Bank transfer instructions were sent for ${data.credits} credits (${formatEuro(data.amountEuro)}). Use your Customer ID as payment reference: ${reference}. Credits are added manually after payment is received.`,
        });
        return;
      }

      const response = await authenticatedFetch(
        "/api/stripe/create-checkout-session",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ...payload,
            quoteId: checkoutQuote.quoteId,
          }),
        },
      );
      const data = await readResponseBody(response);

      if (response.status === 409 || data.code === "credit_quote_stale") {
        await refreshStaleQuote();
        return;
      }
      if (!response.ok) {
        throw new Error(
          responseError(data, "Could not start Stripe checkout."),
        );
      }
      if (typeof data.url !== "string" || !data.url) {
        throw new Error("Stripe checkout URL was not returned.");
      }

      window.location.assign(data.url);
    } catch (error) {
      setNotice({
        kind: "error",
        text:
          error instanceof Error
            ? error.message
            : "Credit purchase could not be started.",
      });
    } finally {
      checkoutInFlight.current = false;
      setLoadingPackage(null);
    }
  };

  const startCustomCheckout = () => {
    if (!customValid) {
      setNotice({
        kind: "error",
        text: "Please enter a whole number between 1 and 1000 credits.",
      });
      return;
    }

    void startCheckout({ customCredits: customCreditAmount });
  };

  const copyBankReference = async () => {
    const user = (await getStableSession()).session?.user;

    if (!user) {
      notifySessionRequired();
      return;
    }

    if (await signOutIfEmailUnverified(user)) {
      router.push("/login?verify_email=1");
      return;
    }

    let reference = "";

    try {
      reference = await getCustomerReference(user.id);
    } catch (error) {
      setNotice({
        kind: "error",
        text:
          error instanceof Error
            ? error.message
            : "Customer ID could not be loaded.",
      });
      return;
    }

    try {
      await navigator.clipboard.writeText(reference);
      setCopiedBankReference(true);
      setNotice({ kind: "success", text: "Payment reference copied." });
    } catch {
      setNotice({
        kind: "error",
        text: "Payment reference could not be copied. Please copy it manually.",
      });
      return;
    }

    window.setTimeout(() => {
      setCopiedBankReference(false);
    }, 1600);
  };

  return (
    <main className="mg-compact-ui min-h-screen bg-[#050505] text-white">
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_18%_0%,rgba(160,18,28,0.25),transparent_34%),radial-gradient(circle_at_80%_20%,rgba(177,18,27,0.15),transparent_28%),linear-gradient(135deg,#050505,#0c0c0e_48%,#170507)]" />

      <CustomerPortalPageHeader
        eyebrow="Account"
        title="Buy Credits"
        icon={CreditCard}
      />

      <section className="mx-auto max-w-7xl px-4 py-10">
        <div className="mb-10 grid gap-6 xl:grid-cols-[1fr_420px] xl:items-end">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-red-800/50 bg-red-950/25 px-4 py-2 text-sm font-semibold text-red-100">
              <CreditCard className="h-4 w-4 text-red-500" />
              Secure payment options
            </div>

            <h1 className="text-4xl font-black md:text-6xl">
              Credits <span className="text-red-600">Prices</span>
            </h1>

            <p className="mt-4 max-w-3xl text-lg leading-8 text-zinc-400">
              Choose a package or enter a custom credit amount. Package prices
              get cheaper as the volume increases.
            </p>
            {quote?.promotionLabel && (
              <div className="mt-5 inline-flex rounded-full border border-red-700/60 bg-red-950/40 px-4 py-2 text-sm font-black text-red-100">
                {quote.promotionLabel}
              </div>
            )}
            {pricingLabel && (
              <div className="mt-3 text-sm font-bold text-emerald-300">
                {pricingLabel}
              </div>
            )}
          </div>

          <div className="rounded-[2rem] border border-red-900/50 bg-red-950/20 p-6 shadow-2xl shadow-black/30">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-8 w-8 text-red-500" />
              <div>
                <div className="text-sm font-black uppercase tracking-[0.2em] text-red-400">
                  Payment Workflow
                </div>
                <p className="mt-1 text-sm text-zinc-400">
                  Stripe card payments add credits automatically after
                  confirmation. Bank transfer stays manual.
                </p>
              </div>
            </div>
          </div>
        </div>

        {notice && (
          <div
            role={notice.kind === "success" ? "status" : "alert"}
            aria-live={notice.kind === "success" ? "polite" : "assertive"}
            className={`mb-6 rounded-2xl border p-4 text-sm ${
              notice.kind === "success"
                ? "border-emerald-800/50 bg-emerald-950/25 text-emerald-200"
                : notice.kind === "info"
                  ? "border-amber-700/50 bg-amber-950/25 text-amber-100"
                  : "border-red-800/50 bg-red-950/30 text-red-200"
            }`}
          >
            {notice.text}
          </div>
        )}

        {quoteState === "loading" && (
          <div
            role="status"
            aria-live="polite"
            aria-busy="true"
            className="mb-8 flex min-h-40 items-center justify-center rounded-[2rem] border border-white/10 bg-white/[0.04] p-8 text-center"
          >
            <div>
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-red-500" />
              <div className="mt-4 text-lg font-black">
                Loading verified credit prices
              </div>
              <p className="mt-2 text-sm text-zinc-400">
                Purchase options will appear after the latest account pricing
                is verified.
              </p>
            </div>
          </div>
        )}

        {quoteState === "error" && (
          <div
            role="alert"
            aria-live="assertive"
            className="mb-8 rounded-[2rem] border border-red-800/60 bg-red-950/30 p-6"
          >
            <div className="text-lg font-black text-red-100">
              Credit prices are temporarily unavailable
            </div>
            <p className="mt-2 text-sm leading-6 text-red-200/80">
              {quoteError ||
                "No payment can be started until verified prices are loaded."}
            </p>
            <button
              type="button"
              onClick={() => void loadQuote()}
              className="mt-5 inline-flex items-center justify-center rounded-xl bg-[#b1121b] px-5 py-3 text-sm font-black text-white transition hover:bg-[#c91824]"
            >
              Retry verified prices
            </button>
          </div>
        )}

        {quoteState === "ready" && quote && (
          <>
            <div className="mb-8 rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="text-sm font-black uppercase tracking-[0.2em] text-red-400">
                Payment Method
              </div>
              <h2 className="mt-1 text-2xl font-black">
                Choose how you want to pay
              </h2>
            </div>
            <div className="text-right text-sm font-bold text-zinc-500">
              <div>
                Selected: {selectedPayment?.title ?? "No payment method available"}
              </div>
              {quote.customerPaymentPolicyActive && (
                <div className="mt-1 text-xs text-emerald-300">
                  Account-specific payment policy active
                </div>
              )}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {availablePaymentMethods.map((method) => {
              const Icon = method.icon;
              const active = paymentMethod === method.id;

              return (
                <button
                  key={method.id}
                  type="button"
                  aria-pressed={active}
                  disabled={loadingPackage !== null}
                  onClick={() => {
                    setPaymentMethod(method.id);
                    setNotice(null);
                  }}
                  className={`rounded-2xl border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${
                    active
                      ? "border-red-700 bg-red-950/30"
                      : "border-white/10 bg-black/30 hover:border-white/20 hover:bg-white/[0.06]"
                  }`}
                >
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div
                      className={`flex h-11 w-11 items-center justify-center rounded-2xl ${
                        active
                          ? "bg-red-600 text-white"
                          : "bg-white/10 text-zinc-300"
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="rounded-full border border-white/10 bg-black/35 px-2.5 py-1 text-[11px] font-black text-zinc-300">
                      {method.badge}
                    </span>
                  </div>
                  <div className="font-black text-white">{method.title}</div>
                  <div className="mt-1 text-xs font-bold text-zinc-500">
                    {method.subtitle}
                  </div>
                </button>
              );
            })}
          </div>

          {!availablePaymentMethods.length && (
            <div className="mt-4 rounded-xl border border-amber-700/40 bg-amber-950/20 p-4 text-sm text-amber-200">
              Online credit purchases are currently disabled for this account.
              Please contact support.
            </div>
          )}

          {paymentMethod === "bank" && quote.paymentMethods.bank && (
            <div className="mt-5 rounded-2xl border border-white/10 bg-black/30 p-5">
              <div className="grid gap-4 md:grid-cols-4">
                <div>
                  <div className="text-xs font-black uppercase tracking-[0.14em] text-zinc-500">
                    Account
                  </div>
                  <div className="mt-1 font-black">
                    {bankDetails.accountName}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-black uppercase tracking-[0.14em] text-zinc-500">
                    Bank
                  </div>
                  <div className="mt-1 font-black">{bankDetails.bankName}</div>
                </div>
                <div>
                  <div className="text-xs font-black uppercase tracking-[0.14em] text-zinc-500">
                    IBAN
                  </div>
                  <div className="mt-1 break-all font-black">
                    {bankDetails.iban}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-black uppercase tracking-[0.14em] text-zinc-500">
                    BIC
                  </div>
                  <div className="mt-1 font-black">{bankDetails.bic}</div>
                </div>
              </div>

              <button
                type="button"
                onClick={copyBankReference}
                disabled={loadingPackage !== null}
                className="mt-5 inline-flex items-center rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-black text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Copy className="mr-2 h-4 w-4" />
                {copiedBankReference
                  ? "Reference copied"
                  : "Copy payment reference"}
              </button>
            </div>
          )}
        </div>

        <div className="mb-8 rounded-[2rem] border border-white/10 bg-white/[0.04] p-4">
          <div className="grid gap-3 md:grid-cols-[220px_1fr_52px] md:items-center">
            <div className="px-2 text-sm font-black">Credit Utilization Scale</div>

            <div className="grid gap-3 md:grid-cols-5">
              {utilization.map((item) => {
                const Icon = item.icon;

                return (
                  <div
                    key={item.title}
                    className="flex items-center gap-3 rounded-xl bg-red-900/45 px-4 py-3"
                  >
                    <Icon className="h-5 w-5 shrink-0 text-white" />
                    <div>
                      <div className="text-sm font-black">{item.title}</div>
                      <div className="text-xs font-bold text-red-100">
                        {item.credits}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="hidden h-11 w-11 items-center justify-center rounded-xl border border-red-700/40 bg-red-950/35 text-red-300 md:flex">
              <Zap className="h-5 w-5" />
            </div>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
          {packages.map((item) => (
            <div
              key={item.id}
              className={`relative flex min-h-[360px] flex-col rounded-[2rem] border p-6 shadow-2xl shadow-black/20 transition hover:-translate-y-1 ${
                item.highlight
                  ? "border-red-800/70 bg-red-950/30 2xl:-mt-6"
                  : "border-white/10 bg-white/[0.04]"
              }`}
            >
              {item.highlight && (
                <div className="absolute right-5 top-5 flex items-center gap-2 rounded-full bg-red-600 px-3 py-1 text-xs font-black text-white">
                  <Crown className="h-3.5 w-3.5" />
                  Popular
                </div>
              )}

              <div className="mb-8 flex h-12 w-12 items-center justify-center rounded-2xl border border-red-900/40 bg-red-950/35">
                <Sparkles className="h-6 w-6 text-red-500" />
              </div>

              <div className="text-sm font-black text-zinc-300">
                {item.credits} Credit
              </div>

              {item.basePriceEuro !== item.priceEuro && (
                <div className="mt-3 text-sm font-bold text-zinc-500 line-through">
                  {formatEuro(item.basePriceEuro)}
                </div>
              )}

              <div className={`${item.basePriceEuro === item.priceEuro ? "mt-8" : "mt-1"} text-4xl font-black`}>
                {formatEuro(item.priceEuro)}
              </div>

              <div className="mt-2 text-sm font-bold text-red-400">
                Each Credit {formatCreditUnitEuro(item.unitPriceEuro)}
              </div>

              <p className="mt-5 flex-1 text-sm leading-6 text-zinc-400">
                {item.description}
              </p>

              <div className="mt-5 space-y-2 text-xs text-zinc-300">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  {paymentMethod === "stripe"
                    ? "Automatic credit top-up"
                    : paymentMethod === "bank"
                    ? "Manual admin verification"
                    : "Automatic credit top-up"}
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  {paymentMethod === "stripe"
                    ? "Secure Stripe checkout"
                    : paymentMethod === "bank"
                    ? "Reference based payment"
                    : "Reference based payment"}
                </div>
              </div>

              <button
                type="button"
                onClick={() => void startCheckout({ packageId: item.id })}
                disabled={
                  !selectedPayment ||
                  loadingPackage !== null ||
                  (paymentMethod === "stripe" &&
                    !isStripeEuroAmountSupported(item.priceEuro))
                }
                className="mt-7 flex w-full items-center justify-center rounded-xl border border-red-700 bg-transparent px-5 py-4 text-sm font-black text-white transition hover:bg-red-950/40 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loadingPackage === item.id ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Opening...
                  </>
                ) : (
                  <>
                  {paymentMethod === "stripe"
                    ? "Buy"
                    : `Pay with ${selectedPayment?.title}`}
                  </>
                )}
              </button>
              {paymentMethod === "stripe" &&
                !isStripeEuroAmountSupported(item.priceEuro) && (
                  <p className="mt-2 text-xs font-bold leading-5 text-amber-300" role="status">
                    {"This total is outside Stripe's supported EUR range. Choose Bank Transfer or change the amount."}
                  </p>
                )}
            </div>
          ))}
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-[2rem] border border-red-900/50 bg-gradient-to-br from-red-950/30 via-white/[0.04] to-black p-7 shadow-2xl shadow-black/30">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-red-800/50 bg-red-950/30 px-4 py-2 text-sm font-bold text-red-100">
              <Sparkles className="h-4 w-4 text-red-500" />
              Custom Amount
            </div>

            <h2 className="text-3xl font-black">
              Buy exactly how many credits you need.
            </h2>

            <p className="mt-3 text-sm leading-6 text-zinc-400">
              Enter any credit amount. Custom credit purchases are calculated at{" "}
              {formatCreditUnitEuro(quote.customUnitPriceEuro)} per credit for your account.
            </p>

            <div className="mt-6 grid gap-4 sm:grid-cols-[1fr_180px]">
              <label className="block">
                <div className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-zinc-500">
                  Custom Credits
                </div>
                <input
                  type="number"
                  min="1"
                  max="1000"
                  step="1"
                  value={customCredits}
                  onChange={(event) => setCustomCredits(event.target.value)}
                  className="h-14 w-full rounded-2xl border border-white/10 bg-black/35 px-4 text-lg font-black text-white outline-none transition placeholder:text-zinc-600 focus:border-red-700"
                  placeholder="e.g. 17"
                />
              </label>

              <div className="rounded-2xl border border-white/10 bg-black/35 p-4">
                <div className="text-xs font-black uppercase tracking-[0.16em] text-zinc-500">
                  Total Price
                </div>
                {customValid &&
                  quote.customerPricingActive &&
                  quote.globalCustomUnitPriceEuro !==
                    quote.customUnitPriceEuro && (
                    <div className="mt-2 text-sm font-bold text-zinc-500 line-through">
                      {formatEuro(
                        calculateCreditTotalEuro(
                          customCreditAmount,
                          quote.globalCustomUnitPriceEuro,
                        ),
                      )}
                    </div>
                  )}
                <div className="mt-2 text-3xl font-black text-red-400">
                  {customValid ? formatEuro(customPrice) : "-"}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={startCustomCheckout}
              disabled={
                !availablePaymentMethods.length ||
                !selectedPayment ||
                !customValid ||
                loadingPackage !== null ||
                (paymentMethod === "stripe" &&
                  !isStripeEuroAmountSupported(customPrice))
              }
              className="mt-6 flex w-full items-center justify-center rounded-xl bg-[#b1121b] px-5 py-4 text-sm font-black text-white shadow-xl shadow-red-950/40 transition hover:bg-[#c91824] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loadingPackage?.startsWith("custom_") ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Opening Checkout...
                </>
              ) : (
                <>
                  <CreditCard className="mr-2 h-4 w-4" />
                  {paymentMethod === "stripe"
                    ? "Buy Custom Credits"
                    : `Pay Custom via ${selectedPayment?.title}`}
                </>
              )}
            </button>
            {customValid &&
              paymentMethod === "stripe" &&
              !isStripeEuroAmountSupported(customPrice) && (
                <p className="mt-3 text-sm font-bold leading-6 text-amber-300" role="status">
                  {"This total is outside Stripe's supported EUR range. Choose Bank Transfer or change the amount."}
                </p>
              )}
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-7">
            <ShieldCheck className="mb-5 h-10 w-10 text-red-500" />
            <h2 className="text-2xl font-black">Important</h2>
            <p className="mt-3 text-sm leading-7 text-zinc-400">
              Package purchases use the verified package rate shown above.
              Custom credit purchases are calculated at{" "}
              {formatCreditUnitEuro(quote.customUnitPriceEuro)} per credit for this
              account. Stripe payments add credits automatically after payment
              confirmation. Bank transfer requires admin verification before
              credits are added.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                <div className="text-sm font-black">Example</div>
                <div className="mt-1 text-sm text-zinc-400">
                  17 Credits × {formatCreditUnitEuro(quote.customUnitPriceEuro)} ={" "}
                  {formatEuro(calculateCreditTotalEuro(17, quote.customUnitPriceEuro))}
                </div>
              </div>

              {bestValuePackage && (
                <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                  <div className="text-sm font-black">Best Value</div>
                  <div className="mt-1 text-sm text-zinc-400">
                    {bestValuePackage.credits} Credits ={" "}
                    {formatCreditUnitEuro(bestValuePackage.unitPriceEuro)} / Credit
                  </div>
                </div>
              )}
            </div>
          </div>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
