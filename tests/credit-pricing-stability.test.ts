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

test("customer package and custom overrides are independent final prices", () => {
  const customerPolicy = {
    ...emptyCustomerCommercialPolicy("customer-fixed"),
    package_price_overrides_eur: {
      ...emptyCustomerCommercialPolicy("customer-fixed").package_price_overrides_eur,
      credits_50: 199.99,
    },
    custom_credit_unit_price_override_eur: 2.75,
  };
  const settingsVariants = [
    {
      ...defaultCommerceSettings,
      custom_credit_unit_price_eur: 12,
      package_prices_eur: {
        ...defaultCommerceSettings.package_prices_eur,
        credits_10: 41.25,
        credits_50: 205,
      },
    },
    {
      ...defaultCommerceSettings,
      custom_credit_unit_price_eur: 40,
      package_prices_eur: {
        credits_10: 50,
        credits_50: 250,
        credits_100: 450,
        credits_250: 900,
        credits_500: 1600,
      },
    },
  ];

  for (const settings of settingsVariants) {
    const quote = buildCreditQuote(settings, customerPolicy);
    assert.equal(quote.customUnitPriceEuro, 2.75);
    assert.equal(quote.customPricingSource, "customer_override");
    assert.equal(quote.pricingSource, "customer_override");
    assert.equal(quote.packages.find((item) => item.id === "credits_50")?.priceEuro, 199.99);
    assert.equal(quote.packages.find((item) => item.id === "credits_50")?.pricingSource, "customer_override");
    assert.equal(
      quote.packages.find((item) => item.id === "credits_10")?.priceEuro,
      settings.package_prices_eur.credits_10,
    );
    assert.equal(quote.packages.find((item) => item.id === "credits_10")?.pricingSource, "global");
  }
});

test("customers without an override inherit the current global tariff", () => {
  const inheritedPolicy = emptyCustomerCommercialPolicy("new-customer");
  const first = buildCreditQuote({
    ...defaultCommerceSettings,
    custom_credit_unit_price_eur: 5,
    package_prices_eur: {
      ...defaultCommerceSettings.package_prices_eur,
      credits_10: 49.99,
    },
  }, inheritedPolicy);
  const changed = buildCreditQuote({
    ...defaultCommerceSettings,
    custom_credit_unit_price_eur: 4.5,
    package_prices_eur: {
      ...defaultCommerceSettings.package_prices_eur,
      credits_10: 44.99,
    },
  }, inheritedPolicy);

  assert.equal(first.customUnitPriceEuro, 5);
  assert.equal(changed.customUnitPriceEuro, 4.5);
  assert.equal(first.packages[0]?.priceEuro, 49.99);
  assert.equal(changed.packages[0]?.priceEuro, 44.99);
  assert.equal(first.pricingSource, "global");
  assert.equal(changed.pricingSource, "global");
});

