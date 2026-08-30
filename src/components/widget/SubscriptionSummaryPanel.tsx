"use client";

import Link from "next/link";
import type React from "react";
import { CalendarClock, CreditCard, RefreshCw, ShieldCheck, WalletCards } from "lucide-react";
import {
  translateWidgetSiteExact,
  widgetSitePlanLabel,
  widgetSiteStatusLabel,
  widgetSiteT,
} from "@/lib/i18n/widget-site-translations";
import { intlLocaleByCode, type LocaleCode } from "@/lib/i18nConfig";
import { useActiveLocale } from "@/lib/useActiveLocale";
import type { WidgetBillingSummary } from "@/lib/widget/customerTypes";

function formatCurrency(cents: number | null, currency: string | null, locale: LocaleCode) {
  if (cents === null || cents === undefined) return widgetSiteT(locale, "notAvailable");
  try {
    return new Intl.NumberFormat(intlLocaleByCode[locale], {
      style: "currency",
      currency: (currency || "EUR").toUpperCase(),
    }).format(cents / 100);
  } catch {
    return `${new Intl.NumberFormat(intlLocaleByCode[locale], { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cents / 100)} ${(currency || "EUR").toUpperCase()}`;
  }
}

function formatDate(value: string | null, locale: LocaleCode) {
  if (!value) return widgetSiteT(locale, "notAvailable");
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return widgetSiteT(locale, "notAvailable");
  return date.toLocaleDateString(intlLocaleByCode[locale], { day: "2-digit", month: "short", year: "numeric" });
}

function dayLabel(days: number | null, locale: LocaleCode) {
  if (days === null || days === undefined) return widgetSiteT(locale, "dateNotAvailable");
  return new Intl.RelativeTimeFormat(intlLocaleByCode[locale], { numeric: "auto" }).format(days, "day");
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
  const locale = useActiveLocale();
  const action = summary?.action ?? (canManageBilling ? "manage_billing" : "view_plans");
  const status = summary?.status ?? null;
  const isEnding = Boolean(summary?.cancel_at_period_end || summary?.ends_at);

  return (
    <section className="overflow-hidden rounded-2xl border border-white/10 bg-[linear-gradient(135deg,rgba(177,18,27,0.16),rgba(8,8,10,0.96)_42%,rgba(20,20,24,0.92))] shadow-2xl shadow-black/40">
      <div className="flex flex-col gap-4 border-b border-white/10 p-6 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-red-300">
            <WalletCards className="h-4 w-4" />
            {widgetSiteT(locale, "widgetSubscription")}
          </div>
          <h3 className="mt-3 text-2xl font-black text-white">{widgetSiteT(locale, "billingOverview")}</h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
            {widgetSiteT(locale, "billingOverviewDescription")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full border px-3 py-1.5 text-xs font-black uppercase tracking-[0.12em] ${
            ["active", "trialing"].includes(status?.toLowerCase() ?? "")
              ? "border-emerald-700/40 bg-emerald-950/30 text-emerald-200"
              : "border-amber-700/40 bg-amber-950/25 text-amber-200"
          }`}>
            {status ? widgetSiteStatusLabel(locale, status) : widgetSiteT(locale, "notLinked")}
          </span>
          {summary?.source && (
            <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1.5 text-xs font-black uppercase tracking-[0.12em] text-zinc-300">
              {widgetSiteT(locale, summary.source === "stripe" ? "liveStripe" : summary.source === "local" ? "localFallback" : "unlinked")}
            </span>
          )}
        </div>
      </div>

      {loading ? (
        <div className="grid gap-3 p-6 sm:grid-cols-2 xl:grid-cols-4">
          {[widgetSiteT(locale, "plan"), widgetSiteT(locale, "lastPayment"), widgetSiteT(locale, "nextPayment"), widgetSiteT(locale, "daysRemaining")].map((label) => (
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
            label={widgetSiteT(locale, "currentPlan")}
            value={widgetSitePlanLabel(locale, summary?.plan ?? null)}
            detail={widgetSiteT(locale, "perBillingPeriod", { amount: formatCurrency(summary?.amount_due_cents ?? null, summary?.currency ?? null, locale) })}
          />
          <MetricCard
            icon={<CreditCard />}
            label={widgetSiteT(locale, "lastPayment")}
            value={formatDate(summary?.last_payment_at ?? null, locale)}
            detail={formatCurrency(summary?.last_payment_amount_cents ?? null, summary?.currency ?? null, locale)}
          />
          <MetricCard
            icon={<CalendarClock />}
            label={isEnding ? widgetSiteT(locale, "subscriptionEnds") : widgetSiteT(locale, "nextPayment")}
            value={formatDate(isEnding ? summary?.ends_at ?? summary?.current_period_end ?? null : summary?.next_payment_at ?? null, locale)}
            detail={isEnding ? dayLabel(summary?.days_until_period_end ?? null, locale) : `${dayLabel(summary?.days_until_next_payment ?? null, locale)} · ${formatCurrency(summary?.next_payment_amount_cents ?? null, summary?.currency ?? null, locale)}`}
          />
          <MetricCard
            icon={<RefreshCw />}
            label={widgetSiteT(locale, "daysRemaining")}
            value={dayLabel(summary?.days_until_period_end ?? null, locale)}
            detail={widgetSiteT(locale, "currentPeriodEnds", { date: formatDate(summary?.current_period_end ?? null, locale) })}
          />
        </div>
      )}

      {(error || summary?.message) && (
        <div className="mx-6 mb-6 rounded-xl border border-amber-700/30 bg-amber-950/20 p-4 text-sm leading-6 text-amber-100">
          {translateWidgetSiteExact(locale, error || summary?.message, "billingDetailsUnavailable")}
        </div>
      )}

      <div className="flex flex-col gap-3 border-t border-white/10 bg-black/25 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm leading-6 text-zinc-400">
          {widgetSiteT(locale, "customerSafeBilling")}
        </div>
        <div className="flex flex-wrap gap-2">
          {onRefresh && (
            <button type="button" onClick={onRefresh} className="rounded-lg border border-white/10 px-4 py-3 text-sm font-black text-white">
              <RefreshCw className="mr-2 inline h-4 w-4" />
              {widgetSiteT(locale, "refresh")}
            </button>
          )}
          {action === "manage_billing" && canManageBilling ? (
            <button type="button" onClick={onManage} className="rounded-lg bg-white px-4 py-3 text-sm font-black text-black">
              {widgetSiteT(locale, "manageSubscription")}
            </button>
          ) : (
            <>
              <Link href="/widget" className="rounded-lg bg-white px-4 py-3 text-sm font-black text-black">
                {widgetSiteT(locale, "viewWidgetPlans")}
              </Link>
              <a href="mailto:info@mgautotech.de?subject=Widget%20billing%20support" className="rounded-lg border border-white/10 px-4 py-3 text-sm font-black text-white">
                {widgetSiteT(locale, "contactSupport")}
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
