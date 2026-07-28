import assert from "node:assert/strict";
import test from "node:test";
import { classifyAdminAccessProfile } from "../src/lib/adminAccess";

test("admin access classification treats query errors as unavailable", () => {
  assert.deepEqual(
    classifyAdminAccessProfile(null, { code: "PGRST000", message: "temporary connection failure" }),
    { state: "unavailable" }
  );
});

test("admin access classification authorizes owners and explicitly permitted staff", () => {
  const owner = classifyAdminAccessProfile(
    { role: "admin", staff_role: "owner", staff_permissions: [] },
    null
  );
  const support = classifyAdminAccessProfile(
    { role: "staff", staff_role: "support", staff_permissions: ["orders.view"] },
    null
  );

  assert.equal(owner.state, "authorized");
  assert.equal(support.state, "authorized");
});

test("admin access classification denies only confirmed missing or insufficient profiles", () => {
  assert.deepEqual(classifyAdminAccessProfile(null, null), {
    state: "denied",
    reason: "profile_missing",
  });
  assert.deepEqual(
    classifyAdminAccessProfile(
      { role: "customer", staff_role: null, staff_permissions: [] },
      null
    ),
    { state: "denied", reason: "not_staff" }
  );
  assert.deepEqual(
    classifyAdminAccessProfile(
      { role: "staff", staff_role: "support", staff_permissions: ["messages.manage"] },
      null
    ),
    { state: "denied", reason: "missing_orders_permission" }
  );
});
