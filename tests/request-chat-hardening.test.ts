import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import {
  filterCustomerVisibleRequestMessages,
  type RequestMessageVisibilityRow,
} from "../src/lib/workOrders/messageVisibility";

function source(...segments: string[]) {
  return readFileSync(resolve(process.cwd(), ...segments), "utf8");
}

test("customer message projection excludes hidden and internal rows", () => {
  const base = {
    request_id: "request-1",
    sender_id: "customer-1",
    sender_role: "customer",
    created_at: "2026-08-05T10:00:00.000Z",
  };
  const rows: RequestMessageVisibilityRow[] = [
    { ...base, id: "visible", message: "Visible", is_internal: false, visibility_status: "visible" },
    { ...base, id: "hidden", message: "Hidden", is_internal: false, visibility_status: "hidden" },
    { ...base, id: "archived", message: "Archived", is_internal: false, visibility_status: "archived" },
    { ...base, id: "internal", message: "Internal", is_internal: true, visibility_status: "visible" },
  ];

  assert.deepEqual(filterCustomerVisibleRequestMessages(rows), [
    {
      id: "visible",
      request_id: "request-1",
      sender_id: "customer-1",
      sender_role: "customer",
      message: "Visible",
      created_at: "2026-08-05T10:00:00.000Z",
    },
  ]);
});

test("request chat API is bounded, private, fail-closed, and customer-safe", () => {
  const route = source("src", "app", "api", "requests", "[id]", "messages", "route.ts");

  assert.match(route, /const MESSAGE_HISTORY_LIMIT = 200/);
  assert.match(route, /"Cache-Control": "private, no-store, max-age=0"/);
  assert.match(route, /\.eq\("request_id", id\)[\s\S]*\.eq\("is_internal", false\)/);
  assert.match(route, /visibility_status\.is\.null,visibility_status\.eq\.visible/);
  assert.match(route, /\.limit\(MESSAGE_HISTORY_LIMIT \+ 1\)/);
  assert.match(route, /history_limited: historyLimited/);
  assert.match(route, /const body = await request\.json\(\)\.catch\(\(\) => null\)/);
  assert.match(route, /is_internal: false/);
  assert.match(route, /Messages are temporarily unavailable\. Please try again\./);
  assert.match(route, /"Retry-After": "3"/);
  assert.doesNotMatch(route, /error\.message/);
  assert.doesNotMatch(route, /admin_notes|hidden_reason|source_reference|storage_path|signed_url/);
});

test("request chat UI preserves loaded history during reconnects", () => {
  const chat = source("src", "components", "RequestChat.tsx");
  const orderPage = source("src", "app", "dashboard", "orders", "[id]", "page.tsx");

  assert.match(chat, /type ChatSyncState = "loading" \| "live" \| "reconnecting" \| "unavailable"/);
  assert.match(chat, /if \(fetchInFlightRef\.current\) return fetchInFlightRef\.current/);
  assert.match(chat, /MESSAGE_REQUEST_TIMEOUT_MS/);
  assert.match(chat, /document\.addEventListener\("visibilitychange", refreshWhenAvailable\)/);
  assert.match(chat, /window\.addEventListener\("online", refreshWhenAvailable\)/);
  assert.match(chat, /setSyncState\("reconnecting"\)/);
  assert.match(chat, /Secure and live/);
  assert.match(chat, /Messages stay securely attached to this order\./);
  assert.match(chat, /formatMessageDay/);
  assert.match(chat, /role="log"/);
  assert.match(chat, /aria-label=\{sending \? "Sending message" : "Send message"\}/);
  assert.doesNotMatch(orderPage, /table: "request_messages"/);
});

test("request messages are API-only after the additive security migration", () => {
  const migration = source(
    "supabase",
    "migrations",
    "20260805201813_request_chat_security_hardening.sql"
  );
  const verification = source("scripts", "verify-request-chat-security.sql");

  assert.match(migration, /alter table public\.request_messages enable row level security/i);
  assert.match(migration, /revoke all privileges on table public\.request_messages from anon/i);
  assert.match(migration, /revoke all privileges on table public\.request_messages from authenticated/i);
  assert.match(migration, /grant select, insert, update, delete on table public\.request_messages to service_role/i);
  assert.match(migration, /drop policy if exists "Allow authenticated select request messages"/i);
  assert.match(migration, /drop policy if exists "Allow authenticated insert request messages"/i);
  assert.doesNotMatch(migration, /drop table|drop column|delete\s+from|truncate\s+table/i);
  assert.match(verification, /anon_select_blocked/);
  assert.match(verification, /authenticated_select_blocked/);
  assert.match(verification, /authenticated_insert_blocked/);
});
