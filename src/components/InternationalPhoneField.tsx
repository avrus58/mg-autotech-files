"use client";

import { ChevronDown, Phone } from "lucide-react";
import { useEffect, useId, useMemo, useState } from "react";
import {
  getPhoneCountryOptions,
  type PhoneCountryOption,
} from "@/lib/phoneCountries";

type InternationalPhoneFieldProps = {
  countryCode: string;
  nationalNumber: string;
  onCountryCodeChange: (countryCode: string) => void;
  onNationalNumberChange: (nationalNumber: string) => void;
};

function currentDocumentLocale() {
  if (typeof document === "undefined") return "en";
  return document.documentElement.lang || window.navigator.language || "en";
}

function selectedOptionTitle(
  options: PhoneCountryOption[],
  countryCode: string
) {
  const selected = options.find((option) => option.code === countryCode);
  return selected
    ? `${selected.flag} ${selected.name} (${selected.callingCode})`
    : "Select a country calling code";
}

export function InternationalPhoneField({
  countryCode,
  nationalNumber,
  onCountryCodeChange,
  onNationalNumberChange,
}: InternationalPhoneFieldProps) {
  const hintId = useId();
  const [locale, setLocale] = useState("en");
  const options = useMemo(() => getPhoneCountryOptions(locale), [locale]);
  const selectedOption = options.find((option) => option.code === countryCode);

  useEffect(() => {
    const syncLocale = (event?: Event) => {
      const eventLocale =
        event instanceof CustomEvent &&
        typeof event.detail?.locale === "string"
          ? event.detail.locale
          : "";
      setLocale(eventLocale || currentDocumentLocale());
    };

    syncLocale();
    window.addEventListener("mg-locale-change", syncLocale);
    return () => window.removeEventListener("mg-locale-change", syncLocale);
  }, []);

  return (
    <fieldset className="block min-w-0">
      <legend className="mb-1.5 text-[11px] font-black uppercase tracking-[0.14em] text-zinc-500">
        Phone Number
      </legend>
      <div className="grid min-w-0 grid-cols-[7.75rem_minmax(0,1fr)] gap-2">
        <div className="relative h-11 min-w-0 rounded-xl border border-white/10 bg-black/35 transition focus-within:border-red-700">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 flex items-center gap-1.5 px-2.5 text-sm font-bold text-white"
          >
            <span
              data-phone-country-flag
              className="inline-flex min-w-6 justify-center text-base leading-none"
            >
              {selectedOption?.flag ?? "🌐"}
            </span>
            <span className="min-w-0 flex-1 truncate">
              {selectedOption?.callingCode ?? "Code"}
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 text-zinc-500" />
          </div>
          <select
            value={countryCode}
            onChange={(event) => onCountryCodeChange(event.target.value)}
            aria-label="Country calling code"
            aria-describedby={hintId}
            autoComplete="tel-country-code"
            title={selectedOptionTitle(options, countryCode)}
            dir="ltr"
            className="absolute inset-0 h-11 w-full cursor-pointer opacity-0"
          >
            <option value="" disabled className="bg-[#111]">
              Code
            </option>
            {options.map((option) => (
              <option
                key={option.code}
                value={option.code}
                className="bg-[#111]"
                data-no-translate
              >
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="relative min-w-0">
          <span className="absolute left-3 top-1/2 flex -translate-y-1/2 text-zinc-500">
            <Phone className="h-4 w-4" aria-hidden="true" />
          </span>
          <input
            value={nationalNumber}
            onChange={(event) => onNationalNumberChange(event.target.value)}
            placeholder="Mobile or landline"
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            maxLength={40}
            spellCheck={false}
            aria-label="Phone number"
            aria-describedby={hintId}
            dir="ltr"
            className="h-11 w-full min-w-0 rounded-xl border border-white/10 bg-black/35 pl-10 pr-3 text-sm font-bold text-white outline-none transition placeholder:text-zinc-600 focus:border-red-700"
          />
        </div>
      </div>
      <p id={hintId} className="mt-1.5 text-xs leading-5 text-zinc-500">
        Calling code starts from your country. Enter the local number; special
        carrier plans may require the full + number.
      </p>
    </fieldset>
  );
}
