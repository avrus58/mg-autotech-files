"use client";

import Link from "next/link";
import { ArrowLeft, Cpu, ShieldCheck } from "lucide-react";
import { Footer } from "@/components/Footer";
import { OnlineStatus } from "@/components/OnlineStatus";

export default function Page() {
  return (
    <main className="min-h-screen bg-[#050505] text-white">
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_20%_0%,rgba(160,18,28,0.24),transparent_32%),linear-gradient(135deg,#050505,#0d0d0f_48%,#160608)]" />

      <header className="border-b border-white/10 bg-black/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-red-800/50 bg-[#111]">
              <Cpu className="h-7 w-7 text-red-600" />
            </div>
            <div>
              <div className="text-xl font-black tracking-wide">
                MG <span className="text-red-600">AUTOTECH</span>
              </div>
              <div className="text-xs text-zinc-400">Legal Information</div>
            </div>
          </Link>

          <Link
            href="/"
            className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-black text-white transition hover:bg-white/10"
          >
            <ArrowLeft className="mr-2 inline h-4 w-4" />
            Back Home
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-4xl px-4 py-12">
        <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 md:p-10">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-red-800/50 bg-red-950/25 px-4 py-2 text-sm font-semibold text-red-100">
            <ShieldCheck className="h-4 w-4 text-red-500" />
            Privacy Policy
          </div>

          <h1 className="text-4xl font-black md:text-6xl">Datenschutz</h1>

          <div className="mt-8 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5 text-sm leading-7 text-amber-100">
            Hinweis: Diese Seite ist ein technischer Platzhalter / Entwurf und
            sollte vor Veröffentlichung von einem geeigneten Rechtsberater oder
            Impressum-/Datenschutz-Generator geprüft und finalisiert werden.
          </div>

          <div className="mt-8 text-sm md:text-base">
              <p className="mt-4 leading-8 text-zinc-300">Wir verarbeiten personenbezogene Daten ausschließlich im Rahmen der Nutzung unseres Kundenportals, der Bearbeitung von Datei-Anfragen, der Zahlungsabwicklung und der Kommunikation mit Kunden.</p>
              <p className="mt-4 leading-8 text-zinc-300">Zu den verarbeiteten Daten können Name, E-Mail-Adresse, Fahrzeugdaten, Bestelldaten, Zahlungsstatus, hochgeladene Dateien und technische Logdaten gehören.</p>
              <p className="mt-4 leading-8 text-zinc-300">Zahlungen werden über externe Zahlungsdienstleister wie Stripe verarbeitet. Zahlungsdaten werden dabei direkt vom Zahlungsdienstleister verarbeitet.</p>
              <p className="mt-4 leading-8 text-zinc-300">Kundendaten und Dateien werden über technische Dienstleister wie Hosting-, Datenbank- und Storage-Anbieter verarbeitet.</p>
              <p className="mt-4 leading-8 text-zinc-300">Diese Datenschutzerklärung muss vor Live-Betrieb vollständig an die tatsächlichen Anbieter, Prozesse, Speicherfristen und Rechtsgrundlagen angepasst werden.</p>

              <div className="mt-6 grid gap-3">
                <div className="rounded-2xl border border-white/10 bg-black/25 p-4 text-sm text-zinc-300">Zweck: Kundenkonto, File-Service-Bearbeitung, Zahlungsbestätigung, Support und Sicherheit.</div>
                <div className="rounded-2xl border border-white/10 bg-black/25 p-4 text-sm text-zinc-300">Rechtsgrundlagen: Vertragserfüllung, berechtigtes Interesse und gesetzliche Pflichten.</div>
                <div className="rounded-2xl border border-white/10 bg-black/25 p-4 text-sm text-zinc-300">Betroffene Personen können Auskunft, Berichtigung, Löschung und Einschränkung der Verarbeitung verlangen.</div>
              </div>
          </div>
        </div>
      </section>

      <Footer />
      <OnlineStatus />
    </main>
  );
}
