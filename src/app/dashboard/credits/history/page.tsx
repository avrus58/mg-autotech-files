"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import {
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  FileText,
  Gauge,
  History,
  Loader2,
  LogOut,
  MinusCircle,
  PlusCircle,
  RefreshCcw,
} from "lucide-react";

type CreditPayment = {
  id: string;
  user_id: string;
  stripe_session_id: string;
  stripe_payment_intent: string | null;
  customer_email: string | null;
  package_id: string | null;
  credits: number | string;
  amount_total: number | string | null;
  currency: string | null;
  status: string | null;
  created_at: string;
};

type Order = {
  id: string;
  vehicle_brand: string | null;
  vehicle_model: string | null;
  service_type: string | null;
  credits_required: number | string | null;
  status: string | null;
  created_at: string;
};

type HistoryItem = {
  id: string;
  type: "purchase" | "usage";
  title: string;
  subtitle: string;
  credits: number;
  amount?: string;
  status: string;
  created_at: string;
};

function formatDate(date: string) {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

function formatAmount(amountTotal: number | string | null, currency: string | null) {
  if (amountTotal === null || amountTotal === undefined) return "";

  const value = Number(amountTotal) / 100;
  const curr = (currency || "eur").toUpperCase();

  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: curr,
  }).format(value);
}

