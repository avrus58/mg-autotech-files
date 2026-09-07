import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const path = "src/components/dashboard/DashboardClient.tsx";
const source = readFileSync(path, "utf8");
const sourceFile = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let nextActionBody: string | undefined;

function findNextAction(node: ts.Node): void {
  if (
    ts.isVariableDeclaration(node) &&
    node.name.getText(sourceFile) === "dashboardNextAction" &&
    node.initializer &&
    ts.isCallExpression(node.initializer)
  ) {
    const callback = node.initializer.arguments[0];
    assert.ok(callback && ts.isArrowFunction(callback) && ts.isBlock(callback.body));
    nextActionBody = callback.body.getText(sourceFile);
  }
  ts.forEachChild(node, findNextAction);
}

findNextAction(sourceFile);
assert.ok(nextActionBody, "Exercise the actual dashboard useMemo callback, not a copied selector");

type Fixture = {
  dashboardReady: boolean;
  orders: Array<{ status: string }>;
  credits: number;
  needsResponseCount: number;
  activeCount: number;
  profileMissingItems: string[];
};

const newCustomer: Fixture = {
  dashboardReady: true,
  orders: [],
  credits: 0,
  needsResponseCount: 0,
  activeCount: 0,
  profileMissingItems: ["Billing address"],
};

function nextAction(overrides: Partial<Fixture> = {}) {
  return runInNewContext(`(() => ${nextActionBody})()`, {
    ...newCustomer,
    ...overrides,
    locale: "en",
    profileCompletionSummary: "Billing address",
    customerWorkflowExactT: (_locale: string, text: string) => text,
    customerWorkflowT: (_locale: string, key: string) => key,
    formatDashboardCount: (value: number) => String(value),
  }, { timeout: 1000 }) as { key: string; href: string; title: string; description: string; cta: string };
}

function previousPriority(fixture: Fixture) {
  if (fixture.needsResponseCount > 0) return "response";
  if (fixture.profileMissingItems.length > 0) return "profile";
  if (fixture.credits <= 0) return "credits";
  if (fixture.activeCount > 0) return "orders";
  return "new-request";
}

test("a ready first-request customer sees existing credit guidance before optional profile details", () => {
  const action = nextAction();
  assert.equal(action.key, "credits");
  assert.equal(action.href, "/dashboard/credits");
  assert.equal(action.title, "Add credits before your next file request");
  assert.equal(action.cta, "Buy Credits");
  assert.equal(action.description, "Your current balance is 0 credits. Top up first so your next request can move without payment delay.");
});

test("urgent requested order information remains the highest priority", () => {
  const action = nextAction({ needsResponseCount: 2 });
  assert.equal(action.key, "response");
  assert.equal(action.href, "/dashboard/orders?view=needs_response");
});

test("existing customers retain their previous priorities including cancelled order history", () => {
  for (const status of ["completed", "cancelled", "new_request", "in_progress"]) {
    assert.equal(nextAction({ orders: [{ status }] }).key, "profile", status);
    assert.equal(nextAction({ orders: [{ status }], profileMissingItems: [] }).key, "credits", status);
  }
});

test("unloaded data and a nonzero balance do not trigger the new first-request exception", () => {
  assert.equal(nextAction({ dashboardReady: false }).key, "profile");
  assert.equal(nextAction({ credits: 10 }).key, "profile");
  assert.equal(nextAction({ credits: -1 }).key, "profile");
  assert.equal(nextAction({ credits: 10, profileMissingItems: [] }).key, "new-request");
});

test("the priority matrix differs from the previous behavior only for the bounded first-request case", () => {
  for (const dashboardReady of [false, true]) {
    for (const orders of [[], [{ status: "completed" }], [{ status: "cancelled" }]]) {
      for (const credits of [-1, 0, 10]) {
        for (const needsResponseCount of [0, 2]) {
          for (const activeCount of [0, 2]) {
            for (const profileMissingItems of [[], ["Billing address"]]) {
              const fixture = { dashboardReady, orders, credits, needsResponseCount, activeCount, profileMissingItems };
              const expected = dashboardReady && orders.length === 0 && credits === 0 && needsResponseCount === 0
                ? "credits"
                : previousPriority(fixture);
              assert.equal(nextAction(fixture).key, expected, JSON.stringify(fixture));
            }
          }
        }
      }
    }
  }
});

test("first-request evidence uses loaded unfiltered customer order history and retains loading/error guards", () => {
  const query = source.slice(source.indexOf('.from("orders")'), source.indexOf('.from("credit_transactions")'));
  assert.match(query, /\.eq\("customer_id", userId\)/);
  assert.match(query, /\.order\("created_at", \{ ascending: false \}\)[\s\S]*\.limit\(5\)/);
  assert.doesNotMatch(query, /\.eq\("status"|\.in\("status"|requestSearch|filteredOrders/);
  assert.match(source, /if \(queryFailed\) \{[\s\S]*?return;[\s\S]*?setOrders\(\(recentOrders \?\? \[\]\) as Order\[\]\)/);
  assert.match(nextActionBody!, /dashboardReady && orders\.length === 0 && credits === 0/);
  assert.match(source, /\[activeCount, credits, dashboardReady, locale, needsResponseCount, orders\.length, profileCompletionSummary, profileMissingItems\.length\]/);
});
