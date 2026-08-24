import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { relative, resolve } from "node:path";
import test from "node:test";
import {
  CommercialPricingUnavailableError,
  normalizeCommerceSettings,
  normalizeCustomerCommercialPolicy,
} from "../src/lib/commercialPolicy";
import {
  buildCreditQuote,
  calculateCreditTotalEuro,
  defaultCommerceSettings,
  emptyCustomerCommercialPolicy,
  euroAmountToCents,
  isStripeEuroAmountSupported,
} from "../src/lib/commercialPricing";

function source(...segments: string[]) {
  return readFileSync(resolve(process.cwd(), ...segments), "utf8");
}

function typescriptFiles(directory: string): string[] {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return typescriptFiles(path);
    return /\.(?:ts|tsx)$/.test(entry.name) ? [path] : [];
  });
}

function sourcesContaining(directory: string, pattern: RegExp) {
  return typescriptFiles(resolve(process.cwd(), directory))
    .map((path) => ({ path, content: readFileSync(path, "utf8") }))
    .filter(({ content }) => pattern.test(content));
}

function functionBlock(input: string, name: string) {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(
    `(?:async\\s+function|function)\\s+${escapedName}\\s*\\(|const\\s+${escapedName}\\s*=`,
  ).exec(input);
  if (!match) return "";

  const constDeclaration = match[0].startsWith("const");
  let openBrace = -1;
  if (constDeclaration) {
    const arrow = input.indexOf("=>", match.index);
    openBrace = input.indexOf("{", arrow);
  } else {
    const openParen = input.indexOf("(", match.index);
    let parenDepth = 0;
    for (let index = openParen; index < input.length; index += 1) {
      if (input[index] === "(") parenDepth += 1;
      if (input[index] === ")") parenDepth -= 1;
      if (parenDepth === 0) {
        openBrace = input.indexOf("{", index + 1);
        break;
      }
    }
  }
  if (openBrace < 0) return "";

  let depth = 0;
  for (let index = openBrace; index < input.length; index += 1) {
    if (input[index] === "{") depth += 1;
    if (input[index] === "}") depth -= 1;
    if (depth === 0) return input.slice(match.index, index + 1);
  }
  return input.slice(match.index);
}

function around(input: string, needle: string, radius = 1_800) {
  const index = input.indexOf(needle);
  assert.ok(index >= 0, `Expected source to contain ${needle}`);
  return input.slice(Math.max(0, index - radius), Math.min(input.length, index + radius));
}

const revisionToken = /\b(?:quoteId|quoteRevision|pricingRevision|pricingVersion|quote_id|quote_revision|pricing_revision)\b/i;

test("an explicit customer fixed credit price is final", () => {
  const customerPolicy = {
    ...emptyCustomerCommercialPolicy("customer-fixed"),
    credit_price_override_eur: 2.75,
    adjustment_type: "percentage" as const,
    adjustment_value: 65,
  };
  const settingsVariants = [
    {
      ...defaultCommerceSettings,
      default_custom_credit_price_eur: 12,
      global_adjustment_type: "fixed" as const,
      global_adjustment_value: 3,
    },
    {
      ...defaultCommerceSettings,
      default_custom_credit_price_eur: 40,
      global_adjustment_type: "percentage" as const,
      global_adjustment_value: -80,
    },
  ];

  for (const settings of settingsVariants) {
    const quote = buildCreditQuote(settings, customerPolicy);
    assert.equal(quote.customUnitPriceEuro, 2.75);
    assert.equal(quote.pricingSource, "customer_fixed");
    for (const item of quote.packages) {
      assert.equal(item.unitPriceEuro, 2.75, `${item.id} must retain the fixed customer rate`);
      assert.equal(item.priceEuro, Number((item.credits * 2.75).toFixed(2)));
    }
  }
});

test("customers without an override inherit the current global tariff", () => {
  const inheritedPolicy = emptyCustomerCommercialPolicy("new-customer");
  const first = buildCreditQuote({
    ...defaultCommerceSettings,
    default_custom_credit_price_eur: 5,
    global_adjustment_type: "none",
    global_adjustment_value: 0,
  }, inheritedPolicy);
  const changed = buildCreditQuote({
    ...defaultCommerceSettings,
    default_custom_credit_price_eur: 6,
    global_adjustment_type: "fixed",
    global_adjustment_value: 1.5,
  }, inheritedPolicy);

  assert.equal(first.customUnitPriceEuro, 5);
  assert.equal(changed.customUnitPriceEuro, 4.5);
  assert.equal(first.pricingSource, "global");
  assert.equal(changed.pricingSource, "global");
});

