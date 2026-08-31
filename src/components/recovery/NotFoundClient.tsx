"use client";

import Link from "next/link";
import { ArrowLeft, SearchX } from "lucide-react";
import {
  recoveryTranslations,
  useRecoveryLocale,
} from "@/lib/i18n/recovery-translations";
import { getLocalizedPublicHref } from "@/lib/i18nRoutes";

export function NotFoundClient() {
  const locale = useRecoveryLocale();
  if (!locale) {
    return (
      <main
        aria-busy="true"
        className="grid min-h-[75vh] place-items-center bg-[#050505] px-4 py-16 text-white"
      >
        <span className="text-sm font-black tracking-[0.18em]">MG AUTOTECH</span>
      </main>
    );
  }

  const copy = recoveryTranslations[locale];

  return (
    <main
      lang={locale}
      className="grid min-h-[75vh] place-items-center bg-[#050505] px-4 py-16 text-white"
    >
      <section className="w-full max-w-xl rounded-2xl border border-white/10 bg-[#0a0a0b] p-7 text-center shadow-2xl shadow-black/40 sm:p-10">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-red-500/25 bg-red-950/25 text-red-300">
          <SearchX className="h-6 w-6" aria-hidden="true" />
        </span>
        <p className="mt-5 text-xs font-black uppercase tracking-[0.2em] text-red-400">
          {copy.notFoundEyebrow}
        </p>
        <h1 className="mt-3 text-2xl font-black sm:text-3xl">
          {copy.notFoundTitle}
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-zinc-400">
          {copy.notFoundDescription}
        </p>
        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            href={getLocalizedPublicHref("/", locale)}
            className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[#b1121b] px-5 text-sm font-black transition hover:bg-[#c91824] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
          >
            <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
            {copy.home}
          </Link>
          <Link
            href={getLocalizedPublicHref("/services", locale)}
            className="inline-flex min-h-11 items-center justify-center rounded-lg border border-white/10 px-5 text-sm font-black text-zinc-100 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
          >
            {copy.services}
          </Link>
        </div>
      </section>
    </main>
  );
}
