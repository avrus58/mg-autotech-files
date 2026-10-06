import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as draftHelpers from "../src/lib/adminCustomerDraft";
import { hasAdminSnapshotRegression } from "../src/lib/adminDataStability";
import { ADMIN_SYNC_INCIDENT_HEADER, readAdminSyncIncidentCode } from "../src/lib/adminSyncResilience";
import {
  creditPackages,
  MAX_CREDIT_PACKAGE_TOTAL_EURO,
  MAX_CUSTOM_CREDIT_UNIT_PRICE_EURO,
  minimumCreditPackageTotalEuro,
  type CreditPackageId,
} from "../src/lib/creditPackages";
import { hasStaffPermission, type StaffAccess } from "../src/lib/staffPermissions";

type Form = {
  full_name: string;
  city: string;
  allow_negative_credits: boolean;
  customer_tags: string[];
  commercial_package_price_overrides_eur: Record<CreditPackageId, string>;
  commercial_custom_unit_price_override_eur: string;
  payment_bank: string;
};

const identity = { customerId: "synthetic-A", instanceId: 1 };
const profileKeys = ["full_name", "city", "allow_negative_credits", "customer_tags"] as const;
const commercialKeys = ["commercial_package_price_overrides_eur", "commercial_custom_unit_price_override_eur", "payment_bank"] as const;

function initialForm(): Form {
  return {
    full_name: "Synthetic name", city: "Fixturetown", allow_negative_credits: true,
    customer_tags: ["vip"],
    commercial_package_price_overrides_eur: {
      credits_10: "20", credits_50: "90", credits_100: "170", credits_250: "400", credits_500: "750",
    },
    commercial_custom_unit_price_override_eur: "2", payment_bank: "enabled",
  };
}

function plain<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }

test("draft creation and edits isolate baseline, nested records and arrays from caller mutation", () => {
  const input = initialForm();
  const opened = draftHelpers.createAdminCustomerDraft(identity, input);
  input.customer_tags.push("reseller");
  input.commercial_package_price_overrides_eur.credits_10 = "999";
  assert.deepEqual(opened.baseline, initialForm());
  assert.deepEqual(opened.draft, initialForm());
  assert.notEqual(opened.draft.customer_tags, opened.baseline.customer_tags);
  assert.notEqual(opened.draft.commercial_package_price_overrides_eur, opened.baseline.commercial_package_price_overrides_eur);
  const editedInput = { ...initialForm(), full_name: "Local name" };
  const edited = draftHelpers.editAdminCustomerDraft(opened, editedInput);
  editedInput.customer_tags.push("workshop");
  assert.equal(edited.draft.full_name, "Local name");
  assert.deepEqual(edited.draft.customer_tags, ["vip"]);
  assert.deepEqual(opened.draft, initialForm());
  assert.deepEqual(edited.baseline, initialForm());
});

test("repeated profile snapshots preserve dirty empty, false and removed tags while accepting untouched changes", () => {
  let state = draftHelpers.createAdminCustomerDraft(identity, initialForm());
  state = draftHelpers.editAdminCustomerDraft(state, {
    ...state.draft, full_name: "", allow_negative_credits: false, customer_tags: [],
  });
  for (const city of ["Remote one", "Remote two", "Remote three"]) {
    state = draftHelpers.reconcileAdminCustomerDraftFields(state, identity, {
      ...initialForm(), full_name: "Remote name", city, allow_negative_credits: true, customer_tags: ["vip", "reseller"],
    }, profileKeys);
    assert.equal(state.draft.full_name, "");
    assert.equal(state.draft.allow_negative_credits, false);
    assert.deepEqual(state.draft.customer_tags, []);
    assert.equal(state.draft.city, city);
    assert.equal(state.baseline.full_name, "Remote name");
    assert.deepEqual(state.draft.commercial_package_price_overrides_eur, initialForm().commercial_package_price_overrides_eur);
  }
});

