"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { signOutIfEmailUnverified } from "@/lib/authGuards";
import { supabase } from "@/lib/supabaseClient";
import {
  ArrowLeft,
  CheckCircle2,
  Copy,
  CreditCard,
  Crown,
  ExternalLink,
  Gauge,
  Landmark,
  Loader2,
  ShieldCheck,
  Sparkles,
  WalletCards,
  Zap,
} from "lucide-react";

const packages = [
  {
    id: "credits_10",
    credits: 10,
    priceEuro: 50,
    perCredit: 5,
    title: "Starter",
    description: "Perfect for testing the platform or a small single request.",
  },
  {
    id: "credits_50",
    credits: 50,
    priceEuro: 225,
    perCredit: 4.5,
    title: "Workshop",
    description: "Better price for regular customers and small workshops.",
  },
  {
    id: "credits_100",
    credits: 100,
    priceEuro: 400,
    perCredit: 4,
    title: "Professional",
    description: "Strong value for recurring file service requests.",
    highlight: true,
  },
  {
    id: "credits_250",
    credits: 250,
    priceEuro: 875,
    perCredit: 3.5,
    title: "Partner",
    description: "High-volume package for workshops and partner businesses.",
  },
  {
    id: "credits_500",
    credits: 500,
    priceEuro: 1500,
    perCredit: 3,
    title: "Enterprise",
    description: "Best price for serious volume and frequent ECU/TCU work.",
  },
];

const utilization = [
  { title: "Stage 1", credits: "10 Credit", icon: Crown },
  { title: "DPF OFF", credits: "6 Credit", icon: Sparkles },
  { title: "AdBlue OFF", credits: "11 Credit", icon: Sparkles },
  { title: "EGR OFF", credits: "6 Credit", icon: Sparkles },
  { title: "DTC OFF", credits: "4 Credit", icon: Sparkles },
];

const paymentMethods = [
  {
    id: "sumup",
    title: "SumUp",
    subtitle: "Card / mobile payment",
    badge: "Automatic",
    icon: WalletCards,
  },
  {
    id: "paypal",
    title: "PayPal",
    subtitle: "PayPal payment link",
    badge: "Automatic",
    icon: ShieldCheck,
  },
  {
    id: "bank",
    title: "Bank Transfer",
    subtitle: "SEPA transfer",
    badge: "Manual check",
    icon: Landmark,
  },
  {
    id: "stripe",
    title: "Credit Card",
    subtitle: "Stripe checkout",
    badge: "Automatic",
    icon: CreditCard,
  },
] as const;

type PaymentMethod = (typeof paymentMethods)[number]["id"];

function formatEuro(value: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(value);
}

function formatCustomerReference(customerId: string) {
  const cleanId = customerId.trim().toUpperCase();
  if (/^MGA-\d{5,}$/.test(cleanId)) return cleanId;
  if (/^\d+$/.test(cleanId)) return `MGA-${cleanId.padStart(5, "0")}`;
  return "MGA-10001";
}

