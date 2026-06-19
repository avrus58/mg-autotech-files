"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import {
  ArrowLeft,
  CreditCard,
  FileText,
  Gauge,
  History,
  Loader2,
  LogOut,
  MinusCircle,
  PlusCircle,
  RefreshCcw,
  ShieldCheck,
} from "lucide-react";

type CreditTransaction = {
  id: string;
  user_id: string;
  type: string;
  source_type: string | null;
  source_id: string | null;
  credits_delta: number | string;
  balance_after: number | string | null;
  description: string | null;
  amount_total: number | string | null;
  currency: string | null;
  metadata: Record<string, unknown> | null;
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

function formatType(type: string | null) {
  if (!type) return "Transaction";

  return type
    .replaceAll("_", " ")
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export default function CreditHistoryPage() {
  const router = useRouter();

  const [email, setEmail] = useState<string | null>(null);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [credits, setCredits] = useState<number>(0);
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
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
      .select("credit_balance, customer_id")
      .eq("id", user.id)
      .single();

    if (profile) {
      setCredits(Number(profile.credit_balance ?? 0));
      setCustomerId(profile.customer_id ?? null);
    }

    const { data: transactionRows, error } = await supabase
      .from("credit_transactions")
      .select(
        "id, user_id, type, source_type, source_id, credits_delta, balance_after, description, amount_total, currency, metadata, created_at"
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (!error && transactionRows) {
      setTransactions(transactionRows as CreditTransaction[]);
    }

    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const positiveCredits = useMemo(
    () =>
      transactions
        .filter((item) => Number(item.credits_delta) > 0)
        .reduce((total, item) => total + Number(item.credits_delta ?? 0), 0),
    [transactions]
  );

  const usedCredits = useMemo(
    () =>
      Math.abs(
        transactions
          .filter((item) => Number(item.credits_delta) < 0)
          .reduce((total, item) => total + Number(item.credits_delta ?? 0), 0)
      ),
    [transactions]
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
          <p className="text-sm text-zinc-400">Loading credit ledger...</p>
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
              <div className="text-xs text-zinc-400">Credit Ledger</div>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <div className="hidden rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 md:block">
              <div className="text-xs text-zinc-500">Logged in as</div>
              <div className="max-w-[220px] truncate text-sm font-bold">
                {email}
              </div>
              {customerId && (
                <div className="mt-1 text-xs font-black text-red-400">
                  {customerId}
                </div>
              )}
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
              Credit <span className="text-red-600">Ledger</span>
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-zinc-400">
              Every credit top-up, Stripe purchase, manual adjustment and file
              request usage is recorded here.
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
            <div className="text-sm text-zinc-400">Positive Credits</div>
            <div className="mt-2 text-5xl font-black">{positiveCredits}</div>
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

          {transactions.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-white/15 bg-black/25 p-10 text-center">
              <FileText className="mx-auto mb-4 h-10 w-10 text-red-600" />
              <h3 className="text-xl font-black">No credit ledger yet</h3>
              <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-zinc-400">
                Stripe purchases, manual top-ups and credit usage will appear here.
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
                <div>Balance After</div>
                <div>Date</div>
                <div className="text-right">Credits</div>
              </div>

              <div className="divide-y divide-white/10">
                {transactions.map((item) => {
                  const delta = Number(item.credits_delta ?? 0);
                  const isPositive = delta >= 0;

                  return (
                    <div
                      key={item.id}
                      className="grid grid-cols-1 gap-4 bg-black/20 px-5 py-4 transition hover:bg-white/[0.04] md:grid-cols-[1.4fr_.7fr_.7fr_.7fr] md:items-center"
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
                            isPositive
                              ? "bg-emerald-500/10 text-emerald-400"
                              : "bg-red-500/10 text-red-400"
                          }`}
                        >
                          {isPositive ? (
                            <PlusCircle className="h-5 w-5" />
                          ) : (
                            <MinusCircle className="h-5 w-5" />
                          )}
                        </div>

                        <div>
                          <div className="font-black">
                            {item.description || formatType(item.type)}
                          </div>
                          <div className="mt-1 text-sm text-zinc-400">
                            {formatType(item.type)}
                            {item.source_type ? ` · ${item.source_type}` : ""}
                          </div>
                          {formatAmount(item.amount_total, item.currency) && (
                            <div className="mt-1 text-xs font-bold text-emerald-300">
                              {formatAmount(item.amount_total, item.currency)}
                            </div>
                          )}
                        </div>
                      </div>

                      <div>
                        <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-black text-zinc-300">
                          {item.balance_after ?? "-"}
                        </span>
                      </div>

                      <div className="text-sm text-zinc-400">
                        {formatDate(item.created_at)}
                      </div>

                      <div
                        className={`text-left text-xl font-black md:text-right ${
                          isPositive ? "text-emerald-400" : "text-red-500"
                        }`}
                      >
                        {isPositive ? "+" : ""}
                        {delta}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="mt-8 rounded-[2rem] border border-red-900/40 bg-red-950/20 p-6">
          <ShieldCheck className="mb-4 h-9 w-9 text-red-500" />
          <h3 className="text-2xl font-black">Ledger based credit tracking</h3>
          <p className="mt-3 text-sm leading-6 text-zinc-400">
            This page is based on the credit_transactions ledger table. Manual
            admin credits, Stripe purchases and order usage can all be tracked
            from one transaction source.
          </p>
        </div>
      </section>
    </main>
  );
}