test("commercial reconciliation is per package and profile reconciliation cannot reset loaded prices", () => {
  let state = draftHelpers.createAdminCustomerDraft(identity, initialForm());
  state = draftHelpers.editAdminCustomerDraft(state, {
    ...state.draft, commercial_package_price_overrides_eur: { ...state.draft.commercial_package_price_overrides_eur, credits_10: "25" },
  });
  state = draftHelpers.reconcileAdminCustomerDraftFields(state, identity, {
    ...initialForm(), commercial_package_price_overrides_eur: { ...initialForm().commercial_package_price_overrides_eur, credits_10: "24", credits_50: "95" },
  }, commercialKeys);
  assert.equal(state.draft.commercial_package_price_overrides_eur.credits_10, "25");
  assert.equal(state.draft.commercial_package_price_overrides_eur.credits_50, "95");
  assert.equal(state.baseline.commercial_package_price_overrides_eur.credits_10, "24");
  state = draftHelpers.reconcileAdminCustomerDraftFields(state, identity, {
    ...initialForm(), city: "Remote city", commercial_custom_unit_price_override_eur: "",
    commercial_package_price_overrides_eur: Object.fromEntries(creditPackages.map(({ id }) => [id, ""])) as Form["commercial_package_price_overrides_eur"],
  }, profileKeys);
  assert.equal(state.draft.commercial_custom_unit_price_override_eur, "2");
  assert.equal(state.draft.commercial_package_price_overrides_eur.credits_10, "25");
  assert.equal(state.draft.commercial_package_price_overrides_eur.credits_50, "95");
});

test("save acknowledgement uses submitted values and independently advances profile/commercial baselines", () => {
  let state = draftHelpers.createAdminCustomerDraft(identity, initialForm());
  state = draftHelpers.editAdminCustomerDraft(state, { ...state.draft, full_name: " Submitted name ", city: "Submitted city" });
  const submitted = draftHelpers.cloneAdminCustomerDraftFields(state.draft);
  state = draftHelpers.editAdminCustomerDraft(state, { ...state.draft, city: "Typed after click" });
  state = draftHelpers.acceptAdminCustomerSubmittedFields(state, identity, submitted, {
    full_name: "Submitted name", city: "Submitted city",
  }, profileKeys);
  assert.equal(state.draft.full_name, "Submitted name");
  assert.equal(state.draft.city, "Typed after click");
  assert.equal(state.baseline.city, "Submitted city");
  assert.deepEqual(state.baseline.commercial_package_price_overrides_eur, initialForm().commercial_package_price_overrides_eur);
  state = draftHelpers.editAdminCustomerDraft(state, {
    ...state.draft, commercial_package_price_overrides_eur: { ...state.draft.commercial_package_price_overrides_eur, credits_10: "25", credits_50: "100" },
  });
  const commercialSubmitted = draftHelpers.cloneAdminCustomerDraftFields(state.draft);
  state = draftHelpers.editAdminCustomerDraft(state, {
    ...state.draft, commercial_package_price_overrides_eur: { ...state.draft.commercial_package_price_overrides_eur, credits_10: "30" },
  });
  state = draftHelpers.acceptAdminCustomerSubmittedFields(state, identity, commercialSubmitted, commercialSubmitted, commercialKeys);
  assert.equal(state.draft.commercial_package_price_overrides_eur.credits_10, "30");
  assert.equal(state.draft.commercial_package_price_overrides_eur.credits_50, "100");
  assert.equal(state.baseline.commercial_package_price_overrides_eur.credits_10, "25");
  assert.equal(state.draft.city, "Typed after click");
  assert.equal(state.baseline.city, "Submitted city");
});

test("wrong customer or reopened editor identity cannot acknowledge or reconcile a draft", () => {
  const state = draftHelpers.createAdminCustomerDraft(identity, initialForm());
  for (const stale of [{ customerId: "synthetic-B", instanceId: 1 }, { customerId: "synthetic-A", instanceId: 0 }]) {
    assert.equal(draftHelpers.isAdminCustomerDraftIdentity(state, stale), false);
    assert.equal(draftHelpers.reconcileAdminCustomerDraftFields(state, stale, { full_name: "Stale response" }, profileKeys), state);
    assert.equal(draftHelpers.acceptAdminCustomerSubmittedFields(state, stale, { full_name: "Synthetic name" }, { full_name: "Stale response" }, profileKeys), state);
  }
  assert.equal(draftHelpers.isAdminCustomerDraftIdentity(null, identity), false);
});

