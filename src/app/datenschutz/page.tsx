import type { Metadata } from "next";
import { LegalPageShell, LegalSection } from "@/components/legal/LegalPageShell";
import { absoluteUrl } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Datenschutzerklärung",
  description: "Datenschutzerklärung für die MG AutoTech File-Service-Plattform und das Vehicle Selector Widget.",
  alternates: {
    canonical: absoluteUrl("/datenschutz"),
    languages: {
      de: absoluteUrl("/datenschutz"),
      en: absoluteUrl("/privacy"),
      "x-default": absoluteUrl("/privacy"),
    },
  },
};

export default function DatenschutzPage() {
  return (
    <LegalPageShell
      eyebrow="Datenschutz nach DSGVO"
      title="Datenschutzerklärung"
      updatedAt="29. August 2026"
    >
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
        <p>Die öffentliche Website und die File-Service-Anwendung werden auf einem virtuellen Server (<strong className="text-white">VPS</strong>) von <strong className="text-white">Hostinger</strong> bereitgestellt. Kundenkonten und Authentifizierung, Datenbankfunktionen sowie der Dateispeicher werden über <strong className="text-white">Supabase</strong> verarbeitet.</p>
        <p>Diese Dienste verarbeiten die für ihre jeweilige technische Funktion erforderlichen Daten. Dazu können die oben beschriebenen Konto-, Auftrags- und Dateidaten sowie technische Verbindungsdaten wie IP-Adresse, Zeitpunkt, angefragte Ressource, Browserinformationen und Sicherheitsereignisse gehören.</p>
      </LegalSection>

      <LegalSection title="5. E-Mail und Support">
        <p>Transaktions- und Benachrichtigungs-E-Mails werden über <strong className="text-white">Resend</strong> versendet. Dabei werden insbesondere Empfängeradresse, Nachrichteninhalt, Versandstatus und technische Zustellinformationen verarbeitet. Direkte Supportanfragen werden zur Bearbeitung und Dokumentation des Anliegens gespeichert.</p>
      </LegalSection>

      <LegalSection title="6. Zahlungen">
        <p>Je nach ausgewählter Zahlungsart werden Kartenzahlungen über <strong className="text-white">Stripe</strong> abgewickelt oder Banküberweisungen manuell zugeordnet. Stripe verarbeitet Zahlungs- und Transaktionsdaten in eigener datenschutzrechtlicher Verantwortung. MG AutoTech erhält grundsätzlich nur die für Zuordnung, Bestätigung, Buchhaltung und Betrugsprävention erforderlichen Zahlungsstatus- und Referenzdaten. Banküberweisungen werden anhand der übermittelten Bank- und Verwendungszweckdaten zugeordnet.</p>
      </LegalSection>

      <LegalSection title="7. Anmeldung und Google Login">
        <p>Für die Anmeldung werden technisch erforderliche Authentifizierungsinformationen und Sitzungscookies verwendet. Wenn Sie freiwillig „Mit Google fortfahren“ auswählen, werden Sie zu Google weitergeleitet; dabei verarbeitet Google die für die Anmeldung erforderlichen Daten. MG AutoTech erhält die von Google freigegebenen Basisprofildaten wie E-Mail-Adresse und Name.</p>
      </LegalSection>

      <LegalSection title="8. Cookies, lokaler Speicher und optionale Messung">
        <p>Wir verwenden technisch erforderliche Cookies und lokalen Browserspeicher für Anmeldung, Sitzungsverwaltung, Spracheinstellung, Sicherheitsfunktionen und das Speichern Ihrer Datenschutzauswahl. Analyse und Werbemessung sind standardmäßig deaktiviert und werden erst nach Ihrer aktiven Auswahl eingeschaltet.</p>
        <p>Wenn Sie der Analyse zustimmen, wird <strong className="text-white">Google Analytics</strong> auf freigegebenen öffentlichen Inhaltsseiten eingesetzt, um Seitennutzung und den sicheren Anfrageablauf zu messen. Mit einer zusätzlichen Einwilligung in die Werbemessung wird <strong className="text-white">Google Ads</strong> verwendet, um zu erkennen, ob eine Anzeige zu einer bestätigten Registrierung, Anfrage oder Zahlung führt. Personalisierte Werbung bleibt deaktiviert.</p>
        <p>An Google werden dabei nur für die Messung vorgesehene Informationen übermittelt. Dazu können der bereinigte öffentliche Seitenpfad ohne Suchparameter oder Fragment, Browser- und Geräteinformationen, der Einwilligungsstatus sowie vorhandene Kampagnen- oder Anzeigenklick-Kennungen gehören. Bei bestätigten Ergebnissen können außerdem der Ereignistyp, eine pseudonyme Kennung zur Vermeidung doppelter Zählung und bei einer bestätigten Zahlung Betrag und Währung übermittelt werden. Dateinamen, Fahrzeugdaten, E-Mail-Adressen, Kontodaten und Auftragsnummern werden nicht als Messereignis an Google übermittelt.</p>
        <p>Bei Analyse-Einwilligung verwendet MG AutoTech außerdem eine zufällige Besucherkennung und verarbeitet für die interne Kampagnenzuordnung den öffentlichen Einstiegspfad, Quelle und Medium, eine freigegebene Kampagnenbezeichnung, die reine Referrer-Domain, einen gegebenenfalls verfügbaren Ländercode und die Browsersprache. Nach erfolgreicher Anmeldung kann diese Kennung intern mit bestätigten Kontoereignissen verknüpft werden, damit Registrierungen, Anfragen und Zahlungen der jeweiligen Quelle zugeordnet werden können. Suchbegriffe und vollständige Referrer-URLs werden dafür nicht gespeichert; die Besucherkennung wird serverseitig als Einwegwert weiterverarbeitet.</p>
        <p>Sie können Ihre Auswahl jederzeit über die auf der Website erreichbaren Datenschutzeinstellungen ändern oder widerrufen. Der Widerruf wirkt für die Zukunft.</p>
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
