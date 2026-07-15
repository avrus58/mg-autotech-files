"use client";

import Link from "next/link";
import type React from "react";
import { CalendarClock, CreditCard, RefreshCw, ShieldCheck, WalletCards } from "lucide-react";
import type { WidgetBillingSummary } from "@/lib/widget/customerTypes";

function formatCurrency(cents: number | null, currency: string | null) {
  if (cents === null || cents === undefined) return "Not available";
  try {
    return new Intl.NumberFormat("en", {
      style: "currency",
      currency: (currency || "EUR").toUpperCase(),
    }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${(currency || "EUR").toUpperCase()}`;
  }
}

function formatDate(value: string | null) {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  return date.toLocaleDateString("en", { day: "2-digit", month: "short", year: "numeric" });
}

function dayLabel(days: number | null) {
  if (days === null || days === undefined) return "Date not available";
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return `In ${days} days`;
}

function titleCase(value: string | null) {
  if (!value) return "Not available";
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export function SubscriptionSummaryPanel({
  summary,
  loading,
  error,
  canManageBilling,
  onManage,
  onRefresh,
}: {
  summary: WidgetBillingSummary | null;
  loading?: boolean;
  error?: string;
  canManageBilling: boolean;
  onManage: () => void;
  onRefresh?: () => void;
}) {
  const action = summary?.action ?? (canManageBilling ? "manage_billing" : "view_plans");
  const status = summary?.status ?? "Not linked";
  const isEnding = Boolean(summary?.cancel_at_period_end || summary?.ends_at);

  return (
    <section className="overflow-hidden rounded-2xl border border-white/10 bg-[linear-gradient(135deg,rgba(177,18,27,0.16),rgba(8,8,10,0.96)_42%,rgba(20,20,24,0.92))] shadow-2xl shadow-black/40">
      <div className="flex flex-col gap-4 border-b border-white/10 p-6 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-red-300">
            <WalletCards className="h-4 w-4" />
            Widget Subscription
          </div>
          <h3 className="mt-3 text-2xl font-black text-white">Billing overview</h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
            Track the linked Stripe subscription, latest paid invoice and upcoming renewal from one safe customer view.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full border px-3 py-1.5 text-xs font-black uppercase tracking-[0.12em] ${
            ["active", "trialing"].includes(status.toLowerCase())
              ? "border-emerald-700/40 bg-emerald-950/30 text-emerald-200"
              : "border-amber-700/40 bg-amber-950/25 text-amber-200"
          }`}>
            {titleCase(status)}
          </span>
          {summary?.source && (
            <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1.5 text-xs font-black uppercase tracking-[0.12em] text-zinc-300">
              {summary.source === "stripe" ? "Live Stripe" : summary.source === "local" ? "Local fallback" : "Unlinked"}
            </span>
          )}
        </div>
      </div>

      {loading ? (
        <div className="grid gap-3 p-6 sm:grid-cols-2 xl:grid-cols-4">
          {["Plan", "Last payment", "Next payment", "Days remaining"].map((label) => (
            <div key={label} className="min-h-32 rounded-xl border border-white/10 bg-black/30 p-4">
              <div className="text-xs font-black uppercase tracking-[0.14em] text-zinc-600">{label}</div>
              <div className="mt-5 h-5 w-24 animate-pulse rounded bg-white/10" />
              <div className="mt-3 h-3 w-32 animate-pulse rounded bg-white/5" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid gap-3 p-6 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            icon={<ShieldCheck />}
            label="Current plan"
            value={titleCase(summary?.plan ?? null)}
            detail={`${formatCurrency(summary?.amount_due_cents ?? null, summary?.currency ?? null)} per billing period`}
          />
          <MetricCard
            icon={<CreditCard />}
            label="Last payment"
            value={formatDate(summary?.last_payment_at ?? null)}
            detail={formatCurrency(summary?.last_payment_amount_cents ?? null, summary?.currency ?? null)}
          />
          <MetricCard
            icon={<CalendarClock />}
            label={isEnding ? "Subscription ends" : "Next payment"}
            value={formatDate(isEnding ? summary?.ends_at ?? summary?.current_period_end ?? null : summary?.next_payment_at ?? null)}
            detail={isEnding ? dayLabel(summary?.days_until_period_end ?? null) : `${dayLabel(summary?.days_until_next_payment ?? null)} · ${formatCurrency(summary?.next_payment_amount_cents ?? null, summary?.currency ?? null)}`}
          />
          <MetricCard
            icon={<RefreshCw />}
            label="Days remaining"
            value={dayLabel(summary?.days_until_period_end ?? null)}
            detail={`Current period ends ${formatDate(summary?.current_period_end ?? null)}`}
          />
        </div>
      )}

      {(error || summary?.message) && (
        <div className="mx-6 mb-6 rounded-xl border border-amber-700/30 bg-amber-950/20 p-4 text-sm leading-6 text-amber-100">
          {error || summary?.message}
        </div>
      )}

      <div className="flex flex-col gap-3 border-t border-white/10 bg-black/25 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm leading-6 text-zinc-400">
          Customer-safe billing view only. Exact payment method and invoice internals stay inside Stripe.
        </div>
        <div className="flex flex-wrap gap-2">
          {onRefresh && (
            <button type="button" onClick={onRefresh} className="rounded-lg border border-white/10 px-4 py-3 text-sm font-black text-white">
              <RefreshCw className="mr-2 inline h-4 w-4" />
              Refresh
            </button>
          )}
          {action === "manage_billing" && canManageBilling ? (
            <button type="button" onClick={onManage} className="rounded-lg bg-white px-4 py-3 text-sm font-black text-black">
              Manage subscription
            </button>
          ) : (
            <>
              <Link href="/widget" className="rounded-lg bg-white px-4 py-3 text-sm font-black text-black">
                View widget plans
              </Link>
              <a href="mailto:info@mgautotech.de?subject=Widget%20billing%20support" className="rounded-lg border border-white/10 px-4 py-3 text-sm font-black text-white">
                Contact support
              </a>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function MetricCard({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: string; detail: string }) {
  return (
    <div className="min-h-32 rounded-xl border border-white/10 bg-black/30 p-4">
      <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-zinc-500">
        <span className="text-red-400">{icon}</span>
        {label}
      </div>
      <div className="mt-4 break-words text-xl font-black text-white">{value}</div>
      <div className="mt-2 text-sm leading-5 text-zinc-400">{detail}</div>
    </div>
  );
}
