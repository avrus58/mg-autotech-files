"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { authenticatedFetch, getStableSession, notifySessionRequired, signOutIfEmailUnverified } from "@/lib/authGuards";
import type { CreditPackage, CreditPackageId } from "@/lib/creditPackages";
import {
  calculateCreditTotalEuro,
  isStripeEuroAmountSupported,
} from "@/lib/commercialPricing";
import { supabase } from "@/lib/supabaseClient";
import { CustomerPortalPageHeader } from "@/components/dashboard/CustomerPortalPageHeader";
import {
  customerWorkflowExactT,
  customerWorkflowT,
  type CustomerWorkflowTranslationKey,
} from "@/lib/i18n/customer-workflow-credits-translations";
import { intlLocaleByCode } from "@/lib/i18nConfig";
import { useActiveLocale } from "@/lib/useActiveLocale";
import { localizeCreditPromotionLabel } from "@/lib/i18n/commercial-translations";
import {
  creditPurchaseErrorCodes,
  creditPurchaseErrorMessage,
} from "@/lib/creditPurchaseErrorCodes";
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

const creditPackageDescriptionKeys = {
  credits_10: "creditPackageDescription10",
  credits_50: "creditPackageDescription50",
  credits_100: "creditPackageDescription100",
  credits_250: "creditPackageDescription250",
  credits_500: "creditPackageDescription500",
} as const satisfies Record<CreditPackageId, CustomerWorkflowTranslationKey>;

type PaymentMethod = (typeof paymentMethods)[number]["id"];
type PricingSource = "global" | "customer_override";
type CreditQuote = {
  quoteId: string;
  currency: string;
  promotionLabel: string | null;
  customBaseUnitPriceEuro: number;
  globalCustomUnitPriceEuro: number;
  customUnitPriceEuro: number;
  customPricingSource: PricingSource;
  pricingSource: PricingSource;
  customerPricingActive: boolean;
  customerPaymentPolicyActive: boolean;
  paymentMethods: Record<PaymentMethod, boolean>;
  packages: Array<CreditPackage & {
    globalPriceEuro: number;
    priceEuro: number;
    unitPriceEuro: number;
    pricingSource: PricingSource;
  }>;
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
    !["global", "customer_override"].includes(quote.customPricingSource ?? "") ||
    !["global", "customer_override"].includes(
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
      isFinitePositive(item.globalPriceEuro) &&
      isFinitePositive(item.priceEuro) &&
      isFinitePositive(item.unitPriceEuro) &&
      ["global", "customer_override"].includes(item.pricingSource) &&
      typeof item.description === "string" &&
      (item.highlight === undefined || typeof item.highlight === "boolean"),
  );
}

async function readResponseBody(response: Response) {
  return (await response.json().catch(() => ({}))) as Record<string, unknown>;
}