test("credit totals use the same integer-cent rounding at half-cent boundaries", () => {
  assert.equal(calculateCreditTotalEuro(1, 1.005), 1.01);
  assert.equal(calculateCreditTotalEuro(3, 1.005), 3.02);
  assert.equal(calculateCreditTotalEuro(10, 2.755), 27.55);
  assert.throws(() => calculateCreditTotalEuro(0, 2.75), RangeError);
});

test("Stripe EUR boundaries are enforced before opening provider checkout", () => {
  assert.equal(euroAmountToCents(1.005), 101);
  assert.equal(isStripeEuroAmountSupported(0.49), false);
  assert.equal(isStripeEuroAmountSupported(0.5), true);
  assert.equal(isStripeEuroAmountSupported(999_999.99), true);
  assert.equal(isStripeEuroAmountSupported(1_000_000), false);

  const stripeRoute = source("src", "app", "api", "stripe", "create-checkout-session", "route.ts");
  const creditsPage = source("src", "app", "dashboard", "credits", "page.tsx");
  assert.match(stripeRoute, /isStripeEuroAmountSupported\(selectedPackage\.priceEuro\)/);
  assert.match(stripeRoute, /status:\s*422/);
  assert.match(stripeRoute, /unit_amount:\s*amountCents/);
  assert.match(creditsPage, /isStripeEuroAmountSupported\(checkoutAmount\)/);
  assert.match(creditsPage, /isStripeEuroAmountSupported\(item\.priceEuro\)/);
  assert.match(creditsPage, /isStripeEuroAmountSupported\(customPrice\)/);
});

