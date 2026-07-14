import { createHash, randomUUID } from "node:crypto";
import { makeArtifactId, sha256Hex } from "@/lib/dtcActive/syntheticFixtureSource";
import type {
  DtcPhaseCArtifactRecord,
  DtcPhaseCEventRecord,
  DtcPhaseCProcessingAttempt,
} from "@/lib/dtcActive/phaseCTypes";
import type { DtcActiveHardVetoCode } from "@/lib/dtcActive/types";

type StoredArtifact = {
  record: DtcPhaseCArtifactRecord;
  bytes: Buffer;
};

export class DtcPhaseCInMemoryStore {
  private readonly artifacts = new Map<string, StoredArtifact>();
  private readonly attempts = new Map<string, DtcPhaseCProcessingAttempt>();
  private readonly idempotency = new Map<string, string>();
  private readonly events: DtcPhaseCEventRecord[] = [];

  createOrGetAttempt(input: {
    idempotencyKey: string;
    requestHash: string;
    requestedCodes: string[];
  }) {
    const existingAttemptId = this.idempotency.get(input.idempotencyKey);
    if (existingAttemptId) {
      const existing = this.attempts.get(existingAttemptId);
      if (!existing) throw new Error("Idempotency record points to missing attempt.");
      if (existing.requestHash !== input.requestHash) {
        throw new Error("Idempotency key reuse with different Phase C request payload rejected.");
      }
      return { attempt: existing, reused: true };
    }

    const now = new Date().toISOString();
    const attempt: DtcPhaseCProcessingAttempt = {
      attemptId: randomUUID(),
      idempotencyKey: input.idempotencyKey,
      requestHash: input.requestHash,
      status: "queued",
      requestedCodes: [...input.requestedCodes],
      hardVetoes: [],
      leaseToken: null,
      leaseOwner: null,
      leaseExpiresAt: null,
      fencingToken: 0,
      internalTestOnly: true,
      customerPublishable: false,
      createdAt: now,
      updatedAt: now,
    };
    this.attempts.set(attempt.attemptId, attempt);
    this.idempotency.set(input.idempotencyKey, attempt.attemptId);
    return { attempt, reused: false };
  }

  claimAttempt(attemptId: string, leaseOwner: string, now = new Date()) {
    const attempt = this.requiredAttempt(attemptId);
    if (attempt.status !== "queued" && attempt.status !== "failed") {
      return { ok: false as const, reason: "attempt is not claimable", attempt };
    }
    const leaseToken = randomUUID();
    const leaseExpiresAt = new Date(now.getTime() + 60_000).toISOString();
    const updated: DtcPhaseCProcessingAttempt = {
      ...attempt,
      status: "claimed",
      leaseToken,
      leaseOwner,
      leaseExpiresAt,
      fencingToken: attempt.fencingToken + 1,
      updatedAt: now.toISOString(),
    };
    this.attempts.set(attemptId, updated);
    return { ok: true as const, attempt: updated, leaseToken, fencingToken: updated.fencingToken };
  }

  markProcessing(attemptId: string, leaseToken: string) {
    const attempt = this.requiredAttempt(attemptId);
    this.assertLease(attempt, leaseToken);
    this.attempts.set(attemptId, { ...attempt, status: "processing", updatedAt: new Date().toISOString() });
  }

  markSucceeded(attemptId: string, leaseToken: string) {
    const attempt = this.requiredAttempt(attemptId);
    this.assertLease(attempt, leaseToken);
    this.attempts.set(attemptId, { ...attempt, status: "succeeded", updatedAt: new Date().toISOString() });
  }

  markFailed(attemptId: string, hardVetoes: DtcActiveHardVetoCode[]) {
    const attempt = this.requiredAttempt(attemptId);
    this.attempts.set(attemptId, {
      ...attempt,
      status: "failed",
      hardVetoes: [...new Set([...attempt.hardVetoes, ...hardVetoes])],
      updatedAt: new Date().toISOString(),
    });
  }

  putArtifact(input: {
    attemptId: string;
    role: DtcPhaseCArtifactRecord["role"];
    bytes: Uint8Array;
    parentArtifactId?: string | null;
  }) {
    const sha256 = sha256Hex(input.bytes);
    const artifactId = makeArtifactId(input.role, input.attemptId, sha256);
    if (this.artifacts.has(artifactId)) {
      throw new Error(`Immutable synthetic artifact already exists: ${artifactId}`);
    }
    const record: DtcPhaseCArtifactRecord = {
      artifactId,
      attemptId: input.attemptId,
      role: input.role,
      sha256,
      byteSize: input.bytes.length,
      parentArtifactId: input.parentArtifactId ?? null,
      storageKind: "memory_synthetic_test",
      internalTestOnly: true,
      customerPublishable: false,
      createdAt: new Date().toISOString(),
    };
    this.artifacts.set(artifactId, { record, bytes: Buffer.from(input.bytes) });
    return record;
  }

  getArtifactBytes(artifactId: string) {
    const stored = this.artifacts.get(artifactId);
    if (!stored) return null;
    return Buffer.from(stored.bytes);
  }

  listArtifacts(attemptId: string) {
    return [...this.artifacts.values()].filter((artifact) => artifact.record.attemptId === attemptId).map((artifact) => artifact.record);
  }

  appendEvent(event: Omit<DtcPhaseCEventRecord, "eventId" | "at">) {
    const record: DtcPhaseCEventRecord = {
      ...event,
      eventId: randomUUID(),
      at: new Date().toISOString(),
    };
    this.events.push(record);
    return record;
  }

  listEvents(attemptId: string) {
    return this.events.filter((event) => event.attemptId === attemptId);
  }

  getAttempt(attemptId: string) {
    return this.attempts.get(attemptId) ?? null;
  }

  private requiredAttempt(attemptId: string) {
    const attempt = this.attempts.get(attemptId);
    if (!attempt) throw new Error(`Unknown Phase C attempt: ${attemptId}`);
    return attempt;
  }

  private assertLease(attempt: DtcPhaseCProcessingAttempt, leaseToken: string) {
    if (!attempt.leaseToken || attempt.leaseToken !== leaseToken) {
      throw new Error("Phase C lease fencing rejected stale or missing lease token.");
    }
  }
}

export const defaultDtcPhaseCStore = new DtcPhaseCInMemoryStore();

export function phaseCRequestHash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
