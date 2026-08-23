import {
  chmod,
  copyFile,
  lstat,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  rmdir,
  writeFile,
} from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { isAbsolute, parse, posix, relative, resolve, sep } from "node:path";

function absoluteSafePath(name, fallback) {
  const value = process.env[name] || fallback;
  if (!isAbsolute(value)) throw new Error(`${name} must be an absolute path.`);
  const resolved = resolve(value);
  if (resolved === parse(resolved).root) throw new Error(`${name} cannot be a filesystem root.`);
  return resolved;
}

const sourceDirectory = absoluteSafePath(
  "FILE_SERVICE_STATIC_SOURCE",
  "/app/static-release"
);
const targetDirectory = absoluteSafePath(
  "FILE_SERVICE_STATIC_TARGET",
  "/app/.next/static"
);
const stateDirectory = absoluteSafePath(
  "FILE_SERVICE_STATIC_STATE",
  "/app/static-state"
);
const sourceManifestPath = absoluteSafePath(
  "FILE_SERVICE_STATIC_MANIFEST",
  "/app/static-release-manifest.json"
);
const buildIdPath = absoluteSafePath(
  "FILE_SERVICE_BUILD_ID_FILE",
  "/app/release-build-id"
);

function isInside(parent, child) {
  const candidate = relative(parent, child);
  return candidate === "" || (!candidate.startsWith(`..${sep}`) && candidate !== "..");
}

if (isInside(targetDirectory, stateDirectory)) {
  throw new Error("Static release metadata cannot be stored below the public static directory.");
}

const retention = Number(process.env.FILE_SERVICE_STATIC_RELEASES_TO_KEEP || "3");
if (!Number.isInteger(retention) || retention < 3 || retention > 5) {
  throw new Error("Static release retention must be an integer between 3 and 5.");
}

const maxManifestBytes = 2 * 1024 * 1024;
const maxManifestFiles = 10_000;
const maxStateManifests = 16;

async function readBoundedManifest(path) {
  const metadata = await lstat(path);
  if (metadata.isSymbolicLink() || !metadata.isFile() || metadata.size > maxManifestBytes) {
    throw new Error("Static release manifest is not a bounded regular file.");
  }
  return readFile(path, "utf8");
}

function validateBuildId(value) {
  if (!/^[A-Za-z0-9._-]{1,128}$/.test(value)) {
    throw new Error("Static release build ID is invalid.");
  }
  return value;
}

function validateRelativeFile(value) {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > 512 ||
    value.includes("\\") ||
    value.includes("\0") ||
    posix.isAbsolute(value) ||
    posix.normalize(value) !== value ||
    value.split("/").some((segment) => segment === "" || segment === "." || segment === "..")
  ) {
    throw new Error("Static release manifest contains an unsafe file path.");
  }
  return value;
}

function parseManifest(raw, { activated = false } = {}) {
  const value = JSON.parse(raw);
  if (
    value?.schemaVersion !== 1 ||
    !Array.isArray(value.files) ||
    value.files.length > maxManifestFiles ||
    (activated && (!Number.isSafeInteger(value.activatedAt) || value.activatedAt < 1))
  ) {
    throw new Error("Static release manifest schema is invalid.");
  }
  const files = value.files.map(validateRelativeFile);
  if (new Set(files).size !== files.length) {
    throw new Error("Static release manifest contains duplicate file paths.");
  }
  return {
    schemaVersion: 1,
    buildId: validateBuildId(value.buildId),
    files,
    ...(activated ? { activatedAt: value.activatedAt } : {}),
  };
}

async function assertDirectoryNotSymlink(path) {
  try {
    const metadata = await lstat(path);
    if (metadata.isSymbolicLink() || !metadata.isDirectory()) {
      throw new Error(`Expected a regular directory at ${path}.`);
    }
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
    await mkdir(path);
  }
}

async function ensureSafeDirectory(root, relativeDirectory = "") {
  await mkdir(root, { recursive: true });
  await assertDirectoryNotSymlink(root);
  let cursor = root;
  for (const segment of relativeDirectory.split("/").filter(Boolean)) {
    cursor = resolve(cursor, segment);
    await assertDirectoryNotSymlink(cursor);
  }
}

