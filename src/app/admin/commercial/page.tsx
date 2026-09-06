"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  BadgeEuro,
  CheckCircle2,
  CreditCard,
  Landmark,
  Loader2,
  RefreshCw,
  Save,
} from "lucide-react";
import { authenticatedFetch } from "@/lib/authGuards";
import {
  creditPackages,
  MAX_CREDIT_PACKAGE_TOTAL_EURO,
  MAX_CUSTOM_CREDIT_UNIT_PRICE_EURO,
  minimumCreditPackageTotalEuro,
  type CreditPackageId,
  type CreditPackagePriceMap,
} from "@/lib/creditPackages";
import {
  buildCreditQuote,
  defaultCommerceSettings,
  emptyCustomerCommercialPolicy,
} from "@/lib/commercialPricing";

type PackagePriceForm = Record<CreditPackageId, string>;

type SettingsForm = {
  packagePricesEuro: PackagePriceForm;
  customUnitPriceEuro: string;
  promotionLabel: string;
  paymentMethods: { stripe: boolean; bank: boolean };
};

type StoredSettings = {
  pricing_model_version: 2;
  explicit_pricing_writes_enabled: boolean;
  explicit_pricing_bridge_release: string | null;
  package_prices_eur: CreditPackagePriceMap;
  custom_credit_unit_price_eur: number;
  promotion_label: string | null;
  payment_stripe_enabled: boolean;
  payment_bank_enabled: boolean;
  updated_at?: string;
};

type Feedback = { kind: "success" | "error"; text: string } | null;

const paymentOptions = [
  { id: "stripe", label: "Stripe", description: "Primary automatic card checkout", icon: CreditCard },
  { id: "bank", label: "Bank transfer", description: "Manual SEPA verification", icon: Landmark },
] as const;

function settingsToForm(settings: StoredSettings): SettingsForm {
  return {
    packagePricesEuro: Object.fromEntries(
      creditPackages.map((item) => [
        item.id,
        String(settings.package_prices_eur[item.id]),
      ]),
    ) as PackagePriceForm,
    customUnitPriceEuro: String(settings.custom_credit_unit_price_eur),
    promotionLabel: settings.promotion_label || "",
    paymentMethods: {
      stripe: settings.payment_stripe_enabled,
      bank: settings.payment_bank_enabled,
    },
  };
}

function parsePackagePrices(form: SettingsForm): CreditPackagePriceMap | null {
  const entries = creditPackages.map((item) => {
    const value = parsePackagePrice(form.packagePricesEuro[item.id], item.credits);
    return value == null ? null : [item.id, value] as const;
  });
  if (entries.some((entry) => entry == null)) return null;
  return Object.fromEntries(
    entries as Array<readonly [CreditPackageId, number]>,
  ) as CreditPackagePriceMap;
}

function parsePackagePrice(rawValue: string, credits: number) {
  const raw = rawValue.trim();
  const value = raw === "" ? Number.NaN : Number(raw);
  if (
    !Number.isFinite(value) ||
    value < minimumCreditPackageTotalEuro(credits) ||
    value > MAX_CREDIT_PACKAGE_TOTAL_EURO ||
    Math.abs(value * 100 - Math.round(value * 100)) > 0.000001
  ) {
    return null;
  }
  return Math.round(value * 100) / 100;
}

function parseCustomUnitPrice(form: SettingsForm) {
  const raw = form.customUnitPriceEuro.trim();
  const value = raw === "" ? Number.NaN : Number(raw);
  if (
    !Number.isFinite(value) ||
    value < 0.01 ||
    value > MAX_CUSTOM_CREDIT_UNIT_PRICE_EURO ||
    Math.abs(value * 10_000 - Math.round(value * 10_000)) > 0.000001
  ) {
    return null;
  }
  return Math.round(value * 10_000) / 10_000;
}

function validateForm(form: SettingsForm) {
  if (!parsePackagePrices(form)) {
    return "Every package needs a final EUR total of at least EUR 0.01 per credit, with at most 2 decimals.";
  }
  if (parseCustomUnitPrice(form) == null) {
    return "The custom-credit price must be between EUR 0.01 and EUR 4,000, with at most 4 decimals.";
  }
  if (form.promotionLabel.trim().length > 180) {
    return "Promotion label cannot exceed 180 characters.";
  }
  return null;
}

function formatEuro(value: number, maximumFractionDigits = 2) {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits,
  }).format(value);
}

