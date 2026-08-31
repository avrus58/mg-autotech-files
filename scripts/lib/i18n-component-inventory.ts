export interface ComponentInventoryInput {
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

export function findUnclassifiedComponentFiles({
  files,
  auditedRoots,
  intentionallyAuthoredRoots,
}: ComponentInventoryInput) {
  const normalizedAuditedRoots = [...auditedRoots].map(normalizeProjectPath);
  const normalizedIntentionalRoots = [...intentionallyAuthoredRoots].map(
    normalizeProjectPath
  );

  return [...files]
    .map(normalizeProjectPath)
    .filter(
      (file) =>
        !normalizedAuditedRoots.some((root) => isWithin(file, root)) &&
        !normalizedIntentionalRoots.some((root) => isWithin(file, root))
    )
    .sort((left, right) => left.localeCompare(right));
}