type Profile = Record<string, unknown> & { id: string; full_name: string; city: string; credit_balance: number };
type AppForm = Record<string, unknown> & {
  full_name: string; city: string; company_name: string; customer_tags: string[];
  commercial_package_price_overrides_eur: Record<CreditPackageId, string>;
  commercial_custom_unit_price_override_eur: string; payment_bank: string;
  global_package_prices_eur: Record<CreditPackageId, string>;
  effective_package_prices_eur: Record<CreditPackageId, string>;
  global_custom_unit_price_eur: string; effective_custom_unit_price_eur: string;
};
type AppEditor = draftHelpers.AdminCustomerDraft<AppForm>;
type ResponsePayload = Record<string, unknown>;
type State = Record<string, unknown> & {
  selectedCustomer: Profile | null; customers: Profile[]; customerEditor: AppEditor | null;
  customerPricingLoadState: string; customerPricingUpdatedAt: string | null;
};
type Request = {
  url: string; init: { method?: string; body?: string };
  resolve(payload: ResponsePayload, status?: number): void; reject(error: Error): void;
};
type Actions = {
  openCustomer(customer: Profile): void;
  closeCustomerModal(): void;
  setCustomerForm(action: AppForm | ((current: AppForm) => AppForm)): void;
  loadAdminData(options?: { silent?: boolean }): Promise<void>;
  loadCustomerPricing(customerId: string): Promise<void>;
  saveCustomerPricing(): Promise<void>;
  saveCustomerSettings(): Promise<void>;
};

const source = readFileSync("src/app/admin/page.tsx", "utf8");
const ast = ts.createSourceFile("admin-page.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const page = ast.statements.find((node): node is ts.FunctionDeclaration => ts.isFunctionDeclaration(node) && node.name?.text === "AdminPage");
assert.ok(page?.body, "exercise the actual admin page callbacks, not a duplicate draft-save model");
const topNames = ["emptyPackagePriceText", "makeCustomerForm", "applyCustomerPricingPayload", "parseOptionalPackageTotal", "parseOptionalCustomUnitPrice", "paymentOverride", "paymentOverrideValue", "mergeCustomerSnapshot"];
const topDeclarations = ast.statements.filter((node) =>
  ts.isFunctionDeclaration(node) && topNames.includes(node.name?.text ?? "")
  || ts.isVariableStatement(node) && node.declarationList.declarations.some((declaration) =>
    ts.isIdentifier(declaration.name) && ["customerProfileFormKeys", "customerPricingFormKeys"].includes(declaration.name.text)),
);
assert.equal(topDeclarations.filter(ts.isFunctionDeclaration).length, topNames.length);
const callbackNames = ["openCustomer", "loadCustomerPricing", "saveCustomerPricing", "saveCustomerSettings"];
const callbackDeclarations = page.body.statements.filter((node) =>
  ts.isFunctionDeclaration(node) && callbackNames.includes(node.name?.text ?? "")
  || ts.isVariableStatement(node) && node.declarationList.declarations.some((declaration) =>
    ts.isIdentifier(declaration.name) && ["setCustomerForm", "loadAdminData"].includes(declaration.name.text)),
);
assert.equal(callbackDeclarations.length, callbackNames.length + 2, "extract the real draft setter and full refresh callback");
let closeExpression: ts.Expression | undefined;
function findClose(node: ts.Node) {
  if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(ast) === "CustomerDetailModal") {
    const attribute = node.attributes.properties.find((property): property is ts.JsxAttribute => ts.isJsxAttribute(property) && property.name.getText(ast) === "onClose");
    if (attribute?.initializer && ts.isJsxExpression(attribute.initializer)) closeExpression = attribute.initializer.expression;
  }
  ts.forEachChild(node, findClose);
}
findClose(page);
assert.ok(closeExpression, "execute the actual modal close callback");
const namedClose = ts.isIdentifier(closeExpression)
  ? page.body.statements.find((node): node is ts.FunctionDeclaration => ts.isFunctionDeclaration(node) && node.name?.text === closeExpression?.getText(ast))
  : undefined;