test("an odd-cent package total remains authoritative when its display unit rounds", () => {
  const quote = buildCreditQuote({
    ...defaultCommerceSettings,
    package_prices_eur: {
      ...defaultCommerceSettings.package_prices_eur,
      credits_250: 700.01,
    },
  }, emptyCustomerCommercialPolicy("odd-cent"));
  const pack = quote.packages.find((item) => item.id === "credits_250");
  assert.equal(pack?.priceEuro, 700.01);
  assert.equal(pack?.unitPriceEuro, 2.8);
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

test("v2 explicit price rows normalize strictly and malformed values fail closed", () => {
  const validSettings = {
    id: "default",
    currency: "EUR",
    pricing_model_version: 2,
    explicit_pricing_writes_enabled: true,
    explicit_pricing_bridge_release: "vercel-dpl-verified-v2",
    credit_package_10_total_eur: 36,
    credit_package_50_total_eur: 180,
    credit_package_100_total_eur: 320,
    credit_package_250_total_eur: 700,
    credit_package_500_total_eur: 1200,
    custom_credit_unit_price_eur: 4,
    promotion_label: null,
    payment_bank_enabled: true,
    payment_stripe_enabled: true,
    updated_at: "2026-08-24T12:00:00.000Z",
  };

  assert.equal(normalizeCommerceSettings(validSettings).package_prices_eur.credits_250, 700);
  assert.equal(normalizeCommerceSettings(validSettings).custom_credit_unit_price_eur, 4);
  assert.throws(
    () => normalizeCommerceSettings({ ...validSettings, promotion_label: "x".repeat(181) }),
    CommercialPricingUnavailableError,
  );
  assert.throws(
    () => normalizeCommerceSettings({ ...validSettings, credit_package_10_total_eur: 36.001 }),
    CommercialPricingUnavailableError,
  );
  assert.throws(
    () => normalizeCommerceSettings({ ...validSettings, pricing_model_version: 1 }),
    CommercialPricingUnavailableError,
  );
  assert.throws(
    () => normalizeCommerceSettings({
      ...validSettings,
      explicit_pricing_bridge_release: null,
    }),
    CommercialPricingUnavailableError,
  );
  const explicitPolicy = normalizeCustomerCommercialPolicy("customer", {
      user_id: "customer",
      pricing_model_version: 2,
      credit_package_10_total_override_eur: null,
      credit_package_50_total_override_eur: 199.99,
      credit_package_100_total_override_eur: null,
      credit_package_250_total_override_eur: null,
      credit_package_500_total_override_eur: null,
      custom_credit_unit_price_override_eur: 2.75,
      payment_bank_enabled: null,
      payment_stripe_enabled: null,
      internal_note: null,
      updated_at: "2026-08-24T12:00:00.000Z",
    });
  assert.equal(explicitPolicy.package_price_overrides_eur.credits_50, 199.99);
  assert.equal(explicitPolicy.package_price_overrides_eur.credits_10, null);
  assert.equal(explicitPolicy.custom_credit_unit_price_override_eur, 2.75);
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
  assert.match(pricingSources, /revisions:\s*\{\s*global:\s*string;\s*customer:\s*string\s*\|\s*null\s*\}/);
  assert.match(pricingSources, /global:\s*globalRevision/);
  assert.match(pricingSources, /customer:\s*context\.customerPolicy\.updated_at\s*\?\?\s*null/);
});

test("admin pricing saves use atomic service-role RPCs instead of split row and audit writes", () => {
  const globalRoute = source("src", "app", "api", "admin", "commercial-settings", "route.ts");
  const customerRoute = source(
    "src",
    "app",
    "api",
    "admin",
    "customers",
    "[id]",
    "commercial-policy",
    "route.ts",
  );

  assert.match(globalRoute, /\.rpc\(["']save_commerce_settings_v2["']/);
  assert.match(customerRoute, /\.rpc\(["']save_customer_commercial_policy_v2["']/);
  assert.doesNotMatch(globalRoute, /\.from\(["']commerce_settings["']\)[\s\S]{0,500}\.(?:update|insert|upsert)\(/);
  assert.doesNotMatch(customerRoute, /\.from\(["']customer_commercial_policies["']\)[\s\S]{0,500}\.(?:update|insert|upsert)\(/);
  assert.doesNotMatch(
    `${globalRoute}\n${customerRoute}`,
    /\b(?:vat|automatic_tax|tax_rate|tax_country)\b/i,
  );
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
  const homepage = source("src", "components", "homepage", "HomepageExperience.tsx");
  const purchaseResolver = source("src", "lib", "commercialPolicy.ts");

  assert.match(creditsPage, /function formatCreditUnitEuro[\s\S]{0,300}minimumFractionDigits:\s*2[\s\S]{0,100}maximumFractionDigits:\s*4/);
  assert.match(creditsPage, /formatCreditUnitEuro\(quote\.customUnitPriceEuro\)/);
  assert.match(homepage, /function formatEuro[\s\S]{0,300}maximumFractionDigits:\s*2/);
  assert.match(homepage, /function formatCreditUnitEuro[\s\S]{0,300}maximumFractionDigits:\s*4/);
  assert.match(purchaseResolver, /customUnitPriceEuro\.toFixed\(4\)/);
  assert.match(creditsPage, /calculateCreditTotalEuro\(customCreditAmount, quote\.customUnitPriceEuro\)/);
  assert.match(purchaseResolver, /calculateCreditTotalEuro\(customCredits, quote\.customUnitPriceEuro\)/);
});

test("customer and public price cards show final totals without invented comparison prices", () => {
  const creditsPage = source("src", "app", "dashboard", "credits", "page.tsx");
  const homepage = source("src", "components", "homepage", "HomepageExperience.tsx");
  const publicRoute = source("src", "app", "api", "credits", "public-quote", "route.ts");

  assert.doesNotMatch(`${creditsPage}\n${homepage}\n${publicRoute}`, /basePriceEuro/);
  assert.doesNotMatch(creditsPage, /Best Value|bestValuePackage|get cheaper as the volume/i);
  assert.match(creditsPage, /lowestUnitPricePackage[\s\S]{0,500}unitPriceEuro/);
  assert.match(homepage, /Prices below are loaded from the live public tariff\./);
  assert.doesNotMatch(around(creditsPage, "Total Price", 1_200), /line-through/);
});

test("package totals preserve the legacy minimum of EUR 0.01 per credit", () => {
  assert.throws(
    () => buildCreditQuote({
      ...defaultCommerceSettings,
      package_prices_eur: {
        ...defaultCommerceSettings.package_prices_eur,
        credits_500: 0.01,
      },
    }, emptyCustomerCommercialPolicy("minimum-package")),
    RangeError,
  );

  const minimumQuote = buildCreditQuote({
    ...defaultCommerceSettings,
    package_prices_eur: {
      credits_10: 0.1,
      credits_50: 0.5,
      credits_100: 1,
      credits_250: 2.5,
      credits_500: 5,
    },
  }, emptyCustomerCommercialPolicy("minimum-package"));
  assert.equal(minimumQuote.packages.find((item) => item.id === "credits_500")?.unitPriceEuro, 0.01);
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

  const savePricingLabel = /Save (?:customer )?(?:pricing|price policy|price overrides|commercial policy)/i.exec(admin);
  assert.ok(savePricingLabel, "The pricing section must have its own visible save action");
  const savePricingControl = admin.slice(
    Math.max(0, savePricingLabel.index - 1_000),
    Math.min(admin.length, savePricingLabel.index + 500),
  );
  assert.match(savePricingControl, /disabled=/);
  assert.ok(
    pricingLoading.test(savePricingControl) || /pricingControlsDisabled/.test(savePricingControl),
    "The dedicated pricing save must remain disabled while pricing is loading",
  );
  assert.match(admin, /const\s+pricingControlsDisabled\s*=\s*customerPricingLoading/);
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
  assert.match(globalAdmin, /step=\{0\.01\}/);
  assert.match(
    globalAdmin,
    /function formatEuro[\s\S]{0,300}maximumFractionDigits/,
  );
  assert.match(globalAdmin, /formatEuro\(preview\.customUnitPriceEuro, 4\)/);
  assert.match(globalAdmin, /packagePricesEuro/);
  assert.doesNotMatch(globalAdmin, /adjustmentType|adjustmentValue/);
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

  const homepage = source("src", "components", "homepage", "HomepageExperience.tsx");
  assert.match(homepage, /\/api\/[\w()\-/]*(?:credit|pricing)[\w()\-/]*(?:public|global)|\/api\/[\w()\-/]*(?:public|global)[\w()\-/]*(?:credit|pricing)/i);
});

test("commercial tables allow authenticated staff reads but server-only writes", () => {
  const authorityMigration = source(
    "supabase",
    "migrations",
    "20260824000000_commercial_pricing_write_authority.sql",
  );
  const explicitPricingMigration = source(
    "supabase",
    "migrations",
    "20260826000000_explicit_credit_price_authority.sql",
  );
  const verifier = source("scripts", "verify-commercial-pricing-authority.sql");
  const explicitVerifier = source("scripts", "verify-explicit-credit-pricing.sql");

  assert.match(authorityMigration, /begin;[\s\S]*commit;/i);
  assert.match(authorityMigration, /drop policy if exists "Staff can manage global commerce settings"/i);
  assert.match(authorityMigration, /drop policy if exists "Staff can manage customer commerce policies"/i);
  assert.match(authorityMigration, /for select\s+to authenticated[\s\S]*has_staff_permission\('credits\.manage'\)/i);
  assert.match(authorityMigration, /revoke all privileges[\s\S]*from authenticated/i);
  assert.match(authorityMigration, /grant select[\s\S]*to authenticated/i);
  assert.match(authorityMigration, /grant select, insert, update, delete[\s\S]*to service_role/i);
  assert.match(authorityMigration, /commerce_settings_authoritative_values_chk/i);
  assert.match(authorityMigration, /customer_commercial_policy_authoritative_values_chk/i);
  assert.match(authorityMigration, /inactive_customer_adjustment_normalized/);
  assert.match(
    authorityMigration,
    /update\s+public\.customer_commercial_policies\s+set\s+adjustment_value\s*=\s*0\s+where\s+adjustment_type\s*=\s*'none'\s+and\s+adjustment_value\s*<>\s*0/i,
  );
  assert.doesNotMatch(authorityMigration, /\b(?:delete\s+from|truncate\s+table)\b/i);

  assert.match(explicitPricingMigration, /begin;[\s\S]*commit;/i);
  assert.match(explicitPricingMigration, /set local lock_timeout\s*=\s*'5s'/i);
  assert.match(explicitPricingMigration, /set local statement_timeout\s*=\s*'120s'/i);
  assert.match(explicitPricingMigration, /credit_package_10_total_eur\s+numeric\(12,2\)/i);
  assert.match(explicitPricingMigration, /custom_credit_unit_price_eur\s+numeric\(10,4\)/i);
  assert.match(explicitPricingMigration, /custom_credit_unit_price_override_eur\s+numeric\(10,4\)/i);
  assert.match(explicitPricingMigration, /explicit_customer_credit_prices_materialized/i);
  assert.match(explicitPricingMigration, /explicit_global_credit_prices_materialized/i);
  assert.doesNotMatch(explicitPricingMigration, /pg_catalog\.greatest/i);
  assert.match(explicitPricingMigration, /mg_seed_js_unit_ticks\(input_unit double precision\)/i);
  assert.match(explicitPricingMigration, /float8send\(greatest\(0\.01::double precision, input_unit\)\)/i);
  assert.match(explicitPricingMigration, /exact_denominator := exact_denominator \* 2/i);
  assert.match(explicitPricingMigration, /pg_catalog\.div\([\s\S]{0,140}2 \* exact_numerator \+ exact_denominator/i);
  assert.doesNotMatch(explicitPricingMigration, /exact_(?:scaled|numerator)\s*:=\s*exact_(?:scaled|numerator)\s*\/\s*2/i);
  assert.match(explicitPricingMigration, /credits::bigint \* public\.mg_seed_js_unit_ticks\(input_unit\) \+ 50/i);
  assert.match(explicitPricingMigration, /create or replace function public\.save_commerce_settings_v2/i);
  assert.match(explicitPricingMigration, /create or replace function public\.save_customer_commercial_policy_v2/i);
  assert.match(explicitPricingMigration, /create or replace function public\.activate_explicit_pricing_v2/i);
  assert.match(explicitPricingMigration, /explicit_pricing_writes_not_activated/i);
  assert.match(explicitPricingMigration, /security invoker[\s\S]*set search_path = ''/i);
  assert.match(explicitPricingMigration, /revoke all on function public\.save_commerce_settings_v2[\s\S]*from PUBLIC, anon, authenticated/i);
  assert.match(explicitPricingMigration, /grant execute on function public\.save_customer_commercial_policy_v2[\s\S]*to service_role/i);
  assert.doesNotMatch(explicitPricingMigration, /\b(?:delete\s+from|truncate\s+table)\b/i);
  assert.doesNotMatch(
    explicitPricingMigration,
    /(?:add column|create table|p_)\s+\w*(?:vat|tax|automatic_tax)\w*/i,
  );
  assert.match(explicitVerifier, /SELECT-only verification/i);
  assert.match(explicitVerifier, /global_rpc_service_only/);
  assert.match(explicitVerifier, /customer_rpc_service_only/);
  assert.match(explicitVerifier, /activation_rpc_service_only/);
  assert.match(explicitVerifier, /browser_direct_writes_revoked/);
  assert.match(explicitVerifier, /legacy_write_guards_present/);
  assert.equal((explicitVerifier.match(/tgenabled\s+in\s*\('O',\s*'A'\)/gi) ?? []).length, 2);
  assert.doesNotMatch(explicitVerifier, /tgenabled\s*<>\s*'D'/i);
  assert.doesNotMatch(
    explicitVerifier,
    /\b(?:alter|create|drop|grant|revoke|insert|update|delete|truncate)\s+(?:table|policy|on|into|from|public\.)/i,
  );

  assert.match(verifier, /SELECT-only verification/i);
  assert.match(verifier, /authenticated_write_revoked/);
  assert.match(verifier, /no_authenticated_write_policy/);
  assert.match(verifier, /inactive_adjustments_canonical/);
  assert.doesNotMatch(verifier, /\b(?:alter|create|drop|grant|revoke|insert|update|delete|truncate)\s+(?:table|policy|on|into|from|public\.)/i);
});

test("legacy materialization keeps the JavaScript half-step fixture exact", () => {
  const afterGlobal = Math.max(0.01, 3.5 * (1 - (-99.99 / 100)));
  const canonicalUnit = Number(afterGlobal.toFixed(4));
  assert.equal(canonicalUnit, 6.9996);
  assert.equal(calculateCreditTotalEuro(250, canonicalUnit), 1749.9);
  const secondCanonicalUnit = Number(
    Math.max(0.01, 3.5 * (1 - (-99.97 / 100))).toFixed(4),
  );
  assert.equal(secondCanonicalUnit, 6.9989);
  assert.equal(calculateCreditTotalEuro(250, secondCanonicalUnit), 1749.73);

  const releaseRunbook = source("docs", "explicit-credit-pricing-release.md");
  const continuityVerifier = source("scripts", "verify-explicit-pricing-continuity.mjs");
  assert.match(releaseRunbook, /writes\s+remain locked/i);
  assert.match(releaseRunbook, /v2-aware[\s\S]{0,120}rollback\s+bridge/i);
  assert.match(releaseRunbook, /Never point Production at a pre-v2 build/i);
  assert.match(continuityVerifier, /mismatchCount/);
  assert.doesNotMatch(continuityVerifier, /\.(?:insert|update|upsert|delete|rpc)\s*\(/);
  assert.doesNotMatch(continuityVerifier, /console\.(?:log|error)\([^)]*(?:user_id|credit_price_override)/i);
  assert.doesNotMatch(releaseRunbook, /\bVAT calculation\b/i);
});
