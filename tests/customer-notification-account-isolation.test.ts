import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import test from "node:test";
import * as React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import * as icons from "lucide-react";
import ts from "typescript";
import { intlLocaleByCode, supportedLocales, type LocaleCode } from "../src/lib/i18nConfig";
import * as notificationCopy from "../src/lib/i18n/customer-workflow-notifications-translations";
import { customerNotificationProjection } from "../src/lib/customerNotificationProjection";

type Notification = {
  id: string; user_id: string; order_id: string | null;
  type: "system"; title: string; body: string | null; status: null;
  read_at: string | null; created_at: string;
};
type WireResponse = { ok: boolean; json: () => Promise<unknown> };
type QueryResult = { data: Notification[] | null; error: null | { message: string } };
type Session = { user: { id: string } } | null;
type NodeProps = Record<string, unknown> & { children?: React.ReactNode };
type Element = React.ReactElement<NodeProps>;
type Effect = {
  dependencies: readonly unknown[] | undefined;
  create: () => void | (() => void); cleanup?: () => void; pending: boolean; layout: boolean;
};
type Timer = { callback: () => void; delay: number; interval: boolean };
type AuthListener = (event: string, session: Session) => void;
type Channel = {
  name: string; event: string; filter: Record<string, unknown>; callback: () => void;
  removed: boolean;
  on: (event: string, filter: Record<string, unknown>, callback: () => void) => Channel;
  subscribe: () => Channel;
};

function deferred<T>() {
  let resolvePromise!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolvePromise = yes; reject = no; });
  return { promise, resolve: resolvePromise, reject };
}
function elements(node: React.ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!React.isValidElement(node)) return [];
  const element = node as Element;
  return [element, ...elements(element.props.children)];
}
function text(node: React.ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(text).join("");
  return React.isValidElement(node) ? text((node as Element).props.children) : "";
}
function row(user: string, id: string, read = false): Notification {
  return {
    id, user_id: user, order_id: `synthetic-order-${user}-${id}`, type: "system",
    title: `Synthetic private ${user} title ${id}`, body: `Synthetic private ${user} body ${id}`,
    status: null, read_at: read ? "2026-10-07T10:00:00.000Z" : null,
    created_at: "2026-10-07T10:00:00.000Z",
  };
}

