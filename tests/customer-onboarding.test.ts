import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  CUSTOMER_GUIDE_KEY,
  HIDDEN_CUSTOMER_GUIDE,
  createCustomerOnboardingController,
  enrollCustomerGuide,
  enrollFreshGoogleCustomerGuide,
  getCustomerGuideStatus,
  getEffectiveCustomerGuideStatus,
  parseCustomerGuideDismissal,
  saveCustomerGuideDismissal,
  type CustomerGuideDismissal,
  type CustomerGuideUser,
} from "../src/lib/customerOnboarding";
import { buildRegistrationCompletionUpdates } from "../src/lib/registrationCompletion";

const customerA = "11111111-1111-4111-8111-111111111111";
const customerB = "22222222-2222-4222-8222-222222222222";
const pendingUser = (id = customerA): CustomerGuideUser => ({ id, user_metadata: { [CUSTOMER_GUIDE_KEY]: "pending" } });
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((onResolve, onReject) => { resolve = onResolve; reject = onReject; });
  return { promise, resolve, reject };
}
function setup() {
  let user: CustomerGuideUser | null = pendingUser();
  const writes: { id: string; status: CustomerGuideDismissal }[] = [];
  const store = new Map<string, string>();
  const options = {
    readUser: async () => user,
    persist: async (id: string, status: CustomerGuideDismissal) => {
      writes.push({ id, status });
      user = { ...pendingUser(id), app_metadata: { [CUSTOMER_GUIDE_KEY]: status } };
      return status;
    },
    sessionStorage: { getItem: (key: string) => store.get(key) ?? null, setItem: (key: string, value: string) => { store.set(key, value); } },
  };
  const controller = createCustomerOnboardingController(options);
  controller.setAccount(customerA);
  return { controller, options, writes, setUser: (next: CustomerGuideUser | null) => { user = next; } };
}

test("guide enrollment marks only new accounts and preserves all existing preference values", () => {
  assert.equal(getCustomerGuideStatus(enrollCustomerGuide()), "pending");
  for (const value of ["pending", "completed", "skipped", "future", null, false]) {
    const metadata = { full_name: "Synthetic fixture", [CUSTOMER_GUIDE_KEY]: value };
    assert.deepEqual(enrollCustomerGuide(metadata), metadata);
  }
  for (const metadata of [undefined, {}, { [CUSTOMER_GUIDE_KEY]: "future" }, { [CUSTOMER_GUIDE_KEY]: true }]) {
    assert.equal(getCustomerGuideStatus(metadata), null);
  }
});

test("Google enrollment uses new-account creation time rather than a login or old country completion", () => {
  const now = Date.parse("2026-09-07T10:00:00Z");
  const fresh = { created_at: new Date(now - 60_000).toISOString(), app_metadata: { provider: "google" } };
  assert.equal(getCustomerGuideStatus(enrollFreshGoogleCustomerGuide(fresh, now)), "pending");
  for (const user of [
    { ...fresh, created_at: new Date(now - 31 * 60_000).toISOString() },
    { ...fresh, created_at: "2024-01-01T00:00:00Z" },
    { ...fresh, created_at: "invalid" },
    { ...fresh, created_at: new Date(now + 1000).toISOString() },
    { ...fresh, app_metadata: { provider: "email" } },
  ]) assert.equal(getCustomerGuideStatus(enrollFreshGoogleCustomerGuide(user, now)), null);
  for (const status of ["completed", "skipped"] as const) {
    assert.equal(getCustomerGuideStatus(enrollFreshGoogleCustomerGuide({ ...fresh, user_metadata: { [CUSTOMER_GUIDE_KEY]: status } }, now)), status);
  }
});

