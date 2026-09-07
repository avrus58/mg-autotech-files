import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { supportedLocales } from "../src/lib/i18nConfig";
import { renderServiceReportPdf } from "../src/lib/serviceReports/pdf";
import { reportFixture } from "../tests/helpers/service-report-fixture";

async function main() {
  const output = path.resolve(".autopilot/runtime/service-reports/pdfs");
  await mkdir(output, { recursive: true });
  const logo = await sharp({ create: { width: 128, height: 128, channels: 4, background: { r: 177, g: 18, b: 27, alpha: 1 } } }).png().toBuffer();
  for (const { code } of supportedLocales) {
    const pdf = await renderServiceReportPdf(reportFixture, code, logo);
    await writeFile(path.join(output, `demo-${code}.pdf`), pdf);
    process.stdout.write(`${code}: ${pdf.length} bytes\n`);
  }
  const empty = structuredClone(reportFixture);
  empty.workshop.name = null;
  empty.performedServices = [];
  empty.performance = { beforeHp: null, afterHp: null, beforeNm: null, afterNm: null, source: null, sourceNote: "" };
  await writeFile(path.join(output, "demo-empty.pdf"), await renderServiceReportPdf(empty, "en"));
  const long = structuredClone(reportFixture);
  long.workshop.name = ("DEMO workshop\n".repeat(12) + "W".repeat(300)).slice(0, 512);
  long.vehicle.engine = "W".repeat(512);
  long.performedServices = Array.from({ length: 30 }, (_, index) => `DEMO ${index + 1} - ${"Technical service scope ".repeat(5)}`);
  long.customerNote = "DEMO long note for page wrapping. ".repeat(50);
  long.performance.sourceNote = Array.from({ length: 30 }, (_, i) => `DEMO source line ${i + 1} - ${"W".repeat(35)}`).join("\n");
  await writeFile(path.join(output, "demo-long.pdf"), await renderServiceReportPdf(long, "de", logo));
}
void main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.message : "Fixture rendering failed"}\n`); process.exitCode = 1; });
