import type { Metadata } from "next";
import { LegalPageShell, LegalSection } from "@/components/legal/LegalPageShell";
import { absoluteUrl } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Datenschutzerklärung",
  description: "Datenschutzerklärung für die MG AutoTech File-Service-Plattform und das Vehicle Selector Widget.",
  alternates: { canonical: absoluteUrl("/datenschutz") },
};

export default function DatenschutzPage() {
  return (
    <LegalPageShell eyebrow="Datenschutz nach DSGVO" title="Datenschutzerklärung">
      <LegalSection title="1. Verantwortlicher">
        <p><strong className="text-white">MG AutoTech, Inhaber Melih Gökkaya</strong><br />Böckinger Str. 32, 70437 Stuttgart, Deutschland<br />E-Mail: <a className="font-bold text-white hover:text-red-400" href="mailto:info@mgautotech.de">info@mgautotech.de</a><br />Telefon: <a className="font-bold text-white hover:text-red-400" href="tel:+4915151561670">+49 151 51561670</a></p>
      </LegalSection>

      <LegalSection title="2. Verarbeitete Daten und Zwecke">
        <p>Wir verarbeiten Stammdaten, Kontaktdaten, Kunden- und Kontokennungen, Fahrzeug- und Steuergerätedaten, Bestell- und Servicedaten, Nachrichten, Zahlungsstatus, hochgeladene Originaldateien, ausgelieferte Dateiversionen sowie technische Sicherheits- und Zugriffsprotokolle.</p>
        <p>Die Verarbeitung erfolgt zur Bereitstellung des Kundenkontos, zur Durchführung von File-Service-Aufträgen, zur Abrechnung, zur Kommunikation, zur technischen Absicherung des Portals, zur Fehleranalyse und zur Erfüllung gesetzlicher Aufbewahrungspflichten.</p>
      </LegalSection>

      <LegalSection title="3. Rechtsgrundlagen">
        <p>Rechtsgrundlagen sind insbesondere Art. 6 Abs. 1 lit. b DSGVO für Vertrag und vorvertragliche Maßnahmen, Art. 6 Abs. 1 lit. c DSGVO für rechtliche Pflichten, Art. 6 Abs. 1 lit. f DSGVO für IT-Sicherheit, Missbrauchsprävention und die zuverlässige Bereitstellung des Dienstes sowie Art. 6 Abs. 1 lit. a DSGVO, soweit eine Einwilligung eingeholt wird.</p>
      </LegalSection>

      <LegalSection title="4. Hosting, Datenbank und Dateispeicher">
        <p>Die Website wird über <strong className="text-white">Vercel</strong> bereitgestellt. Kundenkonten, Authentifizierung, Datenbankfunktionen und Dateispeicher werden über <strong className="text-white">Supabase</strong> verarbeitet. Dabei können technische Verbindungsdaten, insbesondere IP-Adresse, Zeitpunkt, angefragte Ressource, Browserinformationen und Sicherheitsereignisse, verarbeitet werden.</p>
        <p>Die Einbindung dieser Anbieter erfolgt auf Grundlage von Verträgen zur Auftragsverarbeitung und den jeweils anwendbaren Datenschutzgarantien. Soweit Daten außerhalb des Europäischen Wirtschaftsraums verarbeitet werden, erfolgt dies auf Grundlage eines Angemessenheitsbeschlusses oder geeigneter Garantien, insbesondere Standardvertragsklauseln.</p>
      </LegalSection>

      <LegalSection title="5. E-Mail und Support">
        <p>Transaktions- und Benachrichtigungs-E-Mails werden über <strong className="text-white">Resend</strong> versendet. Dabei werden insbesondere Empfängeradresse, Nachrichteninhalt, Versandstatus und technische Zustellinformationen verarbeitet. Direkte Supportanfragen werden zur Bearbeitung und Dokumentation des Anliegens gespeichert.</p>
      </LegalSection>

      <LegalSection title="6. Zahlungen">
        <p>Je nach ausgewählter Zahlungsart werden Zahlungen über <strong className="text-white">Stripe</strong> oder <strong className="text-white">PayPal</strong> abgewickelt. Diese Anbieter verarbeiten Zahlungs- und Transaktionsdaten in eigener datenschutzrechtlicher Verantwortung. MG AutoTech erhält grundsätzlich nur die für Zuordnung, Bestätigung, Buchhaltung und Betrugsprävention erforderlichen Zahlungsstatus- und Referenzdaten. Banküberweisungen werden anhand der übermittelten Bank- und Verwendungszweckdaten zugeordnet.</p>
      </LegalSection>

      <LegalSection title="7. Anmeldung und Google Login">
        <p>Für die Anmeldung werden technisch erforderliche Authentifizierungsinformationen und Sitzungscookies verwendet. Wenn Sie freiwillig „Mit Google fortfahren“ auswählen, werden Sie zu Google weitergeleitet; dabei verarbeitet Google die für die Anmeldung erforderlichen Daten. MG AutoTech erhält die von Google freigegebenen Basisprofildaten wie E-Mail-Adresse und Name.</p>
      </LegalSection>

      <LegalSection title="8. Cookies und lokaler Speicher">
        <p>Wir verwenden technisch erforderliche Cookies und lokalen Browserspeicher für Anmeldung, Sitzungsverwaltung, Spracheinstellung und die vom Nutzer gewählte Benachrichtigungseinstellung. Diese Funktionen sind für Sicherheit oder ausdrücklich angeforderte Komfortfunktionen erforderlich. Auf der File-Service-Plattform wird derzeit kein eigenes Werbe- oder Reichweiten-Tracking eingesetzt.</p>
      </LegalSection>

      <LegalSection title="9. Vehicle Selector Widget">
        <p>Beim Aufruf eines eingebetteten Widgets werden zur Auslieferung, Domainprüfung, Fehleranalyse, Durchsetzung von Nutzungslimits und Missbrauchsabwehr technische Zugriffsdaten verarbeitet. Dazu können Zeitpunkt, Pfad, freigegebene und anfragende Domain, Sprache, Browserkennung, Zugriffsstatus und ein nicht rückrechenbarer Hash der IP-Adresse gehören. Die rohe IP-Adresse wird nicht im Widget-Zugriffsprotokoll gespeichert.</p>
        <p>Bei einer Fahrzeugauswahl werden nur die für die konkrete Auswahl erforderlichen Fahrzeugdaten an die zuvor freigegebene Website übermittelt. Betreiber einbettender Websites bleiben für ihre eigene Datenschutzerklärung, Kontaktformulare und weitere Verarbeitung verantwortlich.</p>
      </LegalSection>

      <LegalSection title="10. Speicherdauer">
        <p>Wir speichern Daten nur so lange, wie dies für Konto, Auftrag, Support, Sicherheit und Abrechnung erforderlich ist. Vertrags-, Zahlungs- und Buchungsdaten werden entsprechend gesetzlicher Aufbewahrungsfristen gespeichert. Dateien und technische Protokolle werden gelöscht oder anonymisiert, sobald der jeweilige Zweck entfällt und keine vertraglichen, sicherheitsbezogenen oder gesetzlichen Gründe entgegenstehen.</p>
      </LegalSection>

      <LegalSection title="11. Ihre Rechte">
        <p>Betroffene Personen haben nach Maßgabe der DSGVO das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit und Widerspruch. Eine erteilte Einwilligung kann jederzeit mit Wirkung für die Zukunft widerrufen werden.</p>
        <p>Anfragen richten Sie bitte an <a className="font-bold text-white hover:text-red-400" href="mailto:info@mgautotech.de">info@mgautotech.de</a>. Sie haben außerdem das Recht, sich bei einer Datenschutzaufsichtsbehörde zu beschweren, insbesondere bei der für Baden-Württemberg zuständigen Aufsichtsbehörde.</p>
      </LegalSection>

      <LegalSection title="12. Datensicherheit und Aktualisierung">
        <p>Wir setzen angemessene technische und organisatorische Maßnahmen ein, darunter verschlüsselte Übertragung, rollenbasierte Zugriffe, private Dateiablagen, zeitlich begrenzte Download-Links, serverseitige Berechtigungsprüfungen und Protokollierung sicherheitsrelevanter Vorgänge.</p>
        <p>Diese Datenschutzerklärung wird angepasst, wenn sich eingesetzte Dienste oder Verarbeitungsabläufe wesentlich ändern.</p>
      </LegalSection>
    </LegalPageShell>
  );
}