test("an enrolled Google account retains pending or terminal guide state when country is completed much later", () => {
  for (const status of ["pending", "completed", "skipped"] as const) {
    const oldGoogleUser = { created_at: "2024-01-01T00:00:00Z", app_metadata: { provider: "google" }, user_metadata: { [CUSTOMER_GUIDE_KEY]: status } };
    const updates = buildRegistrationCompletionUpdates({ country: "Germany", draft: null, existingMetadata: enrollFreshGoogleCustomerGuide(oldGoogleUser) });
    assert.equal(getCustomerGuideStatus(updates?.metadata), status);
  }
});

test("server-owned completion always wins over stale or edited user metadata", () => {
  for (const status of ["completed", "skipped"] as const) {
    for (const metadata of [undefined, {}, enrollCustomerGuide(), { [CUSTOMER_GUIDE_KEY]: "future" }]) {
      assert.equal(getEffectiveCustomerGuideStatus({ id: customerA, user_metadata: metadata, app_metadata: { [CUSTOMER_GUIDE_KEY]: status } }), status);
    }
  }
  for (const status of ["pending", "future", null]) {
    assert.equal(getEffectiveCustomerGuideStatus({ ...pendingUser(), app_metadata: { [CUSTOMER_GUIDE_KEY]: status } }), null);
  }
});

test("existing, unmarked, unknown, and already dismissed customers do not see an automatic guide", async () => {
  const { controller, setUser } = setup();
  for (const status of [undefined, "completed", "skipped", "future", null]) {
    setUser({ id: customerA, user_metadata: status === undefined ? {} : { [CUSTOMER_GUIDE_KEY]: status } });
    await controller.refresh();
    assert.equal(controller.getSnapshot().visible, false);
  }
  setUser(pendingUser());
  await controller.refresh();
  assert.equal(controller.getSnapshot().visible, true);
  controller.dispose();
});

test("complete and skip persist to the exact account and stay hidden on a new device", async () => {
  for (const status of ["completed", "skipped"] as const) {
    const { controller, options, writes } = setup();
    await controller.refresh();
    assert.equal(await controller.dismiss(status), true);
    assert.deepEqual(writes, [{ id: customerA, status }]);
    assert.deepEqual(controller.getSnapshot(), HIDDEN_CUSTOMER_GUIDE);
    const otherDevice = createCustomerOnboardingController({ ...options, sessionStorage: undefined });
    otherDevice.setAccount(customerA);
    await otherDevice.refresh();
    assert.equal(otherDevice.getSnapshot().visible, false);
    controller.dispose();
    otherDevice.dispose();
  }
});

test("another device's terminal state is checked again before saving and is never rewritten", async () => {
  const { controller, setUser, writes } = setup();
  await controller.refresh();
  setUser({ ...pendingUser(), app_metadata: { [CUSTOMER_GUIDE_KEY]: "completed" } });
  assert.equal(await controller.dismiss("skipped"), true);
  assert.equal(writes.length, 0);
  assert.equal(controller.getSnapshot().visible, false);
  controller.dispose();
});

test("failed save stays optional, reports failure, and retry saves the original choice", async () => {
  const harness = setup();
  let fail = true;
  const controller = createCustomerOnboardingController({ ...harness.options, persist: async (id, status) => {
    if (fail) throw new Error("offline");
    return harness.options.persist(id, status);
  } });
  controller.setAccount(customerA);
  await controller.refresh();
  assert.equal(await controller.dismiss("skipped"), false);
  assert.deepEqual(controller.getSnapshot(), { visible: true, saving: false, saveFailed: true, step: -1 });
  fail = false;
  assert.equal(await controller.retryDismiss(), true);
  assert.deepEqual(harness.writes, [{ id: customerA, status: "skipped" }]);
  controller.dispose();
  harness.controller.dispose();
});

