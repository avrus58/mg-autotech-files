import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { countryCodes } from "../src/lib/countries";
import {
  countryCallingCodes,
  countryCodeToFlag,
  formatInternationalPhone,
  getCountryCallingCode,
  getPhoneCountryOptions,
  resolveDetectedPhoneCountrySelection,
} from "../src/lib/phoneCountries";

const registerPage = readFileSync(
  resolve(process.cwd(), "src", "app", "register", "page.tsx"),
  "utf8"
);
const phoneField = readFileSync(
  resolve(
    process.cwd(),
    "src",
    "components",
    "InternationalPhoneField.tsx"
  ),
  "utf8"
);
const countrySelect = readFileSync(
  resolve(process.cwd(), "src", "components", "CountrySelect.tsx"),
  "utf8"
);

test("phone catalog covers the global country catalog without invented codes", () => {
  const catalogCodes = Object.keys(countryCallingCodes).sort();
  const unsupported = Object.entries(countryCallingCodes)
    .filter(([, callingCode]) => callingCode === null)
    .map(([countryCode]) => countryCode)
    .sort();
  const operational = Object.values(countryCallingCodes).filter(Boolean);

  assert.deepEqual(catalogCodes, [...countryCodes].sort());
  assert.equal(new Set(catalogCodes).size, 250);
  assert.equal(operational.length, 243);
  assert.deepEqual(unsupported, ["AQ", "BV", "GS", "HM", "PN", "TF", "UM"]);
  assert.equal(
    operational.every((callingCode) => /^\+[1-9]\d{0,2}$/.test(callingCode!)),
    true
  );
});

test("known and shared calling codes remain keyed by ISO country", () => {
  assert.equal(getCountryCallingCode("DE"), "+49");
  assert.equal(getCountryCallingCode("US"), "+1");
  assert.equal(getCountryCallingCode("TR"), "+90");
  assert.equal(getCountryCallingCode("GB"), "+44");
  assert.equal(getCountryCallingCode("XK"), "+383");
  assert.equal(getCountryCallingCode("AQ"), null);
  assert.equal(getCountryCallingCode("XX"), null);
  assert.equal(getCountryCallingCode("CA"), getCountryCallingCode("US"));
  assert.equal(getCountryCallingCode("KZ"), getCountryCallingCode("RU"));

  assert.equal(countryCodeToFlag("DE"), "🇩🇪");
  assert.equal(countryCodeToFlag("US"), "🇺🇸");
  assert.equal(countryCodeToFlag("XK"), "🇽🇰");
  assert.equal(countryCodeToFlag("invalid"), "🌐");
});

test("phone options are localized, operational and show flag before code", () => {
  const options = getPhoneCountryOptions("en");
  const germany = options.find((option) => option.code === "DE");
  const unitedStates = options.find((option) => option.code === "US");

  assert.equal(options.length, 243);
  assert.equal(germany?.label, "🇩🇪 +49 · Germany");
  assert.equal(unitedStates?.label, "🇺🇸 +1 · United States");
  assert.equal(options.some((option) => option.code === "AQ"), false);
});

test("late detection cannot replace a selected phone country", () => {
  assert.equal(
    resolveDetectedPhoneCountrySelection({
      currentCountryCode: "",
      detectedCountryCode: "US",
      manuallySelected: false,
    }),
    "US"
  );
  assert.equal(
    resolveDetectedPhoneCountrySelection({
      currentCountryCode: "TR",
      detectedCountryCode: "US",
      manuallySelected: true,
    }),
    "TR"
  );
  assert.equal(
    resolveDetectedPhoneCountrySelection({
      currentCountryCode: "DE",
      detectedCountryCode: "US",
      manuallySelected: false,
    }),
    "DE"
  );
  assert.equal(
    resolveDetectedPhoneCountrySelection({
      currentCountryCode: "",
      detectedCountryCode: "AQ",
      manuallySelected: false,
    }),
    ""
  );
});

