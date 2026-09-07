import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const reportFontFiles = [
  "NotoSans-Regular.ttf", "NotoSans-Bold.ttf", "NotoSansSC-Regular.ttf",
  "OFL-NotoSans.txt", "OFL-NotoSansSC.txt",
];
const reportRoute = ".next/server/app/api/requests/[id]/service-report/route.js";
const standardFontsDirectory = "node_modules/pdfkit/js/standard-fonts";
const key = (file) => process.platform === "win32" ? path.resolve(file).toLowerCase() : path.resolve(file);

/**
 * Pure trace/standalone comparison, also exercised without a build by unit tests.
 * @param {{ projectRoot: string, traceDirectory: string, tracedFiles: string[], requiredFiles: string[], exists?: (file: string) => boolean }} input
 */
export function auditReportAssetList({ projectRoot, traceDirectory, tracedFiles, requiredFiles, exists = existsSync }) {
  const traced = new Set(tracedFiles.map((file) => key(path.resolve(traceDirectory, file))));
  const missing = [];
  for (const file of requiredFiles) {
    const source = path.resolve(projectRoot, file);
    if (!exists(source)) missing.push({ file, reason: "missing_source" });
    if (!traced.has(key(source))) missing.push({ file, reason: "not_traced" });
    if (!exists(path.resolve(projectRoot, ".next/standalone", file))) missing.push({ file, reason: "missing_in_standalone" });
  }
  return missing;
}

function listFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? listFiles(file) : entry.isFile() || entry.isSymbolicLink() ? [file] : [];
  });
}

/** Sharp loads native binaries and libvips shared libraries outside the JS graph. */
export function listSharpRuntimeFiles(projectRoot) {
  const imageDirectory = path.join(projectRoot, "node_modules/@img");
  const files = readdirSync(imageDirectory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("sharp-"))
    .flatMap((entry) => listFiles(path.join(imageDirectory, entry.name)))
    .map((file) => path.relative(projectRoot, file));
  assert.ok(files.some((file) => file.endsWith(".node")), "Sharp native runtime package missing.");
  return files;
}

/** No URL target, credentials, server startup, or real customer fixtures are used. */
export async function checkServiceReportBuild(projectRoot = process.cwd()) {
  projectRoot = path.resolve(projectRoot);
  const standalone = path.join(projectRoot, ".next/standalone");
  const traceDirectory = path.dirname(path.join(projectRoot, reportRoute));
  const trace = JSON.parse(readFileSync(path.join(projectRoot, `${reportRoute}.nft.json`), "utf8"));
  assert.ok(Array.isArray(trace.files) && trace.files.every((file) => typeof file === "string"), "Invalid report route trace.");
  const standardFiles = listFiles(path.join(projectRoot, standardFontsDirectory)).map((file) => path.relative(projectRoot, file));
  assert.ok(standardFiles.some((file) => file.endsWith("Helvetica.cjs")), "PDFKit standard font entry missing.");
  assert.ok(standardFiles.some((file) => file.split(path.sep).includes("chunks")), "PDFKit standard font chunks missing.");
  const sharpFiles = listSharpRuntimeFiles(projectRoot);
  const requiredFiles = [...reportFontFiles.map((file) => path.join("assets/report-fonts", file)), ...standardFiles, ...sharpFiles];
  const missing = auditReportAssetList({ projectRoot, traceDirectory, tracedFiles: trace.files, requiredFiles });
  const brandingDirectory = path.join(projectRoot, ".next/server/app/api/account/report-branding");
  const brandingTrace = JSON.parse(readFileSync(path.join(brandingDirectory, "route.js.nft.json"), "utf8"));
  assert.ok(Array.isArray(brandingTrace.files) && brandingTrace.files.every((file) => typeof file === "string"), "Invalid branding route trace.");
  missing.push(...auditReportAssetList({ projectRoot, traceDirectory: brandingDirectory, tracedFiles: brandingTrace.files, requiredFiles: sharpFiles })
    .map((entry) => ({ ...entry, route: "report-branding" })));
  if (missing.length) throw new Error(`Report build assets have ${missing.length} missing checks: ${JSON.stringify(missing.slice(0, 12))}`);

  const requireStandalone = createRequire(path.join(standalone, "package.json"));
  const modules = {};
  for (const name of ["sharp", "@react-pdf/renderer", "react"]) {
    const resolved = requireStandalone.resolve(name);
    assert.ok(key(resolved).startsWith(`${key(path.join(standalone, "node_modules"))}${path.sep}`), `${name} escaped standalone dependencies.`);
    modules[name] = resolved;
  }
  const originalFetch = globalThis.fetch;
  let forbiddenFetches = 0;
  globalThis.fetch = async (input, init) => {
    const url = new URL(typeof input === "string" ? input : input.url ?? String(input));
    // Yoga may load its embedded WASM through a data URL; this is not network I/O.
    if (url.protocol === "data:") return originalFetch(input, init);
    forbiddenFetches += 1;
    throw new Error("Network is forbidden in report build validation.");
  };
  try {
    const compiled = await requireStandalone(path.join(standalone, reportRoute));
    assert.equal(typeof compiled.routeModule?.userland?.POST, "function", "Compiled report POST is unavailable.");
    const id = "20000000-0000-4000-8000-000000000002";
    const response = await compiled.routeModule.userland.POST(new Request(`http://localhost/api/requests/${id}/service-report`, {
      method: "POST", body: JSON.stringify({ locale: "de" }),
    }), { params: Promise.resolve({ id }) });
    assert.equal(response.status, 401, "Unauthenticated compiled report route must fail closed.");
    assert.match(response.headers.get("cache-control") ?? "", /private, no-store/);

    const sharp = (await import(pathToFileURL(modules.sharp).href)).default;
    const image = await sharp({ create: { width: 4, height: 4, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 1 } } }).png().toBuffer();
    assert.equal((await sharp(image).metadata()).format, "png");
    const pdf = await import(pathToFileURL(modules["@react-pdf/renderer"]).href);
    const React = (await import(pathToFileURL(modules.react).href)).default;
    // Exercise PDFKit's dynamic standard-font loading, not just an import check.
    const document = React.createElement(pdf.Document, null,
      React.createElement(pdf.Page, { size: "A4" }, React.createElement(pdf.Text, null, "Synthetic build validation")));
    const bytes = await pdf.renderToBuffer(document);
    assert.equal(bytes.subarray(0, 5).toString("ascii"), "%PDF-");
    assert.ok(bytes.length > 100 && bytes.length < 1024 * 1024);
    assert.equal(forbiddenFetches, 0, "Report build validation attempted external fetch.");
    return { requiredAssetCount: requiredFiles.length, reportFontCount: reportFontFiles.length, pdfkitFileCount: standardFiles.length, sharpFileCount: sharpFiles.length, compiledAuthStatus: response.status, sharp: "png", pdf: "valid", externalFetches: forbiddenFetches };
  } finally {
    globalThis.fetch = originalFetch;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  checkServiceReportBuild().then((result) => console.log(JSON.stringify(result, null, 2))).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
