import assert from "node:assert/strict";
import test from "node:test";

import {
  recordGrowthAttributionTouchServer,
  recordGrowthJourneyEvent,
} from "../src/lib/growth/server";
import { hashGrowthVisitorId } from "../src/lib/growth/attributionServer";

type JourneyRow = {
  id: string;
  event_key: string;
  event_type: string;
  user_id: string;
  visitor_hash: string | null;
  visitor_hash_version: string | null;
  safe_metadata: Record<string, unknown>;
  created_at: string;
};

type AttributionRow = {
  id: string;
  user_id: string | null;
  touch_count: number;
  visitor_hash_version: string;
};

class FakeGrowthAdmin {
  readonly journeyRows: JourneyRow[] = [];
  readonly attributionRows = new Map<string, AttributionRow>();
  failNextLinkUpdate = false;
  lastAttributionRpcUserId: string | null = null;
  lastAttributionRpcHash: string | null = null;
  lastAttributionRpcHashVersion: string | null = null;
  attributionRpcInvocations = 0;
  attributionMutations = 0;
  readonly attributionReceipts = new Map<string, string | null>();
  linkOutcomeOverride: unknown = undefined;

  from(table: string) {
    return new FakeGrowthQuery(this, table);
  }

  async rpc(name: string, args: Record<string, unknown>) {
    if (name === "link_growth_visitor_identity") {
      if (this.linkOutcomeOverride !== undefined) {
        return { data: this.linkOutcomeOverride, error: null };
      }
      if (this.failNextLinkUpdate) {
        this.failNextLinkUpdate = false;
        return {
          data: null,
          error: { code: "08006", message: "synthetic transient failure" },
        };
      }
      const hash = String(args.p_visitor_hash);
      const hashVersion = String(args.p_visitor_hash_version);
      const userId = String(args.p_user_id);
      const owners = new Set(
        this.journeyRows
          .filter((row) => row.visitor_hash === hash)
          .map((row) => row.user_id)
      );
      owners.add(userId);
      const row = this.attributionRows.get(hash);
      if (
        owners.size > 1 ||
        (row?.user_id && row.user_id !== userId)
      ) return { data: "rejected_conflict", error: null };
      if (!row) return { data: "pending_touch", error: null };
      if (
        row.visitor_hash_version !== hashVersion &&
        row.visitor_hash_version !== "pre-v2-key-unknown"
      ) {
        return { data: "rejected_conflict", error: null };
      }
      if (row.user_id === userId) {
        return { data: "already_linked", error: null };
      }
      row.user_id = userId;
      return { data: "linked", error: null };
    }
    assert.equal(name, "record_growth_attribution_touch");
    this.attributionRpcInvocations += 1;
    const hash = String(args.p_visitor_hash);
    const hashVersion = String(args.p_visitor_hash_version);
    const receiptHash = String(args.p_receipt_hash);
    if (this.attributionReceipts.has(receiptHash)) {
      return { data: this.attributionReceipts.get(receiptHash), error: null };
    }
    const userId = typeof args.p_user_id === "string" ? args.p_user_id : null;
    this.lastAttributionRpcUserId = userId;
    this.lastAttributionRpcHash = hash;
    this.lastAttributionRpcHashVersion = hashVersion;
    const existing = this.attributionRows.get(hash);
    if (existing) {
      existing.user_id = existing.user_id ?? userId;
      existing.touch_count += 1;
      this.attributionMutations += 1;
      this.attributionReceipts.set(receiptHash, existing.id);
      return { data: existing.id, error: null };
    }
    const row = {
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      user_id: userId,
      touch_count: 1,
      visitor_hash_version: hashVersion,
    };
    this.attributionRows.set(hash, row);
    this.attributionMutations += 1;
    this.attributionReceipts.set(receiptHash, row.id);
    return { data: row.id, error: null };
  }
}

