import { lstat, readdir, readFile, writeFile } from "node:fs/promises";
import { posix, relative, resolve, sep } from "node:path";

const nextDirectory = resolve(process.cwd(), ".next");
const staticDirectory = resolve(nextDirectory, "static");
const buildId = (await readFile(resolve(nextDirectory, "BUILD_ID"), "utf8")).trim();

if (!/^[A-Za-z0-9._-]{1,128}$/.test(buildId)) {
  throw new Error("Next build ID is not safe for the static asset manifest.");
}

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolutePath = resolve(directory, entry.name);
    const metadata = await lstat(absolutePath);
    if (metadata.isSymbolicLink()) {
      throw new Error("Static asset manifests cannot contain symbolic links.");
    }
    if (metadata.isDirectory()) {
      files.push(...await collectFiles(absolutePath));
      continue;
    }
    if (!metadata.isFile()) {
      throw new Error("Static asset manifests can contain regular files only.");
    }
    files.push(relative(staticDirectory, absolutePath).split(sep).join(posix.sep));
  }

  return files;
}

const files = (await collectFiles(staticDirectory)).sort();
if (files.length === 0) {
  throw new Error("The standalone build produced no static assets.");
}

await writeFile(
  resolve(nextDirectory, "static-release-manifest.json"),
  `${JSON.stringify({ schemaVersion: 1, buildId, files })}\n`,
  { encoding: "utf8", mode: 0o644 }
);
