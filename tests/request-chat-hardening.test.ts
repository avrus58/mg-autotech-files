import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import test from "node:test";
import * as React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import * as icons from "lucide-react";
import ts from "typescript";
import { supportedLocales, intlLocaleByCode, type LocaleCode } from "../src/lib/i18nConfig";
import * as ordersCopy from "../src/lib/i18n/customer-workflow-orders-translations";
import * as runtimeCopy from "../src/lib/i18n/customer-runtime-translations";
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

type ChatProps = { requestId: string; senderRole: "customer" | "admin"; variant?: "default" | "workspace" };
type MessageRow = { id: string; request_id: string; sender_id: string; sender_role: "customer" | "admin"; message: string; created_at: string };
type NodeProps = Record<string, unknown> & { children?: React.ReactNode };
type ChatElement = React.ReactElement<NodeProps>;
type WireResponse = { ok: boolean; json: () => Promise<unknown> };
type Effect = { dependencies: readonly unknown[]; create: () => void | (() => void); cleanup?: () => void; pending: boolean; layout: boolean };

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function children(node: React.ReactNode): React.ReactNode[] {
  if (Array.isArray(node)) return node.flatMap(children);
  return node === null || node === undefined || typeof node === "boolean" ? [] : [node];
}
function elements(node: React.ReactNode): ChatElement[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!React.isValidElement(node)) return [];
  const element = node as ChatElement;
  return [element, ...children(element.props.children).flatMap(elements)];
}
function nodeText(node: React.ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(nodeText).join("");
  return React.isValidElement(node) ? children((node as ChatElement).props.children).map(nodeText).join("") : "";
}
function fixture(requestId: string, id: string, message = id, sender_role: MessageRow["sender_role"] = "admin"): MessageRow {
  return { id, request_id: requestId, sender_id: "synthetic-sender", sender_role, message, created_at: "2026-10-07T10:00:00.000Z" };
}

