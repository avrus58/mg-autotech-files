"use client";

import { ChevronDown, Phone } from "lucide-react";
import { useId, useMemo } from "react";
import {
  getPhoneCountryOptions,
  type PhoneCountryOption,
} from "@/lib/phoneCountries";
import type { LocaleCode } from "@/lib/i18nConfig";
import { customerRuntimeExactT } from "@/lib/i18n/customer-runtime-translations";
import { useActiveLocale } from "@/lib/useActiveLocale";

type InternationalPhoneFieldProps = {
  countryCode: string;
  nationalNumber: string;
  onCountryCodeChange: (countryCode: string) => void;
  onNationalNumberChange: (nationalNumber: string) => void;
};

function selectedOptionTitle(
  options: PhoneCountryOption[],
  countryCode: string,
  locale: LocaleCode
) {
  const selected = options.find((option) => option.code === countryCode);
  return selected
    ? `${selected.flag} ${selected.name} (${selected.callingCode})`
    : customerRuntimeExactT(locale, "Select a country calling code");
}

export function InternationalPhoneField({
  countryCode,
  nationalNumber,
  onCountryCodeChange,
  onNationalNumberChange,
}: InternationalPhoneFieldProps) {
  const hintId = useId();
  const locale = useActiveLocale();
  const options = useMemo(() => getPhoneCountryOptions(locale), [locale]);
  const selectedOption = options.find((option) => option.code === countryCode);

  return (
    <fieldset className="block min-w-0">
      <legend className="mb-1.5 text-[11px] font-black uppercase tracking-[0.14em] text-zinc-500">
        {customerRuntimeExactT(locale, "Phone Number")}
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
              {selectedOption?.callingCode ?? customerRuntimeExactT(locale, "Code")}
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 text-zinc-500" />
          </div>
          <select
            value={countryCode}
            onChange={(event) => onCountryCodeChange(event.target.value)}
            aria-label={customerRuntimeExactT(locale, "Country calling code")}
            aria-describedby={hintId}
            autoComplete="tel-country-code"
            title={selectedOptionTitle(options, countryCode, locale)}
            dir="ltr"
            className="absolute inset-0 h-11 w-full cursor-pointer opacity-0"
          >
            <option value="" disabled className="bg-[#111]">
              {customerRuntimeExactT(locale, "Code")}
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
            placeholder={customerRuntimeExactT(locale, "Mobile or landline")}
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            maxLength={40}
            spellCheck={false}
            aria-label={customerRuntimeExactT(locale, "Phone number")}
            aria-describedby={hintId}
            dir="ltr"
            className="h-11 w-full min-w-0 rounded-xl border border-white/10 bg-black/35 pl-10 pr-3 text-sm font-bold text-white outline-none transition placeholder:text-zinc-600 focus:border-red-700"
          />
        </div>
      </div>
      <p id={hintId} className="mt-1.5 text-xs leading-5 text-zinc-500">
        {customerRuntimeExactT(
          locale,
          "Calling code starts from your country. Enter the local number; special carrier plans may require the full + number."
        )}
      </p>
    </fieldset>
  );
}
