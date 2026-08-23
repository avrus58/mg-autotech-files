import { readFileSync, statSync } from "node:fs";
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

console.log(
  JSON.stringify(
    {
      route: "/",
      initialChunks: rows.length,
      initialRawKb: Number((totalRawBytes / 1024).toFixed(1)),
      initialGzipKb: Number((totalGzipBytes / 1024).toFixed(1)),
      budgetGzipKb: budgetBytes / 1024,
      forbiddenInitialRuntime: forbidden,
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