test("continue without saving hides only the chosen account in this tab, not another device", async () => {
  const { controller, options, setUser, writes } = setup();
  await controller.refresh();
  controller.hideForSession();
  await controller.refresh();
  assert.equal(controller.getSnapshot().visible, false);
  const remount = createCustomerOnboardingController(options);
  remount.setAccount(customerA);
  await remount.refresh();
  assert.equal(remount.getSnapshot().visible, false);
  const otherDevice = createCustomerOnboardingController({ ...options, sessionStorage: undefined });
  otherDevice.setAccount(customerA);
  await otherDevice.refresh();
  assert.equal(otherDevice.getSnapshot().visible, true);
  setUser(pendingUser(customerB));
  remount.setAccount(customerB);
  await remount.refresh();
  assert.equal(remount.getSnapshot().visible, true);
  assert.equal(writes.length, 0);
  [controller, remount, otherDevice].forEach((item) => item.dispose());
});

test("unavailable session storage never blocks skip or the workspace", async () => {
  const harness = setup();
  const controller = createCustomerOnboardingController({ ...harness.options, sessionStorage: {
    getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); },
  } });
  controller.setAccount(customerA);
  await controller.refresh();
  controller.hideForSession();
  await controller.refresh();
  assert.equal(controller.getSnapshot().visible, false);
  controller.dispose();
  harness.controller.dispose();
});

test("a late initial read cannot display the previous account's guide after account switching", async () => {
  const oldRead = deferred<CustomerGuideUser | null>();
  let userId = customerA;
  const controller = createCustomerOnboardingController({ readUser: () => userId === customerA ? oldRead.promise : Promise.resolve({ id: customerB, user_metadata: {} }), persist: async () => null });
  controller.setAccount(customerA);
  const pending = controller.refresh();
  userId = customerB;
  controller.setAccount(customerB);
  await controller.refresh();
  oldRead.resolve(pendingUser());
  await pending;
  assert.deepEqual(controller.getSnapshot(), HIDDEN_CUSTOMER_GUIDE);
  controller.dispose();
});

test("account switch during fresh dismissal verification cannot write either account", async () => {
  const harness = setup();
  const verification = deferred<CustomerGuideUser | null>();
  let reads = 0;
  const controller = createCustomerOnboardingController({ ...harness.options, readUser: () => ++reads === 1 ? Promise.resolve(pendingUser()) : verification.promise });
  controller.setAccount(customerA);
  await controller.refresh();
  const pending = controller.dismiss("completed");
  controller.setAccount(customerB);
  verification.resolve(pendingUser());
  assert.equal(await pending, false);
  assert.equal(harness.writes.length, 0);
  assert.deepEqual(controller.getSnapshot(), HIDDEN_CUSTOMER_GUIDE);
  controller.dispose();
  harness.controller.dispose();
});

test("late save completion never dismisses a different account and always receives the original expected ID", async () => {
  const saving = deferred<CustomerGuideDismissal | null>();
  const writeStarted = deferred<string>();
  let user = pendingUser();
  const controller = createCustomerOnboardingController({ readUser: async () => user, persist: async (id) => { writeStarted.resolve(id); return saving.promise; } });
  controller.setAccount(customerA);
  await controller.refresh();
  const pending = controller.dismiss("completed");
  assert.equal(await writeStarted.promise, customerA);
  user = pendingUser(customerB);
  controller.setAccount(customerB);
  await controller.refresh();
  saving.resolve("completed");
  assert.equal(await pending, false);
  assert.equal(controller.getSnapshot().visible, true);
  controller.dispose();
});

test("concurrent clicks produce one save and an out-of-order refresh cannot reopen the guide", async () => {
  const harness = setup();
  const lateRead = deferred<CustomerGuideUser | null>();
  let reads = 0;
  const controller = createCustomerOnboardingController({ ...harness.options, readUser: () => ++reads === 2 ? lateRead.promise : harness.options.readUser() });
  controller.setAccount(customerA);
  await controller.refresh();
  const refresh = controller.refresh();
  const save = controller.dismiss("skipped");
  assert.equal(await controller.dismiss("completed"), false);
  assert.equal(await save, true);
  lateRead.resolve(pendingUser());
  await refresh;
  assert.equal(harness.writes.length, 1);
  assert.equal(controller.getSnapshot().visible, false);
  controller.dispose();
  harness.controller.dispose();
});

