const isoCountryCodes = `
AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ
BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ
CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ
DE DJ DK DM DO DZ
EC EE EG EH ER ES ET
FI FJ FK FM FO FR
GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY
HK HM HN HR HT HU
ID IE IL IM IN IO IQ IR IS IT
JE JM JO JP
KE KG KH KI KM KN KP KR KW KY KZ
LA LB LC LI LK LR LS LT LU LV LY
MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ
NA NC NE NF NG NI NL NO NP NR NU NZ
OM
PA PE PF PG PH PK PL PM PN PR PS PT PW PY
QA
RE RO RS RU RW
SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ
TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ
UA UG UM US UY UZ
VA VC VE VG VI VN VU
WF WS
YE YT
ZA ZM ZW
`
  .trim()
  .split(/\s+/);

// XK is a widely used user-assigned code for Kosovo. It is included as a
// customer-facing option even though it is not assigned in ISO 3166-1.
export const countryCodes = Object.freeze([...isoCountryCodes, "XK"]);

const countryCodeSet = new Set(countryCodes);

export type CountryOption = {
  code: string;
  value: string;
  label: string;
};

function createRegionNames(locale: string | readonly string[]) {
  try {
    return new Intl.DisplayNames(locale, { type: "region" });
  } catch {
    return new Intl.DisplayNames(["en"], { type: "region" });
  }
}

function displayRegionName(code: string, locale: string | readonly string[]) {
  if (code === "XK") {
    try {
      const localized = createRegionNames(locale).of(code);
      return localized && localized !== code ? localized : "Kosovo";
    } catch {
      return "Kosovo";
    }
  }

  try {
    return createRegionNames(locale).of(code) || code;
  } catch {
    return code;
  }
}

export function normalizeCountryCode(value: unknown) {
  if (typeof value !== "string") return null;
  const code = value.trim().toUpperCase();
  return countryCodeSet.has(code) ? code : null;
}

export function getCountryName(countryCode: unknown) {
  const code = normalizeCountryCode(countryCode);
  return code ? displayRegionName(code, ["en"]) : null;
}

let canonicalCountryNames: Map<string, string> | null = null;

function getCanonicalCountryNames() {
  if (canonicalCountryNames) return canonicalCountryNames;

  canonicalCountryNames = new Map<string, string>();
  countryCodes.forEach((code) => {
    const name = getCountryName(code);
    if (!name) return;
    canonicalCountryNames?.set(name.toLocaleLowerCase("en"), name);
  });
  return canonicalCountryNames;
}

export function normalizeCountryName(value: unknown) {
  if (typeof value !== "string") return null;
  const clean = value.trim();
  if (!clean || clean.length > 80) return null;

  const codeName = getCountryName(clean);
  if (codeName) return codeName;

  return getCanonicalCountryNames().get(clean.toLocaleLowerCase("en")) ?? null;
}

export function getCountryOptions(locale = "en"): CountryOption[] {
  const options = countryCodes.map((code) => ({
    code,
    value: getCountryName(code) || code,
    label: displayRegionName(code, [locale, "en"]),
  }));

  try {
    const collator = new Intl.Collator([locale, "en"], {
      sensitivity: "base",
      usage: "sort",
    });
    return options.sort((left, right) => collator.compare(left.label, right.label));
  } catch {
    return options.sort((left, right) => left.label.localeCompare(right.label));
  }
}

export function resolveDetectedCountrySelection(input: {
  currentCountry: string;
  detectedCountryCode: unknown;
  manuallySelected: boolean;
}) {
  const current = normalizeCountryName(input.currentCountry);
  if (input.manuallySelected || current) return current ?? input.currentCountry.trim();
  return getCountryName(input.detectedCountryCode) ?? "";
}
