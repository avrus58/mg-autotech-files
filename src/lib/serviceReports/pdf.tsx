import React from "react";
import path from "node:path";
import { intlLocaleByCode, type LocaleCode } from "@/lib/i18nConfig";
import { serviceReportT } from "@/lib/i18n/service-report-translations";
import type { ServiceReportSnapshot } from "./model";

// Files are bundled with the server. Rendering never fetches a remote font/image.
let fontsRegistered = false;
let fontPreparation: Promise<void> | undefined;
type PdfRuntime = typeof import("@react-pdf/renderer");
function registerReportFonts({ Font }: PdfRuntime) {
  if (fontsRegistered) return;
  const directory = path.join(process.cwd(), "assets", "report-fonts");
  Font.register({ family: "ReportSans", fonts: [
    { src: path.join(directory, "NotoSans-Regular.ttf"), fontWeight: 400 },
    { src: path.join(directory, "NotoSans-Bold.ttf"), fontWeight: 700 },
  ] });
  Font.register({ family: "ReportCJK", src: path.join(directory, "NotoSansSC-Regular.ttf") });
  // No English-only hyphenation rules applied to translated or technical words.
  Font.registerHyphenationCallback((word) => Array.from(word).some((char) => /\p{Script=Han}/u.test(char)) ? Array.from(word) : [word]);
  fontsRegistered = true;
}

async function prepareReportFonts(pdf: PdfRuntime) {
  registerReportFonts(pdf);
  if (!fontPreparation) {
    const prepareFont = async (fontFamily: "ReportSans" | "ReportCJK", fontWeight: 400 | 700) => {
      const descriptor = { fontFamily, fontWeight };
      await pdf.Font.load(descriptor);
      const font = pdf.Font.getFont(descriptor).data;
      if (!font) throw new Error("Report font unavailable.");
      // Fontkit caches composite component glyphs without Unicode if their
      // outline is read first (e.g. dotless i inside accented Latin glyphs).
      // Seed the public cmap before any layout/path read so later reports retain
      // both the glyph and searchable Unicode, irrespective of locale order.
      // Do not preseed CJK: its compatibility radicals intentionally share glyph
      // IDs with unified ideographs and must keep the actual input character.
      if (fontFamily === "ReportSans") {
        for (const codePoint of font.characterSet) {
          if (codePoint <= 0x052f) font.glyphForCodePoint(codePoint);
        }
      }
    };
    fontPreparation = Promise.all([
      prepareFont("ReportSans", 400),
      prepareFont("ReportSans", 700),
      prepareFont("ReportCJK", 400),
    ]).then(() => undefined).catch((error) => {
      fontPreparation = undefined;
      throw error;
    });
  }
  await fontPreparation;
}

const red = "#b1121b";
const makeStyles = ({ StyleSheet }: PdfRuntime) => StyleSheet.create({
  page: { paddingTop: 36, paddingBottom: 55, paddingHorizontal: 40, fontFamily: ["ReportSans", "ReportCJK"], fontSize: 9, color: "#18181b", lineHeight: 1.3 },
  brand: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 2, borderBottomColor: red, paddingBottom: 16, marginBottom: 18 },
  brandText: { flexGrow: 1, flexShrink: 1, paddingRight: 18 },
  eyebrow: { color: red, fontSize: 8, fontWeight: 700, marginBottom: 4 },
  workshop: { fontSize: 19, fontWeight: 700, lineHeight: 1.25 },
  logo: { width: 64, height: 54, objectFit: "contain" },
  title: { fontSize: 22, lineHeight: 1.3, fontWeight: 700, marginBottom: 8 },
  subdued: { color: "#62626e", fontSize: 9 },
  reference: { flexDirection: "row", gap: 14, marginTop: 12, marginBottom: 15, backgroundColor: "#f4f4f5", padding: 10, borderRadius: 5 },
  meta: { flex: 1, minWidth: 0 },
  metaLabel: { color: "#62626e", fontSize: 7.5, marginBottom: 3 },
  metaValue: { fontSize: 9, fontWeight: 700 },
  section: { marginBottom: 12 },
  sectionTitle: { fontSize: 11, lineHeight: 1.3, fontWeight: 700, marginBottom: 7, borderBottomWidth: 0.5, borderBottomColor: "#dedee3", paddingBottom: 4 },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  field: { width: "50%", paddingRight: 15, paddingBottom: 6 },
  fieldLabel: { color: "#62626e", fontSize: 7.5, marginBottom: 2 },
  fieldValue: { fontSize: 9 },
  services: { flexDirection: "row", flexWrap: "wrap", gap: 5 },
  service: { backgroundColor: "#f9eeee", color: "#76101a", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 3, maxWidth: "100%" },
  tableHeader: { flexDirection: "row", padding: 9, backgroundColor: "#202025", color: "#ffffff", borderTopLeftRadius: 4, borderTopRightRadius: 4, fontSize: 8 },
  tableRow: { flexDirection: "row", padding: 10, borderBottomWidth: 0.5, borderBottomColor: "#dedee3" },
  tableLabel: { width: "31%", fontWeight: 700 },
  tableCell: { width: "23%" },
  after: { width: "23%", color: red, fontWeight: 700 },
  source: { backgroundColor: "#f4f4f5", padding: 10, marginTop: 8, borderRadius: 4 },
  sourceLabel: { fontSize: 8, fontWeight: 700, marginBottom: 3 },
  note: { fontSize: 8, color: "#51515d" },
  footer: { position: "absolute", top: 806, height: 1, left: 40, right: 40, borderTopWidth: 0.5, borderTopColor: "#dedee3" },
  footerBrand: { position: "absolute", top: 813, left: 40, width: 325, fontSize: 7, lineHeight: 1.2, color: "#71717a" },
  pageNumber: { position: "absolute", top: 813, right: 40, width: 170, textAlign: "right", fontSize: 7, lineHeight: 1.2, color: "#71717a" },
});

