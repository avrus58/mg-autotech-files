import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const manifestPath = resolve(process.cwd(), ".next", "prerender-manifest.json");
let manifest;

try {
  manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
} catch {
  console.error("Prerender coverage requires a completed `npm run build` first.");
  process.exit(1);
}

const locales = ["nl", "de", "fr", "it", "ru", "es", "tr", "pt", "zh", "pl", "sq"];
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
const missingRoutes = requiredRoutes.filter((route) => !prerenderedRoutes.has(route));

console.log(
  JSON.stringify(
    {
      prerenderedRouteCount: prerenderedRoutes.size,
      requiredPublicRouteCount: requiredRoutes.length,
      missingPublicRoutes: missingRoutes,
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
