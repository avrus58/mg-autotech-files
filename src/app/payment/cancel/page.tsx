"use client";

import Link from "next/link";
import { ArrowLeft, CreditCard } from "lucide-react";
import { customerWorkflowExactT } from "@/lib/i18n/customer-workflow-credits-translations";
import { useActiveLocale } from "@/lib/useActiveLocale";

export default function PaymentCancelPage() {
  const locale = useActiveLocale();
  const firstPaintT = (source: string) => customerWorkflowExactT(locale, source);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#050505] px-4 text-white">
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_20%_0%,rgba(160,18,28,0.24),transparent_32%),linear-gradient(135deg,#050505,#0d0d0f_48%,#160608)]" />

      <div className="max-w-lg rounded-[2rem] border border-red-900/40 bg-red-950/20 p-8 text-center shadow-2xl shadow-black/30">
        <div role="status" aria-live="polite">
          <CreditCard
            aria-hidden="true"
            className="mx-auto mb-5 h-16 w-16 text-red-500"
          />
          <h1 className="text-4xl font-black">
            {firstPaintT("Payment cancelled")}
          </h1>
          <p className="mt-4 text-sm leading-6 text-zinc-300">
            {firstPaintT(
              "The payment was cancelled. No credits were added and you were not charged by MG AutoTech through this checkout flow."
            )}
          </p>
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/dashboard/credits"
            className="rounded-xl bg-[#b1121b] px-5 py-3 font-black text-white transition hover:bg-[#c91824]"
          >
            {firstPaintT("Try Again")}
          </Link>

          <Link
            href="/dashboard"
            className="rounded-xl border border-white/10 bg-white/[0.04] px-5 py-3 font-black text-white transition hover:bg-white/10"
          >
            <ArrowLeft aria-hidden="true" className="mr-2 inline h-4 w-4" />
            {firstPaintT("Dashboard")}
          </Link>
        </div>
      </div>
    </main>
  );
}