export default function BuyCreditsPage() {
  const router = useRouter();

  const [loadingPackage, setLoadingPackage] = useState<string | null>(null);
  const [customCredits, setCustomCredits] = useState("17");
  const [message, setMessage] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("sumup");
  const [copiedBankReference, setCopiedBankReference] = useState(false);

  const customCreditAmount = Number(customCredits);
  const customValid =
    Number.isFinite(customCreditAmount) &&
    customCreditAmount >= 1 &&
    customCreditAmount <= 1000 &&
    Number.isInteger(customCreditAmount);

  const customPrice = useMemo(() => {
    if (!customValid) return 0;
    return customCreditAmount * 5;
  }, [customCreditAmount, customValid]);

  const selectedPayment = paymentMethods.find(
    (method) => method.id === paymentMethod
  );

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

  const startCheckout = async (payload: {
    packageId?: string;
    customCredits?: number;
  }) => {
    const loadingId =
      payload.packageId ?? `custom_${payload.customCredits ?? "credits"}`;

    setLoadingPackage(loadingId);
    setMessage("");

    const { data: sessionData } = await supabase.auth.getSession();

    if (!sessionData.session) {
      router.push("/login");
      return;
    }

    const { data: userData } = await supabase.auth.getUser();

    if (!userData.user || (await signOutIfEmailUnverified(userData.user))) {
      router.push("/login?verify_email=1");
      return;
    }

    if (paymentMethod !== "stripe") {
      if (paymentMethod === "bank") {
        try {
          const reference = await getCustomerReference(userData.user.id);
          setMessage(
            `Bank transfer selected. Use your Customer ID as payment reference: ${reference}. Credits are added manually after payment is received.`
          );
        } catch (error) {
          setMessage(
            error instanceof Error
              ? error.message
              : "Customer ID could not be loaded."
          );
        } finally {
          setLoadingPackage(null);
        }

        return;
      }

      const endpoint =
        paymentMethod === "paypal"
          ? "/api/paypal/create-order"
          : "/api/sumup/create-checkout";

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      setLoadingPackage(null);

      if (!response.ok) {
        setMessage(
          data.error ?? `Could not start ${selectedPayment?.title ?? "payment"}.`
        );
        return;
      }

      if (!data.url) {
        setMessage(`${selectedPayment?.title ?? "Payment"} URL was not returned.`);
        return;
      }

      window.location.assign(data.url);
      return;
    }

    const response = await fetch("/api/stripe/create-checkout-session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionData.session.access_token}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    setLoadingPackage(null);

    if (!response.ok) {
      setMessage(data.error ?? "Could not start Stripe checkout.");
      return;
    }

    if (!data.url) {
      setMessage("Stripe checkout URL was not returned.");
      return;
    }

    window.location.assign(data.url);
  };

  const startCustomCheckout = () => {
    if (!customValid) {
      setMessage("Please enter a whole number between 1 and 1000 credits.");
      return;
    }

    startCheckout({ customCredits: customCreditAmount });
  };

  const copyBankReference = async () => {
    const { data: sessionData } = await supabase.auth.getSession();

    if (!sessionData.session) {
      router.push("/login");
      return;
    }

    const { data: userData } = await supabase.auth.getUser();

    if (!userData.user || (await signOutIfEmailUnverified(userData.user))) {
      router.push("/login?verify_email=1");
      return;
    }

    let reference = "";

    try {
      reference = await getCustomerReference(userData.user.id);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Customer ID could not be loaded."
      );
      return;
    }

    await navigator.clipboard.writeText(reference);
    setCopiedBankReference(true);

    window.setTimeout(() => {
      setCopiedBankReference(false);
    }, 1600);
  };

  return (
    <main className="min-h-screen bg-[#050505] text-white">
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_18%_0%,rgba(160,18,28,0.25),transparent_34%),radial-gradient(circle_at_80%_20%,rgba(177,18,27,0.15),transparent_28%),linear-gradient(135deg,#050505,#0c0c0e_48%,#170507)]" />

      <header className="sticky top-0 z-50 border-b border-white/10 bg-black/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-red-800/50 bg-[#111] shadow-lg shadow-red-950/40">
              <Gauge className="h-7 w-7 text-red-600" />
            </div>

            <div>
              <div className="text-xl font-black tracking-wide">
                MG <span className="text-red-600">AUTOTECH</span>
              </div>
              <div className="text-xs text-zinc-400">Credit Checkout</div>
            </div>
          </Link>

          <Link
            href="/dashboard"
            className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-bold text-white transition hover:bg-white/10"
          >
            <ArrowLeft className="mr-2 inline h-4 w-4" />
            Dashboard
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-10">
        <div className="mb-10 grid gap-6 lg:grid-cols-[1fr_420px] lg:items-end">
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
          </div>

          <div className="rounded-[2rem] border border-red-900/50 bg-red-950/20 p-6 shadow-2xl shadow-black/30">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-8 w-8 text-red-500" />
              <div>
                <div className="text-sm font-black uppercase tracking-[0.2em] text-red-400">
                  Payment Workflow
                </div>
                <p className="mt-1 text-sm text-zinc-400">
                  SumUp, PayPal and Stripe add credits automatically after
                  payment confirmation. Bank transfer stays manual.
                </p>
              </div>
            </div>
          </div>
        </div>

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
            <div className="text-sm font-bold text-zinc-500">
              Selected: {selectedPayment?.title}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            {paymentMethods.map((method) => {
              const Icon = method.icon;
              const active = paymentMethod === method.id;

              return (
                <button
                  key={method.id}
                  type="button"
                  onClick={() => {
                    setPaymentMethod(method.id);
                    setMessage("");
                  }}
                  className={`rounded-2xl border p-4 text-left transition ${
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

          {paymentMethod === "bank" && (
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
                className="mt-5 inline-flex items-center rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-black text-white transition hover:bg-white/10"
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

        {message && (
          <div className="mb-6 rounded-2xl border border-red-800/50 bg-red-950/30 p-4 text-sm text-red-200">
            {message}
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-5">
          {packages.map((item) => (
            <div
              key={item.id}
              className={`relative flex min-h-[360px] flex-col rounded-[2rem] border p-6 shadow-2xl shadow-black/20 transition hover:-translate-y-1 ${
                item.highlight
                  ? "border-red-800/70 bg-red-950/30 xl:-mt-6"
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

              <div className="mt-2 text-4xl font-black">
                {formatEuro(item.priceEuro)}
              </div>

              <div className="mt-2 text-sm font-bold text-red-400">
                Each Credit {formatEuro(item.perCredit)}
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
                onClick={() => startCheckout({ packageId: item.id })}
                disabled={loadingPackage === item.id}
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
                    {paymentMethod !== "stripe" && paymentMethod !== "bank" && (
                      <ExternalLink className="ml-2 h-4 w-4" />
                    )}
                  </>
                )}
              </button>
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
              Enter any credit amount. Custom credit purchases are calculated at
              €5 per credit.
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
                <div className="mt-2 text-3xl font-black text-red-400">
                  {customValid ? formatEuro(customPrice) : "-"}
                </div>
              </div>
            </div>

            <button
              onClick={startCustomCheckout}
              disabled={!customValid || Boolean(loadingPackage?.startsWith("custom_"))}
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
                  {paymentMethod !== "stripe" && paymentMethod !== "bank" && (
                    <ExternalLink className="ml-2 h-4 w-4" />
                  )}
                </>
              )}
            </button>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-7">
            <ShieldCheck className="mb-5 h-10 w-10 text-red-500" />
            <h2 className="text-2xl font-black">Important</h2>
            <p className="mt-3 text-sm leading-7 text-zinc-400">
              Package purchases use discounted package pricing. Custom credit
              purchases are always calculated at €5 per credit. Stripe payments
              add credits automatically after payment confirmation. Bank
              transfer requires admin verification before credits are added.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                <div className="text-sm font-black">Example</div>
                <div className="mt-1 text-sm text-zinc-400">
                  17 Credits × €5 = €85
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                <div className="text-sm font-black">Best Value</div>
                <div className="mt-1 text-sm text-zinc-400">
                  500 Credits = €3 / Credit
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