function technicalText(value: string, singleLine = false) {
  // Strip invisible bidi/control directives, not international letters or accents.
  const clean = value.normalize("NFC").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g, "");
  const text = singleLine ? clean.replace(/\s+/gu, " ").trim() : clean;
  // An imported ECU/name can be one 512-character token. Explicit line breaks
  // preserve every character without adding a misleading hyphen to identifiers.
  return text.replace(/\S{25,}/gu, (token) => {
    const characters = Array.from(token);
    return Array.from({ length: Math.ceil(characters.length / 20) }, (_, index) => characters.slice(index * 20, (index + 1) * 20).join("")).join("\n");
  });
}

function ServiceReportDocument({ snapshot, locale, logo, pdf }: { snapshot: ServiceReportSnapshot; locale: LocaleCode; logo?: Buffer | null; pdf: PdfRuntime }) {
  const { Document, Image, Page, Text, View } = pdf;
  const styles = makeStyles(pdf);
  const t = (key: Parameters<typeof serviceReportT>[1]) => serviceReportT(locale, key);
  const number = new Intl.NumberFormat(intlLocaleByCode[locale], { maximumFractionDigits: 1 });
  const date = new Intl.DateTimeFormat(intlLocaleByCode[locale], { dateStyle: "medium", timeZone: "UTC" }).format(new Date(snapshot.issuedAt));
  const value = (text: string | null) => text ? technicalText(text, true) : t("notRecorded");
  const metric = (amount: number | null, unit: string) => amount === null ? t("notRecorded") : `${number.format(amount)} ${unit}`;
  const change = (before: number | null, after: number | null, unit: string) => before === null || after === null ? t("notRecorded") : `${after > before ? "+" : ""}${number.format(after - before)} ${unit}`;
  const p = snapshot.performance;
  const hasPerformance = [p.beforeHp, p.afterHp, p.beforeNm, p.afterNm].some((amount) => amount !== null);
  const sourceLabel = p.source === "measured" ? t("measured") : p.source === "datalog_estimate" ? t("datalogEstimate") : p.source === "catalog_reference" ? t("catalogReference") : p.source === "manually_declared" ? t("manuallyDeclared") : t("notRecorded");
  const fields = [
    [t("brand"), snapshot.vehicle.brand], [t("model"), snapshot.vehicle.model],
    [t("generation"), snapshot.vehicle.generation], [t("engine"), snapshot.vehicle.engine],
    [t("year"), snapshot.vehicle.year], [t("ecu"), snapshot.vehicle.ecu],
    [t("gearbox"), snapshot.vehicle.gearbox], [t("licensePlate"), snapshot.vehicle.licensePlate],
  ];
  return <Document title={t("reportTitle")} author={snapshot.workshop.name ?? "MG AutoTech"} subject={t("reportSubtitle")} language={intlLocaleByCode[locale]} creator="MG AutoTech" creationDate={new Date(snapshot.issuedAt)} modificationDate={new Date(snapshot.issuedAt)}>
    <Page size="A4" style={styles.page}>
      <View style={styles.brand} wrap={false}>
        <View style={styles.brandText}><Text style={styles.eyebrow}>{t("workshop")}</Text><Text style={styles.workshop}>{value(snapshot.workshop.name)}</Text></View>
        {/* React-PDF Image is not an HTML img and has no alt prop; workshop identity is adjacent text. */}
        {/* eslint-disable-next-line jsx-a11y/alt-text */}
        {logo ? <Image src={{ data: logo, format: "png" }} style={styles.logo} /> : null}
      </View>
      <Text style={styles.title}>{t("reportTitle")}</Text>
      <Text style={styles.subdued}>{t("reportSubtitle")}</Text>
      <View style={styles.reference} wrap={false}>
        <View style={styles.meta}><Text style={styles.metaLabel}>{t("reportReference")}</Text><Text style={styles.metaValue}>{snapshot.orderId.toUpperCase()}</Text></View>
        <View style={{ width: 60 }}><Text style={styles.metaLabel}>{t("revision")}</Text><Text style={styles.metaValue}>{number.format(snapshot.revision)}</Text></View>
        <View style={{ width: 94 }}><Text style={styles.metaLabel}>{t("issuedAt")}</Text><Text style={styles.metaValue}>{date}</Text></View>
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle} minPresenceAhead={45}>{t("vehicle")}</Text>
        <View style={styles.grid}>{fields.map(([label, text], index) => <View key={index} style={styles.field} wrap={false}><Text style={styles.fieldLabel}>{label}</Text><Text style={styles.fieldValue}>{value(text)}</Text></View>)}</View>
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle} minPresenceAhead={30}>{t("requestedServices")}</Text>
        <View style={styles.services}>{snapshot.requestedServices.length ? snapshot.requestedServices.map((service, index) => <Text key={index} style={styles.service}>{technicalText(service, true)}</Text>) : <Text style={styles.subdued}>{t("notRecorded")}</Text>}</View>
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle} minPresenceAhead={30}>{t("performedServices")}</Text>
        <View style={styles.services}>{snapshot.performedServices.length ? snapshot.performedServices.map((service, index) => <Text key={index} style={styles.service}>{technicalText(service)}</Text>) : <Text style={styles.subdued}>{t("noConfirmedServices")}</Text>}</View>
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle} minPresenceAhead={100}>{t("performance")}</Text>
        {hasPerformance ? <View><View wrap={false}>
          <View style={styles.tableHeader}><Text style={styles.tableLabel}>{t("performance")}</Text><Text style={styles.tableCell}>{t("before")}</Text><Text style={styles.tableCell}>{t("after")}</Text><Text style={styles.tableCell}>{t("change")}</Text></View>
          <View style={styles.tableRow}><Text style={styles.tableLabel}>{t("power")}</Text><Text style={styles.tableCell}>{metric(p.beforeHp, "HP")}</Text><Text style={styles.after}>{metric(p.afterHp, "HP")}</Text><Text style={styles.tableCell}>{change(p.beforeHp, p.afterHp, "HP")}</Text></View>
          <View style={styles.tableRow}><Text style={styles.tableLabel}>{t("torque")}</Text><Text style={styles.tableCell}>{metric(p.beforeNm, "Nm")}</Text><Text style={styles.after}>{metric(p.afterNm, "Nm")}</Text><Text style={styles.tableCell}>{change(p.beforeNm, p.afterNm, "Nm")}</Text></View>
          </View><View style={styles.source}><Text style={styles.sourceLabel} minPresenceAhead={18}>{sourceLabel}</Text><Text style={styles.note}>{technicalText(p.sourceNote)}</Text></View>
        </View> : <Text style={styles.subdued}>{t("noPerformance")}</Text>}
      </View>
      {snapshot.customerNote ? <View style={styles.section}><Text style={styles.sectionTitle} minPresenceAhead={35}>{t("customerNote")}</Text><Text>{technicalText(snapshot.customerNote)}</Text></View> : null}
      <Text style={styles.note}>{t("footerNote")}</Text>
      <View style={styles.footer} fixed />
      <Text style={styles.footerBrand} fixed>{t("preparedBy")} MG AutoTech</Text>
      <Text style={styles.pageNumber} fixed render={({ pageNumber, totalPages }) => serviceReportT(locale, "pageNumber", { page: pageNumber, total: totalPages })} />
    </Page>
  </Document>;
}

let activeRenders = 0;
export async function renderServiceReportPdf(snapshot: ServiceReportSnapshot, locale: LocaleCode, logo?: Buffer | null): Promise<Buffer> {
  if (activeRenders >= 2) throw new Error("Report renderer is busy.");
  activeRenders += 1;
  try {
    const pdf = await import("@react-pdf/renderer");
    await prepareReportFonts(pdf);
    return await pdf.renderToBuffer(<ServiceReportDocument snapshot={snapshot} locale={locale} logo={logo} pdf={pdf} />);
  } finally {
    activeRenders -= 1;
  }
}