export default function CommercialSettingsPage() {
  const [form, setForm] = useState<SettingsForm | null>(null);
  const [savedForm, setSavedForm] = useState<SettingsForm | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [writesEnabled, setWritesEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  const authFetch = useCallback(
    (url: string, init?: RequestInit) => authenticatedFetch(url, init),
    [],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setFeedback(null);
    try {
      const response = await authFetch("/api/admin/commercial-settings", {
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || "Commercial settings could not be loaded.");
      }
      const settings = payload?.settings as StoredSettings | undefined;
      if (
        !settings ||
        settings.pricing_model_version !== 2 ||
        !settings.package_prices_eur ||
        typeof settings.explicit_pricing_writes_enabled !== "boolean" ||
        typeof settings.custom_credit_unit_price_eur !== "number" ||
        typeof settings.updated_at !== "string"
      ) {
        throw new Error("Commercial settings response could not be verified.");
      }
      const nextForm = settingsToForm(settings);
      setForm(nextForm);
      setSavedForm(nextForm);
      setUpdatedAt(settings.updated_at);
      setWritesEnabled(settings.explicit_pricing_writes_enabled);
    } catch (error) {
      setForm(null);
      setSavedForm(null);
      setWritesEnabled(false);
      setFeedback({
        kind: "error",
        text: error instanceof Error ? error.message : "Commercial settings could not be loaded.",
      });
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timeout);
  }, [load]);

  const validationError = useMemo(() => form ? validateForm(form) : null, [form]);
  const hasChanges = Boolean(form && savedForm && JSON.stringify(form) !== JSON.stringify(savedForm));

  const preview = useMemo(() => {
    if (!form) return null;
    const packagePrices = parsePackagePrices(form);
    const customUnitPrice = parseCustomUnitPrice(form);
    if (!packagePrices || customUnitPrice == null || validateForm(form)) return null;

    return buildCreditQuote(
      {
        ...defaultCommerceSettings,
        package_prices_eur: packagePrices,
        custom_credit_unit_price_eur: customUnitPrice,
        promotion_label: form.promotionLabel.trim() || null,
        payment_stripe_enabled: form.paymentMethods.stripe,
        payment_bank_enabled: form.paymentMethods.bank,
      },
      emptyCustomerCommercialPolicy("global-preview"),
    );
  }, [form]);

  function updateForm(updater: (current: SettingsForm) => SettingsForm) {
    setForm((current) => current ? updater(current) : current);
    setFeedback(null);
  }

  async function save() {
    if (!form || validationError || !hasChanges || !updatedAt || !writesEnabled) return;
    const packagePrices = parsePackagePrices(form);
    const customUnitPrice = parseCustomUnitPrice(form);
    if (!packagePrices || customUnitPrice == null) return;

    setSaving(true);
    setFeedback(null);
    try {
      const response = await authFetch("/api/admin/commercial-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          packagePricesEuro: packagePrices,
          customUnitPriceEuro: customUnitPrice,
          promotionLabel: form.promotionLabel.trim() || null,
          paymentMethods: form.paymentMethods,
          expectedUpdatedAt: updatedAt,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        if (response.status === 409) {
          throw new Error("These prices changed in another session. Reload before saving so nobody's update is overwritten.");
        }
        throw new Error(payload?.error || "Commercial settings could not be saved.");
      }
      const settings = payload?.settings as StoredSettings | undefined;
      if (
        !settings ||
        settings.pricing_model_version !== 2 ||
        typeof settings.explicit_pricing_writes_enabled !== "boolean" ||
        typeof settings.updated_at !== "string"
      ) {
        throw new Error("Saved settings could not be verified.");
      }
      const canonicalForm = settingsToForm(settings);
      setForm(canonicalForm);
      setSavedForm(canonicalForm);
      setUpdatedAt(settings.updated_at);
      setWritesEnabled(settings.explicit_pricing_writes_enabled);
      setFeedback({
        kind: "success",
        text: "Global package totals and custom-credit price saved atomically.",
      });
    } catch (error) {
      setFeedback({
        kind: "error",
        text: error instanceof Error ? error.message : "Commercial settings could not be saved.",
      });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#050505] text-white" role="status">
        <Loader2 className="mr-3 h-5 w-5 animate-spin text-red-500" />
        Loading commercial controls...
      </main>
    );
  }

  if (!form) {
    return (
      <main className="min-h-screen bg-[#050505] p-6 text-white sm:p-8">
        <Link href="/admin" className="font-bold text-zinc-400 hover:text-white">← Admin operations</Link>
        <div className="mt-8 max-w-xl rounded-xl border border-red-800/60 bg-red-950/20 p-5" role="alert">
          <div className="font-black text-red-100">Commercial controls are unavailable</div>
          <p className="mt-2 text-sm text-red-200">{feedback?.text}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-4 inline-flex min-h-11 items-center rounded-lg border border-red-700 px-4 text-sm font-black hover:bg-red-950/40"
          >
            <RefreshCw className="mr-2 h-4 w-4" />Retry current settings
          </button>
        </div>
      </main>
    );
  }

  return (
    <main data-admin-mobile-save-space className="mg-compact-ui min-h-screen bg-[#050505] text-white">
      <header className="border-b border-white/10 bg-black/80">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link href="/admin" className="text-sm font-bold text-zinc-500 hover:text-white">
              <ArrowLeft className="mr-2 inline h-4 w-4" />Admin operations
            </Link>
            <h1 className="mt-2 text-2xl font-black sm:text-3xl">Commercial controls</h1>
            <p className="mt-1 text-sm text-zinc-500">
              Enter final package totals and the separate custom-credit unit price.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving || Boolean(validationError) || !hasChanges || !writesEnabled}
            className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[#b1121b] px-5 text-sm font-black hover:bg-[#c91824] disabled:cursor-not-allowed disabled:opacity-50 lg:h-10 lg:min-h-0"
          >
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save final prices
          </button>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-5 px-4 py-5 xl:grid-cols-[minmax(0,1fr)_300px]">
        <fieldset disabled={saving} className="min-w-0 space-y-4 disabled:opacity-80">
          <legend className="sr-only">Global commercial settings</legend>
          {!writesEnabled && (
            <div className="rounded-lg border border-amber-700/50 bg-amber-950/20 p-3 text-sm text-amber-100" role="status">
              <div className="font-black">Saving prices is temporarily locked</div>
              <p className="mt-1 leading-6 text-amber-100/80">
                Current prices remain readable and payable. Saving unlocks only after the verified v2 rollback bridge is recorded during release.
              </p>
            </div>
          )}
          {(feedback || validationError) && (
            <div
              className={`rounded-lg border p-3 text-sm ${
                feedback?.kind === "success"
                  ? "border-emerald-800/50 bg-emerald-950/20 text-emerald-100"
                  : "border-red-800/50 bg-red-950/20 text-red-100"
              }`}
              role={feedback?.kind === "success" ? "status" : "alert"}
            >
              <div className="flex items-start gap-2">
                {feedback?.kind === "success"
                  ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                  : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
                <span>{validationError || feedback?.text}</span>
              </div>
              {feedback?.kind === "error" && feedback.text.includes("another session") && (
                <button type="button" onClick={() => void load()} className="mt-3 inline-flex min-h-10 items-center rounded-lg border border-red-700 px-3 font-black">
                  <RefreshCw className="mr-2 h-4 w-4" />Reload current values
                </button>
              )}
            </div>
          )}

          <section className="rounded-xl border border-white/10 bg-white/[0.025] p-4">
            <div className="flex items-center gap-3">
              <BadgeEuro className="h-5 w-5 text-red-400" />
              <div>
                <h2 className="text-lg font-black">Final credit prices</h2>
                <p className="mt-0.5 text-xs text-zinc-500">
                  Package fields are total prices. Custom credit is priced per credit.
                </p>
              </div>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
              {creditPackages.map((item) => (
                <PriceField
                  key={item.id}
                  label={`${item.credits} credits`}
                  help="Final total"
                  value={form.packagePricesEuro[item.id]}
                  onChange={(value) => updateForm((current) => ({
                    ...current,
                    packagePricesEuro: {
                      ...current.packagePricesEuro,
                      [item.id]: value,
                    },
                  }))}
                  suffix="EUR"
                  max={MAX_CREDIT_PACKAGE_TOTAL_EURO}
                  min={minimumCreditPackageTotalEuro(item.credits)}
                  step={0.01}
                  invalid={parsePackagePrice(form.packagePricesEuro[item.id], item.credits) == null}
                />
              ))}
              <PriceField
                label="Custom amount"
                help="Per credit"
                value={form.customUnitPriceEuro}
                onChange={(value) => updateForm((current) => ({
                  ...current,
                  customUnitPriceEuro: value,
                }))}
                suffix="EUR"
                max={MAX_CUSTOM_CREDIT_UNIT_PRICE_EURO}
                min={0.01}
                step={0.0001}
                invalid={parseCustomUnitPrice(form) == null}
              />
            </div>
            <label className="mt-4 block text-xs font-black uppercase text-zinc-500">
              Customer-facing promotion label
              <input
                value={form.promotionLabel}
                maxLength={180}
                onChange={(event) => updateForm((current) => ({ ...current, promotionLabel: event.target.value }))}
                className="mt-2 min-h-11 w-full rounded-lg border border-white/10 bg-black/50 px-3 text-sm normal-case text-white lg:h-10 lg:min-h-0"
                placeholder="Optional"
              />
            </label>
          </section>

          <section className="rounded-xl border border-white/10 bg-white/[0.025] p-4">
            <h2 className="text-lg font-black">Global payment methods</h2>
            <p className="mt-0.5 text-xs text-zinc-500">Customer accounts can inherit or override each method.</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {paymentOptions.map((option) => {
                const Icon = option.icon;
                const active = form.paymentMethods[option.id];
                return (
                  <button
                    key={option.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => updateForm((current) => ({
                      ...current,
                      paymentMethods: { ...current.paymentMethods, [option.id]: !active },
                    }))}
                    className={`flex min-h-11 items-center gap-3 rounded-lg border px-3 py-2 text-left ${
                      active
                        ? "border-emerald-700/50 bg-emerald-950/15"
                        : "border-white/10 bg-black/25 opacity-60"
                    }`}
                  >
                    <Icon className={active ? "h-5 w-5 text-emerald-400" : "h-5 w-5 text-zinc-600"} />
                    <div>
                      <div className="text-sm font-black">{option.label}</div>
                      <div className="text-xs text-zinc-500">{option.description}</div>
                    </div>
                    <span className="ml-auto text-xs font-black">{active ? "ON" : "OFF"}</span>
                  </button>
                );
              })}
            </div>
          </section>
        </fieldset>

        <aside className="h-fit rounded-xl border border-red-900/50 bg-red-950/10 p-4 xl:sticky xl:top-5">
          <div className="text-xs font-black uppercase tracking-[0.16em] text-red-400">Unsaved preview</div>
          <div className="mt-3 space-y-2">
            {preview?.packages.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-sm">
                <span className="text-zinc-400">{item.credits} credits</span>
                <span className="font-black tabular-nums">{formatEuro(item.priceEuro)}</span>
              </div>
            ))}
            <div className="flex items-center justify-between gap-3 rounded-lg border border-red-900/40 bg-red-950/20 px-3 py-2 text-sm">
              <span className="text-zinc-400">Custom / credit</span>
              <span className="font-black tabular-nums">
                {preview ? formatEuro(preview.customUnitPriceEuro, 4) : "—"}
              </span>
            </div>
          </div>
          <p className="mt-4 text-xs leading-5 text-zinc-500">
            These are final payable prices for new customers and every account whose matching field is set to inherit.
          </p>
          <div className="mt-3 text-xs font-bold text-zinc-600">
            {hasChanges ? "Preview has unsaved changes." : "Preview matches saved prices."}
          </div>
        </aside>
      </div>
      <div className="admin-mobile-savebar">
        <span role="status">{hasChanges ? "Unsaved prices" : "Prices up to date"}</span>
        <button type="button" onClick={() => void save()} disabled={saving || Boolean(validationError) || !hasChanges || !writesEnabled}>
          {saving ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <Save size={18} aria-hidden="true" />}
          {saving ? "Saving…" : "Save final prices"}
        </button>
      </div>
    </main>
  );
}

