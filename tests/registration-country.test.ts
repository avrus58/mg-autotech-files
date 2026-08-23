import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { GET } from "../src/app/api/public/country/route";
import {
  countryCodes,
  getCountryName,
  getCountryOptions,
  normalizeCountryCode,
  normalizeCountryName,
  resolveDetectedCountrySelection,
} from "../src/lib/countries";
import {
  buildPendingRegistrationCountryMetadata,
  buildRegistrationCompletionUpdates,
  hasConfirmedRegistrationCountry,
  isGoogleRegistrationAfterCountryEnforcement,
  requiresRegistrationCountryCompletion,
} from "../src/lib/registrationCompletion";

const registerPage = readFileSync(
  resolve(process.cwd(), "src", "app", "register", "page.tsx"),
  "utf8"
);
const countrySelect = readFileSync(
  resolve(process.cwd(), "src", "components", "CountrySelect.tsx"),
  "utf8"
);
const settingsPage = readFileSync(
  resolve(process.cwd(), "src", "app", "dashboard", "settings", "page.tsx"),
  "utf8"
);
const authCallback = readFileSync(
  resolve(process.cwd(), "src", "app", "auth", "callback", "page.tsx"),
  "utf8"
);
const loginPage = readFileSync(
  resolve(process.cwd(), "src", "app", "login", "page.tsx"),
  "utf8"
);
const profileCompletionPage = readFileSync(
  resolve(process.cwd(), "src", "app", "auth", "complete-profile", "page.tsx"),
  "utf8"
);
const registrationCountryBoundary = readFileSync(
  resolve(process.cwd(), "src", "components", "auth", "RegistrationCountryBoundary.tsx"),
  "utf8"
);
const dashboardLayout = readFileSync(
  resolve(process.cwd(), "src", "app", "dashboard", "layout.tsx"),
  "utf8"
);
const newRequestLayout = readFileSync(
  resolve(process.cwd(), "src", "app", "new-request", "layout.tsx"),
  "utf8"
);

test("country catalog covers every ISO entry plus the documented Kosovo option", () => {
  assert.equal(countryCodes.length, 250);
  assert.equal(new Set(countryCodes).size, countryCodes.length);
  assert.equal(countryCodes.every((code) => /^[A-Z]{2}$/.test(code)), true);
  assert.equal(countryCodes.includes("US"), true);
  assert.equal(countryCodes.includes("DE"), true);
  assert.equal(countryCodes.includes("TR"), true);
  assert.equal(countryCodes.includes("GB"), true);
  assert.equal(countryCodes.includes("XK"), true);
  assert.equal(countryCodes.includes("ZZ"), false);
});

test("country normalization keeps a stable English profile value", () => {
  assert.equal(normalizeCountryCode(" us "), "US");
  assert.equal(normalizeCountryCode("deu"), null);
  assert.equal(normalizeCountryCode("XX"), null);
  assert.equal(getCountryName("US"), "United States");
  assert.equal(getCountryName("DE"), "Germany");
  assert.equal(normalizeCountryName(" united states "), "United States");
  assert.equal(normalizeCountryName("tr"), "Türkiye");

  const germanOptions = getCountryOptions("de");
  assert.equal(germanOptions.length, countryCodes.length);
  assert.equal(
    germanOptions.find((option) => option.code === "US")?.value,
    "United States"
  );
});

test("late geolocation never replaces a manual country choice", () => {
  assert.equal(
    resolveDetectedCountrySelection({
      currentCountry: "Canada",
      detectedCountryCode: "US",
      manuallySelected: true,
    }),
    "Canada"
  );
  assert.equal(
    resolveDetectedCountrySelection({
      currentCountry: "",
      detectedCountryCode: "US",
      manuallySelected: false,
    }),
    "United States"
  );
  assert.equal(
    resolveDetectedCountrySelection({
      currentCountry: "",
      detectedCountryCode: "XX",
      manuallySelected: false,
    }),
    ""
  );
});

