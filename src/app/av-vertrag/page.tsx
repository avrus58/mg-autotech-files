import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, FileCheck2, Mail, ShieldCheck } from "lucide-react";

export const metadata: Metadata = {
  title: "Auftragsverarbeitung",
  description: "Informationen zur Auftragsverarbeitung für gewerbliche MG AutoTech Widget-Kunden.",
  alternates: null,
  openGraph: null,
  twitter: null,
  robots: { index: false, follow: false },
};

export default function ProcessingAgreementPage() {
  return (
    <>
    <script
      data-fixed-document-language="de-DE"
      dangerouslySetInnerHTML={{
        __html: 'document.documentElement.lang="de-DE";',
      }}
    />
    <div lang="de" data-no-translate className="min-h-screen bg-[#050505] text-white">
      <header className="border-b border-white/10 bg-black/90">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-4">
          <div className="flex items-center gap-3 font-black">
            <ShieldCheck className="h-7 w-7 text-red-500" /> MG <span className="text-red-500">AUTOTECH</span>
          </div>
          <Link href="/datenschutz" className="inline-flex h-11 items-center rounded-lg border border-white/10 px-4 text-sm font-black">
            <ArrowLeft className="mr-2 h-4 w-4" /> Datenschutz
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-12 sm:py-16">
        <FileCheck2 className="h-10 w-10 text-red-500" />
        <div className="mt-5 text-xs font-black uppercase tracking-[0.18em] text-red-400">B2B Datenschutz</div>
        <h1 className="mt-3 text-4xl font-black sm:text-6xl">Auftragsverarbeitung nach Art. 28 DSGVO</h1>
        <p className="mt-6 max-w-3xl text-base leading-8 text-zinc-400">Soweit MG AutoTech bei der Bereitstellung des Vehicle Selector Widgets personenbezogene Daten im Auftrag eines gewerblichen Kunden verarbeitet, stellen wir eine auf den Kunden und den tatsächlichen Einsatz abgestimmte Vereinbarung zur Auftragsverarbeitung bereit.</p>

        <section className="mt-10 grid gap-px overflow-hidden border border-white/10 bg-white/10 md:grid-cols-3">
          <Info title="Gegenstand" text="Gehostetes Widget, Domainprüfung, technische Bereitstellung und Sicherheitsprotokolle." />
          <Info title="Schutzmaßnahmen" text="Zugriffskontrolle, verschlüsselte Übertragung, Rollenmodell, Limits und Protokollierung." />
          <Info title="Unterauftragnehmer" text="Die eingesetzten Hosting-, Datenbank- und Kommunikationsanbieter werden im Vertrag aufgeführt." />
        </section>

        <section className="mt-10 border-y border-white/10 py-8">
          <h2 className="text-2xl font-black">AV-Vereinbarung anfordern</h2>
          <p className="mt-3 max-w-3xl leading-7 text-zinc-400">Senden Sie Firmenname, Anschrift, Ansprechpartner und die für das Widget vorgesehene Domain. Wir stellen die Vereinbarung zur Prüfung und zum Abschluss bereit.</p>
          <a href="mailto:info@mgautotech.de?subject=AV-Vertrag%20Vehicle%20Selector%20Widget" className="mt-6 inline-flex h-12 items-center rounded-lg bg-[#b1121b] px-5 text-sm font-black">
            <Mail className="mr-2 h-4 w-4" /> AV-Vertrag anfordern
          </a>
        </section>
      </main>
    </div>
    </>
  );
}

function Info({ title, text }: { title: string; text: string }) {
  return (
    <div className="bg-[#080808] p-5 sm:p-6">
      <h2 className="font-black">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-zinc-500">{text}</p>
    </div>
  );
}
