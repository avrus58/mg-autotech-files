import type { Metadata } from "next";
import { LegalPageShell, LegalSection } from "@/components/legal/LegalPageShell";
import { absoluteUrl } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Impressum",
  description: "Anbieterkennzeichnung und Kontaktangaben von MG AutoTech.",
  alternates: { canonical: absoluteUrl("/impressum") },
  openGraph: null,
  twitter: null,
};

export default function ImpressumPage() {
  return (
    <LegalPageShell eyebrow="Anbieterkennzeichnung" title="Impressum">
      <LegalSection title="Angaben gemäß § 5 DDG">
        <p><strong className="text-white">MG AutoTech</strong><br />Inhaber: Melih Gökkaya<br />Böckinger Str. 32<br />70437 Stuttgart<br />Deutschland</p>
        <p>Gewerbeanmeldung nach § 14 GewO beim zuständigen Amt der Landeshauptstadt Stuttgart.</p>
      </LegalSection>

      <LegalSection title="Kontakt">
        <p>Telefon / WhatsApp: <a className="font-bold text-white hover:text-red-400" href="tel:+4915151561670">+49 151 51561670</a><br />E-Mail: <a className="font-bold text-white hover:text-red-400" href="mailto:info@mgautotech.de">info@mgautotech.de</a></p>
      </LegalSection>

      <LegalSection title="Steuerliche Angaben">
        <p>Steuernummer: 93087/00619<br />Umsatzsteuer-Identifikationsnummer gemäß § 27a UStG: DE461343520</p>
      </LegalSection>

      <LegalSection title="Verantwortlich für den Inhalt">
        <p>Verantwortlich für journalistisch-redaktionelle Inhalte nach § 18 Abs. 2 MStV: Melih Gökkaya, Böckinger Str. 32, 70437 Stuttgart.</p>
      </LegalSection>

      <LegalSection title="Verbraucherstreitbeilegung">
        <p>MG AutoTech ist nicht bereit und nicht verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.</p>
      </LegalSection>

      <LegalSection title="Haftung für Inhalte und Links">
        <p>Als Diensteanbieter sind wir für eigene Inhalte nach den allgemeinen Gesetzen verantwortlich. Trotz sorgfältiger Prüfung übernehmen wir keine Gewähr für die ständige Aktualität, Vollständigkeit und Richtigkeit sämtlicher Informationen.</p>
        <p>Diese Website kann Links zu externen Websites enthalten. Für deren Inhalte ist ausschließlich der jeweilige Anbieter verantwortlich.</p>
      </LegalSection>

      <LegalSection title="Urheberrecht">
        <p>Die durch MG AutoTech erstellten Inhalte und Werke unterliegen dem deutschen Urheberrecht. Eine Vervielfältigung, Bearbeitung oder Verwertung außerhalb der gesetzlichen Grenzen bedarf der vorherigen Zustimmung des jeweiligen Rechteinhabers.</p>
      </LegalSection>
    </LegalPageShell>
  );
}
