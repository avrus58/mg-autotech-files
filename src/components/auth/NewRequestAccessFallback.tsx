import { customerPortalFirstPaintT } from "@/lib/i18n/customer-portal-first-paint";
import type { LocaleCode } from "@/lib/i18nConfig";

export function NewRequestAccessFallback({ locale }: { locale: LocaleCode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#050505] px-4 text-white">
      <p role="status" aria-live="polite" className="text-sm font-bold text-zinc-400">
        {customerPortalFirstPaintT(locale, "Secure customer access")}
      </p>
    </main>
  );
}