// Execute the complete current component unchanged, including its effects,
// callback closures, JSX and async continuations. Only React hook scheduling,
// timers and SDK/auth transport are deterministic doubles. This is not a
// copied isolation reducer, React DOM, a real session or an authenticated E2E.
function notificationHarness(initialPath = "/dashboard", initialLocale: LocaleCode = "en") {
  const filename = "src/components/CustomerNotifications.tsx";
  const source = readFileSync(resolve(process.cwd(), filename), "utf8");
  const ast = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const componentNode = ast.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === "CustomerNotifications");
  assert.ok(componentNode && ts.isFunctionDeclaration(componentNode) && componentNode.body);
  const stateNames: string[] = [];
  function inventory(node: ts.Node) {
    if (ts.isVariableDeclaration(node) && ts.isArrayBindingPattern(node.name)
      && node.initializer && ts.isCallExpression(node.initializer)
      && ts.isIdentifier(node.initializer.expression) && node.initializer.expression.text === "useState") {
      stateNames.push(node.name.elements[0].getText(ast));
    }
    ts.forEachChild(node, inventory);
  }
  inventory(componentNode.body);
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const states: unknown[] = [];
  const stateIndices = new Map<string, number>();
  const refs: Array<{ current: unknown }> = [];
  const memos: Array<{ dependencies: readonly unknown[] | undefined; value: unknown }> = [];
  const effects: Effect[] = [];
  const timers = new Map<number, Timer>();
  const authority: Array<{ url: string; init: RequestInit; result: ReturnType<typeof deferred<WireResponse>> }> = [];
  const selects: Array<{ table: string; projection: string; filters: Array<[string, unknown]>; order: [string, unknown]; limit: number; result: ReturnType<typeof deferred<QueryResult>> }> = [];
  const updates: Array<{ table: string; values: Record<string, unknown>; ids: string[]; filters: Array<[string, unknown]> }> = [];
  const channels: Channel[] = [];
  const authListeners = new Set<AuthListener>();
  const allAuthListeners: AuthListener[] = [];
  const stableSessions: Array<ReturnType<typeof deferred<{ session: Session }>>> = [];
  const storageWrites: Array<[string, string]> = [];
  let storedSound = "off";
  let pathname = initialPath;
  let locale = initialLocale;
  let cursor = 0;
  let stateCursor = 0;
  let timerId = 0;
  let mutations = 0;
  let mounted = true;
  let current: React.ReactNode;
  const changed = (before: readonly unknown[] | undefined, after: readonly unknown[] | undefined) =>
    !before || !after || before.length !== after.length || after.some((value, index) => !Object.is(value, before[index]));
  const forbidden = () => { throw new Error("Notification isolation tests must not access real auth, credentials, env or services."); };
  const hooks = {
    useState(initial: unknown) {
      const index = cursor++;
      const name = stateNames[stateCursor++];
      assert.ok(name, "AST inventory binds the actual useState call");
      stateIndices.set(name, index);
      if (!(index in states)) states[index] = typeof initial === "function" ? (initial as () => unknown)() : initial;
      return [states[index], (value: unknown) => {
        mutations += 1;
        states[index] = typeof value === "function" ? (value as (previous: unknown) => unknown)(states[index]) : value;
      }];
    },
    useRef(initial: unknown) {
      const index = cursor++;
      if (!(index in refs)) refs[index] = { current: initial };
      return refs[index];
    },
    useMemo(create: () => unknown, dependencies: readonly unknown[] | undefined) {
      const index = cursor++;
      if (!memos[index] || changed(memos[index].dependencies, dependencies)) memos[index] = { dependencies, value: create() };
      return memos[index].value;
    },
    useCallback(callback: unknown, dependencies: readonly unknown[] | undefined) {
      return hooks.useMemo(() => callback, dependencies);
    },
    useEffect(create: Effect["create"], dependencies?: readonly unknown[]) { registerEffect(create, dependencies, false); },
    useLayoutEffect(create: Effect["create"], dependencies?: readonly unknown[]) { registerEffect(create, dependencies, true); },
  };
  function registerEffect(create: Effect["create"], dependencies: readonly unknown[] | undefined, layout: boolean) {
    const index = cursor++;
    const previous = effects[index];
    if (!previous || changed(previous.dependencies, dependencies)) effects[index] = {
      create, dependencies, layout, cleanup: previous?.cleanup, pending: true,
    };
  }
  const windowDouble = {
    localStorage: {
      getItem(key: string) { assert.equal(key, "mg_notification_sound"); return storedSound; },
      setItem(key: string, value: string) { assert.equal(key, "mg_notification_sound"); storedSound = value; storageWrites.push([key, value]); },
    },
    setTimeout(callback: () => void, delay: number) { const id = ++timerId; timers.set(id, { callback, delay, interval: false }); return id; },
    clearTimeout(id: number) { timers.delete(id); },
    setInterval(callback: () => void, delay: number) { const id = ++timerId; timers.set(id, { callback, delay, interval: true }); return id; },
    clearInterval(id: number) { timers.delete(id); },
  };
  const sdk = {
    auth: {
      onAuthStateChange(callback: AuthListener) {
        authListeners.add(callback); allAuthListeners.push(callback);
        return { data: { subscription: { unsubscribe() { authListeners.delete(callback); } } } };
      },
    },
    from(table: string) {
      assert.equal(table, "notifications");
      return {
        select(projection: string) {
          const filters: Array<[string, unknown]> = [];
          let order: [string, unknown] = ["", null];
          const query = {
            eq(column: string, value: unknown) { filters.push([column, value]); return query; },
            order(column: string, value: unknown) { order = [column, value]; return query; },
            limit(limit: number) {
              const result = deferred<QueryResult>();
              selects.push({ table, projection, filters: [...filters], order, limit, result });
              return result.promise;
            },
          };
          return query;
        },
        update(values: Record<string, unknown>) {
          let ids: string[] = [];
          const query = {
            in(column: string, values: string[]) { assert.equal(column, "id"); ids = [...values]; return query; },
            eq(column: string, value: unknown) {
              updates.push({ table, values, ids, filters: [[column, value]] });
              return Promise.resolve({ data: null, error: null });
            },
          };
          return query;
        },
      };
    },
    channel(name: string) {
      const channel: Channel = {
        name, event: "", filter: {}, callback: forbidden, removed: false,
        on(event, filter, callback) { Object.assign(channel, { event, filter, callback }); return channel; },
        subscribe() { return channel; },
      };
      channels.push(channel);
      return channel;
    },
    removeChannel(channel: Channel) { channel.removed = true; return Promise.resolve("ok"); },
  };
  const Link = (props: NodeProps) => React.createElement("a", props, props.children);
  const exports: Record<string, unknown> = {};
  const context: Record<string, unknown> = {
    exports, window: windowDouble, fetch: forbidden, XMLHttpRequest: forbidden,
    require(name: string) {
      if (name === "react") return { ...React, ...hooks };
      if (name === "react/jsx-runtime") return jsxRuntime;
      if (name === "lucide-react") return icons;
      if (name === "next/link") return { default: Link };
      if (name === "next/navigation") return { usePathname: () => pathname };
      if (name === "@/lib/supabaseClient") return { supabase: sdk };
      if (name === "@/lib/authGuards") return {
        getStableSession() { const result = deferred<{ session: Session }>(); stableSessions.push(result); return result.promise; },
        authenticatedFetch(url: string, init: RequestInit) {
          assert.equal(url, "/api/account/context"); assert.equal(init.cache, "no-store");
          const result = deferred<WireResponse>(); authority.push({ url, init, result }); return result.promise;
        },
      };
      if (name === "@/lib/i18nConfig") return { intlLocaleByCode };
      if (name === "@/lib/useActiveLocale") return { useActiveLocale: () => locale };
      if (name === "@/lib/i18n/customer-workflow-notifications-translations") return notificationCopy;
      if (name === "@/lib/customerNotificationProjection") return { customerNotificationProjection };
      throw new Error(`Unexpected notification import: ${name}`);
    },
  };
  for (const target of [context, windowDouble]) {
    for (const name of ["sessionStorage", "credentials", "process"]) Object.defineProperty(target, name, { get: forbidden });
  }
  runInNewContext(code, context, { filename });
  const component = exports.CustomerNotifications as () => React.ReactNode;
  assert.equal(typeof component, "function");
  function commitEffects(layout: boolean) {
    const pending = effects.filter((effect) => effect?.pending && effect.layout === layout);
    for (const effect of pending) { effect.pending = false; effect.cleanup?.(); }
    for (const effect of pending) effect.cleanup = effect.create() || undefined;
  }
  function render(passive = true) {
    if (!mounted) return current;
    cursor = 0; stateCursor = 0;
    current = component();
    assert.equal(stateCursor, stateNames.length);
    commitEffects(true);
    if (passive) commitEffects(false);
    return current;
  }
  function tick(delay: number, intervals = false) {
    for (const [id, timer] of [...timers]) {
      if (timer.delay !== delay || (timer.interval && !intervals)) continue;
      if (!timer.interval) timers.delete(id);
      timer.callback();
    }
  }
  async function flush(runZeroTimers = true) {
    for (let turn = 0; turn < 12; turn++) {
      await Promise.resolve(); render(); if (runZeroTimers) tick(0);
    }
    render();
  }
  async function drainWithoutRender() {
    for (let turn = 0; turn < 12; turn++) await Promise.resolve();
  }
  function control(predicate: (props: NodeProps) => boolean) {
    const matches = elements(current).filter(({ props }) => predicate(props));
    assert.equal(matches.length, 1, "one actual rendered control");
    return matches[0];
  }
  function click(predicate: (props: NodeProps) => boolean) {
    const handler = control(predicate).props.onClick as () => void;
    assert.equal(typeof handler, "function"); handler(); render(); return handler;
  }
  function state<T>(name: string): T {
    const index = stateIndices.get(name); assert.notEqual(index, undefined, `actual AST state ${name}`);
    return states[index!] as T;
  }
  function auth(id: string | null, event = id ? "SIGNED_IN" : "SIGNED_OUT") {
    for (const callback of [...authListeners]) callback(event, id ? { user: { id } } : null);
  }
  async function settleAuthority(index: number, home: unknown = "/dashboard", ok = true) {
    assert.ok(authority[index]); authority[index].result.resolve({ ok, json: async () => ({ home }) }); await flush();
  }
  async function settleSelect(index: number, data: Notification[] = [], error: QueryResult["error"] = null) {
    assert.ok(selects[index]); selects[index].result.resolve({ data, error }); await flush();
  }
  render();
  return {
    render, flush, drainWithoutRender, tick, click, control, state, auth, settleAuthority, settleSelect,
    authority, selects, updates, channels, stableSessions, allAuthListeners, authListeners, timers, storageWrites,
    body: () => text(current), nullUI: () => current === null,
    hrefs: () => elements(current).map(({ props }) => props.href).filter((value): value is string => typeof value === "string"),
    alerts: () => elements(current).filter(({ props }) => props.role === "alert").map(text),
    mutations: () => mutations,
    changePath(next: string, passive = true) { pathname = next; render(passive); },
    changeLocale(next: LocaleCode) { locale = next; render(); },
    unmount() { mounted = false; for (const effect of effects) effect?.cleanup?.(); },
  };
}
type Harness = ReturnType<typeof notificationHarness>;