function formatEuro(value: number, locale: keyof typeof intlLocaleByCode) {
  return new Intl.NumberFormat(intlLocaleByCode[locale], {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(value);
}

function formatCreditUnitEuro(value: number, locale: keyof typeof intlLocaleByCode) {
  return new Intl.NumberFormat(intlLocaleByCode[locale], {
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
  const locale = useActiveLocale();

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
        throw new Error(creditPurchaseErrorMessage("quote", payload.code));
      }
      if (!isCreditQuote(payload.quote)) {
        throw new Error(creditPurchaseErrorMessage("quote", payload.code));
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
    } catch {
      if (requestId !== quoteRequestId.current) return null;
      setQuote(null);
      setQuoteState("error");
      setQuoteError(creditPurchaseErrorMessage("quote", undefined));
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
  const selectedPaymentTitle = selectedPayment
    ? customerWorkflowExactT(locale, selectedPayment.title)
    : customerWorkflowExactT(locale, "No payment method available");
  const lowestUnitPricePackage = packages.reduce<(typeof packages)[number] | null>(
    (lowest, item) => !lowest || item.unitPriceEuro < lowest.unitPriceEuro ? item : lowest,
    null,
  );
  const pricingLabel = quote?.pricingSource === "customer_override"
    ? "Your account-specific package or custom-credit prices are active."
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
      throw new Error("Customer ID could not be loaded.");
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
          throw new Error(creditPurchaseErrorMessage("purchase", data.code));
        }
        if (
          data.success !== true ||
          typeof data.customerId !== "string" ||
          !Number.isInteger(data.credits) ||
          !isFinitePositive(data.amountEuro)
        ) {
          throw new Error(
            creditPurchaseErrorMessage("purchase", data.code),
          );
        }

        const reference = formatCustomerReference(data.customerId);
        setNotice({
          kind: "success",
          text: customerWorkflowT(locale, "bankInstructionsSent", {
            credits: Number(data.credits),
            amount: formatEuro(data.amountEuro, locale),
            reference,
          }),
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
        throw new Error(creditPurchaseErrorMessage("purchase", data.code));
      }
      if (typeof data.url !== "string" || !data.url) {
        throw new Error(
          creditPurchaseErrorMessage(
            "purchase",
            creditPurchaseErrorCodes.checkoutUnavailable,
          ),
        );
      }

      window.location.assign(data.url);
    } catch {
      setNotice({
        kind: "error",
        text: creditPurchaseErrorMessage("purchase", undefined),
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
    } catch {
      setNotice({
        kind: "error",
        text: "Customer ID could not be loaded.",
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
        heading
        width="wide"
      />

      <section
        data-credit-purchase-page
        className="mx-auto max-w-[1500px] px-3 py-3 sm:px-4 lg:px-5"
      >
        <div className="mb-3 grid gap-3 xl:grid-cols-[1fr_320px] xl:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-red-800/50 bg-red-950/25 px-2.5 py-1 text-[11px] font-semibold text-red-100">
                <CreditCard className="h-3.5 w-3.5 text-red-500" />
                Secure payment options
              </div>
              {localizeCreditPromotionLabel(locale, quote?.promotionLabel) && (
                <div className="inline-flex rounded-full border border-red-700/60 bg-red-950/40 px-2.5 py-1 text-[11px] font-black text-red-100">
                  {localizeCreditPromotionLabel(locale, quote?.promotionLabel)}
                </div>
              )}
            </div>

            <h2 className="mt-2 text-lg font-black sm:text-xl">
              Credits <span className="text-red-600">Prices</span>
            </h2>

            <p className="mt-1 max-w-3xl text-xs leading-5 text-zinc-400 sm:text-sm">
              Choose a package or enter a custom credit amount. Every package
              shows its current final total and per-credit rate.
            </p>
            {pricingLabel && (
              <div className="mt-1.5 text-xs font-bold text-emerald-300">
                {pricingLabel}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-red-900/50 bg-red-950/20 p-3">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="h-4 w-4 shrink-0 text-red-500" />
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.16em] text-red-400">
                  Payment Workflow
                </div>
                <p className="mt-0.5 text-[11px] leading-4 text-zinc-400">
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
            className={`mb-3 rounded-xl border p-3 text-sm ${
              notice.kind === "success"
                ? "border-emerald-800/50 bg-emerald-950/25 text-emerald-200"
                : notice.kind === "info"
                  ? "border-amber-700/50 bg-amber-950/25 text-amber-100"
                  : "border-red-800/50 bg-red-950/30 text-red-200"
            }`}
          >
            {customerWorkflowExactT(locale, notice.text)}
          </div>
        )}

        {quoteState === "loading" && (
          <div
            role="status"
            aria-live="polite"
            aria-busy="true"
            className="mb-3 flex min-h-28 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] p-5 text-center lg:min-h-20"
          >
            <div>
              <Loader2 className="mx-auto h-6 w-6 animate-spin text-red-500" />
              <div className="mt-2 text-base font-black">
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
            className="mb-3 rounded-xl border border-red-800/60 bg-red-950/30 p-4"
          >
            <div className="text-lg font-black text-red-100">
              Credit prices are temporarily unavailable
            </div>
            <p className="mt-2 text-sm leading-6 text-red-200/80">
              {customerWorkflowExactT(
                locale,
                quoteError ||
                  "No payment can be started until verified prices are loaded.",
              )}
            </p>
            <button
              type="button"
              onClick={() => void loadQuote()}
              className="mt-3 inline-flex min-h-11 items-center justify-center rounded-lg bg-[#b1121b] px-4 py-2 text-sm font-black text-white transition hover:bg-[#c91824]"
            >
              Retry verified prices
            </button>
          </div>
        )}

        {quoteState === "ready" && quote && (
          <>
            <div className="mb-3 rounded-xl border border-white/10 bg-white/[0.04] p-3">
              <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-red-400">
                    Payment Method
                  </div>
                  <h2 className="mt-0.5 text-lg font-black">
                    Choose how you want to pay
                  </h2>
                </div>
                <div className="text-xs font-bold text-zinc-500 sm:text-right">
                  <div>
                    Selected: {selectedPaymentTitle}
                  </div>
                  {quote.customerPaymentPolicyActive && (
                    <div className="mt-1 text-xs text-emerald-300">
                      Account-specific payment policy active
                    </div>
                  )}
                </div>
              </div>

              <div className="grid gap-2 md:grid-cols-2">
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
                      className={`min-h-14 rounded-lg border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${
                        active
                          ? "border-red-700 bg-red-950/30"
                          : "border-white/10 bg-black/30 hover:border-white/20 hover:bg-white/[0.06]"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                            active
                              ? "bg-red-600 text-white"
                              : "bg-white/10 text-zinc-300"
                          }`}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-sm font-black text-white">
                              {customerWorkflowExactT(locale, method.title)}
                            </div>
                            <span className="shrink-0 rounded-full border border-white/10 bg-black/35 px-2 py-0.5 text-[10px] font-black text-zinc-300">
                              {customerWorkflowExactT(locale, method.badge)}
                            </span>
                          </div>
                          <div className="mt-0.5 text-[11px] font-bold text-zinc-500">
                            {customerWorkflowExactT(locale, method.subtitle)}
                          </div>
                        </div>
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
                <div className="mt-3 rounded-lg border border-white/10 bg-black/30 p-3">
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
                    className="mt-3 inline-flex min-h-11 items-center rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-black text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    {copiedBankReference
                      ? "Reference copied"
                      : "Copy payment reference"}
                  </button>
                </div>
              )}
            </div>

        <div
          data-credit-package-grid
          className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
        >
          {packages.map((item) => (
            <div
              key={item.id}
              className={`relative flex flex-col rounded-xl border p-4 transition hover:-translate-y-0.5 ${
                item.highlight
                  ? "border-red-800/70 bg-red-950/30"
                  : "border-white/10 bg-white/[0.04]"
              }`}
            >
              {item.highlight && (
                <div className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-black text-white">
                  <Crown className="h-3 w-3" />
                  Popular
                </div>
              )}

              <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-lg border border-red-900/40 bg-red-950/35">
                <Sparkles className="h-4 w-4 text-red-500" />
              </div>

              <div className="text-xs font-black uppercase tracking-[0.08em] text-zinc-300">
                {item.credits} Credit
              </div>

              <div className="mt-3 text-2xl font-black">
                {formatEuro(item.priceEuro, locale)}
              </div>

              <div className="mt-1 text-xs font-bold text-red-400">
                Each Credit {formatCreditUnitEuro(item.unitPriceEuro, locale)}
              </div>

              <p className="mt-3 flex-1 text-xs leading-5 text-zinc-400">
                {customerWorkflowT(locale, creditPackageDescriptionKeys[item.id])}
              </p>

              <div className="mt-3 space-y-1 text-[11px] leading-4 text-zinc-300">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                  {paymentMethod === "stripe"
                    ? "Automatic credit top-up"
                    : paymentMethod === "bank"
                    ? "Manual admin verification"
                    : "Automatic credit top-up"}
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
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
                className="mt-3 flex min-h-11 w-full items-center justify-center rounded-lg border border-red-700 bg-transparent px-3 py-2 text-sm font-black text-white transition hover:bg-red-950/40 disabled:cursor-not-allowed disabled:opacity-60"
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
                    : customerWorkflowT(locale, "payWith", {
                        method: selectedPaymentTitle,
                      })}
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

        <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.04] p-3">
          <div className="mb-2 flex items-center gap-2 text-xs font-black">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-red-700/40 bg-red-950/35 text-red-300">
              <Zap className="h-3.5 w-3.5" />
            </span>
            Credit Utilization Scale
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {utilization.map((item) => {
              const Icon = item.icon;

              return (
                <div
                  key={item.title}
                  className="flex items-center gap-2 rounded-lg bg-red-900/40 px-3 py-2"
                >
                  <Icon className="h-4 w-4 shrink-0 text-white" />
                  <div className="min-w-0">
                    <div className="truncate text-xs font-black">{item.title}</div>
                    <div className="text-[11px] font-bold text-red-100">
                      {item.credits}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-3 grid gap-3 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-xl border border-red-900/50 bg-gradient-to-br from-red-950/30 via-white/[0.04] to-black p-4">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-red-800/50 bg-red-950/30 px-3 py-1.5 text-xs font-bold text-red-100">
              <Sparkles className="h-4 w-4 text-red-500" />
              Custom Amount
            </div>

            <h2 className="text-xl font-black">
              Buy exactly how many credits you need.
            </h2>

            <p className="mt-2 text-xs leading-5 text-zinc-400 sm:text-sm">
              Enter any credit amount. Custom credit purchases are calculated at{" "}
              {formatCreditUnitEuro(quote.customUnitPriceEuro, locale)} per credit for your account.
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_160px]">
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
                  className="min-h-11 w-full rounded-lg border border-white/10 bg-black/35 px-3 text-sm font-black text-white outline-none transition placeholder:text-zinc-600 focus:border-red-700"
                  placeholder="e.g. 17"
                />
              </label>

              <div className="rounded-lg border border-white/10 bg-black/35 p-3">
                <div className="text-xs font-black uppercase tracking-[0.16em] text-zinc-500">
                  Total Price
                </div>
                <div className="mt-1.5 text-2xl font-black text-red-400">
                  {customValid ? formatEuro(customPrice, locale) : "-"}
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
              className="mt-4 flex min-h-11 w-full items-center justify-center rounded-lg bg-[#b1121b] px-4 py-2 text-sm font-black text-white transition hover:bg-[#c91824] disabled:cursor-not-allowed disabled:opacity-60"
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
                    : customerWorkflowT(locale, "payCustomVia", {
                        method: selectedPaymentTitle,
                      })}
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

          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
            <ShieldCheck className="mb-3 h-7 w-7 text-red-500" />
            <h2 className="text-xl font-black">Important</h2>
            <p className="mt-2 text-xs leading-5 text-zinc-400 sm:text-sm">
              Package purchases use the verified package rate shown above.
              Custom credit purchases are calculated at{" "}
              {formatCreditUnitEuro(quote.customUnitPriceEuro, locale)} per credit for this
              account. Stripe payments add credits automatically after payment
              confirmation. Bank transfer requires admin verification before
              credits are added.
            </p>

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <div className="rounded-lg border border-white/10 bg-black/30 p-3">
                <div className="text-sm font-black">Example</div>
                <div className="mt-1 text-sm text-zinc-400">
                  17 Credits × {formatCreditUnitEuro(quote.customUnitPriceEuro, locale)} ={" "}
                  {formatEuro(calculateCreditTotalEuro(17, quote.customUnitPriceEuro), locale)}
                </div>
              </div>

              {lowestUnitPricePackage && (
                <div className="rounded-lg border border-white/10 bg-black/30 p-3">
                  <div className="text-sm font-black">Lowest package rate</div>
                  <div className="mt-1 text-sm text-zinc-400">
                    {lowestUnitPricePackage.credits} Credits ={" "}
                    {formatCreditUnitEuro(lowestUnitPricePackage.unitPriceEuro, locale)} / Credit
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