function PriceField({
  label,
  help,
  value,
  onChange,
  suffix,
  max,
  min,
  step,
  invalid,
}: {
  label: string;
  help: string;
  value: string;
  onChange: (value: string) => void;
  suffix: string;
  max: number;
  min: number;
  step: number;
  invalid: boolean;
}) {
  return (
    <label className={`rounded-lg border bg-black/25 p-3 text-xs font-black uppercase transition focus-within:ring-2 focus-within:ring-red-700/70 ${invalid ? "border-red-600/80" : "border-white/10"}`}>
      <span className="flex items-center justify-between gap-2">
        <span>{label}</span>
        <span className="text-[10px] font-bold normal-case text-zinc-400">{help}</span>
      </span>
      <div className="mt-2 flex min-h-11 overflow-hidden rounded-lg border border-white/10 bg-black/60 lg:h-10 lg:min-h-0">
        <input
          type="number"
          inputMode="decimal"
          step={step}
          min={min}
          max={max}
          value={value}
          aria-invalid={invalid}
          onChange={(event) => onChange(event.target.value)}
          className="min-w-0 flex-1 bg-transparent px-3 text-sm font-black normal-case tabular-nums text-white outline-none"
        />
        <span className="flex min-w-12 items-center justify-center border-l border-white/10 px-2 text-[10px] text-zinc-500">{suffix}</span>
      </div>
    </label>
  );
}
