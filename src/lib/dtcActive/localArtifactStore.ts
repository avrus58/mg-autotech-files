import { randomUUID } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import type { DtcPhaseCArtifactRecord, DtcPhaseCArtifactRole } from "@/lib/dtcActive/phaseCTypes";
import { syntheticPhaseBConstants } from "@/lib/dtcActive/fixtures";
import { makeArtifactId, sha256Hex, syntheticFixtureLayout } from "@/lib/dtcActive/syntheticFixtureSource";

export type PutPhaseCArtifactInput = {
  attemptId: string;
  role: DtcPhaseCArtifactRole;
  bytes: Uint8Array;
  parentArtifactId?: string | null;
  syntheticFixtureOnly: true;
  sourceLineage: "synthetic_fixture";
};

export type DtcPhaseCArtifactStorage = {
  putArtifact(input: PutPhaseCArtifactInput): DtcPhaseCArtifactRecord;
  getArtifactBytes(artifactId: string): Buffer | null;
};

export const defaultDtcPhaseCLocalArtifactRoot = resolve(process.cwd(), ".local", "dtc-test-artifacts");

type ParsedArtifactId = {
  attemptId: string;
  role: DtcPhaseCArtifactRole;
  sha256: string;
};

const roleSet = new Set<DtcPhaseCArtifactRole>(["source", "pre_integrity", "final"]);

export class DtcPhaseCLocalArtifactStore implements DtcPhaseCArtifactStorage {
  private readonly root: string;

  constructor(root = defaultDtcPhaseCLocalArtifactRoot) {
    this.root = resolve(root);
  }

  putArtifact(input: PutPhaseCArtifactInput): DtcPhaseCArtifactRecord {
    this.assertSyntheticInput(input);
    const sha256 = sha256Hex(input.bytes);
    const artifactId = makeArtifactId(input.role, input.attemptId, sha256);
    const parsed = parsePhaseCArtifactId(artifactId);
    const artifactPath = this.resolveArtifactPath(parsed);
    const parentDir = dirname(artifactPath);

    this.assertNoExistingRoleArtifact(parsed.attemptId, parsed.role);
    mkdirSync(parentDir, { recursive: true });
    this.assertSafeDirectory(parentDir);
    if (existsSync(artifactPath)) {
      throw new Error(`Immutable synthetic artifact already exists: ${artifactId}`);
    }

    const tmpDir = join(this.root, ".tmp");
    mkdirSync(tmpDir, { recursive: true });
    this.assertSafeDirectory(tmpDir);
    const tmpPath = join(tmpDir, `${randomUUID()}.tmp`);

    try {
      writeFileSync(tmpPath, Buffer.from(input.bytes), { flag: "wx" });
      this.assertSafeFile(tmpPath);
      const tmpBytes = readFileSync(tmpPath);
      if (sha256Hex(tmpBytes) !== sha256) {
        throw new Error("Synthetic artifact temporary write verification failed.");
      }
      renameSync(tmpPath, artifactPath);
      this.assertSafeFile(artifactPath);
      const writtenBytes = readFileSync(artifactPath);
      if (sha256Hex(writtenBytes) !== sha256) {
        throw new Error("Synthetic artifact final write verification failed.");
      }
    } catch (error) {
      if (existsSync(tmpPath)) rmSync(tmpPath, { force: true });
      throw error;
    }

    return {
      artifactId,
      attemptId: input.attemptId,
      role: input.role,
      sha256,
      byteSize: input.bytes.length,
      parentArtifactId: input.parentArtifactId ?? null,
      storageKind: "local_disposable_test",
      artifactClassification: "INTERNAL_TEST_ONLY",
      internalTestOnly: true,
      customerPublishable: false,
      createdAt: new Date().toISOString(),
    };
  }

  getArtifactBytes(artifactId: string): Buffer | null {
    const parsed = parsePhaseCArtifactId(artifactId);
    const artifactPath = this.resolveArtifactPath(parsed);
    if (!existsSync(artifactPath)) return null;
    this.assertSafeFile(artifactPath);
    const bytes = readFileSync(artifactPath);
    if (sha256Hex(bytes) !== parsed.sha256) {
      throw new Error("Synthetic artifact hash verification failed; file is corrupt or tampered.");
    }
    this.assertSyntheticBytes(bytes, parsed.role);
    return Buffer.from(bytes);
  }