async function initialCustomer(h: Harness, user = "synthetic-a", items = [row(user, "initial")]) {
  assert.equal(h.stableSessions.length, 1);
  h.stableSessions[0].resolve({ session: { user: { id: user } } }); await h.flush();
  await h.settleAuthority(0); await h.settleSelect(0, items);
  assert.equal(h.state<string>("userId"), user);
}
async function switchCustomer(h: Harness, user: string) {
  const index = h.authority.length;
  h.auth(user); await h.flush();
  assert.equal(h.authority.length, index + 1);
  await h.settleAuthority(index);
  return h.selects.length - 1;
}
function assertNoAccountUI(h: Harness, account: string) {
  assert.equal(h.body().includes(`Synthetic private ${account}`), false);
  assert.equal(h.hrefs().some((href) => href.includes(`synthetic-order-${account}-`)), false);
  assert.equal(h.state<Notification[]>("items").some((item) => item.user_id === account), false);
  assert.notEqual(h.state<Notification | null>("toast")?.user_id, account);
}
function assertNoRenderedAccount(h: Harness, account: string) {
  assert.equal(h.body().includes(`Synthetic private ${account}`), false);
  assert.equal(h.hrefs().some((href) => href.includes(`synthetic-order-${account}-`)), false);
}
async function toastFor(h: Harness, user: string, id: string) {
  const select = h.selects.length;
  const channel = h.channels.at(-1); assert.ok(channel);
  channel.callback(); await h.flush();
  assert.equal(h.selects.length, select + 1);
  const current = h.state<Notification[]>("items");
  await h.settleSelect(select, [row(user, id), ...current]);
  assert.equal(h.state<Notification | null>("toast")?.id, id);
}