test("read outages fail soft and a hung initial read is bounded", async () => {
  for (const readUser of [async () => { throw new Error("offline"); }, () => new Promise<CustomerGuideUser | null>(() => {})]) {
    const controller = createCustomerOnboardingController({ readUser, persist: async () => null, operationTimeoutMs: 10 });
    controller.setAccount(customerA);
    await controller.refresh();
    assert.deepEqual(controller.getSnapshot(), HIDDEN_CUSTOMER_GUIDE);
    controller.dispose();
  }
});

test("hung saves become retryable and late completion cannot undo session dismissal", async () => {
  const saving = deferred<CustomerGuideDismissal | null>();
  const controller = createCustomerOnboardingController({ readUser: async () => pendingUser(), persist: () => saving.promise, operationTimeoutMs: 10 });
  controller.setAccount(customerA);
  await controller.refresh();
  assert.equal(await controller.dismiss("skipped"), false);
  assert.deepEqual(controller.getSnapshot(), { visible: true, saving: false, saveFailed: true, step: -1 });
  controller.hideForSession();
  saving.resolve("skipped");
  await Promise.resolve();
  assert.deepEqual(controller.getSnapshot(), HIDDEN_CUSTOMER_GUIDE);
  controller.dispose();
});

test("dispose cancels outstanding operations without publishing or leaving pending timer work", async () => {
  const controller = createCustomerOnboardingController({ readUser: () => new Promise<CustomerGuideUser | null>(() => {}), persist: async () => null });
  let publications = 0;
  controller.subscribe(() => { publications += 1; });
  controller.setAccount(customerA);
  const pending = controller.refresh();
  controller.dispose();
  await pending;
  assert.equal(publications, 1);
});

test("guide progress resumes after route remount without restarting the introduction", async () => {
  const { controller, options } = setup();
  await controller.refresh();
  assert.equal(controller.getSnapshot().step, -1);
  controller.moveToStep(0);
  controller.moveToStep(2);
  controller.dispose();
  const remount = createCustomerOnboardingController(options);
  remount.setAccount(customerA);
  await remount.refresh();
  assert.equal(remount.getSnapshot().visible, true);
  assert.equal(remount.getSnapshot().step, 2);
  for (const invalid of [4, -2, 0.5, NaN, Infinity]) remount.moveToStep(invalid);
  assert.equal(remount.getSnapshot().step, 2);
  remount.dispose();
});

test("guide step progress is account-isolated and malformed persisted values reset safely", async () => {
  const { controller, options, setUser } = setup();
  await controller.refresh();
  controller.moveToStep(3);
  controller.setAccount(customerB);
  setUser(pendingUser(customerB));
  await controller.refresh();
  assert.equal(controller.getSnapshot().step, -1);
  controller.moveToStep(1);
  controller.setAccount(customerA);
  setUser(pendingUser());
  await controller.refresh();
  assert.equal(controller.getSnapshot().step, 3);
  controller.dispose();
  for (const value of ["4", "-2", "1.5", "NaN", "", "{}", " 2", "-3"]) {
    const invalid = createCustomerOnboardingController({ ...options, sessionStorage: { getItem: () => value, setItem() {} } });
    invalid.setAccount(customerA);
    await invalid.refresh();
    assert.equal(invalid.getSnapshot().step, -1);
    invalid.dispose();
  }
});

test("dismissal payload accepts only the two own-account terminal fields", () => {
  assert.deepEqual(parseCustomerGuideDismissal({ expectedUserId: customerA, status: "skipped" }), { expectedUserId: customerA, status: "skipped" });
  for (const input of [null, [], {}, { expectedUserId: customerA, status: "pending" }, { expectedUserId: "not-an-id", status: "skipped" }, { expectedUserId: customerA, status: "skipped", role: "admin" }, { expectedUserId: customerA, status: "completed", data: {} }]) {
    assert.equal(parseCustomerGuideDismissal(input), null);
  }
});

