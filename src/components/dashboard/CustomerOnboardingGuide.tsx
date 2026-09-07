"use client";

import Link from "next/link";
import { useRef } from "react";
import { ArrowLeft, ArrowRight, Check, CreditCard, FileUp, Map, MessagesSquare } from "lucide-react";
import { useCustomerOnboarding } from "@/hooks/useCustomerOnboarding";
import { customerOnboardingT, type CustomerOnboardingSource } from "@/lib/i18n/customer-onboarding-translations";
import { useActiveLocale } from "@/lib/useActiveLocale";

/** Optional, non-modal introduction; never intercepts a form or an account action. */
export function CustomerOnboardingGuide() {
  const locale = useActiveLocale();
  const { visible, saving, saveFailed, step, moveToStep, dismiss, retryDismiss, hideForSession } = useCustomerOnboarding();
  const heading = useRef<HTMLHeadingElement>(null);
  const t = (source: CustomerOnboardingSource) => customerOnboardingT(locale, source);

  const steps = [
    {
      title: t("1. Prepare your original file"),
      description: t("Keep the original ECU or TCU read ready. You can add your vehicle, controller and service details when creating a request."),
      icon: FileUp,
    },
    {
      title: t("2. Choose your credits"),
      description: t("Open Buy Credits to compare the available packages or enter an amount. Your account prices are shown before payment."),
      icon: CreditCard,
      href: "/dashboard/credits",
      action: t("Open Buy Credits"),
    },
    {
      title: t("3. Create a file request"),
      description: t("Open New File Request, select your vehicle and services, then upload your original file and review the details."),
      icon: FileUp,
      href: "/new-request",
      action: t("Open New File Request"),
    },
    {
      title: t("4. Follow progress and get help"),
      description: t("Open an order to see its status, exchange messages and download the finished file when it is ready."),
      icon: MessagesSquare,
      href: "/dashboard/orders?view=all",
      action: t("Open My Orders"),
    },
  ];
  const current = steps[step];
  const Icon = current?.icon ?? Map;
  const number = new Intl.NumberFormat(locale);

  const move = (next: number) => {
    moveToStep(next);
    // The introduction does not steal focus. Once opened, announce each step.
    requestAnimationFrame(() => heading.current?.focus());
  };

  if (!visible) return null;

  return (
    <aside
      data-customer-onboarding
      role="region"
      aria-labelledby="customer-guide-title"
      className="fixed bottom-20 right-3 z-40 flex max-h-[calc(100dvh-6rem)] w-[calc(100%-1.5rem)] max-w-sm flex-col overflow-hidden rounded-xl border border-red-900/70 bg-[#101010] text-white shadow-2xl sm:bottom-24 sm:right-5 sm:max-h-[calc(100dvh-7rem)]"
    >
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4 py-2.5">
        <span className="flex min-w-0 items-center gap-2 text-xs font-semibold text-zinc-300">
          <Map aria-hidden="true" className="h-4 w-4 shrink-0 text-red-400" />
          {t("Getting started")}
        </span>
        <button
          type="button"
          disabled={saving}
          onClick={() => void dismiss("skipped")}
          className="min-h-9 shrink-0 rounded-md px-2 text-xs font-semibold text-zinc-300 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 disabled:opacity-50"
        >
          {t("Skip tour")}
        </button>
      </div>
      <div className="min-h-0 max-h-[min(55dvh,30rem)] overflow-y-auto overscroll-contain p-4">
        {step >= 0 && (
          <div aria-label={t("Tour progress")} className="mb-3 flex items-center gap-1.5">
            {steps.map((item, index) => (
              <span key={item.title} aria-hidden="true" className={`h-1 flex-1 rounded-full ${index <= step ? "bg-[#b1121b]" : "bg-white/10"}`} />
            ))}
            <span className="ml-2 text-xs tabular-nums text-zinc-400">{number.format(step + 1)} / {number.format(steps.length)}</span>
          </div>
        )}
        <div className="mb-2 flex items-start gap-2.5">
          <Icon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
          <h2 id="customer-guide-title" ref={heading} tabIndex={-1} className="min-w-0 break-words text-base font-bold leading-snug outline-none">
            {current?.title ?? t("Welcome to your workspace")}
          </h2>
        </div>
        <p className="text-sm leading-relaxed text-zinc-300">
          {current?.description ?? t("A quick tour of credits, file requests and support. You can skip it at any time.")}
        </p>
        {current?.href && (
          <Link href={current.href} className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-md border border-red-800/60 bg-red-950/30 px-3 py-2 text-sm font-semibold text-red-200 hover:bg-red-950/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400">
            {current.action}<ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0" />
          </Link>
        )}
        {saveFailed && (
          <div role="alert" className="mt-3 rounded-lg border border-amber-700/50 bg-amber-950/20 p-3 text-sm text-amber-200">
            <p>{t("Your choice could not be saved. Please try again so the tour stays dismissed on your other devices.")}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" disabled={saving} onClick={() => void retryDismiss()} className="min-h-10 rounded-md border border-amber-700/60 px-3 py-2 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 disabled:opacity-50">{t("Retry")}</button>
              <button type="button" disabled={saving} onClick={hideForSession} className="min-h-10 rounded-md px-2 py-2 underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 disabled:opacity-50">{t("Continue without saving")}</button>
            </div>
          </div>
        )}
      </div>
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-white/10 px-4 py-3" aria-busy={saving}>
        {step > 0 && (
          <button type="button" disabled={saving} onClick={() => move(step - 1)} className="mr-auto inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2 py-2 text-xs font-semibold text-zinc-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 disabled:opacity-50">
            <ArrowLeft aria-hidden="true" className="h-4 w-4 shrink-0" />{t("Previous step")}
          </button>
        )}
        <button
          type="button"
          disabled={saving}
          onClick={() => step === steps.length - 1 ? void dismiss("completed") : move(step + 1)}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[#b1121b] px-4 py-2 text-sm font-bold hover:bg-[#c91824] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 disabled:opacity-50"
        >
          {saving ? t("Saving your choice…") : step === -1 ? t("Start tour") : step === steps.length - 1 ? t("Finish tour") : t("Next step")}
          {step === steps.length - 1 ? <Check aria-hidden="true" className="h-4 w-4 shrink-0" /> : <ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0" />}
        </button>
      </div>
    </aside>
  );
}