test("commercial database reads fail closed without hard-coded pricing fallback", () => {
  const candidates = sourcesContaining("src/lib", /getCommercialContext/);
  assert.ok(candidates.length > 0, "A server-only commercial context resolver must exist");
  const resolver = candidates.map(({ content }) => content).join("\n");
  const globalRead = functionBlock(resolver, "getCommerceSettings");
  const customerRead = functionBlock(resolver, "getCustomerCommercialPolicy");
  assert.ok(globalRead, "The global commercial settings read must remain directly auditable");
  assert.ok(customerRead, "The customer commercial policy read must remain directly auditable");

  assert.match(globalRead, /result\.error/);
  assert.match(customerRead, /result\.error/);
  assert.match(globalRead, /(?:throw|unavailable\s*\()/);
  assert.match(customerRead, /(?:throw|unavailable\s*\()/);
  assert.doesNotMatch(`${globalRead}\n${customerRead}`, /tableUnavailable|schema\s+cache/i);
  assert.doesNotMatch(globalRead, /return\s+defaultCommerceSettings/);

  const globalMissingIsClosed =
    /from\(["']commerce_settings["']\)[\s\S]{0,600}\.single\(\)/.test(globalRead) ||
    /(?:!\w+\.data|\w+\.data\s*(?:===?|==)\s*(?:null|undefined))[\s\S]{0,240}(?:throw|unavailable\s*\(|failCommercial|commercialUnavailable)/i.test(globalRead);
  assert.equal(
    globalMissingIsClosed,
    true,
    "A missing global settings row must fail closed; only a missing customer override may inherit",
  );
});

test("legacy inactive adjustments normalize safely while malformed policy text fails closed", () => {
  const validSettings = {
    id: "default",
    currency: "EUR",
    default_custom_credit_price_eur: 6,
    global_adjustment_type: "none",
    global_adjustment_value: 0,
    promotion_label: null,
    payment_bank_enabled: true,
    payment_stripe_enabled: true,
    updated_at: "2026-08-24T12:00:00.000Z",
  };

  assert.equal(
    normalizeCommerceSettings({ ...validSettings, global_adjustment_value: 1 })
      .global_adjustment_value,
    0,
  );
  assert.throws(
    () => normalizeCommerceSettings({ ...validSettings, promotion_label: "x".repeat(181) }),
    CommercialPricingUnavailableError,
  );
  const legacyFixedPolicy = normalizeCustomerCommercialPolicy("customer", {
      user_id: "customer",
      credit_price_override_eur: 2.75,
      adjustment_type: "none",
      adjustment_value: 1,
      payment_bank_enabled: null,
      payment_stripe_enabled: null,
      internal_note: null,
      updated_at: "2026-08-24T12:00:00.000Z",
    });
  assert.equal(legacyFixedPolicy.credit_price_override_eur, 2.75);
  assert.equal(legacyFixedPolicy.adjustment_value, 0);
});

test("displayed credit quotes carry a revision and stale checkout is rejected with 409", () => {
  const pricingCandidates = sourcesContaining("src/lib", /buildCreditQuote|getCreditPurchaseQuote/);
  const pricingSources = pricingCandidates.map(({ content }) => content).join("\n");
  const purchaseResolver = functionBlock(pricingSources, "getCreditPurchaseQuote");
  const quoteRoute = source("src", "app", "api", "credits", "quote", "route.ts");
  const stripeRoute = source("src", "app", "api", "stripe", "create-checkout-session", "route.ts");
  const creditsPage = source("src", "app", "dashboard", "credits", "page.tsx");

  assert.match(pricingSources, revisionToken);
  assert.ok(
    revisionToken.test(quoteRoute) || /getCreditQuoteForUser/.test(quoteRoute),
    "The authenticated quote route must return the versioned user quote",
  );
  assert.match(stripeRoute, revisionToken);
  assert.match(stripeRoute, /status:\s*409/);
  assert.match(creditsPage, revisionToken);
  assert.match(creditsPage, /(?:status\s*===?\s*409|status\s*==\s*409)/);
  assert.ok(purchaseResolver, "The authoritative purchase quote resolver must remain auditable");
  assert.match(purchaseResolver, /typeof\s+body\.(?:quoteId|quoteRevision)\s*!==\s*["']string["']/);
  assert.doesNotMatch(purchaseResolver, /body\.(?:quoteId|quoteRevision)\s*!==\s*undefined/);
});

test("bank transfer uses the authoritative server quote and never trusts a browser amount", () => {
  const bankRoute = source("src", "app", "api", "email", "bank-transfer", "route.ts");
  const creditsPage = source("src", "app", "dashboard", "credits", "page.tsx");
  const bankClient = around(creditsPage, "/api/email/bank-transfer");

  assert.match(bankRoute, /getCreditPurchaseQuote\([\s\S]{0,500}["']bank["']/);
  assert.match(bankRoute, revisionToken);
  assert.match(bankRoute, /status:\s*409/);
  assert.doesNotMatch(bankRoute, /\b(?:amountEuro|credits)\s*:\s*z\./);
  assert.match(bankRoute, /\b(?:packageId|customCredits)\b/);

  assert.doesNotMatch(
    bankClient,
    /JSON\.stringify\(\s*\{[\s\S]{0,600}\b(?:amountEuro|credits)\s*:/,
  );
  assert.match(bankClient, /\b(?:packageId|customCredits|purchasePayload|selectionPayload|quoteRequest)\b/);
  assert.match(bankClient, /if\s*\(\s*!\w+(?:Response)?\.ok\s*\)/i);
  assert.doesNotMatch(bankClient, /\.catch\(\s*\(\)\s*=>\s*null\s*\)/);
  assert.match(bankRoute, /delivery\.status\s*!==\s*["']sent["']/);

  const emailEvents = source("src", "lib", "email", "events.ts");
  const bankEmailHelper = functionBlock(emailEvents, "sendBankTransferInstructionsEmail");
  assert.match(bankEmailHelper, /return\s+sendTransactionalEmail\(/);
});

test("credit totals and four-decimal unit prices remain visibly consistent", () => {
  const creditsPage = source("src", "app", "dashboard", "credits", "page.tsx");
  const homepage = source("src", "app", "page.tsx");
  const purchaseResolver = source("src", "lib", "commercialPolicy.ts");

  assert.match(creditsPage, /function formatCreditUnitEuro[\s\S]{0,300}minimumFractionDigits:\s*2[\s\S]{0,100}maximumFractionDigits:\s*4/);
  assert.match(creditsPage, /formatCreditUnitEuro\(quote\.customUnitPriceEuro\)/);
  assert.match(homepage, /function formatEuro[\s\S]{0,300}maximumFractionDigits:\s*2/);
  assert.match(homepage, /function formatCreditUnitEuro[\s\S]{0,300}maximumFractionDigits:\s*4/);
  assert.match(purchaseResolver, /customUnitPriceEuro\.toFixed\(4\)/);
  assert.match(creditsPage, /calculateCreditTotalEuro\(customCreditAmount, quote\.customUnitPriceEuro\)/);
  assert.match(purchaseResolver, /calculateCreditTotalEuro\(customCredits, quote\.customUnitPriceEuro\)/);
});

test("admin pricing load is race-safe, visible in the modal and saved separately", () => {
  const admin = source("src", "app", "admin", "page.tsx");
  const pricingLoading = /\b(?:(?:customer|policy)?(?:Pricing|Commercial|Policy)\w*(?:Loading|LoadState)|(?:isLoading|loading)\w*(?:Pricing|Commercial|Policy))\b/i;
  const pricingError = /\b(?:(?:customer|policy)?(?:Pricing|Commercial|Policy)\w*(?:Error|LoadError)|(?:error)\w*(?:Pricing|Commercial|Policy))\b/i;

  assert.match(admin, pricingLoading);
  assert.match(admin, pricingError);
  assert.ok(
    (admin.match(new RegExp(pricingError.source, "gi")) ?? []).length >= 2,
    "The pricing load error must be held and rendered inside the customer modal",
  );

  const abortGuard = /new\s+AbortController\(\)/.test(admin) &&
    /signal\s*:/.test(admin) &&
    /\.abort\(\)/.test(admin);
  const identityGuard =
    /(?:pricing|commercial|policy)\w*(?:request|load)\w*Ref/i.test(admin) &&
    /\.current\s*!==|!==\s*\w+\.current/.test(admin);
  assert.ok(abortGuard || identityGuard, "Customer A responses must not overwrite customer B pricing state");

  const saveProfile = functionBlock(admin, "saveCustomerSettings");
  assert.ok(saveProfile, "The customer profile save handler must remain identifiable");
  assert.doesNotMatch(saveProfile, /commercial-policy/);
  assert.doesNotMatch(saveProfile, /save\w*(?:Pricing|CommercialPolicy)\s*\(/i);

  const saveCandidates = [
    "saveCustomerPricing",
    "saveCustomerCommercialPolicy",
    "saveCustomerPricePolicy",
    "saveCommercialPolicy",
  ].map((name) => functionBlock(admin, name)).filter(Boolean);
  assert.ok(
    saveCandidates.some((block) => /commercial-policy/.test(block)),
    "Customer pricing must have a dedicated persistence handler",
  );

  const savePricingLabel = /Save (?:customer )?(?:pricing|price policy|commercial policy)/i.exec(admin);
  assert.ok(savePricingLabel, "The pricing section must have its own visible save action");
  const savePricingControl = admin.slice(
    Math.max(0, savePricingLabel.index - 1_000),
    Math.min(admin.length, savePricingLabel.index + 500),
  );
  assert.match(savePricingControl, /disabled=/);
  assert.match(savePricingControl, pricingLoading);
  assert.match(admin, /selectedCustomerIdRef\.current\s*!==\s*selectedCustomer\.id/);
  assert.match(admin, /function formatCreditUnitAmount[\s\S]{0,250}maximumFractionDigits:\s*4/);
  assert.match(admin, /formatCreditUnitAmount\(globalCustomerPrice\)/);

  const saveProfileCustomerId = /const\s+customerId\s*=\s*selectedCustomer\.id/.exec(saveProfile);
  assert.ok(saveProfileCustomerId, "Profile save must capture the customer identity before awaiting the API");
  assert.match(saveProfile, /selectedCustomerIdRef\.current\s*!==\s*customerId/);
  assert.match(saveProfile, /setSelectedCustomer\(\(current\)\s*=>\s*\(?\s*current\?\.id\s*===\s*customerId/);
});

test("global commercial edits stay precise and cannot change underneath an in-flight save", () => {
  const globalAdmin = source("src", "app", "admin", "commercial", "page.tsx");

  assert.match(globalAdmin, /<fieldset\s+disabled=\{saving\}/);
  assert.match(globalAdmin, /step=\{0\.0001\}/);
  assert.match(
    globalAdmin,
    /function formatUnitAmount[\s\S]{0,300}maximumFractionDigits:\s*4/,
  );
  assert.match(globalAdmin, /formatUnitAmount\(preview\.customUnitPriceEuro\)/);
});

test("the homepage consumes a public sanitized global quote", () => {
  const routeFiles = typescriptFiles(resolve(process.cwd(), "src", "app", "api"))
    .filter((path) => /[\\/]route\.ts$/.test(path));
  const publicCreditRoutes = routeFiles
    .map((path) => ({ path, content: readFileSync(path, "utf8") }))
    .filter(({ path, content }) =>
      /(?:public|global).*(?:credit|pricing)|(?:credit|pricing).*(?:public|global)/i.test(relative(resolve(process.cwd(), "src", "app", "api"), path)) ||
      /getPublicCreditQuote|buildPublicCreditQuote|publicCreditQuote/i.test(content));

  assert.ok(publicCreditRoutes.length > 0, "A public global credit quote route must exist");
  const publicRoute = publicCreditRoutes.map(({ content }) => content).join("\n");
  assert.match(
    publicRoute,
    /getPublicCreditQuote|buildPublicCreditQuote|publicCreditQuote|buildCreditQuote[\s\S]{0,500}emptyCustomerCommercialPolicy/i,
  );
  assert.doesNotMatch(publicRoute, /requireApiUser|requireStaffAccess|customer_commercial_policies|customerPolicy/i);
  assert.doesNotMatch(
    publicRoute,
    /internal_note|updated_by|before_json|after_json|payment_(?:paypal|bank|stripe)_enabled|paymentMethods/i,
  );

  const homepage = source("src", "app", "page.tsx");
  assert.match(homepage, /\/api\/[\w()\-/]*(?:credit|pricing)[\w()\-/]*(?:public|global)|\/api\/[\w()\-/]*(?:public|global)[\w()\-/]*(?:credit|pricing)/i);
});

test("commercial tables allow authenticated staff reads but server-only writes", () => {
  const migration = source(
    "supabase",
    "migrations",
    "20260824000000_commercial_pricing_write_authority.sql",
  );
  const verifier = source("scripts", "verify-commercial-pricing-authority.sql");

  assert.match(migration, /begin;[\s\S]*commit;/i);
  assert.match(migration, /drop policy if exists "Staff can manage global commerce settings"/i);
  assert.match(migration, /drop policy if exists "Staff can manage customer commerce policies"/i);
  assert.match(migration, /for select\s+to authenticated[\s\S]*has_staff_permission\('credits\.manage'\)/i);
  assert.match(migration, /revoke all privileges[\s\S]*from authenticated/i);
  assert.match(migration, /grant select[\s\S]*to authenticated/i);
  assert.match(migration, /grant select, insert, update, delete[\s\S]*to service_role/i);
  assert.match(migration, /commerce_settings_authoritative_values_chk/i);
  assert.match(migration, /customer_commercial_policy_authoritative_values_chk/i);
  assert.match(migration, /inactive_customer_adjustment_normalized/);
  assert.match(
    migration,
    /update\s+public\.customer_commercial_policies\s+set\s+adjustment_value\s*=\s*0\s+where\s+adjustment_type\s*=\s*'none'\s+and\s+adjustment_value\s*<>\s*0/i,
  );
  assert.doesNotMatch(migration, /\b(?:delete\s+from|truncate\s+table)\b/i);

  assert.match(verifier, /SELECT-only verification/i);
  assert.match(verifier, /authenticated_write_revoked/);
  assert.match(verifier, /no_authenticated_write_policy/);
  assert.match(verifier, /inactive_adjustments_canonical/);
  assert.doesNotMatch(verifier, /\b(?:alter|create|drop|grant|revoke|insert|update|delete|truncate)\s+(?:table|policy|on|into|from|public\.)/i);
});
