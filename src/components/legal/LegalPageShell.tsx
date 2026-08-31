import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, Cpu, Mail, ShieldCheck } from "lucide-react";

const germanLegalLinks = [
  { href: "/impressum", label: "Impressum" },
  { href: "/datenschutz", label: "Datenschutz" },
  { href: "/agb", label: "AGB" },
  { href: "/widerruf", label: "Widerruf" },
];

const englishLegalLinks = [
  { href: "/impressum", label: "Legal notice (German)" },
  { href: "/privacy", label: "Privacy" },
  { href: "/agb", label: "Terms (German)" },
  { href: "/widerruf", label: "Withdrawal information (German)" },
];

export function LegalPageShell({
  eyebrow,
  title,
  language = "de",
  updatedAt,
  children,
}: {
  eyebrow: string;
  title: string;
  language?: "de" | "en";
  updatedAt?: string;
  children: ReactNode;
}) {
  const english = language === "en";
  const legalLinks = english ? englishLegalLinks : germanLegalLinks;
  const documentLanguage = english ? "en-GB" : "de-DE";

  return (
    <>
      <script
        data-fixed-document-language={documentLanguage}
        dangerouslySetInnerHTML={{
          __html: `document.documentElement.lang=${JSON.stringify(documentLanguage)};`,
        }}
      />
      <div lang={language} data-no-translate className="min-h-screen bg-[#050505] text-white">
      <header className="border-b border-white/10 bg-black/90">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4">
          <Link href="/" className="flex min-w-0 items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-red-800/50 bg-[#111]">
              <Cpu className="h-6 w-6 text-red-600" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-lg font-black tracking-wide">
                MG <span className="text-red-600">AUTOTECH</span>
              </span>
              <span className="block text-[11px] text-zinc-500">
                {english ? "Legal information" : "Rechtliche Informationen"}
              </span>
            </span>
          </Link>
          <Link href="/" className="inline-flex h-11 items-center rounded-lg border border-white/10 px-3 text-xs font-black sm:px-4 sm:text-sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {english ? "Home" : "Startseite"}
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-10 sm:py-14">
        <div className="border-b border-white/10 pb-8">
          <div className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-red-400">
            <ShieldCheck className="h-4 w-4" />
            {eyebrow}
          </div>
          <h1 className="mt-4 text-[1.7rem] font-black leading-tight sm:text-6xl">{title}</h1>
          <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-xs font-bold text-zinc-500">
            <span>
              {english ? "Updated" : "Stand"}: {updatedAt ?? (english ? "30 June 2026" : "30. Juni 2026")}
            </span>
            <span>
              {english ? "Legally binding version: German" : "Rechtsverbindliche Fassung: Deutsch"}
            </span>
          </div>
        </div>

        <article className="py-8 text-sm leading-7 text-zinc-300 sm:text-base sm:leading-8">
          {children}
        </article>
      </main>

      <footer className="border-t border-white/10 bg-[#080808]">
        <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-8 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="font-black">MG AutoTech</div>
            <a href="mailto:info@mgautotech.de" className="mt-1 inline-flex items-center text-sm text-zinc-500 hover:text-white">
              <Mail className="mr-2 h-4 w-4" /> info@mgautotech.de
            </a>
          </div>
          <nav className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-bold text-zinc-500">
            {legalLinks.map((item) => (
              <Link key={item.href} href={item.href} className="hover:text-white">
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </footer>
      </div>
    </>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-white/10 py-7 first:border-t-0 first:pt-0">
      <h2 className="text-xl font-black text-white sm:text-2xl">{title}</h2>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}
