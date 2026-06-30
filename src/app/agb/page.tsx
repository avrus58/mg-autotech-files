import type { Metadata } from "next";
import { LegalPageShell, LegalSection } from "@/components/legal/LegalPageShell";
import { absoluteUrl } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Allgemeine Geschäftsbedingungen",
  description: "Allgemeine Geschäftsbedingungen der MG AutoTech File-Service-Plattform.",
  alternates: { canonical: absoluteUrl("/agb") },
};

export default function AgbPage() {
  return (
    <LegalPageShell eyebrow="Vertragsbedingungen" title="Allgemeine Geschäftsbedingungen">
      <LegalSection title="1. Anbieter und Geltungsbereich">
        <p>Diese Allgemeinen Geschäftsbedingungen gelten für Verträge über die MG AutoTech File-Service-Plattform zwischen MG AutoTech, Inhaber Melih Gökkaya, Böckinger Str. 32, 70437 Stuttgart, und dem jeweiligen Kunden.</p>
        <p>Das Vehicle Selector Widget wird ausschließlich Unternehmern, Werkstätten und sonstigen gewerblichen Kunden angeboten. Für Verbraucher gelten ergänzend die zwingenden gesetzlichen Verbraucherschutzvorschriften.</p>
      </LegalSection>

      <LegalSection title="2. Kundenkonto und Zugang">
        <p>Für portalbasierte Leistungen ist ein Kundenkonto erforderlich. Der Kunde muss vollständige und zutreffende Angaben machen, Zugangsdaten vertraulich behandeln und MG AutoTech bei einem vermuteten Missbrauch unverzüglich informieren.</p>
        <p>MG AutoTech darf Zugänge vorübergehend sperren, wenn konkrete Anhaltspunkte für Missbrauch, Zahlungsstörungen, unzulässige Nutzung oder eine Gefährdung der Plattform bestehen.</p>
      </LegalSection>

      <LegalSection title="3. Vertragsschluss und Leistungsumfang">
        <p>Die Darstellung von Leistungen und Preisen ist noch kein verbindliches Angebot. Ein Vertrag kommt zustande, wenn der Kunde eine Bestellung oder Dateianfrage absendet und MG AutoTech diese annimmt oder mit der Ausführung beginnt.</p>
        <p>Der konkrete Leistungsumfang ergibt sich aus der gewählten Serviceart, den übermittelten Fahrzeug- und Steuergerätedaten, der Originaldatei, den Auftragsnotizen und gegebenenfalls ergänzenden Vereinbarungen im Kundenportal.</p>
      </LegalSection>

      <LegalSection title="4. Mitwirkungspflichten des Kunden">
        <p>Der Kunde stellt korrekte Fahrzeug-, Motor-, ECU-/TCU-, Hardware-, Software- und Lesemethodendaten sowie eine technisch geeignete Originaldatei bereit. Er prüft vor und nach der Verwendung den technischen Zustand des Fahrzeugs und beachtet Flash-Anweisungen, Spannungsversorgung, Checksummen und erforderliche Backups.</p>
        <p>Der Kunde bestätigt, dass er zur Übermittlung und Bearbeitung der hochgeladenen Daten und Dateien berechtigt ist. Fehlerhafte oder unvollständige Angaben können zu Rückfragen, Verzögerungen oder Ablehnung des Auftrags führen.</p>
      </LegalSection>

      <LegalSection title="5. Preise, Credits und Zahlung">
        <p>Es gelten die im Portal vor Abschluss des jeweiligen Vorgangs angezeigten Preise und Credit-Werte. Credits dienen als plattforminternes Abrechnungsguthaben. Zahlungsarten und deren Verfügbarkeit werden im Checkout angezeigt.</p>
        <p>Eine Auszahlung nicht verbrauchter Credits ist ausgeschlossen, soweit keine zwingenden gesetzlichen Ansprüche bestehen. Gesetzliche Erstattungs-, Gewährleistungs- und Widerrufsrechte bleiben unberührt.</p>
      </LegalSection>

      <LegalSection title="6. Bearbeitung, Lieferung und Revision">
        <p>Angegebene Bearbeitungszeiten sind unverbindliche Erfahrungswerte. Komplexität, Datenqualität, ECU-/TCU-Typ, Auslastung und notwendige Rückfragen können die Bearbeitungszeit verändern.</p>
        <p>Fertige Dateien werden über den geschützten Auftragsbereich bereitgestellt. Der Kunde muss die Datei dem richtigen Auftrag und Fahrzeug zuordnen und vor Verwendung die angezeigten Hinweise kontrollieren. Revisionen werden im Rahmen des ursprünglichen Auftrags geprüft; wesentliche Änderungen des Leistungsumfangs können einen neuen Auftrag erfordern.</p>
      </LegalSection>

      <LegalSection title="7. Zulässige Nutzung und Straßenverkehr">
        <p>Der Kunde ist für die rechtmäßige Verwendung der beauftragten Softwareänderung im jeweiligen Land und Einsatzzweck verantwortlich. Änderungen an abgas-, sicherheits- oder zulassungsrelevanten Systemen können im öffentlichen Straßenverkehr unzulässig sein und Betriebserlaubnis, Versicherungsschutz, Garantie oder Gewährleistung beeinflussen.</p>
        <p>Als Motorsport-, Prüfstands-, Export-, Diagnose- oder Offroad-Lösung bezeichnete Leistungen dürfen nur im rechtlich zulässigen Rahmen verwendet werden.</p>
      </LegalSection>

      <LegalSection title="8. Vehicle Selector Widget (B2B)">
        <p>Das Widget ist ein gehosteter Softwaredienst für eine freigegebene Website-Domain. Abonnement, Preis, Leistungsgrenzen und Abrechnungsintervall werden vor Vertragsschluss angezeigt. Das Abonnement läuft bis zur Kündigung über den bereitgestellten Abrechnungsbereich weiter.</p>
        <p>Automatisierter Datenexport, Scraping, systematisches Kopieren, Weiterverkauf der Daten, Umgehung von Nutzungslimits und Einsatz auf nicht freigegebenen Domains sind untersagt. Domainwechsel bedürfen einer Freigabe. Datenabdeckung und einzelne Fahrzeugangaben können sich durch Wartung und Datenbankupdates ändern.</p>
      </LegalSection>

      <LegalSection title="9. Verfügbarkeit und Wartung">
        <p>MG AutoTech bemüht sich um eine hohe Verfügbarkeit, schuldet jedoch keine ununterbrochene Erreichbarkeit. Wartung, Sicherheitsmaßnahmen, Störungen von Telekommunikations- oder Drittanbietern sowie Ereignisse außerhalb des Einflussbereichs können zu vorübergehenden Einschränkungen führen.</p>
      </LegalSection>

      <LegalSection title="10. Mängelrechte und Haftung">
        <p>Die gesetzlichen Mängelrechte bleiben unberührt. MG AutoTech haftet unbeschränkt bei Vorsatz, grober Fahrlässigkeit, Verletzung von Leben, Körper oder Gesundheit sowie in Fällen zwingender gesetzlicher Haftung.</p>
        <p>Bei leicht fahrlässiger Verletzung wesentlicher Vertragspflichten ist die Haftung auf den vertragstypischen, vorhersehbaren Schaden begrenzt. Eine Haftung für Schäden aufgrund falscher Kundendaten, ungeeigneter Hardware, fehlerhafter Flash-Vorgänge außerhalb des Einflussbereichs von MG AutoTech oder unzulässiger Nutzung besteht nur nach Maßgabe der gesetzlichen Vorschriften.</p>
      </LegalSection>

      <LegalSection title="11. Schlussbestimmungen">
        <p>Es gilt deutsches Recht unter Ausschluss des UN-Kaufrechts. Für Kaufleute, juristische Personen des öffentlichen Rechts und öffentlich-rechtliche Sondervermögen ist Stuttgart Gerichtsstand, soweit gesetzlich zulässig.</p>
        <p>Sollte eine einzelne Bestimmung unwirksam sein oder werden, bleibt die Wirksamkeit der übrigen Bestimmungen unberührt.</p>
      </LegalSection>
    </LegalPageShell>
  );
}
