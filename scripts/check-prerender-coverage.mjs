import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const manifestPath = resolve(process.cwd(), ".next", "prerender-manifest.json");
let manifest;

try {
  manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
} catch {
  console.error(
    "Prerender coverage requires a completed `npm run build` first.",
  );
  process.exit(1);
}

const locales = [
  "nl",
  "de",
  "fr",
  "it",
  "ru",
  "es",
  "tr",
  "pt",
  "zh",
  "pl",
  "sq",
];
const representativePaths = [
  "",
  "/file-service",
  "/how-it-works",
  "/services/stage-1",
];
const canonicalRoutes = representativePaths.map((pathname) => pathname || "/");
const localizedRoutes = locales.flatMap((locale) =>
  representativePaths.map((pathname) => `/${locale}${pathname}`),
);
const requiredRoutes = [...canonicalRoutes, ...localizedRoutes];
const prerenderedRoutes = new Set(Object.keys(manifest.routes ?? {}));
const missingRoutes = requiredRoutes.filter(
  (route) => !prerenderedRoutes.has(route),
);
const invalidDocumentLanguages = [];

// Test the actual build artifact, not a script that changes lang after parsing.
// This also fails if a future document wrapper accidentally stops producing HTML.
for (const route of requiredRoutes) {
  if (!prerenderedRoutes.has(route)) continue;
  const firstSegment = route.split("/").filter(Boolean)[0];
  const locale = locales.includes(firstSegment) ? firstSegment : "en";
  const expected = locale === "zh" ? "zh-CN" : locale;
  const htmlPath = resolve(
    process.cwd(),
    ".next/server/app",
    `${route === "/" ? "index" : route.slice(1)}.html`,
  );
  try {
    const html = readFileSync(htmlPath, "utf8");
    const openingTag =
      html.match(/^\s*(?:<!doctype[^>]*>\s*)?<html\b[^>]*>/iu)?.[0] ?? "";
    const actual =
      openingTag.match(/\slang\s*=["']([^"']+)["']/iu)?.[1] ?? null;
    if (actual !== expected)
      invalidDocumentLanguages.push({ route, expected, actual });
  } catch {
    invalidDocumentLanguages.push({
      route,
      expected,
      actual: "missing HTML artifact",
    });
  }
}

console.log(
  JSON.stringify(
    {
      prerenderedRouteCount: prerenderedRoutes.size,
      requiredPublicRouteCount: requiredRoutes.length,
      missingPublicRoutes: missingRoutes,
      invalidDocumentLanguages,
    },
    null,
    2,
  ),
);

if (missingRoutes.length > 0) {
  console.error(
    `Public prerender coverage regressed: ${missingRoutes.join(", ")}`,
  );
  process.exit(1);
}

if (invalidDocumentLanguages.length > 0) {
  console.error(
    "Public initial HTML language regressed; browser-side assignment is not a substitute.",
  );
  process.exit(1);
}