test("actual auth event synchronously removes A items, badge, panel, links and toast before B authority", async () => {
  const h = notificationHarness(); await initialCustomer(h);
  h.click((props) => props["aria-label"] === "Notifications");
  await toastFor(h, "synthetic-a", "a-toast");
  assert.ok(h.body().includes("Synthetic private synthetic-a"));
  const authorityCount = h.authority.length;
  h.auth("synthetic-b"); h.render(false);
  assert.equal(h.nullUI(), true, "auth invalidation precedes the deferred classification request");
  assertNoAccountUI(h, "synthetic-a");
  assert.equal(h.state<boolean>("open"), false);
  assert.equal(h.authority.length, authorityCount, "do not perform classification in the synchronous SDK callback");
  await h.flush(); assert.equal(h.authority.length, authorityCount + 1);
  assert.equal(h.nullUI(), true, "B classification still held");
  await h.settleAuthority(authorityCount);
  h.click((props) => props["aria-label"] === "Notifications");
  assert.ok(h.body().includes("Loading notifications..."));
  assertNoAccountUI(h, "synthetic-a");
  await h.settleSelect(h.selects.length - 1, [row("synthetic-b", "b-initial")]);
  assert.ok(h.body().includes("Synthetic private synthetic-b"));
  assert.equal(h.state<Notification | null>("toast"), null, "B initial history is not announced as a new toast");
});

test("held A SELECT and authority bodies cannot repaint or unlock held B history", async () => {
  const h = notificationHarness(); await initialCustomer(h);
  h.channels[0].callback(); await h.flush(); const oldSelect = h.selects.length - 1;
  const bSelect = await switchCustomer(h, "synthetic-b");
  h.click((props) => props["aria-label"] === "Notifications");
  const before = h.mutations();
  await h.settleSelect(oldSelect, [row("synthetic-a", "late-a")]);
  assert.equal(h.mutations(), before);
  assertNoAccountUI(h, "synthetic-a");
  assert.ok(h.body().includes("Loading notifications..."));
  await h.settleSelect(bSelect, [row("synthetic-b", "current-b")]);
  assert.ok(h.body().includes("Synthetic private synthetic-b"));

  const pending = notificationHarness();
  pending.stableSessions[0].resolve({ session: { user: { id: "synthetic-a" } } }); await pending.flush();
  const oldBody = deferred<unknown>(); pending.authority[0].result.resolve({ ok: true, json: () => oldBody.promise }); await pending.flush();
  pending.auth("synthetic-b"); await pending.flush(); await pending.settleAuthority(1);
  const mutations = pending.mutations(); oldBody.resolve({ home: "/dashboard" }); await pending.flush();
  assert.equal(pending.mutations(), mutations);
  assert.equal(pending.state<string>("userId"), "synthetic-b");
  assert.equal(pending.selects.length, 1);
  await pending.settleSelect(0, []);
});

test("auth identity fences an already pending SELECT before any next render or effect cleanup", async () => {
  const h = notificationHarness(); await initialCustomer(h); h.channels[0].callback(); await h.flush();
  const old = h.selects.at(-1)!; h.auth("synthetic-b");
  const before = { mutations: h.mutations(), authority: h.authority.length };
  old.result.resolve({ data: [row("synthetic-a", "before-cleanup-late")], error: null });
  await h.drainWithoutRender();
  assert.equal(h.mutations(), before.mutations, "account ref invalidates old async work synchronously, independent of passive cleanup");
  assert.equal(h.authority.length, before.authority);
  h.render(false); assert.equal(h.nullUI(), true); assertNoAccountUI(h, "synthetic-a");
  await h.flush(); await h.settleAuthority(h.authority.length - 1); await h.settleSelect(h.selects.length - 1, []);
});

test("A-B-A uses a new identity even when account text matches and old A SELECT rejects", async () => {
  for (const failure of [false, true]) {
    const h = notificationHarness(); await initialCustomer(h);
    h.channels[0].callback(); await h.flush(); const old = h.selects.length - 1;
    const b = await switchCustomer(h, "synthetic-b"); await h.settleSelect(b, [row("synthetic-b", "b")]);
    const a = await switchCustomer(h, "synthetic-a");
    h.click((props) => props["aria-label"] === "Notifications");
    const before = h.mutations();
    await h.settleSelect(old, failure ? [] : [row("synthetic-a", "stale-a")], failure ? { message: "synthetic old query failure" } : null);
    assert.equal(h.mutations(), before);
    assert.equal(h.state<boolean>("notificationLoading"), true);
    assert.equal(h.state<Notification[]>("items").length, 0);
    await h.settleSelect(a, [row("synthetic-a", "fresh-a")]);
    assert.ok(h.body().includes("fresh-a")); assert.equal(h.body().includes("stale-a"), false);
  }
});

