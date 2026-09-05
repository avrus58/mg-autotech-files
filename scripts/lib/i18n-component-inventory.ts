export interface SourceInventoryInput {
  files: Iterable<string>;
  auditedRoots: Iterable<string>;
  intentionallyAuthoredRoots: Iterable<string>;
}

function normalizeProjectPath(value: string) {
  return value.replaceAll("\\", "/").replace(/^\.\//u, "").replace(/\/$/u, "");
}

function isWithin(file: string, root: string) {
  return file === root || file.startsWith(`${root}/`);
}

export function findUnclassifiedFiles({
  files,
  auditedRoots,
  intentionallyAuthoredRoots }: SourceInventoryInput) {
  const normalizedAuditedRoots = [...auditedRoots].map(normalizeProjectPath);
  const normalizedIntentionalRoots = [...intentionallyAuthoredRoots].map(
    normalizeProjectPath
  );

  return [...files]
    .map(normalizeProjectPath)
    .filter(
      (file) =>
        !normalizedAuditedRoots.some((root) => isWithin(file, root)) &&
        !normalizedIntentionalRoots.some((root) => isWithin(file, root)),
    )
    .sort((left, right) => left.localeCompare(right));
}

export const appRouterUiEntryBaseNames = new Set([
  "apple-icon",
  "default",
  "error",
  "forbidden",
  "global-error",
  "global-not-found",
  "icon",
  "layout",
  "loading",
  "manifest",
  "not-found",
  "opengraph-image",
  "page",
  "template",
  "twitter-image",
  "unauthorized",
]);

export const appRouterSourceExtensions = new Set(["js", "jsx", "ts", "tsx"]);

const numberedMetadataBaseNamePattern = /^(?:apple-icon|icon|opengraph-image|twitter-image)\d+$/u;

export function isAuditedUiSourceFile(file: string) {
  const normalized = normalizeProjectPath(file);
  const fileName = normalized.split("/").at(-1) ?? "";
  const extensionIndex = fileName.lastIndexOf(".");
  return extensionIndex > 0 && appRouterSourceExtensions.has(fileName.slice(extensionIndex + 1));
}

export function isCoLocatedAppUiSourceFile(file: string) {
  if (!isAuditedUiSourceFile(file)) return false;
  const normalized = normalizeProjectPath(file);
  const fileName = normalized.split("/").at(-1) ?? "";
  return !normalized.startsWith("src/app/api/") && !/^(?:route|robots|sitemap)\.(?:js|jsx|ts|tsx)$/u.test(fileName);
}

export function isPotentialSharedUiSourceFile(file: string) {
  if (!isAuditedUiSourceFile(file)) return false;
  const normalized = normalizeProjectPath(file);
  const fileName = normalized.split("/").at(-1) ?? "";
  const extensionIndex = fileName.lastIndexOf(".");
  const extension = fileName.slice(extensionIndex + 1);
  if (extension !== "ts") return true;
  const stem = fileName.slice(0, extensionIndex);
  return /(?:^|[-_.])copy$/iu.test(stem) || /Copy$/u.test(stem);
}

export function isAppRouterUiEntryFile(file: string) {
  const normalized = normalizeProjectPath(file);
  const fileName = normalized.split("/").at(-1) ?? "";
  const extensionIndex = fileName.lastIndexOf(".");
  if (extensionIndex <= 0) return false;

  return (
    (appRouterUiEntryBaseNames.has(fileName.slice(0, extensionIndex)) ||
      numberedMetadataBaseNamePattern.test(fileName.slice(0, extensionIndex))) &&
    isAuditedUiSourceFile(normalized)
  );
}

export function findUnclassifiedAppRouteFiles(input: SourceInventoryInput) {
  return findUnclassifiedFiles({
    ...input,
    files: [...input.files].filter(isAppRouterUiEntryFile),
  });
}
