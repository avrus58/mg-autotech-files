import type { Metadata } from "next";
import { LegalPageShell, LegalSection } from "@/components/legal/LegalPageShell";
import { absoluteUrl } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Widerrufsbelehrung",
  description: "Informationen zum Widerrufsrecht bei Verträgen mit MG AutoTech.",
  alternates: { canonical: absoluteUrl("/widerruf") },
};

export default function WiderrufPage() {
  return (
    <LegalPageShell eyebrow="Verbraucherinformationen" title="Widerrufsbelehrung">
      <LegalSection title="Widerrufsrecht für Verbraucher">
        <p>Verbraucher haben bei einem im Fernabsatz geschlossenen Vertrag grundsätzlich das Recht, binnen vierzehn Tagen ohne Angabe von Gründen diesen Vertrag zu widerrufen. Die Widerrufsfrist beträgt vierzehn Tage ab dem Tag des Vertragsschlusses, soweit gesetzlich kein anderer Fristbeginn gilt.</p>
        <p>Für Verträge mit Unternehmern, Werkstätten und sonstigen gewerblichen Kunden besteht kein gesetzliches Verbraucherwiderrufsrecht. Das Vehicle Selector Widget wird ausschließlich im B2B-Bereich angeboten.</p>
      </LegalSection>

      <LegalSection title="Ausübung des Widerrufs">
        <p>Um Ihr Widerrufsrecht auszuüben, müssen Sie uns mittels einer eindeutigen Erklärung über Ihren Entschluss informieren:</p>
        <p><strong className="text-white">MG AutoTech, Inhaber Melih Gökkaya</strong><br />Böckinger Str. 32, 70437 Stuttgart, Deutschland<br />E-Mail: <a className="font-bold text-white hover:text-red-400" href="mailto:info@mgautotech.de">info@mgautotech.de</a><br />Telefon: +49 151 51561670</p>
        <p>Zur Wahrung der Frist genügt es, dass Sie die Widerrufserklärung vor Ablauf der Widerrufsfrist absenden.</p>
      </LegalSection>

      <LegalSection title="Folgen des Widerrufs">
        <p>Wenn Sie einen wirksam widerrufbaren Vertrag widerrufen, erstatten wir die von Ihnen erhaltenen Zahlungen unverzüglich und spätestens binnen vierzehn Tagen ab Eingang der Widerrufserklärung. Für die Rückzahlung wird grundsätzlich dasselbe Zahlungsmittel verwendet, das bei der ursprünglichen Transaktion eingesetzt wurde, sofern nichts anderes vereinbart ist.</p>
      </LegalSection>

      <LegalSection title="Vorzeitiger Beginn und digitale Leistungen">
        <p>Bei Dienstleistungen kann das Widerrufsrecht nach vollständiger Leistungserbringung erlöschen, wenn die gesetzlichen Voraussetzungen erfüllt sind und der Verbraucher vor Beginn ausdrücklich zugestimmt und die Kenntnis vom möglichen Verlust des Widerrufsrechts bestätigt hat.</p>
        <p>Bei nicht auf einem körperlichen Datenträger bereitgestellten digitalen Inhalten kann das Widerrufsrecht mit Beginn der Vertragserfüllung erlöschen, wenn die gesetzlich erforderliche ausdrückliche Zustimmung, Kenntnisbestätigung und Vertragsbestätigung vorliegen. Zwingende gesetzliche Rechte bleiben unberührt.</p>
      </LegalSection>

      <LegalSection title="Muster-Widerrufsformular">
        <div className="border border-white/10 bg-[#0a0a0a] p-5 text-sm leading-7">
          <p>An MG AutoTech, Inhaber Melih Gökkaya, Böckinger Str. 32, 70437 Stuttgart, E-Mail: info@mgautotech.de</p>
          <p>Hiermit widerrufe(n) ich/wir den von mir/uns abgeschlossenen Vertrag über die folgende Leistung:</p>
          <p>Bestellt am:<br />Name des/der Verbraucher(s):<br />Anschrift des/der Verbraucher(s):<br />Datum:<br />Unterschrift (nur bei Mitteilung auf Papier):</p>
        </div>
      </LegalSection>
    </LegalPageShell>
  );
}