  getPhysicalPathForTestOnly(artifactId: string) {
    return this.resolveArtifactPath(parsePhaseCArtifactId(artifactId));
  }

  private resolveArtifactPath(parsed: ParsedArtifactId) {
    const artifactPath = resolve(this.root, parsed.attemptId, parsed.role, `${parsed.sha256}.bin`);
    this.assertInsideRoot(artifactPath);
    return artifactPath;
  }

  private assertSyntheticInput(input: PutPhaseCArtifactInput) {
    if (input.syntheticFixtureOnly !== true || input.sourceLineage !== "synthetic_fixture") {
      throw new Error("Non-synthetic artifact input rejected.");
    }
    if (!roleSet.has(input.role)) {
      throw new Error("Unsupported synthetic artifact role rejected.");
    }
    this.assertSyntheticBytes(input.bytes, input.role);
  }

  private assertSyntheticBytes(bytes: Uint8Array, role: DtcPhaseCArtifactRole) {
    if (bytes.length !== syntheticFixtureLayout.size) {
      throw new Error("Synthetic artifact byte size rejected.");
    }
    const magic = Buffer.from(bytes.subarray(0, syntheticFixtureLayout.magic.length)).toString("ascii");
    if (magic !== syntheticFixtureLayout.magic) {
      throw new Error("Synthetic artifact magic marker rejected.");
    }
    if (role === "source" && sha256Hex(bytes) !== syntheticPhaseBConstants.sourceSha256) {
      throw new Error("Synthetic source artifact digest rejected.");
    }
  }

  private assertNoExistingRoleArtifact(attemptId: string, role: DtcPhaseCArtifactRole) {
    const roleDir = resolve(this.root, attemptId, role);
    this.assertInsideRoot(roleDir);
    if (!existsSync(roleDir)) return;
    this.assertSafeDirectory(roleDir);
    if (readdirSync(roleDir).some((entry) => entry.endsWith(".bin"))) {
      throw new Error(`Immutable synthetic artifact role already exists for attempt ${attemptId}: ${role}`);
    }
  }

  private assertSafeDirectory(directoryPath: string) {
    this.assertInsideRoot(directoryPath);
    const stats = lstatSync(directoryPath);
    if (!stats.isDirectory() || stats.isSymbolicLink()) {
      throw new Error("Synthetic artifact directory safety check failed.");
    }
    const realDirectory = realpathSync(directoryPath);
    this.assertInsideRoot(realDirectory);
  }

  private assertSafeFile(filePath: string) {
    this.assertInsideRoot(filePath);
    const stats = lstatSync(filePath);
    if (!stats.isFile() || stats.isSymbolicLink()) {
      throw new Error("Synthetic artifact file safety check failed.");
    }
    const realFile = realpathSync(filePath);
    this.assertInsideRoot(realFile);
  }

  private assertInsideRoot(candidatePath: string) {
    mkdirSync(this.root, { recursive: true });
    const rootReal = realpathSync(this.root);
    const normalizedRoot = normalizeForPlatform(rootReal);
    const normalizedCandidate = normalizeForPlatform(resolve(candidatePath));
    const diff = relative(normalizedRoot, normalizedCandidate);
    if (diff === "" || (!diff.startsWith("..") && !isAbsolute(diff))) return;
    throw new Error("Synthetic artifact path traversal or symlink escape rejected.");
  }
}

export function parsePhaseCArtifactId(artifactId: string): ParsedArtifactId {
  const match = /^dtc-phase-c\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/(source|pre_integrity|final)\/([0-9a-f]{64})$/.exec(artifactId);
  if (!match) {
    throw new Error("Invalid synthetic artifact identifier.");
  }
  return {
    attemptId: match[1],
    role: match[2] as DtcPhaseCArtifactRole,
    sha256: match[3],
  };
}

function normalizeForPlatform(value: string) {
  const resolved = resolve(value);
  return process.platform === "win32" ? resolved.toLowerCase().replaceAll("/", sep) : resolved;
}