test("phone formatting emits one selected international code without trunk errors", () => {
  assert.equal(
    formatInternationalPhone({ countryCode: "DE", nationalNumber: "" }),
    null
  );
  assert.equal(
    formatInternationalPhone({
      countryCode: "DE",
      nationalNumber: "151 234 5678",
    }),
    "+491512345678"
  );
  assert.equal(
    formatInternationalPhone({
      countryCode: "DE",
      nationalNumber: "0151 234 5678",
    }),
    "+491512345678"
  );
  assert.equal(
    formatInternationalPhone({
      countryCode: "DE",
      nationalNumber: "+49 (0)151 234 5678",
    }),
    "+491512345678"
  );
  const domesticZeroCases = [
    ["TR", "0532 123 45 67", "+905321234567"],
    ["GB", "020 7946 0958", "+442079460958"],
    ["FR", "01 42 68 53 00", "+33142685300"],
    ["NL", "020 794 0800", "+31207940800"],
    ["BE", "0470 12 34 56", "+32470123456"],
    ["AU", "02 9374 4000", "+61293744000"],
  ] as const;
  domesticZeroCases.forEach(([countryCode, nationalNumber, expected]) => {
    assert.equal(
      formatInternationalPhone({ countryCode, nationalNumber }),
      expected
    );
  });
  assert.equal(
    formatInternationalPhone({
      countryCode: "US",
      nationalNumber: "202 555 0100",
    }),
    "+12025550100"
  );
  assert.equal(
    formatInternationalPhone({
      countryCode: "DE",
      nationalNumber: "+90 532 123 45 67",
    }),
    null
  );
  assert.equal(
    formatInternationalPhone({
      countryCode: "TR",
      nationalNumber: "+90 532 123 45 67",
    }),
    "+905321234567"
  );
  assert.equal(
    formatInternationalPhone({
      countryCode: "GB",
      nationalNumber: "0044 20 7946 0958",
    }),
    "+442079460958"
  );
  assert.equal(
    formatInternationalPhone({
      countryCode: "IT",
      nationalNumber: "06 6982",
    }),
    "+39066982"
  );
  assert.equal(
    formatInternationalPhone({
      countryCode: "CI",
      nationalNumber: "01 23 45 67 89",
    }),
    "+2250123456789"
  );
  assert.equal(
    formatInternationalPhone({
      countryCode: "GB",
      nationalNumber: "180020 123456",
    }),
    null
  );
  assert.equal(
    formatInternationalPhone({
      countryCode: "AU",
      nationalNumber: "1831 02 9374 4000",
    }),
    null
  );
  const complexNationalCases = [
    ["JP", "03 1234 5678"],
    ["KR", "02 1234 5678"],
    ["BR", "011 2345 6789"],
  ] as const;
  complexNationalCases.forEach(([countryCode, nationalNumber]) => {
    assert.equal(
      formatInternationalPhone({ countryCode, nationalNumber }),
      null
    );
  });
  assert.equal(
    formatInternationalPhone({
      countryCode: "JP",
      nationalNumber: "+81 3 1234 5678",
    }),
    "+81312345678"
  );
  assert.equal(
    formatInternationalPhone({
      countryCode: "AQ",
      nationalNumber: "12345",
    }),
    null
  );
  assert.equal(
    formatInternationalPhone({
      countryCode: "US",
      nationalNumber: "call me",
    }),
    null
  );
  assert.equal(
    formatInternationalPhone({
      countryCode: "US",
      nationalNumber: "1".repeat(15),
    }),
    null
  );
});

test("registration uses one editable auto-detected phone country on both auth paths", () => {
  assert.match(registerPage, /const \[phoneCountryCode, setPhoneCountryCode\] = useState\(""\)/);
  assert.match(registerPage, /phoneCountryManuallySelectedRef/);
  assert.match(registerPage, /resolveDetectedPhoneCountrySelection\(\{/);
  assert.match(registerPage, /<InternationalPhoneField/);
  assert.match(registerPage, /phoneCountryManuallySelectedRef\.current = true/);
  assert.match(registerPage, /if \(phoneCountryManuallySelectedRef\.current\) return/);
  assert.match(registerPage, /const formattedPhone = formatInternationalPhone\(\{/);
  assert.equal(registerPage.match(/phone: formattedPhone/g)?.length, 2);
  assert.match(registerPage, /phone: formattedPhone \?\? ""/);
  assert.match(registerPage, /phone\.trim\(\) && !formattedPhone/);
  assert.doesNotMatch(registerPage, /placeholder="\+49/);

  assert.match(phoneField, /aria-label="Country calling code"/);
  assert.match(phoneField, /autoComplete="tel-country-code"/);
  assert.match(phoneField, /data-phone-country-flag/);
  assert.match(phoneField, /selectedOption\?\.callingCode \?\? "Code"/);
  assert.match(phoneField, /type="tel"/);
  assert.match(phoneField, /inputMode="tel"/);
  assert.match(phoneField, /autoComplete="tel-national"/);
  assert.match(phoneField, /aria-label="Phone number"/);
  assert.match(phoneField, /special[\s\S]*carrier plans may require the full \+ number/);
  assert.match(phoneField, /grid-cols-\[7\.75rem_minmax\(0,1fr\)\]/);
  assert.match(phoneField, /h-11/);
  assert.match(countrySelect, /data-country-code=\{option\.code\}/);
});