test("logout clears account UI immediately and old queued auth, SELECT and toast work stays inert", async () => {
  const h = notificationHarness(); await initialCustomer(h); await toastFor(h, "synthetic-a", "logout-toast");
  h.channels[0].callback(); await h.flush(); const oldSelect = h.selects.length - 1;
  h.auth("synthetic-b"); const oldAuthTimers = [...h.timers.values()].filter((timer) => timer.delay === 0).map((timer) => timer.callback);
  h.auth(null); h.render(false);
  assert.equal(h.nullUI(), true); assertNoAccountUI(h, "synthetic-a");
  await h.flush();
  const before = { mutations: h.mutations(), authority: h.authority.length, selects: h.selects.length };
  for (const callback of oldAuthTimers) callback();
  await h.settleSelect(oldSelect, [row("synthetic-a", "logout-late")]);
  assert.equal(h.nullUI(), true); assertNoAccountUI(h, "synthetic-a");
  assert.equal(h.mutations(), before.mutations);
  assert.equal(h.authority.length, before.authority);
  assert.equal(h.selects.length, before.selects);
});

test("new auth event outranks a stale initial stable-session result, including a later null result", async () => {
  for (const initialId of ["synthetic-a", null]) {
    const h = notificationHarness();
    h.auth("synthetic-b"); await h.flush(); await h.settleAuthority(0); await h.settleSelect(0, [row("synthetic-b", "b")]);
    const before = { mutations: h.mutations(), authority: h.authority.length, selects: h.selects.length };
    h.stableSessions[0].resolve({ session: initialId ? { user: { id: initialId } } : null }); await h.flush();
    assert.equal(h.state<string>("userId"), "synthetic-b");
    assert.equal(h.mutations(), before.mutations); assert.equal(h.authority.length, before.authority); assert.equal(h.selects.length, before.selects);
  }
});

test("same-user token refresh reclassifies fail-closed without discarding current items or toast history", async () => {
  const h = notificationHarness(); await initialCustomer(h);
  h.click((props) => props["aria-label"] === "Notifications"); await toastFor(h, "synthetic-a", "same-user-toast");
  const before = { body: h.body(), items: h.state<Notification[]>("items"), toast: h.state<Notification | null>("toast") };
  h.auth("synthetic-a", "TOKEN_REFRESHED"); h.render(false);
  assert.equal(h.nullUI(), true, "same-user classification is still fail-closed, as before");
  assert.equal(h.state<boolean>("open"), false, "the established auth-event panel close is preserved");
  assert.equal(h.state<Notification[]>("items"), before.items); assert.equal(h.state<Notification | null>("toast"), before.toast);
  await h.flush();
  for (const request of h.authority.slice(1)) request.result.resolve({ ok: true, json: async () => ({ home: "/dashboard" }) });
  await h.flush();
  assert.equal(h.state<string>("userId"), "synthetic-a");
  assert.equal(h.state<Notification | null>("toast")?.id, "same-user-toast");
  assert.ok(h.selects.every((query) => query.filters.some(([key, id]) => key === "user_id" && id === "synthetic-a")));
  await h.settleSelect(h.selects.length - 1, before.items);
  h.click((props) => props["aria-label"] === "Notifications");
  assert.equal(h.body(), before.body);
  const query = h.selects.length; h.channels.at(-1)!.callback(); await h.flush();
  await h.settleSelect(query, before.items);
  assert.equal(h.state<Notification | null>("toast")?.id, "same-user-toast", "known rows are not reannounced on same-account refresh");
});

test("removed account callbacks and old toast expiry cannot query or clear B toast", async () => {
  const h = notificationHarness(); await initialCustomer(h); await toastFor(h, "synthetic-a", "old-toast");
  const oldChannel = h.channels[0];
  const oldPoll = [...h.timers.values()].find((timer) => timer.interval); assert.ok(oldPoll);
  const oldToastExpiry = [...h.timers.values()].filter((timer) => timer.delay === 8000).map((timer) => timer.callback); assert.ok(oldToastExpiry.length);
  const b = await switchCustomer(h, "synthetic-b"); await h.settleSelect(b, [row("synthetic-b", "b-initial")]);
  await toastFor(h, "synthetic-b", "b-toast");
  const before = { mutations: h.mutations(), selects: h.selects.length };
  oldChannel.callback(); oldPoll.callback(); for (const callback of oldToastExpiry) callback(); await h.flush();
  assert.equal(h.mutations(), before.mutations); assert.equal(h.selects.length, before.selects);
  assert.equal(h.state<Notification | null>("toast")?.id, "b-toast");
  assert.equal(oldChannel.removed, true);
});

test("suppressed routes synchronously hide and retire an account; returning needs fresh authority", async () => {
  for (const route of ["/admin", "/admin/requests", "/embed/widget"]) {
    const h = notificationHarness(); await initialCustomer(h); await toastFor(h, "synthetic-a", "suppressed-toast");
    const oldChannel = h.channels[0]; const oldAuth = h.allAuthListeners[0];
    h.changePath(route, false); assert.equal(h.nullUI(), true); h.render();
    assertNoRenderedAccount(h, "synthetic-a");
    const before = { mutations: h.mutations(), selects: h.selects.length, authority: h.authority.length };
    oldChannel.callback(); oldAuth("SIGNED_IN", { user: { id: "synthetic-b" } }); await h.flush();
    assert.equal(h.mutations(), before.mutations); assert.equal(h.selects.length, before.selects); assert.equal(h.authority.length, before.authority);
    h.changePath("/dashboard", false); assert.equal(h.nullUI(), true, "unsuppress does not resurrect a stale account"); h.render();
    assert.equal(h.stableSessions.length, 2);
    h.stableSessions[1].resolve({ session: { user: { id: "synthetic-b" } } }); await h.flush();
    await h.settleAuthority(h.authority.length - 1); await h.settleSelect(h.selects.length - 1, [row("synthetic-b", "b")]);
    assertNoAccountUI(h, "synthetic-a");
  }
});

