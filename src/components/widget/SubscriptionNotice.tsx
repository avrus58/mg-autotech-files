"use client";

import { AlertTriangle, CreditCard } from "lucide-react";
import Link from "next/link";
import { widgetSiteT } from "@/lib/i18n/widget-site-translations";
import { useActiveLocale } from "@/lib/useActiveLocale";

export function SubscriptionNotice({
  canManageBilling,
  onManage,
}: {
  canManageBilling: boolean;
  onManage: () => void;
}) {
  const locale = useActiveLocale();

  return (
    <div className="mb-6 flex flex-col gap-4 border border-amber-700/40 bg-amber-950/20 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
        <div>
          <div className="font-black text-amber-100">{widgetSiteT(locale, "subscriptionInactiveTitle")}</div>
          <p className="mt-1 text-sm leading-6 text-amber-200/70">
            {canManageBilling
              ? widgetSiteT(locale, "subscriptionInactiveDescription")
              : widgetSiteT(locale, "billingProfileMissing")}
          </p>
        </div>
      </div>
      {canManageBilling ? (
        <button
          type="button"
          onClick={onManage}
          className="flex h-11 shrink-0 items-center justify-center rounded-lg bg-amber-400 px-4 text-sm font-black text-black"
        >
          <CreditCard className="mr-2 h-4 w-4" />
          {widgetSiteT(locale, "manageSubscription")}
        </button>
      ) : (
        <div className="flex shrink-0 flex-wrap gap-2">
          <Link href="/widget" className="flex h-11 items-center justify-center rounded-lg bg-amber-400 px-4 text-sm font-black text-black">
            {widgetSiteT(locale, "viewWidgetPlans")}
          </Link>
          <a
            href="mailto:info@mgautotech.de?subject=Widget%20billing%20support"
            className="flex h-11 items-center justify-center rounded-lg border border-amber-500/40 px-4 text-sm font-black text-amber-100"
          >
            {widgetSiteT(locale, "contactSupport")}
          </a>
        </div>
      )}
    </div>
  );
}