test("new Google accounts require country completion without a time limit", () => {
  const enforcedGoogleUser = {
    created_at: "2026-08-22T00:01:00.000Z",
    app_metadata: { provider: "google", providers: ["google"] },
    user_metadata: {},
  };

  assert.equal(
    isGoogleRegistrationAfterCountryEnforcement(enforcedGoogleUser),
    true
  );
  assert.equal(requiresRegistrationCountryCompletion(enforcedGoogleUser), true);
  assert.equal(
    isGoogleRegistrationAfterCountryEnforcement({
      ...enforcedGoogleUser,
      created_at: "2026-08-21T23:59:59.000Z",
    }),
    false
  );
  assert.equal(
    isGoogleRegistrationAfterCountryEnforcement({
      ...enforcedGoogleUser,
      app_metadata: { provider: "email" },
    }),
    false
  );
  assert.equal(
    requiresRegistrationCountryCompletion({
      ...enforcedGoogleUser,
      created_at: "2025-01-01T00:00:00.000Z",
      user_metadata: { registration_country_required: true },
    }),
    true
  );
  assert.equal(
    hasConfirmedRegistrationCountry({
      registration_country_confirmed: true,
      country: "US",
    }),
    true
  );
  assert.equal(
    requiresRegistrationCountryCompletion({
      ...enforcedGoogleUser,
      user_metadata: {
        registration_country_required: true,
        registration_country_confirmed: true,
        country: "United States",
      },
    }),
    false
  );
  assert.equal(
    hasConfirmedRegistrationCountry({
      registration_country_confirmed: true,
      country: "Unknownland",
    }),
    false
  );
  assert.equal(
    hasConfirmedRegistrationCountry({ country: "Germany" }),
    false
  );
  assert.deepEqual(buildPendingRegistrationCountryMetadata({ locale: "en" }), {
    locale: "en",
    registration_country_required: true,
    registration_country_confirmed: false,
  });
});

test("country completion preserves a safe legacy OAuth draft", () => {
  const updates = buildRegistrationCompletionUpdates({
    country: "US",
    existingMetadata: { avatar_url: "https://example.test/avatar.png" },
    draft: {
      full_name: "Workshop Owner",
      account_type: "company",
      company_name: "Example Workshop",
      phone: "+1 555 0100",
      vat_id: null,
      tax_number: null,
      country: null,
      email_language: "en",
    },
  });

  assert.equal(updates?.metadata.country, "United States");
  assert.equal(updates?.metadata.registration_country_confirmed, true);
  assert.equal(updates?.metadata.registration_country_required, false);
  assert.equal(updates?.metadata.avatar_url, "https://example.test/avatar.png");
  assert.deepEqual(updates?.profile, {
    full_name: "Workshop Owner",
    account_type: "company",
    company_name: "Example Workshop",
    phone: "+1 555 0100",
    vat_id: null,
    country: "United States",
  });
  assert.equal(
    buildRegistrationCompletionUpdates({ country: "XX", draft: null }),
    null
  );
});

test("public country endpoint returns only a normalized no-store country code", async () => {
  const mutableEnvironment = process.env as Record<string, string | undefined>;
  const previousVercel = mutableEnvironment.VERCEL;
  const previousProvider = mutableEnvironment.REQUEST_NETWORK_PROVIDER;
  mutableEnvironment.VERCEL = "1";
  delete mutableEnvironment.REQUEST_NETWORK_PROVIDER;

  try {
    const response = GET(
      new Request("https://file.example/api/public/country", {
        headers: {
          "x-vercel-ip-country": " us ",
          "x-forwarded-for": "203.0.113.10",
        },
      })
    );
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { countryCode: "US" });
    assert.equal(response.headers.get("cache-control"), "private, no-store, max-age=0");
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    assert.match(response.headers.get("x-robots-tag") ?? "", /noindex/);

    const invalidResponse = GET(
      new Request("https://file.example/api/public/country", {
        headers: { "x-vercel-ip-country": "XX" },
      })
    );
    assert.deepEqual(await invalidResponse.json(), { countryCode: null });

    const missingResponse = GET(
      new Request("https://file.example/api/public/country")
    );
    assert.deepEqual(await missingResponse.json(), { countryCode: null });
  } finally {
    if (previousVercel === undefined) delete mutableEnvironment.VERCEL;
    else mutableEnvironment.VERCEL = previousVercel;
    if (previousProvider === undefined) {
      delete mutableEnvironment.REQUEST_NETWORK_PROVIDER;
    } else {
      mutableEnvironment.REQUEST_NETWORK_PROVIDER = previousProvider;
    }
  }
});

