"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, CreditCard, Loader2, ShieldCheck } from "lucide-react";
import { SubscriptionSummaryPanel } from "@/components/widget/SubscriptionSummaryPanel";
import { authenticatedFetch } from "@/lib/authGuards";
import type { WidgetBillingSummary } from "@/lib/widget/customerTypes";

export default function WidgetBillingPage() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [showPlanAction, setShowPlanAction] = useState(false);
  const [summary, setSummary] = useState<WidgetBillingSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState("");

  const loadSummary = useCallback(async () => {
    setSummaryLoading(true);
    setSummaryError("");
    const response = await authenticatedFetch("/api/stripe/widget-subscription-summary", {
      cache: "no-store",
    });
    const data = await response.json().catch(() => ({}));
    setSummaryLoading(false);
    if (!response.ok) {
      setSummaryError(data.error || "Billing summary could not be loaded.");
      return;
    }
    setSummary(data.summary ?? null);
  }, []);

  useEffect(() => {
    void Promise.resolve().then(loadSummary);
  }, [loadSummary]);

  async function openPortal() {
    setLoading(true);
    setMessage("");
    setShowPlanAction(false);
    const response = await authenticatedFetch("/api/stripe/widget-customer-portal", {
      method: "POST",
    });
    const data = await response.json();
    setLoading(false);
    if (!response.ok || !data.url) {
      setMessage(data.error || "Billing portal could not be opened. If this widget was created manually, contact MG AutoTech support.");
      setShowPlanAction(data.action === "view_plans");
      return;
    }
    window.location.href = data.url;
  }

  return <main data-no-translate className="min-h-screen bg-[#050505] p-4 text-white"><section className="mx-auto w-full max-w-5xl py-10"><Link href="/dashboard/widget" className="text-sm font-black text-zinc-400"><ArrowLeft className="mr-2 inline h-4 w-4" />Widget dashboard</Link><div className="mt-8 border-y border-white/10 py-8"><CreditCard className="h-10 w-10 text-red-500" /><h1 className="mt-5 text-4xl font-black">Widget billing</h1><p className="mt-4 max-w-3xl leading-7 text-zinc-400">Review the linked subscription, latest payment, next renewal and remaining period before opening the Stripe Customer Portal.</p><div className="mt-6 flex items-center gap-2 text-sm text-emerald-300"><ShieldCheck className="h-4 w-4" />Secure billing managed by Stripe</div></div>{message && <div className="mt-6 border border-red-800/40 bg-red-950/20 p-4 text-sm text-red-200">{message}</div>}{showPlanAction && <div className="mt-5 flex flex-wrap gap-2"><Link href="/widget" className="rounded-lg bg-white px-4 py-3 text-sm font-black text-black">View widget plans</Link><a href="mailto:info@mgautotech.de?subject=Widget%20billing%20support" className="rounded-lg border border-white/10 px-4 py-3 text-sm font-black">Contact support</a></div>}<div className="mt-8"><SubscriptionSummaryPanel summary={summary} loading={summaryLoading} error={summaryError} canManageBilling={Boolean(summary?.billing_profile_linked)} onManage={openPortal} onRefresh={() => void loadSummary()} /></div><button onClick={openPortal} disabled={loading || !summary?.billing_profile_linked} className="mt-7 flex h-13 items-center rounded-lg bg-[#b1121b] px-6 text-sm font-black disabled:cursor-not-allowed disabled:opacity-50">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Open billing portal"}</button></section></main>;
}
