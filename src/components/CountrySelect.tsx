"use client";

import {
  useEffect,
  useId,
  useMemo,
  useState,
  type RefObject,
} from "react";
import { getCountryOptions, normalizeCountryName } from "@/lib/countries";

type CountrySelectProps = {
  value: string;
  onChange: (value: string) => void;
  onCountryCodeChange?: (countryCode: string) => void;
  required?: boolean;
  detecting?: boolean;
  hint?: string;
  variant?: "compact" | "settings";
  selectRef?: RefObject<HTMLSelectElement | null>;
};

function currentDocumentLocale() {
  if (typeof document === "undefined") return "en";
  return document.documentElement.lang || window.navigator.language || "en";
}

export function CountrySelect({
  value,
  onChange,
  onCountryCodeChange,
  required = false,
  detecting = false,
  hint,
  variant = "compact",
  selectRef,
}: CountrySelectProps) {
  const hintId = useId();
  const [locale, setLocale] = useState("en");
  const options = useMemo(() => getCountryOptions(locale), [locale]);
  const normalizedValue = normalizeCountryName(value) ?? value.trim();
  const legacyValue =
    normalizedValue && !options.some((option) => option.value === normalizedValue)
      ? normalizedValue.slice(0, 80)
      : null;

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

  const large = variant === "settings";

  return (
    <label className="block min-w-0">
      <div
        className={
          large
            ? "mb-2 text-xs font-black uppercase tracking-[0.16em] text-zinc-500"
            : "mb-1.5 text-[11px] font-black uppercase tracking-[0.14em] text-zinc-500"
        }
      >
        Country
        {required && (
          <span className="ml-1 text-red-400" aria-hidden="true">
            *
          </span>
        )}
      </div>
      <select
        ref={selectRef}
        value={normalizedValue}
        onChange={(event) => {
          onChange(event.target.value);
          onCountryCodeChange?.(
            event.currentTarget.selectedOptions[0]?.dataset.countryCode ?? ""
          );
        }}
        required={required}
        autoComplete="country-name"
        aria-busy={detecting}
        aria-describedby={hint ? hintId : undefined}
        className={`${
          large ? "h-14 rounded-2xl" : "h-11 rounded-xl"
        } w-full min-w-0 border border-white/10 bg-black/35 px-4 text-sm font-bold text-white outline-none transition focus:border-red-700`}
      >
        <option value="" disabled className="bg-[#111]">
          {detecting ? "Detecting your country..." : "Select your country"}
        </option>
        {legacyValue && (
          <option value={legacyValue} className="bg-[#111]">
            {legacyValue}
          </option>
        )}
        {options.map((option) => (
          <option
            key={option.code}
            value={option.value}
            className="bg-[#111]"
            data-country-code={option.code}
            data-no-translate
          >
            {option.label}
          </option>
        ))}
      </select>
      {hint && (
        <p
          id={hintId}
          role="status"
          aria-live="polite"
          className="mt-1.5 text-xs leading-5 text-zinc-500"
        >
          {hint}
        </p>
      )}
    </label>
  );
}
