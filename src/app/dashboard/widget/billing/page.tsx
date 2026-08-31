"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, CreditCard, Loader2, ShieldCheck } from "lucide-react";
import { CustomerPortalPageHeader } from "@/components/dashboard/CustomerPortalPageHeader";
import { SubscriptionSummaryPanel } from "@/components/widget/SubscriptionSummaryPanel";
import { authenticatedFetch } from "@/lib/authGuards";
import {
  translateWidgetSiteExact,
  widgetSiteT,
} from "@/lib/i18n/widget-site-translations";
import { useActiveLocale } from "@/lib/useActiveLocale";
import type { LocaleCode } from "@/lib/i18nConfig";
import type { WidgetBillingSummary } from "@/lib/widget/customerTypes";

export default function WidgetBillingPage() {
  const activeSiteLocale = useActiveLocale();
  const [loading, setLoading] = useState(false);
  const [portalNotice, setPortalNotice] = useState<{
    locale: LocaleCode;
    message: string;
    showPlanAction: boolean;
  } | null>(null);
  const [summary, setSummary] = useState<WidgetBillingSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState("");

  const loadSummary = useCallback(async () => {
    setSummaryLoading(true);
    setSummaryError("");
    try {
      const response = await authenticatedFetch("/api/stripe/widget-subscription-summary", {
        cache: "no-store",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setSummary(null);
        setSummaryError(
          translateWidgetSiteExact(
            activeSiteLocale,
            data.error,
            "billingSummaryApiFailed"
          )
        );
        return;
      }
      setSummary(data.summary ?? null);
    } catch {
      setSummary(null);
      setSummaryError(widgetSiteT(activeSiteLocale, "billingSummaryApiFailed"));
    } finally {
      setSummaryLoading(false);
    }
  }, [activeSiteLocale]);

  useEffect(() => {
    void Promise.resolve().then(loadSummary);
  }, [loadSummary]);

  async function openPortal() {
    setLoading(true);
    setPortalNotice(null);
    try {
      const response = await authenticatedFetch("/api/stripe/widget-customer-portal", {
        method: "POST",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.url) {
        setPortalNotice({
          locale: activeSiteLocale,
          message: translateWidgetSiteExact(
            activeSiteLocale,
            data.error,
            "billingPortalFailed"
          ),
          showPlanAction: data.action === "view_plans",
        });
        return;
      }
      window.location.href = data.url;
    } catch {
      setPortalNotice({
        locale: activeSiteLocale,
        message: widgetSiteT(activeSiteLocale, "billingPortalFailed"),
        showPlanAction: false,
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mg-compact-ui min-h-screen bg-[var(--mg-portal-canvas)] text-white">
      <CustomerPortalPageHeader
        eyebrow="Vehicle Widget"
        title="Widget billing"
        icon={CreditCard}
        width="6xl"
        actions={
          <Link
            href="/dashboard/widget"
            className="inline-flex h-10 items-center justify-center rounded-lg border border-white/10 px-3 text-xs font-black text-white transition hover:bg-white/[0.06] sm:px-4 sm:text-sm"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Widget dashboard
          </Link>
        }
      />

      <section className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
        <div className="border-y border-white/10 py-8">
          <h1 className="text-3xl font-black sm:text-4xl">Subscription and payments</h1>
          <p className="mt-4 max-w-3xl leading-7 text-zinc-400">
            Review the linked subscription, latest payment, next renewal and remaining period
            before opening the Stripe Customer Portal.
          </p>
          <div className="mt-6 flex items-center gap-2 text-sm text-emerald-300">
            <ShieldCheck className="h-4 w-4" />
            Secure billing managed by Stripe
          </div>
        </div>

        {portalNotice?.locale === activeSiteLocale ? (
          <div className="mt-6 border border-red-800/40 bg-red-950/20 p-4 text-sm text-red-200">
            {portalNotice.message}
          </div>
        ) : null}

        {portalNotice?.locale === activeSiteLocale && portalNotice.showPlanAction ? (
          <div className="mt-5 flex flex-wrap gap-2">
            <Link href="/widget" className="rounded-lg bg-white px-4 py-3 text-sm font-black text-black">
              View widget plans
            </Link>
            <a
              href="mailto:info@mgautotech.de?subject=Widget%20billing%20support"
              className="rounded-lg border border-white/10 px-4 py-3 text-sm font-black"
            >
              Contact support
            </a>
          </div>
        ) : null}

        <div className="mt-8">
          <SubscriptionSummaryPanel
            summary={summary}
            loading={summaryLoading}
            error={
              summaryError
            }
            canManageBilling={Boolean(summary?.billing_profile_linked)}
            onManage={openPortal}
            onRefresh={() => void loadSummary()}
          />
        </div>
        <button
          type="button"
          onClick={openPortal}
          disabled={loading || !summary?.billing_profile_linked}
          className="mt-7 flex h-13 items-center rounded-lg bg-[#b1121b] px-6 text-sm font-black disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Open billing portal"}
        </button>
      </section>
    </main>
  );
}