test("server writer rejects cross-account and unavailable guides without any mutation", async () => {
  let writes = 0;
  const write = async () => { writes += 1; return null; };
  assert.deepEqual(await saveCustomerGuideDismissal({ user: pendingUser(customerB), expectedUserId: customerA, status: "skipped", write }), { errorCode: "account_changed", statusCode: 409 });
  for (const metadata of [{}, { [CUSTOMER_GUIDE_KEY]: "future" }]) {
    assert.deepEqual(await saveCustomerGuideDismissal({ user: { id: customerA, user_metadata: metadata }, expectedUserId: customerA, status: "completed", write }), { errorCode: "guide_not_available", statusCode: 409 });
  }
  assert.equal(writes, 0);
});

test("server preserves terminal state and writes only the preference key for its verified owner", async () => {
  const writes: unknown[] = [];
  const write = async (id: string, metadata: Record<string, unknown>) => { writes.push({ id, metadata }); return { id, user_metadata: pendingUser().user_metadata, app_metadata: metadata }; };
  assert.deepEqual(await saveCustomerGuideDismissal({ user: { ...pendingUser(), app_metadata: { [CUSTOMER_GUIDE_KEY]: "skipped" } }, expectedUserId: customerA, status: "completed", write }), { status: "skipped" });
  assert.equal(writes.length, 0);
  assert.deepEqual(await saveCustomerGuideDismissal({ user: { id: customerA, user_metadata: { ...pendingUser().user_metadata, country: "Germany", registration_country_confirmed: true } }, expectedUserId: customerA, status: "completed", write }), { status: "completed" });
  assert.deepEqual(writes, [{ id: customerA, metadata: { [CUSTOMER_GUIDE_KEY]: "completed" } }]);
});

test("server does not report success for missing, wrong-account or unconfirmed write responses", async () => {
  for (const user of [null, pendingUser(), { id: customerB, app_metadata: { [CUSTOMER_GUIDE_KEY]: "skipped" } }, { id: customerA, user_metadata: { [CUSTOMER_GUIDE_KEY]: "skipped" } }]) {
    assert.deepEqual(await saveCustomerGuideDismissal({ user: pendingUser(), expectedUserId: customerA, status: "skipped", write: async () => user }), { errorCode: "guide_save_failed", statusCode: 503 });
  }
});

test("production wiring keeps device assurance, exact-user bearer binding and all current signup entry points", () => {
  const route = readFileSync("src/app/api/customer/onboarding/route.ts", "utf8");
  const hook = readFileSync("src/hooks/useCustomerOnboarding.ts", "utf8");
  const register = readFileSync("src/app/register/page.tsx", "utf8");
  const callback = readFileSync("src/app/auth/callback/page.tsx", "utf8");
  const finalize = readFileSync("src/app/api/auth/oauth-registration/finalize/route.ts", "utf8");
  assert.match(route, /await requireApiUser\(request\)/);
  assert.doesNotMatch(route, /requireBaseApiUser/);
  assert.match(route, /user: auth\.user/);
  assert.match(route, /updateUserById\(id,\s*\{\s*app_metadata: metadata/);
  assert.match(route, /private, no-store/);
  assert.match(hook, /authenticatedFetchForUser\(expectedUserId,/);
  assert.match(hook, /supabase\.auth\.getUser\(\)/);
  assert.doesNotMatch(hook, /supabase\.auth\.updateUser/);
  assert.match(register, /data: \{\s*\.\.\.enrollCustomerGuide\(\)/);
  assert.match(callback, /buildPendingRegistrationCountryMetadata\(\s*enrollFreshGoogleCustomerGuide\(currentSession\.user\)/);
  assert.match(finalize, /existingMetadata: enrollFreshGoogleCustomerGuide\(auth\.user\)/);
});
