import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const registerPage = readFileSync(
  resolve(process.cwd(), "src", "app", "register", "page.tsx"),
  "utf8"
);
const authCallback = readFileSync(
  resolve(process.cwd(), "src", "app", "auth", "callback", "page.tsx"),
  "utf8"
);
const oauthFinalizeRoute = readFileSync(
  resolve(process.cwd(), "src", "app", "api", "auth", "oauth-registration", "finalize", "route.ts"),
  "utf8"
);
const registrationCompletion = readFileSync(
  resolve(process.cwd(), "src", "lib", "registrationCompletion.ts"),
  "utf8"
);

test("registration keeps one focused card without the redundant marketing column", () => {
  assert.match(registerPage, /overflow-x-hidden/);
  assert.doesNotMatch(registerPage, /<main className="[^"]*overflow-hidden[^"]*"/);
  assert.match(registerPage, /max-w-\[760px\]/);
  assert.equal(registerPage.match(/<h1\b/g)?.length, 1);
  assert.match(registerPage, /<h1[^>]*>[\s\S]*?Create Account[\s\S]*?<\/h1>/);
  assert.doesNotMatch(registerPage, /FeatureCard/);
  assert.doesNotMatch(registerPage, /Smart Vehicle Database/);
  assert.doesNotMatch(registerPage, /Premium File Workflow/);
  assert.doesNotMatch(registerPage, /lg:grid-cols-\[0\.84fr_1\.16fr\]/);
  assert.match(registerPage, /h-11 w-full rounded-xl/);
});

test("registration keeps the next action inside short laptop viewports", () => {
  const shortLaptopRules = registerPage.match(
    /\[@media\(min-width:640px\)_and_\(max-height:820px\)\]:/g
  );

  assert.ok(
    (shortLaptopRules?.length ?? 0) >= 10,
    "short laptop density rules must cover the shell, progress and active step"
  );
  assert.match(
    registerPage,
    /lg:items-center[\s\S]*\[@media\(min-width:1024px\)_and_\(max-height:820px\)\]:items-start/
  );
  assert.match(
    registerPage,
    /space-y-4 \[@media\(min-width:640px\)_and_\(max-height:820px\)\]:space-y-2\.5/
  );
});

test("final account action links to the existing privacy and terms pages", () => {
  const finalStep = registerPage.slice(registerPage.indexOf("{step === 3"));

  assert.match(
    finalStep,
    /aria-label=\{firstPaintT\("Legal information"\)\}/
  );
  assert.match(
    finalStep,
    /href="\/privacy"[\s\S]*target="_blank"[\s\S]*rel="noopener noreferrer"[\s\S]*aria-label=\{firstPaintT\([\s\S]*?"Privacy information \(opens in a new tab\)"[\s\S]*?\)\}/
  );
  assert.match(
    finalStep,
    /href="\/agb"[\s\S]*target="_blank"[\s\S]*rel="noopener noreferrer"[\s\S]*aria-label=\{firstPaintT\([\s\S]*?"Terms in German \(opens in a new tab\)"[\s\S]*?\)\}/
  );
  assert.match(finalStep, /Terms \(German\)/);
  assert.match(finalStep, /flex flex-wrap items-center/);
  assert.doesNotMatch(finalStep, /href="\/(?:terms|legal)"/);
});

test("company registration requires and persists a bounded company identity", () => {
  assert.match(registerPage, /if \(accountType === "company" && !cleanCompanyName\)/);
  assert.match(
    registerPage,
    /setMessage\(\{ kind: "exact", source: "Please enter your company name\." \}\)/,
  );
  assert.match(registerPage, /company_name: accountType === "company" \? cleanCompanyName : null/);
  assert.match(registerPage, /vat_id: accountType === "company" \? taxNumber\.trim\(\) \|\| null : null/);
  assert.match(
    registerPage,
    /label=\{firstPaintT\("Company Name"\)\}[\s\S]*?autoComplete="organization"/
  );
  assert.match(
    registerPage,
    /label=\{firstPaintT\("Company Name"\)\}[\s\S]*?maxLength=\{120\}/
  );
  assert.match(registerPage, /aria-pressed=\{accountType === item\.id\}/);
});

test("Google registration carries the validated customer and company profile", () => {
  assert.match(registerPage, /if \(!validateAccountStep\(\)\)/);
  assert.match(registerPage, /createRegistrationProfileDraft\(\{/);
  assert.match(registerPage, /country: selectedCountry/);
  assert.match(registerPage, /OAUTH_REGISTRATION_PROFILE_KEY/);
  assert.match(authCallback, /parseRegistrationProfileDraft/);
  assert.match(
    authCallback,
    /oauthSignupProvider === "google" &&[\s\S]*oauthProfile &&[\s\S]*isGoogleRegistrationProfileFinalizationWindowOpen/
  );
  assert.match(authCallback, /JSON\.stringify\(\{ profile: oauthProfile \}\)/);
  assert.match(authCallback, /buildRegistrationCompletionUpdates\(\{/);
  assert.match(authCallback, /country: oauthProfile\.country/);
  assert.match(oauthFinalizeRoute, /buildRegistrationCompletionUpdates\(\{/);
  assert.match(oauthFinalizeRoute, /\.update\(updates\.profile\)/);
  assert.match(oauthFinalizeRoute, /\.eq\("id", auth\.user\.id\)/);
  assert.match(
    oauthFinalizeRoute,
    /isGoogleRegistrationProfileFinalizationWindowOpen\(auth\.user\)/
  );
  assert.match(oauthFinalizeRoute, /\.\.\.updates\.metadata/);
  assert.match(registrationCompletion, /registration_country_required/);
  assert.match(registrationCompletion, /registration_country_confirmed/);
  assert.match(oauthFinalizeRoute, /oauth_registration_finalized: true/);
});

test("private registration keeps company-only controls and metadata out of the account", () => {
  assert.match(
    registerPage,
    /\{accountType === "company" && \([\s\S]*?label=\{firstPaintT\("Company Name"\)\}/
  );
  assert.match(registerPage, /tax_number: accountType === "company" \? taxNumber\.trim\(\) \|\| null : null/);
});