// The real component's imports, JSX, callbacks, async continuation and effects
// execute unchanged. Hook/timer bookkeeping and the authenticated transport are
// deterministic doubles; this is not React DOM, authenticated E2E or geometry QA.
function chatHarness(initial: ChatProps = { requestId: "request-a", senderRole: "customer" }, initialLocale: LocaleCode = "en") {
  const filename = "src/components/RequestChat.tsx";
  const code = ts.transpileModule(source(filename), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const states: unknown[] = [];
  const refs: Array<{ current: unknown }> = [];
  const callbacks: Array<{ dependencies: readonly unknown[]; value: (...args: never[]) => unknown }> = [];
  const effects: Effect[] = [];
  const timers = new Map<number, { callback: () => void; delay: number; interval: boolean }>();
  const listeners = new Map<string, Set<() => void>>();
  const history = new Map<string, MessageRow[]>();
  const posts: Array<{ url: string; init: RequestInit; response: ReturnType<typeof deferred<WireResponse>> }> = [];
  const gets: Array<{ url: string; init: RequestInit }> = [];
  const scrolls: Array<{ requestId: string; senderRole: string; behavior: unknown }> = [];
  let props = initial;
  let locale = initialLocale;
  let current: React.ReactNode;
  let cursor = 0;
  let timerId = 0;
  let mutations = 0;
  let nextGet: ReturnType<typeof deferred<WireResponse>> | null = null;
  const changed = (before: readonly unknown[], after: readonly unknown[]) => before.length !== after.length || after.some((value, index) => !Object.is(value, before[index]));
  const forbidden = () => { throw new Error("RequestChat tests must not access browser storage, credentials or a real service."); };
  const addListener = (name: string, callback: () => void) => {
    if (!listeners.has(name)) listeners.set(name, new Set());
    listeners.get(name)!.add(callback);
  };
  const removeListener = (name: string, callback: () => void) => listeners.get(name)?.delete(callback);
  const scrollArea = { scrollHeight: 800, scrollTop: 700, clientHeight: 100,
    scrollTo(options: { behavior: unknown }) { scrolls.push({ requestId: props.requestId, senderRole: props.senderRole, behavior: options.behavior }); },
  };
  const hooks = {
    useState(initialValue: unknown) {
      const index = cursor++;
      if (!(index in states)) states[index] = typeof initialValue === "function" ? (initialValue as () => unknown)() : initialValue;
      return [states[index], (value: unknown) => {
        mutations += 1;
        states[index] = typeof value === "function" ? (value as (previous: unknown) => unknown)(states[index]) : value;
      }];
    },
    useRef(initialValue: unknown) {
      const index = cursor++;
      if (!(index in refs)) refs[index] = { current: initialValue };
      return refs[index];
    },
    useCallback(value: (...args: never[]) => unknown, dependencies: readonly unknown[]) {
      const index = cursor++;
      if (!callbacks[index] || changed(callbacks[index].dependencies, dependencies)) callbacks[index] = { value, dependencies: [...dependencies] };
      return callbacks[index].value;
    },
    useEffect(create: Effect["create"], dependencies: readonly unknown[]) { registerEffect(create, dependencies, false); },
    useLayoutEffect(create: Effect["create"], dependencies: readonly unknown[]) { registerEffect(create, dependencies, true); },
  };
  function registerEffect(create: Effect["create"], dependencies: readonly unknown[], layout: boolean) {
    const index = cursor++;
    const previous = effects[index];
    if (!previous || changed(previous.dependencies, dependencies)) effects[index] = {
      dependencies: [...dependencies], create, cleanup: previous?.cleanup, pending: true, layout,
    };
  }
  const windowDouble = {
    setTimeout(callback: () => void, delay: number) { const id = ++timerId; timers.set(id, { callback, delay, interval: false }); return id; },
    clearTimeout(id: number) { timers.delete(id); },
    setInterval(callback: () => void, delay: number) { const id = ++timerId; timers.set(id, { callback, delay, interval: true }); return id; },
    clearInterval(id: number) { timers.delete(id); },
    addEventListener: addListener, removeEventListener: removeListener,
  };
  const documentDouble = { visibilityState: "visible", addEventListener: addListener, removeEventListener: removeListener };
  const navigatorDouble = { onLine: true };
  const exports: Record<string, unknown> = {};
  const context: Record<string, unknown> = {
    exports, AbortController, window: windowDouble, document: documentDouble, navigator: navigatorDouble,
    fetch: forbidden, XMLHttpRequest: forbidden,
    require(name: string) {
      if (name === "react") return { ...React, ...hooks };
      if (name === "react/jsx-runtime") return jsxRuntime;
      if (name === "lucide-react") return icons;
      if (name === "@/lib/i18nConfig") return { intlLocaleByCode };
      if (name === "@/lib/useActiveLocale") return { useActiveLocale: () => locale };
      if (name === "@/lib/i18n/customer-workflow-orders-translations") return ordersCopy;
      if (name === "@/lib/i18n/customer-runtime-translations") return runtimeCopy;
      if (name === "@/lib/authGuards") return { authenticatedFetch(url: string, init: RequestInit = {}) {
        assert.match(url, /^\/api\/requests\/request-[ab]\/messages$/u);
        if (init.method === "POST") {
          const response = deferred<WireResponse>();
          posts.push({ url, init, response });
          return response.promise;
        }
        assert.equal(init.cache, "no-store");
        gets.push({ url, init });
        if (nextGet) {
          const pending = nextGet;
          nextGet = null;
          init.signal?.addEventListener("abort", () => pending.reject(new Error("synthetic aborted history")), { once: true });
          return pending.promise;
        }
        const snapshot = (history.get(url) ?? []).map((item) => ({ ...item }));
        return Promise.resolve({ ok: true, json: async () => ({ messages: snapshot, history_limited: false }) });
      } };
      throw new Error(`Unexpected RequestChat test import: ${name}`);
    },
  };
  for (const target of [context, windowDouble]) {
    for (const name of ["localStorage", "sessionStorage", "credentials"]) Object.defineProperty(target, name, { get: forbidden });
  }
  runInNewContext(code, context);
  const component = exports.default as (props: ChatProps) => React.ReactNode;
  assert.equal(typeof component, "function");
  function commitEffects(layout: boolean) {
    for (const effect of effects) {
      if (!effect?.pending || effect.layout !== layout) continue;
      effect.pending = false;
      effect.cleanup?.();
      effect.cleanup = effect.create() || undefined;
    }
  }
  function render(next = props, passive = true) {
    props = next;
    cursor = 0;
    current = component(props);
    const log = elements(current).find(({ props: elementProps }) => elementProps.role === "log");
    assert.ok(log);
    (log.props.ref as { current: unknown }).current = scrollArea;
    commitEffects(true);
    if (passive) commitEffects(false);
    return current;
  }
  function control(type: string, predicate: (props: NodeProps) => boolean = () => true) {
    const matches = elements(current).filter((element) => element.type === type && predicate(element.props));
    assert.equal(matches.length, 1, `one actual ${type} control`);
    return matches[0];
  }
  function runTimers(delay: number, intervals = false) {
    for (const [id, timer] of [...timers]) {
      if (timer.delay !== delay || (timer.interval && !intervals)) continue;
      if (!timer.interval) timers.delete(id);
      timer.callback();
    }
  }
  async function flush(runZeroTimers = true) {
    for (let turn = 0; turn < 8; turn++) {
      await Promise.resolve();
      render();
      if (runZeroTimers) runTimers(0);
    }
    render();
  }
  async function drainWithoutRender() {
    for (let turn = 0; turn < 12; turn++) await Promise.resolve();
  }
  function edit(value: string, rerender = true) {
    (control("textarea").props.onChange as (event: { target: { value: string } }) => void)({ target: { value } });
    if (rerender) render();
  }
  function send(rerender = true) {
    const handler = control("button", (value) => value["aria-label"] === "Send message" || value["aria-label"] === "Sending message").props.onClick as () => void;
    handler();
    if (rerender) render();
    return handler;
  }
  async function settle(index: number, result: "success" | "failure" | "reject" = "success", delayJson = false) {
    const post = posts[index];
    assert.ok(post, `existing deferred POST ${index}`);
    if (result === "reject") post.response.reject(new Error("synthetic connection failure"));
    else {
      const requestId = post.url.split("/")[3];
      const message = fixture(requestId, `stored-${index}`, JSON.parse(String(post.init.body)).message, "customer");
      if (result === "success") history.set(post.url, [...(history.get(post.url) ?? []), message]);
      const json = deferred<unknown>();
      post.response.resolve({ ok: result === "success", json: () => json.promise });
      await flush(false);
      if (delayJson) return { resolve: () => json.resolve({ message }) };
      json.resolve(result === "success" ? { message } : {});
    }
    await flush();
  }
  render();
  return {
    render, flush, drainWithoutRender, edit, send, settle, posts, gets, scrolls, timers, history, listeners,
    control,
    message: () => String(control("textarea").props.value),
    body: () => nodeText(current),
    sendDisabled: () => control("button", (value) => value["aria-label"] === "Send message" || value["aria-label"] === "Sending message").props.disabled,
    sending: () => elements(current).some(({ props: value }) => value["aria-label"] === "Sending message"),
    errors: () => elements(current).filter(({ props: value }) => value.role === "alert").map(nodeText),
    stored: () => elements(current).filter(({ props: value }) => value["data-no-translate"] === true).map(nodeText),
    mutations: () => mutations,
    changeLocale(next: LocaleCode) { locale = next; render(); },
    queueHistory() { nextGet = deferred<WireResponse>(); return nextGet; },
    emit(name: string) { for (const listener of listeners.get(name) ?? []) listener(); },
    tick: runTimers,
    offline(value: boolean) { navigatorDouble.onLine = !value; },
    visible(value: boolean) { documentDouble.visibilityState = value ? "visible" : "hidden"; },
    nearBottom(value: boolean) { scrollArea.scrollTop = value ? 700 : 0; },
    unmount() {
      for (const effect of effects) effect?.cleanup?.();
      for (const ref of refs) if (ref?.current === scrollArea) ref.current = null;
    },
  };
}

test("actual chat send preserves a newer editable draft while storing only its submitted text", async () => {
  const h = chatHarness();
  await h.flush();
  h.edit("  Submitted text  ");
  h.send();
  assert.equal(h.posts.length, 1);
  assert.equal(h.sending(), true);
  assert.equal(h.control("textarea").props.disabled, false, "do not evade the draft race by disabling the composer");
  assert.equal(h.posts[0].init.method, "POST");
  assert.deepEqual(Object.entries(h.posts[0].init.headers as Record<string, string>), [["Content-Type", "application/json"]]);
  assert.equal(h.posts[0].init.body, JSON.stringify({ message: "Submitted text" }));
  h.edit("Newer unsent draft");
  await h.settle(0);
  assert.equal(h.message(), "Newer unsent draft");
  assert.deepEqual(h.stored(), ["Submitted text"]);
  assert.equal(h.sending(), false);
  assert.equal(h.sendDisabled(), false);
  assert.deepEqual(h.errors(), []);
});

test("actual chat clears only the unchanged submitted draft, including the response-body delay", async () => {
  const unchanged = chatHarness();
  await unchanged.flush();
  unchanged.edit("  Unchanged draft  ");
  unchanged.send();
  await unchanged.settle(0);
  assert.equal(unchanged.message(), "");
  assert.deepEqual(unchanged.stored(), ["Unchanged draft"]);
  assert.equal(unchanged.sendDisabled(), true);

  const edited = chatHarness();
  await edited.flush();
  edited.edit("original");
  edited.send();
  const body = await edited.settle(0, "success", true);
  assert.ok(body);
  edited.edit("later body-stage draft");
  body.resolve();
  await edited.flush();
  assert.equal(edited.message(), "later body-stage draft");
  assert.deepEqual(edited.stored(), ["original"]);
});

test("editing away and back creates a distinct draft identity rather than clearing by text equality", async () => {
  const h = chatHarness();
  await h.flush();
  h.edit("same text");
  h.send();
  h.edit("different text");
  h.edit("same text");
  await h.settle(0);
  assert.equal(h.message(), "same text");
  assert.deepEqual(h.stored(), ["same text"]);
  assert.equal(h.sendDisabled(), false);
});

test("actual click and Enter handlers enforce same-turn duplicate protection and retain Shift+Enter and 4000 limits", async () => {
  const h = chatHarness();
  const key = (name: string, shiftKey: boolean) => {
    let prevented = false;
    (h.control("textarea").props.onKeyDown as (event: { key: string; shiftKey: boolean; preventDefault: () => void }) => void)({ key: name, shiftKey, preventDefault: () => { prevented = true; } });
    return prevented;
  };
  h.edit("not ready");
  h.send();
  assert.equal(h.posts.length, 0, "history gates sending");
  await h.flush();
  assert.equal(h.control("textarea").props.maxLength, 4000);
  h.edit("x".repeat(4001));
  h.send();
  assert.equal(h.posts.length, 0);
  h.edit(" ");
  h.send();
  assert.equal(h.posts.length, 0);
  h.edit("x".repeat(4000));
  assert.equal(h.sendDisabled(), false);
  assert.equal(key("Enter", true), false);
  assert.equal(h.posts.length, 0);
  const sameTurn = h.send(false);
  sameTurn();
  assert.equal(key("Enter", false), true);
  assert.equal(h.posts.length, 1, "stale click/keyboard closures cannot bypass the operation lock");
  h.render();
  await h.settle(0, "failure");
  assert.equal(h.message(), "x".repeat(4000));
  assert.equal(h.sending(), false);
  assert.equal(h.errors().length, 1);
  h.send();
  assert.equal(h.posts.length, 2, "current failure unlocks retry");
  await h.settle(1);
  assert.equal(h.message(), "");
});

test("late success, error and finally cannot touch a different request or sender-role context", async () => {
  for (const result of ["success", "failure", "reject"] as const) {
    for (const target of [{ requestId: "request-b", senderRole: "customer" }, { requestId: "request-a", senderRole: "admin" }] as const) {
      const h = chatHarness();
      await h.flush();
      h.edit("old context draft");
      h.send();
      h.render(target);
      await h.flush();
      h.edit("current context draft");
      const before = { mutations: h.mutations(), gets: h.gets.length, scrolls: h.scrolls.length, body: h.body() };
      await h.settle(0, result);
      assert.equal(h.message(), "current context draft", `${result}:${target.senderRole}:${target.requestId}`);
      assert.equal(h.body(), before.body);
      assert.equal(h.mutations(), before.mutations, "no late state setter, including finally");
      assert.equal(h.gets.length, before.gets, "no old-context reload");
      assert.equal(h.scrolls.length, before.scrolls, "no old-context scroll");
      assert.deepEqual(h.stored(), []);
      assert.deepEqual(h.errors(), []);
      assert.equal(h.sending(), false);
    }
  }
});

test("context identity rejects A-B-A and role round trips even when request text matches again", async () => {
  for (const intermediate of [{ requestId: "request-b", senderRole: "customer" }, { requestId: "request-a", senderRole: "admin" }] as const) {
    const h = chatHarness();
    await h.flush();
    h.edit("old first A");
    h.send();
    h.render(intermediate);
    await h.flush();
    h.render({ requestId: "request-a", senderRole: "customer" });
    await h.flush();
    h.edit("new A draft");
    const before = { mutations: h.mutations(), gets: h.gets.length, scrolls: h.scrolls.length };
    await h.settle(0);
    assert.equal(h.message(), "new A draft");
    assert.deepEqual(h.stored(), []);
    assert.equal(h.mutations(), before.mutations);
    assert.equal(h.gets.length, before.gets);
    assert.equal(h.scrolls.length, before.scrolls);
  }
});

test("an old settlement cannot unlock an overlapping current send or append its message", async () => {
  for (const result of ["success", "failure", "reject"] as const) {
    const h = chatHarness();
    await h.flush();
    h.edit("old A message");
    h.send();
    h.render({ requestId: "request-b", senderRole: "customer" });
    await h.flush();
    h.edit("current B message");
    const currentHandler = h.send(false);
    h.render();
    h.edit("current B newer draft");
    const before = h.mutations();
    await h.settle(0, result);
    assert.equal(h.mutations(), before);
    assert.equal(h.sending(), true, "old finally must not clear the current operation state");
    currentHandler();
    assert.equal(h.posts.length, 2, "old finally must not release the current operation lock");
    assert.equal(h.message(), "current B newer draft");
    assert.deepEqual(h.errors(), []);
    assert.deepEqual(h.stored(), []);
    await h.settle(1);
    assert.equal(h.sending(), false);
    assert.equal(h.message(), "current B newer draft");
    assert.deepEqual(h.stored(), ["current B message"]);
    h.send();
    assert.equal(h.posts.length, 3, "only the owning operation can unlock its successor");
    await h.settle(2, "failure");
  }
});

test("unmount invalidates pending POST and queued success scrolling without late setters or reloads", async () => {
  for (const result of ["success", "failure", "reject"] as const) {
    const h = chatHarness();
    await h.flush();
    h.edit("unmounted draft");
    h.send();
    h.unmount();
    const before = { mutations: h.mutations(), gets: h.gets.length, scrolls: h.scrolls.length };
    const post = h.posts[0];
    if (result === "reject") post.response.reject(new Error("synthetic unmounted failure"));
    else post.response.resolve({ ok: result === "success", json: async () => result === "success" ? { message: fixture("request-a", "late", "late") } : {} });
    for (let turn = 0; turn < 8; turn++) await Promise.resolve();
    h.tick(0);
    assert.equal(h.mutations(), before.mutations);
    assert.equal(h.gets.length, before.gets);
    assert.equal(h.scrolls.length, before.scrolls);
    assert.equal([...h.listeners.values()].every((set) => set.size === 0), true);
  }
});

test("committing a new context invalidates old handlers and queued scrolling before passive reset", async () => {
  const h = chatHarness();
  await h.flush();
  h.edit("old response received");
  h.send();
  const post = h.posts[0];
  const stored = fixture("request-a", "old-stored", "old response received");
  h.history.set(post.url, [stored]);
  post.response.resolve({ ok: true, json: async () => ({ message: stored }) });
  await h.flush(false);
  assert.deepEqual(h.stored(), ["old response received"]);
  const oldScrolls = [...h.timers.values()].filter(({ delay, interval }) => delay === 0 && !interval).map(({ callback }) => callback);
  assert.ok(oldScrolls.length > 0, "real success and history handlers queued zero-delay scrolling");
  h.edit("old callback draft");
  const oldSend = h.control("button", (props) => props["aria-label"] === "Send message").props.onClick as () => void;
  h.render({ requestId: "request-b", senderRole: "customer" }, false);
  const before = { mutations: h.mutations(), posts: h.posts.length, gets: h.gets.length, scrolls: h.scrolls.length };
  oldSend();
  for (const scroll of oldScrolls) scroll();
  assert.equal(h.mutations(), before.mutations);
  assert.equal(h.posts.length, before.posts, "a stale callback must not start a POST using the new context");
  assert.equal(h.gets.length, before.gets);
  assert.equal(h.scrolls.length, before.scrolls);
  await h.flush();
  assert.equal(h.message(), "");
  assert.equal(h.sending(), false);
});

test("a delayed POST body cannot settle after request context changes", async () => {
  const h = chatHarness();
  await h.flush();
  h.edit("submitted before body delay");
  h.send();
  const body = await h.settle(0, "success", true);
  assert.ok(body);
  h.render({ requestId: "request-b", senderRole: "customer" });
  await h.flush();
  h.edit("current B draft");
  const before = { mutations: h.mutations(), gets: h.gets.length, scrolls: h.scrolls.length };
  body.resolve();
  await h.flush();
  assert.equal(h.message(), "current B draft");
  assert.deepEqual(h.stored(), []);
  assert.equal(h.mutations(), before.mutations);
  assert.equal(h.gets.length, before.gets);
  assert.equal(h.scrolls.length, before.scrolls);
});

test("actual history, offline reconnect, visibility refresh and timeout retain loaded messages", async () => {
  const h = chatHarness();
  h.history.set("/api/requests/request-a/messages", [fixture("request-a", "retained", "Loaded history")]);
  await h.flush();
  assert.deepEqual(h.stored(), ["Loaded history"]);
  h.offline(true);
  h.emit("offline");
  h.render();
  assert.ok(h.body().includes("Reconnecting in the background"));
  assert.deepEqual(h.stored(), ["Loaded history"]);
  const count = h.gets.length;
  h.emit("online");
  h.tick(12000, true);
  assert.equal(h.gets.length, count, "offline refresh is gated");
  h.offline(false);
  h.visible(false);
  h.emit("visibilitychange");
  assert.equal(h.gets.length, count, "hidden refresh is gated");
  h.visible(true);
  const pending = h.queueHistory();
  h.emit("online");
  h.emit("visibilitychange");
  assert.equal(h.gets.length, count + 1, "one real GET promise deduplicates overlapping refreshes");
  h.tick(12000);
  await h.flush();
  assert.equal(h.gets[count].init.signal?.aborted, true);
  assert.deepEqual(h.stored(), ["Loaded history"]);
  assert.ok(h.body().includes("Reconnecting in the background"));
  pending.resolve({ ok: true, json: async () => ({ messages: [] }) });
  h.emit("online");
  await h.flush();
  assert.deepEqual(h.stored(), ["Loaded history"]);
  assert.ok(h.body().includes("Secure and live"));
});

test("changing the customer locale keeps the pending operation and newer draft in every supported language", async () => {
  const h = chatHarness();
  await h.flush();
  h.edit("submitted raw text");
  h.send();
  h.edit("newer raw draft");
  for (const { code } of supportedLocales) {
    h.changeLocale(code);
    assert.equal(h.message(), "newer raw draft");
    assert.equal(h.sending(), true);
    assert.ok(h.body().includes(runtimeCopy.formatCustomerMessageCount(code, 0)), code);
    assert.ok(h.body().includes(ordersCopy.customerWorkflowExactT(code, "Secure and live")), code);
  }
  assert.equal(h.posts.length, 1);
  await h.settle(0);
  assert.equal(h.message(), "newer raw draft");
  assert.deepEqual(h.stored(), ["submitted raw text"]);
  assert.equal(h.sending(), false);
});

test("same-context pre-acknowledgement GET JSON cannot erase an acknowledged POST and queues a fresh history read", async () => {
  const h = chatHarness();
  const url = "/api/requests/request-a/messages";
  const original = fixture("request-a", "original-history", "Original loaded history");
  h.history.set(url, [original]);
  await h.flush();
  assert.deepEqual(h.stored(), ["Original loaded history"]);

  // Freeze the response at GET creation. Headers settle before the POST, but
  // JSON deliberately ignores any subsequent AbortSignal and stays pending.
  const snapshot = (h.history.get(url) ?? []).map((item) => ({ ...item }));
  const oldHeaders = h.queueHistory();
  const oldBody = deferred<unknown>();
  h.emit("visibilitychange");
  oldHeaders.resolve({ ok: true, json: () => oldBody.promise });
  await h.flush(false);
  assert.equal(h.gets.length, 2);
  const freshHeaders = h.queueHistory();

  h.edit("Acknowledged submitted message");
  h.send();
  h.edit("Newer unsent draft");
  await h.settle(0);
  assert.deepEqual(h.stored(), ["Original loaded history", "Acknowledged submitted message"]);
  assert.equal(h.gets.length, 2, "keep the existing one-in-flight GET contract until the stale body settles");

  oldBody.resolve({ messages: snapshot, history_limited: false });
  await h.flush();
  assert.deepEqual(h.stored(), ["Original loaded history", "Acknowledged submitted message"], "a stale pre-acknowledgement body cannot replace the stored-message UI while fresh history is held");
  assert.equal(h.message(), "Newer unsent draft");
  assert.equal(h.sending(), false);
  assert.deepEqual(h.errors(), []);
  assert.equal(h.gets.length, 3, "POST reconciliation starts automatically after the old GET lock releases, without another visibility event or poll");
  assert.equal(h.gets[2].url, url);
  assert.equal(h.gets[2].init.cache, "no-store");

  freshHeaders.resolve({ ok: true, json: async () => ({ messages: (h.history.get(url) ?? []).map((item) => ({ ...item })), history_limited: false }) });
  await h.flush();
  assert.deepEqual(h.stored(), ["Original loaded history", "Acknowledged submitted message"]);
  assert.equal(h.gets.length, 3, "one follow-up is enough after authoritative history settles");
  assert.equal(h.message(), "Newer unsent draft");
});

test("multiple acknowledgements coalesce and an acknowledgement during the follow-up GET requires one newer snapshot", async () => {
  const h = chatHarness();
  const url = "/api/requests/request-a/messages";
  const original = fixture("request-a", "original", "Original");
  h.history.set(url, [original]);
  await h.flush();
  const oldHeaders = h.queueHistory();
  const oldBody = deferred<unknown>();
  h.emit("visibilitychange");
  oldHeaders.resolve({ ok: true, json: () => oldBody.promise });
  await h.flush(false);

  for (const [index, text] of ["First acknowledgement", "Second acknowledgement"].entries()) {
    h.edit(text);
    h.send();
    await h.settle(index);
  }
  assert.deepEqual(h.stored(), ["Original", "First acknowledgement", "Second acknowledgement"]);
  assert.equal(h.gets.length, 2, "multiple POSTs do not bypass the existing GET lock");
  const followUpSnapshot = (h.history.get(url) ?? []).map((item) => ({ ...item }));
  const followUpHeaders = h.queueHistory();
  const followUpBody = deferred<unknown>();
  oldBody.resolve({ messages: [original], history_limited: false });
  await h.flush();
  assert.equal(h.gets.length, 3, "one coalesced follow-up for both acknowledgements");
  followUpHeaders.resolve({ ok: true, json: () => followUpBody.promise });
  await h.flush(false);

  h.edit("Third acknowledgement");
  h.send();
  h.edit("Draft after all three sends");
  await h.settle(2);
  assert.equal(h.gets.length, 3);
  const newestHeaders = h.queueHistory();
  followUpBody.resolve({ messages: followUpSnapshot, history_limited: false });
  await h.flush();
  assert.deepEqual(h.stored(), ["Original", "First acknowledgement", "Second acknowledgement", "Third acknowledgement"]);
  assert.equal(h.gets.length, 4, "a send acknowledged after follow-up creation needs its own current snapshot");
  assert.equal(h.message(), "Draft after all three sends");
  assert.equal(h.sending(), false);

  newestHeaders.resolve({ ok: true, json: async () => ({ messages: (h.history.get(url) ?? []).map((item) => ({ ...item })), history_limited: false }) });
  await h.flush();
  assert.deepEqual(h.stored(), ["Original", "First acknowledgement", "Second acknowledgement", "Third acknowledgement"]);
  assert.equal(h.gets.length, 4, "successful current history does not start an endless reconciliation loop");
  assert.ok(h.body().includes(runtimeCopy.formatCustomerMessageCount("en", 4)));
  assert.deepEqual(h.errors(), []);
});

test("superseded history failure and timeout tails preserve acknowledged history and drain one current read", async () => {
  for (const failure of ["non-ok", "transport", "timeout"] as const) {
    const h = chatHarness();
    const url = "/api/requests/request-a/messages";
    const original = fixture("request-a", "original", "Original");
    h.history.set(url, [original]);
    await h.flush();
    const oldHeaders = h.queueHistory();
    const oldBody = deferred<unknown>();
    h.emit("visibilitychange");
    if (failure === "non-ok") {
      oldHeaders.resolve({ ok: false, json: () => oldBody.promise });
      await h.flush(false);
    }
    h.edit("Stored before old failure");
    h.send();
    h.edit("Editable after old failure");
    await h.settle(0);
    const freshHeaders = h.queueHistory();
    if (failure === "non-ok") oldBody.resolve({ messages: [], history_limited: true });
    else if (failure === "transport") oldHeaders.reject(new Error("synthetic stale history failure"));
    else h.tick(12000);
    await h.flush();
    assert.deepEqual(h.stored(), ["Original", "Stored before old failure"], failure);
    assert.equal(h.message(), "Editable after old failure", failure);
    assert.ok(h.body().includes("Secure and live"), "a superseded failure cannot replace the accepted send's live state");
    assert.ok(!h.body().includes("Showing the latest 200 messages"));
    assert.deepEqual(h.errors(), []);
    assert.equal(h.gets.length, 3, `${failure}: the old lock releases into one automatic fresh read`);
    if (failure === "timeout") assert.equal(h.gets[1].init.signal?.aborted, true);
    freshHeaders.resolve({ ok: true, json: async () => ({ messages: (h.history.get(url) ?? []).map((item) => ({ ...item })) }) });
    await h.flush();
    assert.deepEqual(h.stored(), ["Original", "Stored before old failure"]);
    assert.equal(h.gets.length, 3);
  }
});

test("a failing current reconciliation preserves the acknowledgement and normal manual recovery remains available", async () => {
  const h = chatHarness();
  const url = "/api/requests/request-a/messages";
  const original = fixture("request-a", "original", "Original");
  h.history.set(url, [original]);
  await h.flush();
  const oldHeaders = h.queueHistory();
  const oldBody = deferred<unknown>();
  h.emit("visibilitychange");
  oldHeaders.resolve({ ok: true, json: () => oldBody.promise });
  await h.flush(false);
  h.edit("Stored before fresh failure");
  h.send();
  h.edit("Retry-safe draft");
  await h.settle(0);
  const freshHeaders = h.queueHistory();
  oldBody.resolve({ messages: [original] });
  await h.flush();
  freshHeaders.resolve({ ok: false, json: async () => ({}) });
  await h.flush();
  assert.deepEqual(h.stored(), ["Original", "Stored before fresh failure"]);
  assert.equal(h.message(), "Retry-safe draft");
  assert.ok(h.body().includes("Reconnecting in the background"));
  assert.equal(h.sendDisabled(), false, "loaded history still permits a current draft while reconnecting");
  assert.equal(h.gets.length, 3, "a current failure does not retry-spin automatically");
  h.emit("online");
  await h.flush();
  assert.equal(h.gets.length, 4);
  assert.deepEqual(h.stored(), ["Original", "Stored before fresh failure"]);
  assert.ok(h.body().includes("Secure and live"));
  assert.equal(h.message(), "Retry-safe draft");
});

test("current authoritative omission and latest-200 history can prune acknowledged messages rather than pinning them forever", async () => {
  for (const limited of [false, true]) {
    const h = chatHarness();
    const url = "/api/requests/request-a/messages";
    const original = fixture("request-a", "original", "Original");
    h.history.set(url, [original]);
    await h.flush();
    const oldHeaders = h.queueHistory();
    const oldBody = deferred<unknown>();
    h.emit("visibilitychange");
    oldHeaders.resolve({ ok: true, json: () => oldBody.promise });
    await h.flush(false);
    h.edit("Acknowledgement later omitted by authority");
    h.send();
    h.edit("Draft retained across authoritative replacement");
    await h.settle(0);
    const freshHeaders = h.queueHistory();
    oldBody.resolve({ messages: [original], history_limited: !limited });
    await h.flush();
    assert.deepEqual(h.stored(), ["Original", "Acknowledgement later omitted by authority"]);
    const authoritative = limited ? Array.from({ length: 200 }, (_, index) => ({
      ...fixture("request-a", `window-${index}`, `Authoritative message ${index}`),
      created_at: new Date(Date.UTC(2026, 9, 7, 11, 0, index)).toISOString(),
    })) : [];
    freshHeaders.resolve({ ok: true, json: async () => ({ messages: [...authoritative].reverse(), history_limited: limited }) });
    await h.flush();
    assert.deepEqual(h.stored(), authoritative.map((item) => item.message), "current server projection remains the source of truth for removal and window pruning");
    assert.equal(h.body().includes("Showing the latest 200 messages"), limited);
    assert.ok(h.body().includes(runtimeCopy.formatCustomerMessageCount("en", authoritative.length)));
    if (!limited) assert.ok(h.body().includes("No messages yet"));
    assert.equal(h.message(), "Draft retained across authoritative replacement");
    assert.equal(h.sendDisabled(), false);
    assert.equal(h.gets.length, 3);
  }
});

test("failed POSTs do not supersede valid pending history or queue an acknowledgement reconciliation", async () => {
  for (const result of ["failure", "reject"] as const) {
    const h = chatHarness();
    const url = "/api/requests/request-a/messages";
    const original = fixture("request-a", "original", "Original");
    const reply = fixture("request-a", "current-reply", "Current authoritative reply");
    h.history.set(url, [original]);
    await h.flush();
    const headers = h.queueHistory();
    const body = deferred<unknown>();
    h.emit("visibilitychange");
    headers.resolve({ ok: true, json: () => body.promise });
    await h.flush(false);
    h.edit("Unacknowledged submitted draft");
    h.send();
    h.edit("Newer draft after failed send");
    await h.settle(0, result);
    assert.equal(h.gets.length, 2);
    assert.equal(h.errors().length, 1);
    body.resolve({ messages: [original, reply], history_limited: false });
    await h.flush();
    assert.deepEqual(h.stored(), ["Original", "Current authoritative reply"]);
    assert.equal(h.message(), "Newer draft after failed send");
    assert.equal(h.gets.length, 2, "only a successful acknowledgement requires a newer GET");
    assert.equal(h.errors().length, 1, "a history success does not silently erase a failed POST's feedback");
    assert.equal(h.sending(), false);
    assert.equal(h.sendDisabled(), false);
  }
});

test("old queued history tails cannot drain or unlock a new request, role or A-B-A generation", async () => {
  const transitions: ChatProps[][] = [
    [{ requestId: "request-b", senderRole: "customer" }],
    [{ requestId: "request-a", senderRole: "admin" }],
    [{ requestId: "request-b", senderRole: "customer" }, { requestId: "request-a", senderRole: "customer" }],
    [{ requestId: "request-a", senderRole: "admin" }, { requestId: "request-a", senderRole: "customer" }],
  ];
  for (const transition of transitions) {
    for (const oldOk of [true, false]) {
      const h = chatHarness();
      const oldUrl = "/api/requests/request-a/messages";
      const oldOriginal = fixture("request-a", "old-original", "Old generation history");
      h.history.set(oldUrl, [oldOriginal]);
      await h.flush();
      const oldHeaders = h.queueHistory();
      const oldBody = deferred<unknown>();
      h.emit("visibilitychange");
      oldHeaders.resolve({ ok: oldOk, json: () => oldBody.promise });
      await h.flush(false);
      h.edit("Old generation acknowledgement");
      h.send();
      await h.settle(0);

      const target = transition[transition.length - 1];
      const currentUrl = `/api/requests/${target.requestId}/messages`;
      const currentOriginal = fixture(target.requestId, "new-original", "New generation history");
      for (const next of transition) {
        h.history.set(`/api/requests/${next.requestId}/messages`, [fixture(next.requestId, "new-original", "New generation history")]);
        h.render(next);
        await h.flush();
      }
      h.history.set(currentUrl, [currentOriginal]);
      const currentHeaders = h.queueHistory();
      const currentBody = deferred<unknown>();
      h.emit("visibilitychange");
      currentHeaders.resolve({ ok: true, json: () => currentBody.promise });
      await h.flush(false);
      h.edit("Current generation submission");
      const currentSend = h.send(false);
      h.render();
      h.edit("Current generation unsent draft");
      const before = { mutations: h.mutations(), gets: h.gets.length, scrolls: h.scrolls.length, body: h.body() };
      oldBody.resolve({ messages: [oldOriginal], history_limited: true });
      await h.flush();
      assert.equal(h.mutations(), before.mutations, "old success/error/finally cannot write into a new committed context");
      assert.equal(h.body(), before.body);
      assert.deepEqual(h.stored(), ["New generation history"]);
      assert.equal(h.message(), "Current generation unsent draft");
      assert.equal(h.sending(), true);
      assert.equal(h.gets.length, before.gets, "no old queued reconciliation drain");
      assert.equal(h.scrolls.length, before.scrolls);
      h.emit("visibilitychange");
      assert.equal(h.gets.length, before.gets, "old cleanup cannot release the new pending history lock");
      currentSend();
      assert.equal(h.posts.length, 2, "old cleanup cannot release the new pending send lock");

      const currentStored = fixture(target.requestId, "current-stored", "Current generation submission", target.senderRole);
      h.history.set(currentUrl, [currentOriginal, currentStored]);
      h.posts[1].response.resolve({ ok: true, json: async () => ({ message: currentStored }) });
      await h.flush();
      assert.equal(h.sending(), false);
      const freshHeaders = h.queueHistory();
      currentBody.resolve({ messages: [currentOriginal], history_limited: false });
      await h.flush();
      assert.deepEqual(h.stored(), ["New generation history", "Current generation submission"]);
      assert.equal(h.gets.length, before.gets + 1, "only the current context drains its own reconciliation");
      assert.equal(h.gets[h.gets.length - 1].url, currentUrl);
      freshHeaders.resolve({ ok: true, json: async () => ({ messages: [currentOriginal, currentStored], history_limited: false }) });
      await h.flush();
      assert.deepEqual(h.stored(), ["New generation history", "Current generation submission"]);
      assert.equal(h.message(), "Current generation unsent draft");
      assert.deepEqual(h.errors(), []);
    }
  }
});

test("unmount discards queued acknowledgement reconciliation and pending follow-up JSON without late effects", async () => {
  for (const stage of ["original", "follow-up"] as const) {
    const h = chatHarness();
    const url = "/api/requests/request-a/messages";
    const original = fixture("request-a", "original", "Original");
    h.history.set(url, [original]);
    await h.flush();
    const headers = h.queueHistory();
    let body = deferred<unknown>();
    h.emit("visibilitychange");
    headers.resolve({ ok: true, json: () => body.promise });
    await h.flush(false);
    h.edit("Acknowledged before unmount");
    h.send();
    await h.settle(0);
    if (stage === "follow-up") {
      const freshHeaders = h.queueHistory();
      body.resolve({ messages: [original] });
      await h.flush();
      body = deferred<unknown>();
      freshHeaders.resolve({ ok: true, json: () => body.promise });
      await h.flush(false);
      h.edit("Another acknowledgement before unmount");
      h.send();
      await h.settle(1);
    }
    h.unmount();
    const before = { mutations: h.mutations(), gets: h.gets.length, scrolls: h.scrolls.length };
    body.resolve({ messages: [original], history_limited: true });
    await h.drainWithoutRender();
    h.tick(0);
    assert.equal(h.mutations(), before.mutations, stage);
    assert.equal(h.gets.length, before.gets, "no queued fresh read after unmount");
    assert.equal(h.scrolls.length, before.scrolls);
    assert.equal([...h.listeners.values()].every((set) => set.size === 0), true);
  }
});

test("a queued history scroll from before acknowledgement cannot mutate the newer same-context UI", async () => {
  const h = chatHarness();
  const url = "/api/requests/request-a/messages";
  const original = fixture("request-a", "original", "Original");
  h.history.set(url, [original]);
  await h.flush();
  h.emit("visibilitychange");
  await h.flush(false);
  const oldScrolls = [...h.timers].filter(([, timer]) => timer.delay === 0 && !timer.interval);
  assert.ok(oldScrolls.length > 0, "the actual accepted pre-send GET queued scrolling");
  for (const [id] of oldScrolls) h.timers.delete(id);
  h.edit("Acknowledgement after queued history scroll");
  h.send();
  h.edit("Newer scroll-safe draft");
  const stored = fixture("request-a", "new-stored", "Acknowledgement after queued history scroll", "customer");
  h.history.set(url, [original, stored]);
  h.posts[0].response.resolve({ ok: true, json: async () => ({ message: stored }) });
  await h.flush(false);
  const before = { mutations: h.mutations(), scrolls: h.scrolls.length, body: h.body() };
  for (const [, timer] of oldScrolls) timer.callback();
  assert.equal(h.scrolls.length, before.scrolls, "a superseded history callback cannot scroll a newer acknowledgement generation");
  assert.equal(h.mutations(), before.mutations, "superseded scrolling cannot clear the newer unread state");
  assert.equal(h.body(), before.body);
  assert.equal(h.message(), "Newer scroll-safe draft");
  h.tick(0);
  assert.ok(h.scrolls.length > before.scrolls, "current acknowledgement/current history scrolling is still usable");
});

test("superseded history cannot replace message count or limit metadata and current unread interaction still works", async () => {
  const h = chatHarness();
  const url = "/api/requests/request-a/messages";
  const original = fixture("request-a", "original", "Original");
  h.history.set(url, [original]);
  await h.flush();
  h.nearBottom(false);
  const headers = h.queueHistory();
  const body = deferred<unknown>();
  h.emit("visibilitychange");
  headers.resolve({ ok: true, json: () => body.promise });
  await h.flush(false);
  h.edit("Metadata-safe acknowledgement");
  h.send();
  await h.settle(0);
  const freshHeaders = h.queueHistory();
  body.resolve({ messages: [original, fixture("request-a", "superseded-other", "Superseded other-side reply")], history_limited: true });
  await h.flush();
  assert.deepEqual(h.stored(), ["Original", "Metadata-safe acknowledgement"]);
  assert.ok(h.body().includes(runtimeCopy.formatCustomerMessageCount("en", 2)));
  assert.ok(!h.body().includes("Showing the latest 200 messages"));
  assert.ok(!h.body().includes(runtimeCopy.formatCustomerNewMessageCount("en", 1)), "ignored history does not create an unread badge");
  freshHeaders.resolve({ ok: true, json: async () => ({ messages: (h.history.get(url) ?? []).map((item) => ({ ...item })), history_limited: false }) });
  await h.flush();
  h.nearBottom(false);
  const reply = fixture("request-a", "new-authoritative-reply", "Fresh other-side reply");
  h.history.set(url, [...(h.history.get(url) ?? []), reply]);
  h.emit("visibilitychange");
  await h.flush();
  assert.deepEqual(h.stored(), ["Original", "Metadata-safe acknowledgement", "Fresh other-side reply"]);
  const unread = h.control("button", (props) => nodeText(props.children) === runtimeCopy.formatCustomerNewMessageCount("en", 1));
  assert.equal(nodeText(unread.props.children), "1 new message");
  const before = h.scrolls.length;
  (unread.props.onClick as () => void)();
  h.render();
  assert.equal(h.scrolls.length, before + 1);
  assert.ok(!h.body().includes("1 new message"));
  assert.ok(h.body().includes(runtimeCopy.formatCustomerMessageCount("en", 3)));
});