test("registration requires the auto-detected but editable country on every signup path", () => {
  assert.match(registerPage, /const \[country, setCountry\] = useState\(""\)/);
  assert.match(registerPage, /fetch\("\/api\/public\/country"/);
  assert.match(registerPage, /countryManuallySelectedRef\.current = true/);
  assert.match(registerPage, /if \(!normalizeCountryName\(country\)\)/);
  assert.match(registerPage, /country: selectedCountry/);
  assert.match(registerPage, /createRegistrationProfileDraft\([\s\S]*country: selectedCountry/);
  assert.doesNotMatch(registerPage, /country\.trim\(\) \|\| "Germany"/);
  assert.doesNotMatch(registerPage, /label="Country"[\s\S]*placeholder="Germany"/);
  assert.match(countrySelect, /required=\{required\}/);
  assert.match(countrySelect, /autoComplete="country-name"/);
  assert.match(countrySelect, /<option value="" disabled/);
  assert.match(countrySelect, /data-no-translate/);
  assert.match(registerPage, /registration_country_confirmed: true/);
  assert.match(registerPage, /registration_country_required: false/);
  assert.match(loginPage, /signInWithIdToken\(\{[\s\S]*provider: "google"/);
  assert.match(loginPage, /captchaToken: requestCaptchaToken/);
  assert.doesNotMatch(loginPage, /signInWithOAuth/);
  assert.match(authCallback, /requiresRegistrationCountryCompletion\(session\.user\)/);
  assert.match(authCallback, /router\.replace\(countryCompletionPath\(next\)\)/);
  assert.ok(
    authCallback.indexOf("const profileUpdate") <
      authCallback.indexOf("const authUpdate")
  );
  assert.match(authCallback, /profileUpdate\.error \|\| !profileUpdate\.data/);
  assert.match(authCallback, /if \(authUpdate\.error\)/);
  assert.match(profileCompletionPage, /fetch\("\/api\/public\/country"/);
  assert.match(profileCompletionPage, /<CountrySelect[\s\S]*required/);
  assert.match(profileCompletionPage, /buildRegistrationCompletionUpdates/);
  assert.match(profileCompletionPage, /requiresRegistrationCountryCompletion\(session\.user\)/);
  assert.ok(
    profileCompletionPage.indexOf("const profileUpdate") <
      profileCompletionPage.indexOf("const authUpdate")
  );
  assert.match(registrationCountryBoundary, /requiresRegistrationCountryCompletion\(session\.user\)/);
  assert.match(registrationCountryBoundary, /\/auth\/complete-profile\?next=/);
  assert.match(dashboardLayout, /<RegistrationCountryBoundary>/);
  assert.match(newRequestLayout, /<RegistrationCountryBoundary nextPath="\/new-request">/);
});

test("customer settings no longer invent Germany for an empty profile", () => {
  assert.match(settingsPage, /const \[country, setCountry\] = useState\(""\)/);
  assert.match(settingsPage, /<CountrySelect[\s\S]*variant="settings"/);
  assert.doesNotMatch(settingsPage, /data\.country \?\? "Germany"/);
  assert.doesNotMatch(settingsPage, /country\.trim\(\) \|\| "Germany"/);
});