function formatStatus(status: string | null) {
  if (!status) return "Paid";

  return status
    .replaceAll("_", " ")
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export default function CreditHistoryPage() {
  const router = useRouter();

  const [email, setEmail] = useState<string | null>(null);
  const [credits, setCredits] = useState<number>(0);
  const [payments, setPayments] = useState<CreditPayment[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadHistory = async () => {
    setRefreshing(true);

    const { data: userData } = await supabase.auth.getUser();

    if (!userData.user) {
      router.push("/login");
      return;
    }

    const user = userData.user;
    setEmail(user.email ?? null);

    const { data: profile } = await supabase
      .from("profiles")
      .select("credit_balance")
      .eq("id", user.id)
      .single();

    if (profile) {
      setCredits(Number(profile.credit_balance ?? 0));
    }

    const { data: paymentRows } = await supabase
      .from("credit_payments")
      .select(
        "id, user_id, stripe_session_id, stripe_payment_intent, customer_email, package_id, credits, amount_total, currency, status, created_at"
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (paymentRows) {
      setPayments(paymentRows as CreditPayment[]);
    }

    const { data: orderRows } = await supabase
      .from("orders")
      .select("id, vehicle_brand, vehicle_model, service_type, credits_required, status, created_at")
      .eq("customer_id", user.id)
      .gt("credits_required", 0)
      .order("created_at", { ascending: false });

    if (orderRows) {
      setOrders(orderRows as Order[]);
    }

    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const historyItems = useMemo<HistoryItem[]>(() => {
    const purchaseItems: HistoryItem[] = payments.map((payment) => ({
      id: `payment-${payment.id}`,
      type: "purchase",
      title: `${Number(payment.credits ?? 0)} Credits Purchased`,
      subtitle: payment.package_id
        ? `Stripe payment · ${payment.package_id}`
        : "Stripe payment",
      credits: Number(payment.credits ?? 0),
      amount: formatAmount(payment.amount_total, payment.currency),
      status: formatStatus(payment.status),
      created_at: payment.created_at,
    }));

    const usageItems: HistoryItem[] = orders.map((order) => ({
      id: `order-${order.id}`,
      type: "usage",
      title: `${order.vehicle_brand || "Vehicle"} ${order.vehicle_model || ""}`.trim(),
      subtitle: order.service_type || "File request",
      credits: -Number(order.credits_required ?? 0),
      status: formatStatus(order.status),
      created_at: order.created_at,
    }));

    return [...purchaseItems, ...usageItems].sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [payments, orders]);

  const purchasedCredits = payments.reduce(
    (total, payment) => total + Number(payment.credits ?? 0),
    0
  );

  const usedCredits = orders.reduce(
    (total, order) => total + Number(order.credits_required ?? 0),
    0
  );

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#050505] text-white">
        <div className="text-center">
          <Loader2 className="mx-auto mb-5 h-12 w-12 animate-spin text-red-600" />
          <p className="text-sm text-zinc-400">Loading credit history...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#050505] text-white">
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_20%_0%,rgba(160,18,28,0.24),transparent_32%),linear-gradient(135deg,#050505,#0d0d0f_48%,#160608)]" />

      <header className="sticky top-0 z-40 border-b border-white/10 bg-black/75 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-red-800/50 bg-[#111] shadow-lg shadow-red-950/40">
              <Gauge className="h-7 w-7 text-red-600" />
            </div>

            <div>
              <div className="text-xl font-black tracking-wide">
                MG <span className="text-red-600">AUTOTECH</span>
              </div>
              <div className="text-xs text-zinc-400">Credit History</div>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <div className="hidden rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 md:block">
              <div className="text-xs text-zinc-500">Logged in as</div>
              <div className="max-w-[220px] truncate text-sm font-bold">
                {email}
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-bold text-white transition hover:bg-white/10"
            >
              <LogOut className="mr-2 inline h-4 w-4" />
              Logout
            </button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <Link
              href="/dashboard"
              className="mb-5 inline-flex items-center rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-black text-white transition hover:bg-white/10"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Link>

            <div className="text-sm font-black uppercase tracking-[0.25em] text-red-600">
              Customer Credits
            </div>
            <h1 className="mt-2 text-4xl font-black md:text-6xl">
              Credit <span className="text-red-600">History</span>
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-zinc-400">
              All purchased credits and used credits from file requests are listed here.
            </p>
          </div>

          <button
            onClick={loadHistory}
            disabled={refreshing}
            className="rounded-xl bg-[#b1121b] px-5 py-3 text-sm font-black text-white transition hover:bg-[#c91824] disabled:opacity-60"
          >
            {refreshing ? (
              <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
            ) : (
              <RefreshCcw className="mr-2 inline h-4 w-4" />
            )}
            Refresh
          </button>
        </div>

        <div className="mb-8 grid gap-5 md:grid-cols-3">
          <div className="rounded-3xl border border-red-900/50 bg-red-950/25 p-6">
            <CreditCard className="mb-4 h-8 w-8 text-red-500" />
            <div className="text-sm text-zinc-400">Current Balance</div>
            <div className="mt-2 text-5xl font-black">{credits}</div>
          </div>

          <div className="rounded-3xl border border-emerald-700/30 bg-emerald-950/20 p-6">
            <PlusCircle className="mb-4 h-8 w-8 text-emerald-400" />
            <div className="text-sm text-zinc-400">Purchased Credits</div>
            <div className="mt-2 text-5xl font-black">{purchasedCredits}</div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
            <MinusCircle className="mb-4 h-8 w-8 text-red-400" />
            <div className="text-sm text-zinc-400">Used Credits</div>
            <div className="mt-2 text-5xl font-black">{usedCredits}</div>
          </div>
        </div>

        <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6">
          <div className="mb-6 flex items-center gap-3">
            <History className="h-7 w-7 text-red-500" />
            <div>
              <div className="text-sm font-black uppercase tracking-[0.25em] text-red-600">
                Transactions
              </div>
              <h2 className="mt-1 text-3xl font-black">All credit movements</h2>
            </div>
          </div>

          {historyItems.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-white/15 bg-black/25 p-10 text-center">
              <FileText className="mx-auto mb-4 h-10 w-10 text-red-600" />
              <h3 className="text-xl font-black">No credit history yet</h3>
              <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-zinc-400">
                Purchased credits and used credits will appear here.
              </p>
              <Link
                href="/dashboard/credits"
                className="mt-6 inline-flex rounded-xl bg-[#b1121b] px-5 py-3 font-black text-white transition hover:bg-[#c91824]"
              >
                Buy Credits
              </Link>
            </div>
          ) : (
            <div className="overflow-hidden rounded-3xl border border-white/10">
              <div className="grid grid-cols-[1.4fr_.7fr_.7fr_.7fr] gap-4 bg-black/40 px-5 py-4 text-xs font-black uppercase tracking-[0.18em] text-zinc-500">
                <div>Transaction</div>
                <div>Status</div>
                <div>Date</div>
                <div className="text-right">Credits</div>
              </div>

              <div className="divide-y divide-white/10">
                {historyItems.map((item) => (
                  <div
                    key={item.id}
                    className="grid grid-cols-1 gap-4 bg-black/20 px-5 py-4 transition hover:bg-white/[0.04] md:grid-cols-[1.4fr_.7fr_.7fr_.7fr] md:items-center"
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
                          item.type === "purchase"
                            ? "bg-emerald-500/10 text-emerald-400"
                            : "bg-red-500/10 text-red-400"
                        }`}
                      >
                        {item.type === "purchase" ? (
                          <PlusCircle className="h-5 w-5" />
                        ) : (
                          <MinusCircle className="h-5 w-5" />
                        )}
                      </div>

                      <div>
                        <div className="font-black">{item.title}</div>
                        <div className="mt-1 text-sm text-zinc-400">
                          {item.subtitle}
                        </div>
                        {item.amount && (
                          <div className="mt-1 text-xs font-bold text-emerald-300">
                            {item.amount}
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-black text-zinc-300">
                        {item.status}
                      </span>
                    </div>

                    <div className="text-sm text-zinc-400">
                      {formatDate(item.created_at)}
                    </div>

                    <div
                      className={`text-left text-xl font-black md:text-right ${
                        item.credits >= 0 ? "text-emerald-400" : "text-red-500"
                      }`}
                    >
                      {item.credits >= 0 ? "+" : ""}
                      {item.credits}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="mt-8 rounded-[2rem] border border-red-900/40 bg-red-950/20 p-6">
          <CheckCircle2 className="mb-4 h-9 w-9 text-red-500" />
          <h3 className="text-2xl font-black">Automatic credit tracking</h3>
          <p className="mt-3 text-sm leading-6 text-zinc-400">
            Stripe purchases are stored in the credit payment table and file request usage is calculated from submitted orders.
          </p>
        </div>
      </section>
    </main>
  );
}