async function atomicWrite(path, contents, mode = 0o600) {
  const temporaryPath = `${path}.tmp-${process.pid}-${randomUUID()}`;
  await writeFile(temporaryPath, contents, { encoding: "utf8", mode });
  try {
    await rename(temporaryPath, path);
  } catch (error) {
    if (process.platform !== "win32" || !["EEXIST", "EPERM"].includes(error?.code)) throw error;
    await rm(path, { force: true });
    await rename(temporaryPath, path);
  }
}

async function atomicCopy(source, destination) {
  const temporaryPath = `${destination}.tmp-${process.pid}-${randomUUID()}`;
  await copyFile(source, temporaryPath);
  await chmod(temporaryPath, 0o644);
  try {
    await rename(temporaryPath, destination);
  } catch (error) {
    if (process.platform !== "win32" || !["EEXIST", "EPERM"].includes(error?.code)) throw error;
    await rm(destination, { force: true });
    await rename(temporaryPath, destination);
  }
}

const buildId = validateBuildId((await readFile(buildIdPath, "utf8")).trim());
const releaseManifest = parseManifest(await readBoundedManifest(sourceManifestPath));
if (releaseManifest.buildId !== buildId) {
  throw new Error("Static release manifest does not match the standalone build ID.");
}

await ensureSafeDirectory(targetDirectory);
await ensureSafeDirectory(stateDirectory);

for (const file of releaseManifest.files) {
  const sourcePath = resolve(sourceDirectory, ...file.split("/"));
  const sourceMetadata = await lstat(sourcePath);
  if (sourceMetadata.isSymbolicLink() || !sourceMetadata.isFile()) {
    throw new Error("Static release source must contain regular files only.");
  }
  const relativeDirectory = posix.dirname(file) === "." ? "" : posix.dirname(file);
  await ensureSafeDirectory(targetDirectory, relativeDirectory);
  await atomicCopy(sourcePath, resolve(targetDirectory, ...file.split("/")));
}

const activeManifest = {
  ...releaseManifest,
  activatedAt: Date.now(),
};
await atomicWrite(
  resolve(stateDirectory, `${buildId}.json`),
  `${JSON.stringify(activeManifest)}\n`
);

const stateEntries = await readdir(stateDirectory, { withFileTypes: true });
if (stateEntries.length > maxStateManifests) {
  throw new Error("Static release state contains too many entries.");
}
const knownManifests = [];
for (const entry of stateEntries) {
  if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
  const manifest = parseManifest(
    await readBoundedManifest(resolve(stateDirectory, entry.name)),
    { activated: true }
  );
  if (`${manifest.buildId}.json` !== entry.name) {
    throw new Error("Static release state filename does not match its build ID.");
  }
  knownManifests.push(manifest);
}

knownManifests.sort((left, right) => {
  if (left.buildId === buildId) return -1;
  if (right.buildId === buildId) return 1;
  return right.activatedAt - left.activatedAt;
});
const retainedManifests = knownManifests.slice(0, retention);
const retainedBuildIds = new Set(retainedManifests.map((manifest) => manifest.buildId));
const retainedFiles = new Set(retainedManifests.flatMap((manifest) => manifest.files));

async function pruneDirectory(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const absolutePath = resolve(directory, entry.name);
    const metadata = await lstat(absolutePath);
    if (metadata.isSymbolicLink()) {
      throw new Error("Public static asset storage cannot contain symbolic links.");
    }
    if (metadata.isDirectory()) {
      await pruneDirectory(absolutePath);
      if ((await readdir(absolutePath)).length === 0) await rmdir(absolutePath);
      continue;
    }
    if (!metadata.isFile()) {
      throw new Error("Public static asset storage can contain regular files only.");
    }
    const relativePath = relative(targetDirectory, absolutePath).split(sep).join("/");
    if (!retainedFiles.has(relativePath)) await rm(absolutePath, { force: true });
  }
}

await pruneDirectory(targetDirectory);
for (const manifest of knownManifests) {
  if (!retainedBuildIds.has(manifest.buildId)) {
    await rm(resolve(stateDirectory, `${manifest.buildId}.json`), { force: true });
  }
}

console.info(
  `[static-assets] release ${buildId} ready; retained ${retainedManifests.length} release manifest(s).`
);