test("unmount fences stale auth callbacks, queued timers, initial resolution, SELECT and authority bodies", async () => {
  const h = notificationHarness(); await initialCustomer(h); await toastFor(h, "synthetic-a", "unmount-toast");
  h.channels[0].callback(); await h.flush(); const select = h.selects.length - 1;
  h.auth("synthetic-b"); const timers = [...h.timers.values()].map((timer) => timer.callback); const callback = h.allAuthListeners[0];
  h.unmount(); const before = { mutations: h.mutations(), selects: h.selects.length, authority: h.authority.length };
  callback("SIGNED_IN", { user: { id: "synthetic-a" } }); for (const timer of timers) timer();
  await h.settleSelect(select, [row("synthetic-a", "unmounted")]);
  assert.equal(h.mutations(), before.mutations); assert.equal(h.selects.length, before.selects); assert.equal(h.authority.length, before.authority);
  assert.equal(h.authListeners.size, 0); assert.ok(h.channels.every((channel) => channel.removed));

  const pending = notificationHarness(); pending.unmount(); const mutations = pending.mutations();
  pending.stableSessions[0].resolve({ session: { user: { id: "synthetic-a" } } }); await pending.flush();
  assert.equal(pending.mutations(), mutations); assert.equal(pending.authority.length, 0);

  const bodyPending = notificationHarness(); bodyPending.stableSessions[0].resolve({ session: { user: { id: "synthetic-a" } } }); await bodyPending.flush();
  const body = deferred<unknown>(); bodyPending.authority[0].result.resolve({ ok: true, json: () => body.promise }); await bodyPending.flush();
  bodyPending.unmount(); const bodyMutations = bodyPending.mutations(); body.resolve({ home: "/dashboard" }); await bodyPending.flush();
  assert.equal(bodyPending.mutations(), bodyMutations); assert.equal(bodyPending.selects.length, 0);
});

test("current classification failure, staff classification and rejection fail closed without an account SELECT", async () => {
  for (const mode of ["http", "staff", "reject"] as const) {
    const h = notificationHarness(); await initialCustomer(h); h.auth("synthetic-b"); await h.flush();
    if (mode === "reject") { h.authority[1].result.reject(new Error("synthetic context rejection")); await h.flush(); }
    else await h.settleAuthority(1, mode === "staff" ? "/admin" : "/dashboard", mode !== "http");
    assert.equal(h.nullUI(), true); assertNoAccountUI(h, "synthetic-a"); assert.equal(h.selects.length, 1);
  }
});

test("current initial SELECT error renders actual retry, then loading and empty rather than stale history", async () => {
  const h = notificationHarness(); await initialCustomer(h); const b = await switchCustomer(h, "synthetic-b");
  h.click((props) => props["aria-label"] === "Notifications"); assert.ok(h.body().includes("Loading notifications..."));
  await h.settleSelect(b, [], { message: "synthetic private SDK error" });
  assert.equal(h.alerts().length, 1); assert.ok(h.body().includes("Notifications could not be loaded. Please try again."));
  assert.equal(h.body().includes("synthetic private SDK error"), false); assert.equal(h.body().includes("No notifications yet."), false);
  assertNoAccountUI(h, "synthetic-a");
  const prior = h.selects.length; h.click((props) => text(props.children) === "Try again"); await h.flush();
  assert.equal(h.selects.length, prior + 1); assert.ok(h.body().includes("Loading notifications...")); assert.deepEqual(h.alerts(), []);
  await h.settleSelect(prior, []); assert.ok(h.body().includes("No notifications yet."));
  assert.equal(h.state<boolean>("notificationLoading"), false); assert.deepEqual(h.alerts(), []);
});

test("background current SELECT error retains loaded account history without misreporting empty", async () => {
  const h = notificationHarness(); await initialCustomer(h); h.click((props) => props["aria-label"] === "Notifications");
  h.channels[0].callback(); await h.flush(); await h.settleSelect(1, [], { message: "synthetic background error" });
  assert.ok(h.body().includes("Synthetic private synthetic-a")); assert.equal(h.body().includes("No notifications yet."), false);
  assert.equal(h.state<boolean>("notificationLoading"), false); assert.deepEqual(h.alerts(), []);
});