class FakeGrowthQuery implements PromiseLike<{
  data: unknown;
  error: { code: string; message: string } | null;
}> {
  private operation: "select" | "upsert" | "update" = "select";
  private payload: Record<string, unknown> = {};
  private readonly filters = new Map<string, unknown>();

  constructor(
    private readonly admin: FakeGrowthAdmin,
    private readonly table: string
  ) {}

  upsert(payload: Record<string, unknown>) {
    this.operation = "upsert";
    this.payload = payload;
    return this;
  }

  update(payload: Record<string, unknown>) {
    this.operation = "update";
    this.payload = payload;
    return this;
  }

  select() {
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.set(column, value);
    return this;
  }

  in(column: string, values: unknown[]) {
    this.filters.set(column, [...values]);
    return this;
  }

  is(column: string, value: unknown) {
    this.filters.set(column, value);
    return this;
  }

  order() {
    return this;
  }

  limit() {
    return this;
  }

  maybeSingle() {
    return Promise.resolve(this.execute(true));
  }

  then<TResult1 = { data: unknown; error: null }, TResult2 = never>(
    onfulfilled?: ((value: { data: unknown; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.execute(false) as { data: unknown; error: null }).then(
      onfulfilled,
      onrejected
    );
  }

  private execute(single: boolean) {
    if (this.table === "growth_journey_events" && this.operation === "upsert") {
      const eventKey = String(this.payload.event_key);
      const existing = this.admin.journeyRows.find(
        (row) => row.event_key === eventKey
      );
      if (existing) return { data: null, error: null };
      const row: JourneyRow = {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        event_key: eventKey,
        event_type: String(this.payload.event_type),
        user_id: String(this.payload.user_id),
        visitor_hash:
          typeof this.payload.visitor_hash === "string"
            ? this.payload.visitor_hash
            : null,
        visitor_hash_version:
          typeof this.payload.visitor_hash_version === "string"
            ? this.payload.visitor_hash_version
            : null,
        safe_metadata:
          this.payload.safe_metadata && typeof this.payload.safe_metadata === "object"
            ? this.payload.safe_metadata as Record<string, unknown>
            : {},
        created_at: "2026-08-28T10:00:00.000Z",
      };
      this.admin.journeyRows.push(row);
      return { data: { id: row.id }, error: null };
    }

    if (this.table === "growth_journey_events" && this.operation === "update") {
      const row = this.admin.journeyRows.find((candidate) =>
        [...this.filters].every(([column, value]) =>
          candidate[column as keyof JourneyRow] === value
        )
      );
      if (!row) return { data: single ? null : [], error: null };
      if (typeof this.payload.visitor_hash === "string") {
        row.visitor_hash = this.payload.visitor_hash;
      }
      if (typeof this.payload.visitor_hash_version === "string") {
        row.visitor_hash_version = this.payload.visitor_hash_version;
      }
      return { data: single ? { id: row.id } : [{ id: row.id }], error: null };
    }

    if (this.table === "growth_journey_events") {
      const rows = this.admin.journeyRows.filter((row) =>
        [...this.filters].every(([column, value]) =>
          Array.isArray(value)
            ? value.includes(row[column as keyof JourneyRow])
            : row[column as keyof JourneyRow] === value
        )
      );
      const row = rows.at(-1) ?? null;
      return {
        data: single
          ? row
            ? {
                id: row.id,
                user_id: row.user_id,
                visitor_hash: row.visitor_hash,
                visitor_hash_version: row.visitor_hash_version,
              }
            : null
          : rows.map((candidate) => ({
              user_id: candidate.user_id,
              visitor_hash: candidate.visitor_hash,
              visitor_hash_version: candidate.visitor_hash_version,
            })),
        error: null,
      };
    }

    if (
      this.table === "growth_attribution_sessions" &&
      this.operation === "select"
    ) {
      const filter = this.filters.get("visitor_hash");
      const hashes = Array.isArray(filter) ? filter.map(String) : [String(filter)];
      const rows = hashes
        .map((hash) => ({ hash, row: this.admin.attributionRows.get(hash) }))
        .filter((entry): entry is { hash: string; row: AttributionRow } => Boolean(entry.row));
      return {
        data: single
          ? rows[0]
            ? {
                user_id: rows[0].row.user_id,
                visitor_hash: rows[0].hash,
                visitor_hash_version: rows[0].row.visitor_hash_version,
              }
            : null
          : rows.map((entry) => ({
              user_id: entry.row.user_id,
              visitor_hash: entry.hash,
              visitor_hash_version: entry.row.visitor_hash_version,
            })),
        error: null,
      };
    }

    if (
      this.table === "growth_attribution_sessions" &&
      this.operation === "update"
    ) {
      if (this.admin.failNextLinkUpdate) {
        this.admin.failNextLinkUpdate = false;
        return {
          data: null,
          error: { code: "08006", message: "synthetic transient failure" },
        };
      }
      const hash = String(this.filters.get("visitor_hash"));
      const row = this.admin.attributionRows.get(hash);
      if (!row || row.user_id !== null) return { data: [], error: null };
      row.user_id = String(this.payload.user_id);
      return { data: [{ id: row.id }], error: null };
    }

    throw new Error(`Unexpected fake query: ${this.table}/${this.operation}`);
  }
}

const visitorId = "11111111-1111-4111-8111-111111111111";
const deliveryId = "88888888-8888-4888-8888-888888888888";
const userId = "22222222-2222-4222-8222-222222222222";
const touch = {
  landingPath: "/services/stage-1",
  source: "google",
  medium: "cpc",
  campaign: "stage1_de",
  term: null,
  referrerHost: "google.de",
  locale: "de-de",
};

test("a delayed attribution endpoint deterministically recovers an account-first visitor link", async () => {
  const previousSecret = process.env.GROWTH_ATTRIBUTION_HMAC_SECRET;
  process.env.GROWTH_ATTRIBUTION_HMAC_SECRET = "a".repeat(64);
  const admin = new FakeGrowthAdmin();
  const dependencies = {
    getAdmin: () => admin as never,
    now: () => "2026-08-28T10:01:00.000Z",
  };

  try {
    const account = await recordGrowthJourneyEvent(
      { eventType: "account_created", userId, visitorId },
      dependencies
    );
    assert.equal(account.ok, true);
    assert.equal(admin.attributionRows.size, 0);

    const attribution = await recordGrowthAttributionTouchServer(
      { visitorId, deliveryId, touch },
      dependencies
    );
    assert.equal(attribution.ok, true);
    assert.equal(admin.lastAttributionRpcUserId, userId);
    assert.equal([...admin.attributionRows.values()][0]?.user_id, userId);
  } finally {
    if (previousSecret === undefined) {
      delete process.env.GROWTH_ATTRIBUTION_HMAC_SECRET;
    } else {
      process.env.GROWTH_ATTRIBUTION_HMAC_SECRET = previousSecret;
    }
  }
});

test("a touch-first visitor links after account creation and a transient link error never ACKs", async () => {
  const previousSecret = process.env.GROWTH_ATTRIBUTION_HMAC_SECRET;
  process.env.GROWTH_ATTRIBUTION_HMAC_SECRET = "b".repeat(64);
  const admin = new FakeGrowthAdmin();
  const dependencies = {
    getAdmin: () => admin as never,
    now: () => "2026-08-28T10:01:00.000Z",
  };

  try {
    const attribution = await recordGrowthAttributionTouchServer(
      { visitorId, deliveryId, touch },
      dependencies
    );
    assert.equal(attribution.ok, true);
    assert.equal(admin.lastAttributionRpcUserId, null);

    admin.failNextLinkUpdate = true;
    const failed = await recordGrowthJourneyEvent(
      { eventType: "account_created", userId, visitorId },
      dependencies
    );
    assert.equal(failed.ok, false);
    assert.equal([...admin.attributionRows.values()][0]?.user_id, null);

    const retried = await recordGrowthJourneyEvent(
      { eventType: "account_created", userId, visitorId },
      dependencies
    );
    assert.equal(retried.ok, true);
    assert.equal(retried.id, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    assert.equal([...admin.attributionRows.values()][0]?.user_id, userId);
  } finally {
    if (previousSecret === undefined) {
      delete process.env.GROWTH_ATTRIBUTION_HMAC_SECRET;
    } else {
      process.env.GROWTH_ATTRIBUTION_HMAC_SECRET = previousSecret;
    }
  }
});

test("a delayed touch links an existing customer from a consented request event without account_created", async () => {
  const previousSecret = process.env.GROWTH_ATTRIBUTION_HMAC_SECRET;
  process.env.GROWTH_ATTRIBUTION_HMAC_SECRET = "c".repeat(64);

  try {
    for (const eventType of ["request_started", "request_created"] as const) {
      const admin = new FakeGrowthAdmin();
      const dependencies = {
        getAdmin: () => admin as never,
        now: () => "2026-08-28T10:01:00.000Z",
      };
      const event = await recordGrowthJourneyEvent(
        {
          eventType,
          userId,
          visitorId,
          attemptId: "33333333-3333-4333-8333-333333333333",
          orderId: eventType === "request_created"
            ? "44444444-4444-4444-8444-444444444444"
            : null,
        },
        dependencies
      );
      assert.equal(event.ok, true, eventType);

      const attribution = await recordGrowthAttributionTouchServer(
        { visitorId, deliveryId, touch },
        dependencies
      );
      assert.equal(attribution.ok, true, eventType);
      assert.equal(admin.lastAttributionRpcUserId, userId, eventType);
    }

    const unrelatedAdmin = new FakeGrowthAdmin();
    const unrelated = await recordGrowthAttributionTouchServer(
      {
        visitorId: "55555555-5555-4555-8555-555555555555",
        deliveryId,
        touch,
      },
      { getAdmin: () => unrelatedAdmin as never }
    );
    assert.equal(unrelated.ok, true);
    assert.equal(unrelatedAdmin.lastAttributionRpcUserId, null);
  } finally {
    if (previousSecret === undefined) {
      delete process.env.GROWTH_ATTRIBUTION_HMAC_SECRET;
    } else {
      process.env.GROWTH_ATTRIBUTION_HMAC_SECRET = previousSecret;
    }
  }
});

test("a consented identity link survives auth-before-touch ordering without becoming account_created", async () => {
  const previousSecret = process.env.GROWTH_ATTRIBUTION_HMAC_SECRET;
  process.env.GROWTH_ATTRIBUTION_HMAC_SECRET = "e".repeat(64);
  const admin = new FakeGrowthAdmin();
  const dependencies = {
    getAdmin: () => admin as never,
    now: () => "2026-08-28T10:01:00.000Z",
  };

  try {
    const identity = await recordGrowthJourneyEvent(
      {
        eventType: "identity_linked",
        userId,
        visitorId,
        purpose: "analytics",
        consentVersion: "consent-mode-v2",
      },
      dependencies
    );
    assert.equal(identity.ok, true);
    assert.equal(admin.journeyRows.length, 1);
    assert.equal(admin.journeyRows[0]?.event_type, "identity_linked");
    assert.notEqual(admin.journeyRows[0]?.visitor_hash, null);

    const attribution = await recordGrowthAttributionTouchServer(
      { visitorId, deliveryId, touch },
      dependencies
    );
    assert.equal(attribution.ok, true);
    assert.equal(admin.lastAttributionRpcUserId, userId);
    assert.equal([...admin.attributionRows.values()][0]?.user_id, userId);
    assert.equal(
      admin.journeyRows.some((row) => row.event_type === "account_created"),
      false
    );
  } finally {
    if (previousSecret === undefined) {
      delete process.env.GROWTH_ATTRIBUTION_HMAC_SECRET;
    } else {
      process.env.GROWTH_ATTRIBUTION_HMAC_SECRET = previousSecret;
    }
  }
});

test("request start purposes create independent idempotent rows before a late public touch", async () => {
  const previousSecret = process.env.GROWTH_ATTRIBUTION_HMAC_SECRET;
  process.env.GROWTH_ATTRIBUTION_HMAC_SECRET = "d".repeat(64);
  const admin = new FakeGrowthAdmin();
  const dependencies = {
    getAdmin: () => admin as never,
    now: () => "2026-08-28T10:01:00.000Z",
  };
  const attemptId = "66666666-6666-4666-8666-666666666666";

  try {
    const reminderFirst = await recordGrowthJourneyEvent(
      {
        eventType: "request_started",
        userId,
        attemptId,
        purpose: "reminder",
        consentVersion: "abandoned-request-v1",
      },
      dependencies
    );
    assert.equal(reminderFirst.ok, true);
    assert.equal(admin.journeyRows.length, 1);
    assert.equal(admin.journeyRows[0]?.visitor_hash, null);
    assert.equal(admin.journeyRows[0]?.safe_metadata.purpose, "reminder");

    const analyticsStart = await recordGrowthJourneyEvent(
      {
        eventType: "request_started",
        userId,
        attemptId,
        visitorId,
        purpose: "analytics",
        consentVersion: "consent-mode-v2",
      },
      dependencies
    );
    assert.equal(analyticsStart.ok, true);
    assert.equal(admin.journeyRows.length, 2);
    assert.equal(admin.journeyRows[0]?.visitor_hash, null);
    assert.notEqual(admin.journeyRows[1]?.visitor_hash, null);
    assert.equal(admin.journeyRows[1]?.safe_metadata.purpose, "analytics");

    const reminderReplay = await recordGrowthJourneyEvent(
      {
        eventType: "request_started",
        userId,
        attemptId,
        purpose: "reminder",
        consentVersion: "abandoned-request-v1",
      },
      dependencies
    );
    const analyticsReplay = await recordGrowthJourneyEvent(
      {
        eventType: "request_started",
        userId,
        attemptId,
        visitorId,
        purpose: "analytics",
        consentVersion: "consent-mode-v2",
      },
      dependencies
    );
    assert.equal(reminderReplay.ok, true);
    assert.equal(analyticsReplay.ok, true);
    assert.equal(admin.journeyRows.length, 2);

    const lateTouch = await recordGrowthAttributionTouchServer(
      { visitorId, deliveryId, touch },
      dependencies
    );
    assert.equal(lateTouch.ok, true);
    assert.equal(admin.lastAttributionRpcUserId, userId);

    const otherUserId = "77777777-7777-4777-8777-777777777777";
    const other = await recordGrowthJourneyEvent(
      { eventType: "request_started", userId: otherUserId, attemptId },
      dependencies
    );
    assert.equal(other.ok, true);
    assert.equal(admin.journeyRows.length, 3);
    assert.equal(admin.journeyRows[0]?.visitor_hash, null);
    assert.notEqual(admin.journeyRows[1]?.visitor_hash, null);
    assert.equal(admin.journeyRows[2]?.visitor_hash, null);
  } finally {
    if (previousSecret === undefined) {
      delete process.env.GROWTH_ATTRIBUTION_HMAC_SECRET;
    } else {
      process.env.GROWTH_ATTRIBUTION_HMAC_SECRET = previousSecret;
    }
  }
});

test("a replayed delivery receipt mutates attribution exactly once", async () => {
  const previousSecret = process.env.GROWTH_ATTRIBUTION_HMAC_SECRET;
  process.env.GROWTH_ATTRIBUTION_HMAC_SECRET = "e".repeat(64);
  const admin = new FakeGrowthAdmin();
  const dependencies = { getAdmin: () => admin as never };
  try {
    const first = await recordGrowthAttributionTouchServer(
      { visitorId, deliveryId, touch },
      dependencies
    );
    const replay = await recordGrowthAttributionTouchServer(
      { visitorId, deliveryId, touch },
      dependencies
    );
    assert.equal(first.ok, true);
    assert.equal(replay.ok, true);
    assert.equal(admin.attributionRpcInvocations, 2);
    assert.equal(admin.attributionMutations, 1);
    assert.equal([...admin.attributionRows.values()][0]?.touch_count, 1);
    assert.equal(admin.attributionReceipts.size, 1);
  } finally {
    if (previousSecret === undefined) {
      delete process.env.GROWTH_ATTRIBUTION_HMAC_SECRET;
    } else {
      process.env.GROWTH_ATTRIBUTION_HMAC_SECRET = previousSecret;
    }
  }
});

test("dual-read preserves pre-cutover rows made with either the dedicated or fallback key", async () => {
  const previousCurrent = process.env.GROWTH_ATTRIBUTION_HMAC_SECRET;
  const previousLegacy = process.env.GROWTH_ATTRIBUTION_LEGACY_HMAC_SECRET;
  const previousService = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const currentSecret = "current-dedicated-growth-secret-000000000000000000000001";
  const legacySecret = "historical-growth-secret-0000000000000000000000000002";
  process.env.GROWTH_ATTRIBUTION_HMAC_SECRET = currentSecret;
  process.env.GROWTH_ATTRIBUTION_LEGACY_HMAC_SECRET = legacySecret;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  const legacyHash = hashGrowthVisitorId(visitorId, legacySecret);
  const currentHash = hashGrowthVisitorId(visitorId, currentSecret);

  try {
    for (const [label, existingHash] of [
      ["former dedicated", currentHash],
      ["service-role fallback", legacyHash],
    ] as const) {
      const admin = new FakeGrowthAdmin();
      admin.attributionRows.set(existingHash, {
        id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        user_id: null,
        touch_count: 1,
        visitor_hash_version: "pre-v2-key-unknown",
      });
      const dependencies = { getAdmin: () => admin as never };

      const account = await recordGrowthJourneyEvent(
        {
          eventType: "account_created",
          userId,
          visitorId,
          purpose: "analytics",
          consentVersion: "consent-mode-v2",
        },
        dependencies
      );
      assert.equal(account.ok, true, label);
      assert.equal(admin.attributionRows.get(existingHash)?.user_id, userId, label);
      assert.equal(admin.journeyRows[0]?.visitor_hash, currentHash, label);
      assert.equal(admin.journeyRows[0]?.visitor_hash_version, "dedicated-v2", label);

      const attribution = await recordGrowthAttributionTouchServer(
        { visitorId, deliveryId, touch },
        dependencies
      );
      assert.equal(attribution.ok, true, label);
      assert.equal(admin.lastAttributionRpcHash, existingHash, label);
      assert.equal(admin.lastAttributionRpcHashVersion, "pre-v2-key-unknown", label);
      assert.equal(admin.attributionRows.get(existingHash)?.touch_count, 2, label);
      assert.equal(admin.attributionRows.size, 1, label);
    }
  } finally {
    if (previousCurrent === undefined) delete process.env.GROWTH_ATTRIBUTION_HMAC_SECRET;
    else process.env.GROWTH_ATTRIBUTION_HMAC_SECRET = previousCurrent;
    if (previousLegacy === undefined) delete process.env.GROWTH_ATTRIBUTION_LEGACY_HMAC_SECRET;
    else process.env.GROWTH_ATTRIBUTION_LEGACY_HMAC_SECRET = previousLegacy;
    if (previousService === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = previousService;
  }
});

test("a visitor without a legacy row is written only with the dedicated hash version", async () => {
  const previousCurrent = process.env.GROWTH_ATTRIBUTION_HMAC_SECRET;
  const previousLegacy = process.env.GROWTH_ATTRIBUTION_LEGACY_HMAC_SECRET;
  const currentSecret = "new-dedicated-growth-secret-00000000000000000000000001";
  const legacySecret = "legacy-read-only-growth-secret-00000000000000000000002";
  process.env.GROWTH_ATTRIBUTION_HMAC_SECRET = currentSecret;
  process.env.GROWTH_ATTRIBUTION_LEGACY_HMAC_SECRET = legacySecret;
  const admin = new FakeGrowthAdmin();

  try {
    const result = await recordGrowthAttributionTouchServer(
      { visitorId, deliveryId, touch },
      { getAdmin: () => admin as never }
    );
    assert.equal(result.ok, true);
    assert.equal(
      admin.lastAttributionRpcHash,
      hashGrowthVisitorId(visitorId, currentSecret)
    );
    assert.equal(admin.lastAttributionRpcHashVersion, "dedicated-v2");
    assert.equal(
      admin.attributionRows.has(hashGrowthVisitorId(visitorId, legacySecret)),
      false
    );
  } finally {
    if (previousCurrent === undefined) delete process.env.GROWTH_ATTRIBUTION_HMAC_SECRET;
    else process.env.GROWTH_ATTRIBUTION_HMAC_SECRET = previousCurrent;
    if (previousLegacy === undefined) delete process.env.GROWTH_ATTRIBUTION_LEGACY_HMAC_SECRET;
    else process.env.GROWTH_ATTRIBUTION_LEGACY_HMAC_SECRET = previousLegacy;
  }
});

test("attribution fails closed when the dedicated key reuses the legacy key", async () => {
  const previousCurrent = process.env.GROWTH_ATTRIBUTION_HMAC_SECRET;
  const previousLegacy = process.env.GROWTH_ATTRIBUTION_LEGACY_HMAC_SECRET;
  const reusedSecret = "must-not-be-reused-growth-secret-00000000000000000000001";
  process.env.GROWTH_ATTRIBUTION_HMAC_SECRET = reusedSecret;
  process.env.GROWTH_ATTRIBUTION_LEGACY_HMAC_SECRET = reusedSecret;
  const admin = new FakeGrowthAdmin();

  try {
    const result = await recordGrowthAttributionTouchServer(
      { visitorId, deliveryId, touch },
      { getAdmin: () => admin as never }
    );
    assert.deepEqual(result, {
      ok: false,
      unavailable: true,
      reason: "attribution_unavailable",
    });
    assert.equal(admin.attributionRpcInvocations, 0);
  } finally {
    if (previousCurrent === undefined) delete process.env.GROWTH_ATTRIBUTION_HMAC_SECRET;
    else process.env.GROWTH_ATTRIBUTION_HMAC_SECRET = previousCurrent;
    if (previousLegacy === undefined) delete process.env.GROWTH_ATTRIBUTION_LEGACY_HMAC_SECRET;
    else process.env.GROWTH_ATTRIBUTION_LEGACY_HMAC_SECRET = previousLegacy;
  }
});

test("a legacy journey-only match binds the user but creates only a dedicated attribution row", async () => {
  const previousCurrent = process.env.GROWTH_ATTRIBUTION_HMAC_SECRET;
  const previousLegacy = process.env.GROWTH_ATTRIBUTION_LEGACY_HMAC_SECRET;
  const previousService = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const currentSecret = "journey-current-growth-secret-000000000000000000000001";
  const legacySecret = "journey-legacy-growth-secret-0000000000000000000000002";
  process.env.GROWTH_ATTRIBUTION_HMAC_SECRET = currentSecret;
  process.env.GROWTH_ATTRIBUTION_LEGACY_HMAC_SECRET = legacySecret;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  const admin = new FakeGrowthAdmin();
  const legacyHash = hashGrowthVisitorId(visitorId, legacySecret);
  const currentHash = hashGrowthVisitorId(visitorId, currentSecret);
  admin.journeyRows.push({
    id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    event_key: "growth:legacy-journey-only",
    event_type: "account_created",
    user_id: userId,
    visitor_hash: legacyHash,
    visitor_hash_version: "legacy-service-role-v1",
    safe_metadata: {},
    created_at: "2026-08-27T10:00:00.000Z",
  });

  try {
    const result = await recordGrowthAttributionTouchServer(
      { visitorId, deliveryId, touch },
      { getAdmin: () => admin as never }
    );
    assert.equal(result.ok, true);
    assert.equal(admin.lastAttributionRpcUserId, userId);
    assert.equal(admin.lastAttributionRpcHash, currentHash);
    assert.equal(admin.lastAttributionRpcHashVersion, "dedicated-v2");
    assert.equal(admin.attributionRows.has(legacyHash), false);
    assert.equal(admin.attributionRows.get(currentHash)?.user_id, userId);
  } finally {
    if (previousCurrent === undefined) delete process.env.GROWTH_ATTRIBUTION_HMAC_SECRET;
    else process.env.GROWTH_ATTRIBUTION_HMAC_SECRET = previousCurrent;
    if (previousLegacy === undefined) delete process.env.GROWTH_ATTRIBUTION_LEGACY_HMAC_SECRET;
    else process.env.GROWTH_ATTRIBUTION_LEGACY_HMAC_SECRET = previousLegacy;
    if (previousService === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = previousService;
  }
});

test("a shared visitor hash with two accounts is rejected before attribution mutation", async () => {
  const previousSecret = process.env.GROWTH_ATTRIBUTION_HMAC_SECRET;
  process.env.GROWTH_ATTRIBUTION_HMAC_SECRET = "f".repeat(64);
  const admin = new FakeGrowthAdmin();
  const dependencies = { getAdmin: () => admin as never };
  const userB = "99999999-9999-4999-8999-999999999999";
  try {
    assert.equal((await recordGrowthJourneyEvent(
      { eventType: "account_created", userId, visitorId },
      dependencies
    )).ok, true);
    assert.equal((await recordGrowthAttributionTouchServer(
      { visitorId, deliveryId, touch },
      dependencies
    )).ok, true);
    assert.equal((await recordGrowthJourneyEvent(
      {
        eventType: "request_started",
        userId: userB,
        visitorId,
        attemptId: "abababab-abab-4bab-8bab-abababababab",
      },
      dependencies
    )).ok, true);

    const conflicted = await recordGrowthAttributionTouchServer(
      {
        visitorId,
        deliveryId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
        touch: { ...touch, campaign: "stage2_de" },
      },
      dependencies
    );
    assert.equal(conflicted.ok, true);
    assert.equal("ignored" in conflicted && conflicted.ignored, true);
    assert.equal(admin.attributionRpcInvocations, 1);
    assert.equal(admin.attributionMutations, 1);
    assert.equal([...admin.attributionRows.values()][0]?.user_id, userId);
    assert.equal([...admin.attributionRows.values()][0]?.touch_count, 1);
  } finally {
    if (previousSecret === undefined) {
      delete process.env.GROWTH_ATTRIBUTION_HMAC_SECRET;
    } else {
      process.env.GROWTH_ATTRIBUTION_HMAC_SECRET = previousSecret;
    }
  }
});

test("private landing paths and unknown identity-link RPC outcomes fail closed", async () => {
  const previousSecret = process.env.GROWTH_ATTRIBUTION_HMAC_SECRET;
  process.env.GROWTH_ATTRIBUTION_HMAC_SECRET = "9".repeat(64);
  try {
    const privateTouch = await recordGrowthAttributionTouchServer({
      visitorId,
      deliveryId,
      touch: { ...touch, landingPath: "/dashboard" },
    });
    assert.equal(privateTouch.ok, false);
    assert.equal("reason" in privateTouch && privateTouch.reason, "invalid_attribution");

    const admin = new FakeGrowthAdmin();
    admin.linkOutcomeOverride = "future_contract_value";
    const result = await recordGrowthJourneyEvent(
      { eventType: "account_created", userId, visitorId },
      { getAdmin: () => admin as never }
    );
    assert.equal(result.ok, false);
    assert.equal("unavailable" in result && result.unavailable, true);
  } finally {
    if (previousSecret === undefined) {
      delete process.env.GROWTH_ATTRIBUTION_HMAC_SECRET;
    } else {
      process.env.GROWTH_ATTRIBUTION_HMAC_SECRET = previousSecret;
    }
  }
});