const compiled = ts.transpileModule(`
${topDeclarations.map((node) => node.getText(ast)).join("\n")}
exports.makeCustomerForm = makeCustomerForm;
exports.render = function(customerEditor, customerForm, selectedCustomer, customerPricingLoadState, customerPricingUpdatedAt) {
  ${callbackDeclarations.map((node) => node.getText(ast)).join("\n")}
  ${namedClose?.getText(ast) ?? ""}
  const closeCustomerModal = ${closeExpression.getText(ast)};
  return { openCustomer, closeCustomerModal, setCustomerForm, loadAdminData, loadCustomerPricing, saveCustomerPricing, saveCustomerSettings };
};`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;

function syntheticProfile(suffix = "A", extra: Partial<Profile> = {}): Profile {
  return {
    id: `synthetic-${suffix}`, customer_id: `FIXTURE-${suffix}`, email: `${suffix.toLowerCase()}@fixture.invalid`,
    full_name: `Synthetic customer ${suffix}`, city: "Fixturetown", company_name: "Synthetic workshop",
    credit_balance: 12, account_type: "company", customer_tags: ["vip"], allow_negative_credits: true,
    ...extra,
  };
}

function pricingPayload(customerId = "synthetic-A", overrides: Record<string, number | null> = {}, revision = "2026-10-06T01:00:00.000Z"): ResponsePayload {
  return {
    policy: {
      user_id: customerId, pricing_model_version: 2,
      package_price_overrides_eur: Object.fromEntries(creditPackages.map(({ id }) => [id, overrides[id] ?? null])),
      custom_credit_unit_price_override_eur: 2, payment_stripe_enabled: null, payment_bank_enabled: true,
      internal_note: "Synthetic pricing note", updated_at: revision,
    },
    effectiveQuote: {
      packages: creditPackages.map(({ id, credits }) => ({ id, globalPriceEuro: credits * 3, priceEuro: overrides[id] ?? credits * 3 })),
      globalCustomUnitPriceEuro: 3, customUnitPriceEuro: 2,
    },
    explicitPricingWritesEnabled: true,
  };
}

function appHarness() {
  const state: State = {
    selectedCustomer: null, customers: [], customerEditor: null,
    customerPricingLoadState: "idle", customerPricingUpdatedAt: null,
    customerPricingError: "", customerPricingMessage: "", message: "",
    customerSavingId: null, customerPricingSavingId: null,
  };
  const requests: Request[] = [];
  const access: StaffAccess = { role: "admin", staffRole: "owner", permissions: ["customers.view", "customers.manage", "credits.manage"] };
  const refs: Record<string, { current: unknown }> = {
    customerEditorInstanceRef: { current: 0 }, selectedCustomerIdRef: { current: null },
    customerPricingLoadRequestRef: { current: 0 }, customerPricingSaveRequestRef: { current: 0 },
    customerProfileSaveRequestRef: { current: 0 }, customerProfileSnapshotRevisionRef: { current: 0 },
    adminLoadSequenceRef: { current: 0 }, adminRefreshInFlightRef: { current: false },
    hasLoadedAdminDataRef: { current: true }, initialOrdersLoadedRef: { current: false },
    knownOrderIdsRef: { current: new Set<string>() }, knownCustomerIdsRef: { current: new Set<string>() },
  };
  const setState = (key: string) => (next: unknown) => {
    state[key] = typeof next === "function" ? (next as (previous: unknown) => unknown)(state[key]) : next;
  };
  const noExternalWork = () => { throw new Error("Draft tests must not access browser storage, secrets, real transport or timers."); };
  const context: Record<string, unknown> = {
    exports: {}, ...draftHelpers, ...refs, creditPackages, MAX_CREDIT_PACKAGE_TOTAL_EURO,
    MAX_CUSTOM_CREDIT_UNIT_PRICE_EURO, minimumCreditPackageTotalEuro, hasStaffPermission, hasAdminSnapshotRegression,
    ADMIN_SYNC_INCIDENT_HEADER, readAdminSyncIncidentCode, adminAccess: access,
    useCallback: (callback: unknown) => callback,
    resetAdminRetryBudget() {}, playAdminNotificationSound: noExternalWork,
    handleAdminSyncFailure: (input: unknown) => { state.syncFailure = input; },
    resolveAdminAccess: noExternalWork, AUTH_SESSION_REQUIRED_MESSAGE: "Synthetic session missing", AUTH_SESSION_RECOVERY_MESSAGE: "Synthetic recovery",
    navigator: { onLine: true }, window: { location: { hash: "" }, setTimeout: noExternalWork },
    fetch: noExternalWork, setTimeout: noExternalWork, document: undefined, localStorage: undefined,
    authenticatedFetch(url: string, init: Request["init"] = {}) {
      assert.match(url, /^\/api\/admin\/(?:dashboard|customers\/synthetic-[AB]\/(?:profile|commercial-policy))$/u);
      return new Promise((resolve, reject) => {
        requests.push({ url, init: plain(init), reject, resolve(payload, status = 200) {
          resolve({ ok: status >= 200 && status < 300, status, headers: { get: () => null }, json: async () => plain(payload) });
        } });
      });
    },
  };
  for (const match of compiled.matchAll(/\b(set[A-Z]\w*)\(/gu)) {
    if (match[1] !== "setCustomerForm") context[match[1]] = setState(match[1].slice(3, 4).toLowerCase() + match[1].slice(4));
  }
  const moduleExports = context.exports as { render?: (...args: unknown[]) => Actions; makeCustomerForm?: (profile: Profile) => AppForm };
  runInNewContext(compiled, context);
  assert.ok(moduleExports.render && moduleExports.makeCustomerForm);
  const actions = () => moduleExports.render!(state.customerEditor, state.customerEditor?.draft ?? null, state.selectedCustomer, state.customerPricingLoadState, state.customerPricingUpdatedAt);
  return {
    state, requests, refs, actions, makeCustomerForm: moduleExports.makeCustomerForm,
    form: () => { assert.ok(state.customerEditor); return state.customerEditor.draft; },
    edit: (changes: Partial<AppForm>) => actions().setCustomerForm((current) => ({ ...current, ...changes })),
    async open(profile = syntheticProfile(), payload = pricingPayload(profile.id)) {
      // Opening normally originates from the canonical customer list. Seed
      // that synthetic server snapshot without substituting a draft algorithm.
      if (!state.customers.some(({ id }) => id === profile.id)) state.customers.push(profile);
      actions().openCustomer(profile);
      const request = requests.at(-1); assert.ok(request); request.resolve(payload);
      for (let index = 0; index < 8; index += 1) await Promise.resolve();
      assert.equal(state.customerPricingLoadState, "ready");
    },
    async refresh(profiles: Profile[]) {
      const pending = actions().loadAdminData({ silent: true });
      const request = requests.at(-1); assert.ok(request); assert.equal(request.url, "/api/admin/dashboard");
      request.resolve({ access, orders: [], customers: profiles, emailIssues: [] });
      await pending;
      assert.equal(state.syncFailure, undefined);
    },
  };
}

test("actual open, pricing load, repeated dashboard refresh and edit callbacks retain local drafts and loaded commercial fields", async () => {
  const app = appHarness();
  await app.open(syntheticProfile(), pricingPayload("synthetic-A", { credits_10: 20 }));
  app.edit({ full_name: "", customer_tags: [], allow_negative_credits: false });
  for (let index = 0; index < 3; index += 1) {
    await app.refresh([syntheticProfile("A", { full_name: "Remote name", city: `Remote city ${index}`, credit_balance: 20 + index })]);
    assert.equal(app.form().full_name, "");
    assert.deepEqual(plain(app.form().customer_tags), []);
    assert.equal(app.form().allow_negative_credits, false);
    assert.equal(app.form().city, `Remote city ${index}`);
    assert.equal(app.form().commercial_package_price_overrides_eur.credits_10, "20");
    assert.equal(app.form().commercial_custom_unit_price_override_eur, "2");
    assert.equal(app.form().payment_bank, "enabled");
    assert.equal(app.form().global_package_prices_eur.credits_10, "30");
    assert.equal(app.form().effective_package_prices_eur.credits_10, "20");
    assert.equal(app.form().global_custom_unit_price_eur, "3");
    assert.equal(app.form().effective_custom_unit_price_eur, "2");
    assert.equal(app.state.selectedCustomer?.credit_balance, 20 + index);
  }
});

test("actual profile save retains post-click edits, accepts confirmed normalization and preserves loaded pricing", async () => {
  const app = appHarness(); await app.open();
  app.edit({ full_name: " Submitted name ", city: "Submitted city" });
  const pending = app.actions().saveCustomerSettings();
  const request = app.requests.at(-1)!;
  assert.match(request.url, /\/profile$/u);
  const submitted = JSON.parse(request.init.body!);
  assert.equal(submitted.full_name, "Submitted name");
  app.edit({ city: "Typed after click" });
  request.resolve({ customer: { id: "synthetic-A", full_name: "Submitted name", city: "Submitted city" } });
  await pending;
  assert.equal(app.form().full_name, "Submitted name");
  assert.equal(app.form().city, "Typed after click");
  assert.equal(app.state.customerEditor?.baseline.city, "Submitted city");
  assert.equal(app.form().commercial_custom_unit_price_override_eur, "2");
  assert.equal(app.state.customerSavingId, null);
});

test("actual commercial save retains post-click package edits independently and preserves dirty profile fields", async () => {
  const app = appHarness(); await app.open();
  app.edit({ city: "Unsaved profile city", commercial_package_price_overrides_eur: { ...app.form().commercial_package_price_overrides_eur, credits_10: "25", credits_50: "100" } });
  const pending = app.actions().saveCustomerPricing(); const request = app.requests.at(-1)!;
  assert.equal(JSON.parse(request.init.body!).packagePriceOverridesEuro.credits_10, 25);
  app.edit({ commercial_package_price_overrides_eur: { ...app.form().commercial_package_price_overrides_eur, credits_10: "30" } });
  request.resolve(pricingPayload("synthetic-A", { credits_10: 25, credits_50: 100 }, "2026-10-06T02:00:00.000Z"));
  await pending;
  assert.equal(app.form().commercial_package_price_overrides_eur.credits_10, "30");
  assert.equal(app.form().commercial_package_price_overrides_eur.credits_50, "100");
  assert.equal(app.state.customerEditor?.baseline.commercial_package_price_overrides_eur.credits_10, "25");
  assert.equal(app.form().city, "Unsaved profile city");
  assert.equal(app.state.customerEditor?.baseline.city, "Fixturetown");
});

test("actual failed profile and pricing saves keep draft/baselines for retry", async () => {
  const app = appHarness(); await app.open();
  app.edit({ full_name: "Local profile", commercial_custom_unit_price_override_eur: "2.5" });
  const before = plain(app.state.customerEditor);
  const profileSave = app.actions().saveCustomerSettings(); app.requests.at(-1)!.resolve({ error: "Synthetic profile conflict" }, 409); await profileSave;
  assert.deepEqual(plain(app.state.customerEditor), before);
  assert.equal(app.state.customerSavingId, null);
  const pricingSave = app.actions().saveCustomerPricing(); app.requests.at(-1)!.reject(new Error("Synthetic network error")); await pricingSave;
  assert.deepEqual(plain(app.state.customerEditor), before);
  assert.equal(app.state.customerPricingSavingId, null);
});

for (const transition of ["A-B-A", "close-reopen"] as const) {
  test(`actual delayed pricing load cannot mutate a new editor after ${transition}`, async () => {
    const app = appHarness(); await app.open();
    const oldInstance = app.state.customerEditor!.instanceId;
    const staleLoad = app.actions().loadCustomerPricing("synthetic-A"); const staleRequest = app.requests.at(-1)!;
    if (transition === "A-B-A") await app.open(syntheticProfile("B"), pricingPayload("synthetic-B"));
    else app.actions().closeCustomerModal();
    await app.open(syntheticProfile(), pricingPayload("synthetic-A", { credits_10: 70 }, "2026-10-06T03:00:00.000Z"));
    assert.notEqual(app.state.customerEditor!.instanceId, oldInstance);
    app.edit({ full_name: "Current editor" }); const before = plain(app.state.customerEditor);
    staleRequest.resolve(pricingPayload("synthetic-A", { credits_10: 10 })); await staleLoad;
    assert.deepEqual(plain(app.state.customerEditor), before);
    assert.equal(app.state.customerPricingLoadState, "ready");
    assert.equal(app.state.customerPricingUpdatedAt, "2026-10-06T03:00:00.000Z");
  });

  for (const kind of ["profile", "pricing"] as const) {
    test(`actual stale ${kind} acknowledgement is rejected after ${transition}`, async () => {
      const app = appHarness(); await app.open(); app.edit({ full_name: "Submitted old editor" });
      const pending = kind === "profile" ? app.actions().saveCustomerSettings() : app.actions().saveCustomerPricing();
      const staleRequest = app.requests.at(-1)!;
      if (transition === "A-B-A") await app.open(syntheticProfile("B"), pricingPayload("synthetic-B"));
      else app.actions().closeCustomerModal();
      await app.open(syntheticProfile(), pricingPayload("synthetic-A", { credits_10: 70 }));
      app.edit({ full_name: "Current editor" }); const before = plain(app.state.customerEditor);
      staleRequest.resolve(kind === "profile" ? { customer: { id: "synthetic-A", full_name: "Stale acknowledgment" } } : pricingPayload("synthetic-A", { credits_10: 10 }));
      await pending;
      assert.deepEqual(plain(app.state.customerEditor), before);
      assert.equal(app.state.customerPricingMessage, "");
      assert.notEqual(app.state.message, "FIXTURE-A updated.");
    });
  }
}

test("profile acknowledgement cannot regress newer read-only customer values received during the save", async () => {
  const app = appHarness(); await app.open();
  app.edit({ full_name: "Saved local name" });
  const pending = app.actions().saveCustomerSettings(); const profileRequest = app.requests.at(-1)!;
  await app.refresh([syntheticProfile("A", { city: "Newest remote city", credit_balance: 99 })]);
  profileRequest.resolve({ customer: { id: "synthetic-A", full_name: "Saved local name" } }); await pending;
  assert.equal(app.state.selectedCustomer?.credit_balance, 99);
  assert.equal(app.state.customers[0]?.credit_balance, 99);
  assert.equal(app.form().full_name, "Saved local name");
});

test("a pre-save dashboard response cannot undo a later successful save acknowledgement", async () => {
  const app = appHarness(); await app.open();
  const refresh = app.actions().loadAdminData({ silent: true }); const refreshRequest = app.requests.at(-1)!;
  app.edit({ full_name: "Acknowledged name" });
  const saving = app.actions().saveCustomerSettings(); app.requests.at(-1)!.resolve({ customer: { id: "synthetic-A", full_name: "Acknowledged name" } }); await saving;
  refreshRequest.resolve({ access: { role: "admin", staffRole: "owner", permissions: ["customers.view", "customers.manage", "credits.manage"] }, orders: [], customers: [syntheticProfile()], emailIssues: [] });
  await refresh;
  assert.equal(app.form().full_name, "Acknowledged name");
  assert.equal(app.state.customerEditor?.baseline.full_name, "Acknowledged name");
  assert.equal(app.state.selectedCustomer?.full_name, "Acknowledged name");
  assert.equal(app.state.customers[0]?.full_name, "Acknowledged name");
  await app.refresh([syntheticProfile("A", { full_name: "Next fresh remote name", credit_balance: 42 })]);
  assert.equal(app.form().full_name, "Next fresh remote name");
  assert.equal(app.state.selectedCustomer?.full_name, "Next fresh remote name");
  assert.equal(app.state.customers[0]?.full_name, "Next fresh remote name");
  assert.equal(app.state.selectedCustomer?.credit_balance, 42);
});

test("a dashboard started without an editor cannot regress an account saved and reopened before its response", async () => {
  const app = appHarness(); app.state.customers = [syntheticProfile()];
  const refresh = app.actions().loadAdminData({ silent: true }); const request = app.requests.at(-1)!;
  await app.open(); app.edit({ full_name: "Confirmed after GET began" });
  const save = app.actions().saveCustomerSettings(); app.requests.at(-1)!.resolve({ customer: { id: "synthetic-A", full_name: "Confirmed after GET began" } }); await save;
  app.actions().closeCustomerModal();
  await app.open(app.state.customers[0]);
  request.resolve({ access: { role: "admin", staffRole: "owner", permissions: ["customers.view", "customers.manage", "credits.manage"] }, orders: [], customers: [syntheticProfile("A", { credit_balance: 44 })], emailIssues: [] });
  await refresh;
  assert.equal(app.form().full_name, "Confirmed after GET began");
  assert.equal(app.state.selectedCustomer?.full_name, "Confirmed after GET began");
  assert.equal(app.state.customers[0]?.full_name, "Confirmed after GET began");
  assert.equal(app.state.selectedCustomer?.credit_balance, 44);
});

test("a dashboard started for A cannot regress confirmed B after switching and reopening A", async () => {
  const app = appHarness(); app.state.customers = [syntheticProfile(), syntheticProfile("B")]; await app.open();
  const refresh = app.actions().loadAdminData({ silent: true }); const request = app.requests.at(-1)!;
  await app.open(syntheticProfile("B"), pricingPayload("synthetic-B"));
  app.edit({ full_name: "Confirmed B after GET began" });
  const save = app.actions().saveCustomerSettings(); app.requests.at(-1)!.resolve({ customer: { id: "synthetic-B", full_name: "Confirmed B after GET began" } }); await save;
  app.actions().closeCustomerModal(); await app.open();
  request.resolve({ access: { role: "admin", staffRole: "owner", permissions: ["customers.view", "customers.manage", "credits.manage"] }, orders: [], customers: [syntheticProfile(), syntheticProfile("B", { credit_balance: 61 })], emailIssues: [] });
  await refresh;
  assert.equal(app.state.customers.find(({ id }) => id === "synthetic-B")?.full_name, "Confirmed B after GET began");
  assert.equal(app.state.customers.find(({ id }) => id === "synthetic-B")?.credit_balance, 61);
  assert.equal(app.state.selectedCustomer?.id, "synthetic-A");
});

test("profile response with wrong or absent identity cannot acknowledge draft edits", async () => {
  for (const customer of [{ full_name: "Malformed response" }, { id: "synthetic-B", full_name: "Wrong account" }]) {
    const app = appHarness(); await app.open(); app.edit({ full_name: "Unsaved A" });
    const before = plain(app.state.customerEditor);
    const save = app.actions().saveCustomerSettings(); app.requests.at(-1)!.resolve({ customer }); await save;
    assert.deepEqual(plain(app.state.customerEditor), before);
    assert.equal(app.state.customerSavingId, null);
    assert.match(String(app.state.message), /could not be saved/u);
  }
});

test("a render-captured form setter cannot edit a closed and reopened instance of the same account", async () => {
  const app = appHarness(); await app.open(); const staleSetter = app.actions().setCustomerForm;
  app.actions().closeCustomerModal(); await app.open();
  const before = plain(app.state.customerEditor);
  staleSetter((current) => ({ ...current, full_name: "Stale input callback" }));
  assert.deepEqual(plain(app.state.customerEditor), before);
});

for (const kind of ["profile", "pricing"] as const) {
  test(`a stale ${kind} failure/finally cannot clear a reopened account's newer saving state`, async () => {
    const app = appHarness(); await app.open();
    const oldSave = kind === "profile" ? app.actions().saveCustomerSettings() : app.actions().saveCustomerPricing();
    const oldRequest = app.requests.at(-1)!;
    app.actions().closeCustomerModal(); await app.open();
    app.edit({ full_name: "Newest draft" });
    const newSave = kind === "profile" ? app.actions().saveCustomerSettings() : app.actions().saveCustomerPricing();
    const newRequest = app.requests.at(-1)!;
    const savingKey = kind === "profile" ? "customerSavingId" : "customerPricingSavingId";
    assert.equal(app.state[savingKey], "synthetic-A");
    oldRequest.reject(new Error("Stale synthetic failure")); await oldSave;
    assert.equal(app.state[savingKey], "synthetic-A");
    assert.equal(app.form().full_name, "Newest draft");
    assert.equal(app.state.customerPricingError, "");
    assert.equal(app.state.message, "");
    newRequest.resolve(kind === "profile" ? { customer: { id: "synthetic-A", full_name: "Newest draft" } } : pricingPayload());
    await newSave;
    assert.equal(app.state[savingKey], null);
  });
}

test("a delayed pricing read started before save cannot undo accepted commercial values", async () => {
  const app = appHarness(); await app.open();
  app.edit({ commercial_package_price_overrides_eur: { ...app.form().commercial_package_price_overrides_eur, credits_10: "30" } });
  // Retain the actual ready-render closures, then overlap a latest policy read
  // and a save. The existing expectedUpdatedAt server contract is unchanged.
  const readyActions = app.actions();
  const oldLoad = readyActions.loadCustomerPricing("synthetic-A"); const readRequest = app.requests.at(-1)!;
  const save = readyActions.saveCustomerPricing(); const saveRequest = app.requests.at(-1)!;
  assert.equal(JSON.parse(saveRequest.init.body!).expectedUpdatedAt, "2026-10-06T01:00:00.000Z");
  saveRequest.resolve(pricingPayload("synthetic-A", { credits_10: 30 }, "2026-10-06T04:00:00.000Z")); await save;
  readRequest.resolve(pricingPayload("synthetic-A", { credits_10: 10 })); await oldLoad;
  assert.equal(app.form().commercial_package_price_overrides_eur.credits_10, "30");
  assert.equal(app.state.customerEditor?.baseline.commercial_package_price_overrides_eur.credits_10, "30");
  assert.equal(app.state.customerPricingUpdatedAt, "2026-10-06T04:00:00.000Z");
});

test("recorded baseline refresh callback demonstrates the original loss invariant", () => {
  // Exact callback from81ab52b, admin/page.tsx932–937. Executing this
  // historical callback with the actual current form constructor demonstrates
  // why replacing the draft with a profile-only form is not a safe refresh.
  const baseline = `(current) => {
    if (!current) return null;
    const updated = nextCustomers.find((customer) => customer.id === current.id) ?? current;
    setCustomerForm(makeCustomerForm(updated));
    return updated;
  }`;
  const app = appHarness();
  const profile = syntheticProfile();
  let form = { ...app.makeCustomerForm(profile), full_name: "Unsaved local name", commercial_custom_unit_price_override_eur: "2" };
  const callback = runInNewContext(baseline, {
    nextCustomers: [profile], makeCustomerForm: app.makeCustomerForm,
    setCustomerForm: (next: AppForm) => { form = next; },
  }) as (current: Profile) => Profile;
  callback(profile);
  assert.throws(() => assert.equal(form.full_name, "Unsaved local name"), assert.AssertionError);
  assert.throws(() => assert.equal(form.commercial_custom_unit_price_override_eur, "2"), assert.AssertionError);
});