test("actual SELECT, UPDATE and realtime subscription remain scoped to the accepted user and narrow projection", async () => {
  const h = notificationHarness(); await initialCustomer(h, "synthetic-a", [row("synthetic-a", "unread"), row("synthetic-a", "read", true)]);
  h.click((props) => props["aria-label"] === "Notifications");
  h.click((props) => props.title === "Mark all as read"); await h.flush();
  assert.equal(h.updates.length, 1); assert.deepEqual(h.updates[0].ids, ["unread"]);
  assert.deepEqual(h.updates[0].filters, [["user_id", "synthetic-a"]]);
  assert.deepEqual(Object.keys(h.updates[0].values), ["read_at"]); assert.ok(!Number.isNaN(Date.parse(String(h.updates[0].values.read_at))));
  const b = await switchCustomer(h, "synthetic-b"); await h.settleSelect(b, [row("synthetic-b", "unread-b")]);
  h.click((props) => props["aria-label"] === "Notifications"); h.click((props) => props.href === "/dashboard/orders/synthetic-order-synthetic-b-unread-b"); await h.flush();
  assert.equal(h.updates.length, 2); assert.deepEqual(h.updates[1].ids, ["unread-b"]); assert.deepEqual(h.updates[1].filters, [["user_id", "synthetic-b"]]);
  for (const query of h.selects) {
    assert.equal(query.table, "notifications"); assert.equal(query.projection, customerNotificationProjection);
    assert.equal(query.projection.includes("metadata,"), false); assert.equal(query.limit, 20);
    assert.equal(JSON.stringify(query.order), JSON.stringify(["created_at", { ascending: false }]));
    assert.equal(query.filters.length, 1); assert.equal(query.filters[0][0], "user_id"); assert.ok(["synthetic-a", "synthetic-b"].includes(String(query.filters[0][1])));
  }
  for (const channel of h.channels) {
    const user = channel.name.replace("customer-notifications-", ""); assert.ok(["synthetic-a", "synthetic-b"].includes(user));
    assert.equal(channel.event, "postgres_changes");
    assert.equal(JSON.stringify(channel.filter), JSON.stringify({ event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user}` }));
  }
});

test("old rendered mark-read and retry handlers cannot adopt the next account, including A-B-A", async () => {
  for (const roundTrip of [false, true]) {
    const h = notificationHarness(); await initialCustomer(h); h.click((props) => props["aria-label"] === "Notifications");
    const oldMark = h.control((props) => props.title === "Mark all as read").props.onClick as () => void;
    const b = await switchCustomer(h, "synthetic-b"); await h.settleSelect(b, [row("synthetic-b", "b-initial")]);
    if (roundTrip) { const a = await switchCustomer(h, "synthetic-a"); await h.settleSelect(a, [row("synthetic-a", "initial")]); }
    const before = { mutations: h.mutations(), updates: h.updates.length };
    oldMark(); await h.flush();
    assert.equal(h.mutations(), before.mutations); assert.equal(h.updates.length, before.updates);
    assert.equal(h.state<Notification[]>("items")[0].read_at, null, "old same-id A handler cannot mark the new A row");

    const retry = notificationHarness(); retry.stableSessions[0].resolve({ session: { user: { id: "synthetic-a" } } }); await retry.flush();
    await retry.settleAuthority(0); await retry.settleSelect(0, [], { message: "synthetic initial failure" });
    retry.click((props) => props["aria-label"] === "Notifications");
    const oldRetry = retry.control((props) => text(props.children) === "Try again").props.onClick as () => void;
    const retryB = await switchCustomer(retry, "synthetic-b"); await retry.settleSelect(retryB, [row("synthetic-b", "b-initial")]);
    if (roundTrip) { const retryA = await switchCustomer(retry, "synthetic-a"); await retry.settleSelect(retryA, [row("synthetic-a", "fresh-a")]); }
    const retryBefore = { mutations: retry.mutations(), selects: retry.selects.length };
    oldRetry(); await retry.flush();
    assert.equal(retry.mutations(), retryBefore.mutations); assert.equal(retry.selects.length, retryBefore.selects);
  }
});

test("batched A-B-A with no intermediate render replaces the actual query context", async () => {
  const h = notificationHarness(); await initialCustomer(h);
  const oldChannel = h.channels[0]; const priorSelects = h.selects.length;
  h.auth("synthetic-b"); h.auth("synthetic-a"); h.tick(0);
  const authorityIndex = h.authority.length - 1;
  h.authority[authorityIndex].result.resolve({ ok: true, json: async () => ({ home: "/dashboard" }) });
  await h.drainWithoutRender();
  assert.equal(h.state<string>("userId"), "synthetic-a", "authority settles before the first post-event render");
  assert.equal(h.selects.length, priorSelects, "no intermediate render starts a blank-user effect");
  h.render(); await h.flush();
  assert.equal(h.state<string>("userId"), "synthetic-a");
  assert.equal(h.selects.length, priorSelects + 1, "same user text does not retain the dead old-A query effect");
  assert.equal(h.state<Notification[]>("items").length, 0);
  const before = { mutations: h.mutations(), selects: h.selects.length }; oldChannel.callback(); await h.flush();
  assert.equal(h.mutations(), before.mutations); assert.equal(h.selects.length, before.selects);
  await h.settleSelect(priorSelects, [row("synthetic-a", "batched-fresh-a")]);
  h.click((props) => props["aria-label"] === "Notifications"); assert.ok(h.body().includes("batched-fresh-a"));
});

test("retained toast dismissal wrappers cannot clear another account or a replacement toast", async () => {
  for (const roundTrip of [false, true]) {
    const h = notificationHarness(); await initialCustomer(h); await toastFor(h, "synthetic-a", "old-dismissal-toast");
    const oldClose = h.control((props) => props["aria-label"] === "Close notification").props.onClick as () => void;
    const oldLink = h.control((props) => props.href === "/dashboard/orders/synthetic-order-synthetic-a-old-dismissal-toast" && text(props.children) === "Open request").props.onClick as () => void;
    const b = await switchCustomer(h, "synthetic-b"); await h.settleSelect(b, [row("synthetic-b", "b-initial")]);
    if (roundTrip) { const a = await switchCustomer(h, "synthetic-a"); await h.settleSelect(a, [row("synthetic-a", "fresh-a")]); }
    await toastFor(h, roundTrip ? "synthetic-a" : "synthetic-b", "replacement-toast");
    const before = { mutations: h.mutations(), updates: h.updates.length };
    oldClose(); oldLink(); await h.flush();
    assert.equal(h.mutations(), before.mutations); assert.equal(h.updates.length, before.updates);
    assert.equal(h.state<Notification | null>("toast")?.id, "replacement-toast");
  }

  const same = notificationHarness(); await initialCustomer(same); await toastFor(same, "synthetic-a", "first-toast");
  const firstClose = same.control((props) => props["aria-label"] === "Close notification").props.onClick as () => void;
  const firstExpiry = [...same.timers.values()].filter((timer) => timer.delay === 8000).map((timer) => timer.callback);
  await toastFor(same, "synthetic-a", "newer-toast");
  firstClose(); for (const callback of firstExpiry) callback(); await same.flush();
  assert.equal(same.state<Notification | null>("toast")?.id, "newer-toast", "same-account old dismissal cannot clear the replacement");
  same.click((props) => props["aria-label"] === "Close notification");
  assert.equal(same.state<Notification | null>("toast"), null, "current actual Close control still dismisses");
});

test("suppression before initial resolution prevents old stable session resurrection after returning", async () => {
  const h = notificationHarness(); h.changePath("/admin"); h.changePath("/dashboard");
  assert.equal(h.stableSessions.length, 2);
  h.stableSessions[0].resolve({ session: { user: { id: "synthetic-a" } } }); await h.flush();
  assert.equal(h.authority.length, 0); assert.equal(h.nullUI(), true);
  h.stableSessions[1].resolve({ session: { user: { id: "synthetic-b" } } }); await h.flush();
  await h.settleAuthority(0); await h.settleSelect(0, [row("synthetic-b", "fresh-b")]);
  h.click((props) => props["aria-label"] === "Notifications"); assertNoAccountUI(h, "synthetic-a");
  assert.ok(h.body().includes("fresh-b"));
});

test("initial stable-session rejection is fail-closed and cannot outrank a later accepted auth event", async () => {
  const initial = notificationHarness(); initial.stableSessions[0].reject(new Error("synthetic initial failure")); await initial.flush();
  assert.equal(initial.nullUI(), true); assert.equal(initial.authority.length, 0); assert.equal(initial.selects.length, 0);
  const later = notificationHarness(); later.auth("synthetic-b"); await later.flush(); await later.settleAuthority(0); await later.settleSelect(0, [row("synthetic-b", "b")]);
  const before = { mutations: later.mutations(), authority: later.authority.length };
  later.stableSessions[0].reject(new Error("synthetic stale initial failure")); await later.flush();
  assert.equal(later.state<string>("userId"), "synthetic-b"); assert.equal(later.mutations(), before.mutations); assert.equal(later.authority.length, before.authority);
});

test("current SELECT defensively excludes foreign-account rows from list, unread count and toast", async () => {
  const h = notificationHarness(); await initialCustomer(h, "synthetic-a", [row("synthetic-a", "a"), row("synthetic-b", "foreign-initial")]);
  h.click((props) => props["aria-label"] === "Notifications"); assertNoAccountUI(h, "synthetic-b");
  assert.equal(h.state<Notification[]>("items").length, 1); assert.ok(h.body().includes("1 unread"));
  h.channels[0].callback(); await h.flush();
  await h.settleSelect(1, [row("synthetic-b", "foreign-incoming"), row("synthetic-a", "a")]);
  assertNoAccountUI(h, "synthetic-b"); assert.equal(h.state<Notification | null>("toast"), null);
});

test("sound preference, notification center route and locale changes preserve the current account", async () => {
  const h = notificationHarness(); await initialCustomer(h); h.click((props) => props["aria-label"] === "Notifications");
  assert.ok(h.hrefs().includes("/dashboard/notifications")); h.click((props) => props.title === "Enable notification sound"); await h.flush();
  assert.deepEqual(h.storageWrites, [["mg_notification_sound", "on"]]);
  await h.settleSelect(h.selects.length - 1, [row("synthetic-a", "initial")]);
  for (const { code } of supportedLocales) { h.changeLocale(code); assert.equal(h.state<string>("userId"), "synthetic-a"); assert.ok(h.body().includes("Synthetic private synthetic-a")); }
  h.click((props) => props.href === "/dashboard/notifications"); assert.equal(h.state<boolean>("open"), false);
});
