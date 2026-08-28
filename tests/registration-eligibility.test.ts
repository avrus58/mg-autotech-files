import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { isCompletedCustomerRegistrationEligible } from "../src/lib/registrationEligibility";
import type { StaffAccess } from "../src/lib/staffPermissions";

const now = Date.parse("2026-08-28T12:00:00.000Z");
const fresh = "2026-08-28T11:45:00.000Z";
const customerAccess: StaffAccess = {
  role: "customer",
  staffRole: null,
  permissions: [],
};

test("registration side effects accept completed customer registrations", () => {
  assert.equal(
    isCompletedCustomerRegistrationEligible({
      user: {
        created_at: fresh,
        email_confirmed_at: fresh,
        app_metadata: { provider: "email", providers: ["email"] },
        user_metadata: {
          registration_country_confirmed: true,
          country: "Germany",
        },
      },
      access: customerAccess,
      now,
    }),
    true,
    "normal e-mail/password registration"
  );

  assert.equal(
    isCompletedCustomerRegistrationEligible({
      user: {
        created_at: fresh,
        email_confirmed_at: fresh,
        app_metadata: { provider: "google", providers: ["google"] },
        user_metadata: {
          registration_country_required: false,
          registration_country_confirmed: true,
          oauth_registration_finalized: true,
          country: "Germany",
        },
      },
      access: customerAccess,
      now,
    }),
    true,
    "completed Google registration"
  );
});

test("registration side effects reject fresh staff and unfinished Google accounts", () => {
  const freshEmailUser = {
    created_at: fresh,
    email_confirmed_at: fresh,
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: {},
  };
  assert.equal(
    isCompletedCustomerRegistrationEligible({
      user: freshEmailUser,
      access: {
        role: "staff",
        staffRole: "support",
        permissions: ["orders.view"],
      },
      now,
    }),
    false,
    "fresh delegated staff"
  );
  assert.equal(
    isCompletedCustomerRegistrationEligible({
      user: freshEmailUser,
      access: { role: "admin", staffRole: "owner", permissions: [] },
      now,
    }),
    false,
    "fresh primary owner"
  );

  assert.equal(
    isCompletedCustomerRegistrationEligible({
      user: {
        created_at: fresh,
        email_confirmed_at: fresh,
        app_metadata: { provider: "google", providers: ["google"] },
        user_metadata: {
          registration_country_required: true,
          registration_country_confirmed: false,
        },
      },
      access: customerAccess,
      now,
    }),
    false,
    "Google country/profile completion is still pending"
  );
  assert.equal(
    isCompletedCustomerRegistrationEligible({
      user: {
        created_at: fresh,
        email_confirmed_at: fresh,
        app_metadata: { provider: "google", providers: ["google"] },
        user_metadata: {
          registration_country_required: false,
          registration_country_confirmed: true,
          country: "Germany",
        },
      },
      access: customerAccess,
      now,
    }),
    false,
    "Google profile must have reached the server finalization marker"
  );
});

test("an old customer with a newly confirmed replacement e-mail is not a registration", () => {
  assert.equal(
    isCompletedCustomerRegistrationEligible({
      user: {
        created_at: "2025-08-28T11:45:00.000Z",
        email_confirmed_at: fresh,
        confirmed_at: fresh,
        email_change_sent_at: "2026-08-20T11:40:00.000Z",
        updated_at: fresh,
        app_metadata: { provider: "email", providers: ["email"] },
        user_metadata: {
          registration_country_confirmed: true,
          country: "Germany",
        },
      },
      access: customerAccess,
      now,
    }),
    false
  );
});

test("a delayed first e-mail confirmation remains a completed registration", () => {
  assert.equal(
    isCompletedCustomerRegistrationEligible({
      user: {
        created_at: "2026-08-20T08:00:00.000Z",
        confirmation_sent_at: "2026-08-20T08:00:01.000Z",
        email_confirmed_at: fresh,
        confirmed_at: fresh,
        updated_at: fresh,
        app_metadata: { provider: "email", providers: ["email"] },
        user_metadata: {
          registration_country_confirmed: true,
          country: "Germany",
        },
      },
      access: customerAccess,
      now,
    }),
    true
  );
});

test("updated_at alone cannot reopen registration eligibility", () => {
  assert.equal(
    isCompletedCustomerRegistrationEligible({
      user: {
        created_at: "2025-08-28T11:45:00.000Z",
        email_confirmed_at: "2025-08-28T11:50:00.000Z",
        confirmed_at: "2025-08-28T11:50:00.000Z",
        updated_at: fresh,
        app_metadata: { provider: "email", providers: ["email"] },
        user_metadata: {
          registration_country_confirmed: true,
          country: "Germany",
        },
      },
      access: customerAccess,
      now,
    }),
    false
  );
});

test("growth and email registration endpoints share the completed-customer gate", () => {
  const growthRoute = readFileSync(
    resolve(process.cwd(), "src", "app", "api", "growth", "journey", "route.ts"),
    "utf8"
  );
  const emailRoute = readFileSync(
    resolve(process.cwd(), "src", "app", "api", "email", "new-customer", "route.ts"),
    "utf8"
  );

  for (const route of [growthRoute, emailRoute]) {
    const eligibility = route.indexOf("!isCompletedCustomerRegistrationEligible(auth)");
    assert.ok(eligibility >= 0, "route uses the centralized eligibility gate");
  }
  assert.ok(
    growthRoute.indexOf("const result = await recordGrowthJourneyEvent") >
      growthRoute.indexOf("!isCompletedCustomerRegistrationEligible(auth)")
  );
  assert.ok(
    emailRoute.indexOf("const delivery = await sendRegistrationConfirmedNotifications") >
      emailRoute.indexOf("!isCompletedCustomerRegistrationEligible(auth)")
  );
});
