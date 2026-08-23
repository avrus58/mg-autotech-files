import { readFileSync, readdirSync, statSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { resolve } from "node:path";

const manifestPath = resolve(
  process.cwd(),
  ".next",
  "server",
  "app",
  "page_client-reference-manifest.js"
);

let manifest;
try {
  manifest = readFileSync(manifestPath, "utf8");
} catch {
  console.error("Performance budget requires a completed `npm run build` first.");
  process.exit(1);
}

const legacyPageEntry = manifest.match(
  /"entryJSFiles":\{[\s\S]*?"[^"\n]*\/src\/app\/page":\[(?<chunks>[^\]]*)\]/
);

const publicSnapshotRuntimeFiles = [
  "src/components/tools/PublicLogSnapshot.tsx",
  "src/lib/analyzePublicLogSnapshotInBrowser.ts",
  "src/lib/publicLogSnapshot.ts",
  "src/workers/publicLogSnapshot.worker.ts",
];
const forbiddenPublicSnapshotDependencies = [
  "@/components/dashboard/LogAnalysisStudio",
  "@/lib/analyzeLogStudioInBrowser",
  "@/lib/logAnalysisStudio",
  "@/lib/performanceReport",
];
const publicSnapshotDependencyLeaks = publicSnapshotRuntimeFiles.flatMap((file) => {
  const source = readFileSync(resolve(process.cwd(), file), "utf8");
  return forbiddenPublicSnapshotDependencies
    .filter((dependency) => source.includes(dependency))
    .map((dependency) => `${dependency} in ${file}`);
});

if (publicSnapshotDependencyLeaks.length) {
  console.error(
    `Full customer datalog runtime leaked into the public snapshot source graph: ${publicSnapshotDependencyLeaks.join(", ")}`
  );
  process.exit(1);
}

function readCurrentWebpackChunks() {
  const assignment = 'globalThis.__RSC_MANIFEST["/page"]=';
  const assignmentIndex = manifest.indexOf(assignment);
  if (assignmentIndex < 0) return [];

  try {
    const routeManifest = JSON.parse(
      manifest
        .slice(assignmentIndex + assignment.length)
        .replace(/;\s*$/, "")
    );
    const entries = Object.entries(routeManifest.clientModules ?? {});
    const pageModule = entries.find(([modulePath]) =>
      modulePath.replaceAll("\\", "/").endsWith("/src/app/page.tsx")
    );
    const routeEntries = entries.filter(([, value]) => {
      const chunks = Array.isArray(value?.chunks) ? value.chunks : [];
      return chunks.some(
        (chunk) =>
          typeof chunk === "string" &&
          /static\/chunks\/app\/layout-[^/]+\.js$/.test(chunk)
      );
    });
    if (pageModule) routeEntries.push(pageModule);
    return routeEntries.flatMap(([, value]) =>
      Array.isArray(value?.chunks) ? value.chunks : []
    );
  } catch {
    return [];
  }
}

const chunks = legacyPageEntry?.groups?.chunks
  ? JSON.parse(`[${legacyPageEntry.groups.chunks}]`)
  : readCurrentWebpackChunks();
const uniqueChunks = [
  ...new Set(
    chunks.filter(
      (chunk) => typeof chunk === "string" && chunk.endsWith(".js")
    )
  ),
];

if (!uniqueChunks.length) {
  console.error("Could not locate the homepage client entry in the Next.js manifest.");
  process.exit(1);
}
const budgetBytes = 80 * 1024;
const forbiddenMarkers = ["supabase-js", "motionValue", "panelV2Translations"];
const rows = uniqueChunks.map((chunk) => {
  const path = resolve(process.cwd(), ".next", chunk);
  const source = readFileSync(path);
  const text = source.toString("utf8");
  return {
    chunk,
    rawBytes: statSync(path).size,
    gzipBytes: gzipSync(source).byteLength,
    forbidden: forbiddenMarkers.filter((marker) => text.includes(marker)),
  };
});

const totalRawBytes = rows.reduce((total, row) => total + row.rawBytes, 0);
const totalGzipBytes = rows.reduce((total, row) => total + row.gzipBytes, 0);
const forbidden = rows.flatMap((row) =>
  row.forbidden.map((marker) => `${marker} in ${row.chunk}`)
);

const publicWorkerDirectory = resolve(process.cwd(), ".next", "static", "chunks");
const publicWorkerFiles = readdirSync(publicWorkerDirectory).filter((file) =>
  /^mg-public-datalog-snapshot\.[a-z0-9]+\.js$/.test(file)
);
const forbiddenPublicWorkerMarkers = [
  "log-analysis-studio-v1",
  "Highest logged pressure value",
  "actual_target_gap",
];
const publicSnapshotWorkerMaximumRawBytes = 12 * 1024;
const publicWorkerRows = publicWorkerFiles.map((file) => {
  const path = resolve(publicWorkerDirectory, file);
  const source = readFileSync(path);
  const text = source.toString("utf8");
  return {
    file,
    rawBytes: statSync(path).size,
    forbidden: forbiddenPublicWorkerMarkers.filter((marker) => text.includes(marker)),
  };
});
const publicWorkerLeaks = publicWorkerRows.flatMap((row) =>
  row.forbidden.map((marker) => `${marker} in ${row.file}`)
);
const oversizedPublicWorkers = publicWorkerRows
  .filter((row) => row.rawBytes > publicSnapshotWorkerMaximumRawBytes)
  .map((row) => `${row.file} (${row.rawBytes} bytes)`);

console.log(
  JSON.stringify(
    {
      route: "/",
      initialChunks: rows.length,
      initialRawKb: Number((totalRawBytes / 1024).toFixed(1)),
      initialGzipKb: Number((totalGzipBytes / 1024).toFixed(1)),
      budgetGzipKb: budgetBytes / 1024,
      forbiddenInitialRuntime: forbidden,
      publicSnapshotWorkers: publicWorkerRows.map((row) => ({
        file: row.file,
        rawKb: Number((row.rawBytes / 1024).toFixed(1)),
      })),
      publicSnapshotWorkerBudgetKb: publicSnapshotWorkerMaximumRawBytes / 1024,
      forbiddenPublicSnapshotRuntime: [
        ...publicSnapshotDependencyLeaks,
        ...publicWorkerLeaks,
      ],
    },
    null,
    2
  )
);

if (totalGzipBytes > budgetBytes) {
  console.error(
    `Homepage initial JavaScript is ${(totalGzipBytes / 1024).toFixed(1)} KB gzip; budget is ${budgetBytes / 1024} KB.`
  );
  process.exitCode = 1;
}

if (forbidden.length) {
  console.error(`Heavy runtime leaked into the homepage entry: ${forbidden.join(", ")}`);
  process.exitCode = 1;
}

if (!publicWorkerRows.length) {
  console.error("Could not locate the public datalog snapshot worker build output.");
  process.exitCode = 1;
}

if (publicWorkerLeaks.length) {
  console.error(
    `Full customer datalog runtime leaked into the public worker: ${publicWorkerLeaks.join(", ")}`
  );
  process.exitCode = 1;
}

if (oversizedPublicWorkers.length) {
  console.error(
    `Public datalog snapshot worker exceeded its bounded runtime budget: ${oversizedPublicWorkers.join(", ")}`
  );
  process.exitCode = 1;
}
