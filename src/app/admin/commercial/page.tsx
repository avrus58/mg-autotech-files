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
  buildCreditQuote,
  defaultCommerceSettings,
  emptyCustomerCommercialPolicy,
  type PriceAdjustmentType,
} from "@/lib/commercialPricing";

type SettingsForm = {
  defaultCustomCreditPriceEuro: string;
  adjustmentType: PriceAdjustmentType;
  adjustmentValue: string;
  promotionLabel: string;
  paymentMethods: { stripe: boolean; bank: boolean };
};

type StoredSettings = {
  default_custom_credit_price_eur: number;
  global_adjustment_type: PriceAdjustmentType;
  global_adjustment_value: number;
  promotion_label: string | null;
  payment_stripe_enabled: boolean;
  payment_bank_enabled: boolean;
  updated_at?: string;
};

type Feedback = { kind: "success" | "warning" | "error"; text: string } | null;

const paymentOptions = [
  { id: "stripe", label: "Stripe", description: "Primary automatic card checkout", icon: CreditCard },
  { id: "bank", label: "Bank transfer", description: "Manual SEPA verification", icon: Landmark },
] as const;

function settingsToForm(settings: StoredSettings): SettingsForm {
  return {
    defaultCustomCreditPriceEuro: String(settings.default_custom_credit_price_eur),
    adjustmentType: settings.global_adjustment_type,
    adjustmentValue: String(settings.global_adjustment_value),
    promotionLabel: settings.promotion_label || "",
    paymentMethods: {
      stripe: settings.payment_stripe_enabled,
      bank: settings.payment_bank_enabled,
    },
  };
}

function validateForm(form: SettingsForm) {
  const base = Number(form.defaultCustomCreditPriceEuro);
  const adjustment = Number(form.adjustmentValue || 0);
  if (!Number.isFinite(base) || base < 0.01 || base > 1000) {
    return "Custom-credit base price must be between EUR 0.01 and EUR 1,000.";
  }
  if (!Number.isFinite(adjustment)) return "Enter a valid adjustment value.";
  if (form.adjustmentType === "percentage" && Math.abs(adjustment) > 100) {
    return "Percentage adjustment must be between -100% and 100%.";
  }
  if (form.adjustmentType === "fixed" && Math.abs(adjustment) > 1000) {
    return "Fixed adjustment must be between EUR -1,000 and EUR 1,000.";
  }
  if (form.promotionLabel.trim().length > 180) {
    return "Promotion label cannot exceed 180 characters.";
  }
  return null;
}

function formatUnitAmount(value: number) {
  return new Intl.NumberFormat("en-IE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(value);
}

export default function CommercialSettingsPage() {
  const [form, setForm] = useState<SettingsForm | null>(null);
  const [savedForm, setSavedForm] = useState<SettingsForm | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
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
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || "Commercial settings could not be loaded.");
      }
      const settings = payload?.settings as StoredSettings | undefined;
      if (
        !settings ||
        typeof settings.default_custom_credit_price_eur !== "number" ||
        typeof settings.updated_at !== "string"
      ) {
        throw new Error("Commercial settings response could not be verified.");
      }
      const nextForm = settingsToForm(settings);
      setForm(nextForm);
      setSavedForm(nextForm);
      setUpdatedAt(settings.updated_at);
    } catch (error) {
      setForm(null);
      setSavedForm(null);
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
    if (!form || validateForm(form)) return null;
    const adjustmentValue = form.adjustmentType === "none"
      ? 0
      : Number(form.adjustmentValue || 0);
    return buildCreditQuote(
      {
        ...defaultCommerceSettings,
        default_custom_credit_price_eur: Number(form.defaultCustomCreditPriceEuro),
        global_adjustment_type: form.adjustmentType,
        global_adjustment_value: adjustmentValue,
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
    if (!form || validationError || !hasChanges) return;
    setSaving(true);
    setFeedback(null);
    try {
      const response = await authFetch("/api/admin/commercial-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          defaultCustomCreditPriceEuro: Number(form.defaultCustomCreditPriceEuro),
          adjustmentType: form.adjustmentType,
          adjustmentValue: form.adjustmentType === "none" ? 0 : Number(form.adjustmentValue || 0),
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
      if (!settings || typeof settings.updated_at !== "string") {
        throw new Error("Saved settings could not be verified.");
      }
      const canonicalForm = settingsToForm(settings);
      setForm(canonicalForm);
      setSavedForm(canonicalForm);
      setUpdatedAt(settings.updated_at);
      setFeedback(payload.auditRecorded === false
        ? {
          kind: "warning",
          text: "Pricing was saved, but the audit entry could not be confirmed. Review the audit service before another change.",
        }
        : { kind: "success", text: "Global pricing saved. New users and customers without a fixed override now inherit these values." });
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
    <main className="mg-compact-ui min-h-screen bg-[#050505] text-white">
      <header className="border-b border-white/10 bg-black/80">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link href="/admin" className="text-sm font-bold text-zinc-500 hover:text-white">
              <ArrowLeft className="mr-2 inline h-4 w-4" />Admin operations
            </Link>
            <h1 className="mt-3 text-3xl font-black">Commercial controls</h1>
            <p className="mt-2 text-sm text-zinc-500">One authoritative global tariff for every customer without an explicit override.</p>
          </div>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving || Boolean(validationError) || !hasChanges}
            className="inline-flex h-12 items-center justify-center rounded-lg bg-[#b1121b] px-5 text-sm font-black hover:bg-[#c91824] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save settings
          </button>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 lg:grid-cols-[1fr_380px]">
        <fieldset disabled={saving} className="min-w-0 space-y-6 disabled:opacity-80">
          <legend className="sr-only">Global commercial settings</legend>
          {(feedback || validationError) && (
            <div
              className={`rounded-lg border p-4 text-sm ${
                feedback?.kind === "success"
                  ? "border-emerald-800/50 bg-emerald-950/20 text-emerald-100"
                  : feedback?.kind === "warning"
                    ? "border-amber-700/50 bg-amber-950/20 text-amber-100"
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

          <section className="rounded-lg border border-white/10 bg-white/[0.025] p-5">
            <div className="flex items-center gap-3">
              <BadgeEuro className="h-6 w-6 text-red-400" />
              <div>
                <h2 className="text-xl font-black">Global credit price</h2>
                <p className="mt-1 text-sm text-zinc-500">Positive adjustments reduce the rate; negative values add a surcharge.</p>
              </div>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              <Field
                label="Custom-credit base price"
                value={form.defaultCustomCreditPriceEuro}
                onChange={(value) => updateForm((current) => ({ ...current, defaultCustomCreditPriceEuro: value }))}
                suffix="EUR"
                min={0.01}
                max={1000}
                step={0.0001}
              />
              <label className="text-xs font-black uppercase text-zinc-500">
                Adjustment type
                <select
                  value={form.adjustmentType}
                  onChange={(event) => updateForm((current) => ({
                    ...current,
                    adjustmentType: event.target.value as PriceAdjustmentType,
                    adjustmentValue: event.target.value === "none" ? "0" : current.adjustmentValue,
                  }))}
                  className="mt-2 h-12 w-full rounded-lg border border-white/10 bg-black/50 px-3 text-sm normal-case text-white"
                >
                  <option value="none">None</option>
                  <option value="percentage">Percentage per credit</option>
                  <option value="fixed">Fixed EUR per credit</option>
                </select>
              </label>
              <Field
                label="Adjustment value"
                value={form.adjustmentValue}
                onChange={(value) => updateForm((current) => ({ ...current, adjustmentValue: value }))}
                suffix={form.adjustmentType === "percentage" ? "%" : "EUR"}
                min={form.adjustmentType === "percentage" ? -100 : -1000}
                max={form.adjustmentType === "percentage" ? 100 : 1000}
                step={form.adjustmentType === "percentage" ? 0.01 : 0.0001}
                disabled={form.adjustmentType === "none"}
              />
            </div>
            <label className="mt-4 block text-xs font-black uppercase text-zinc-500">
              Customer-facing promotion label
              <input
                value={form.promotionLabel}
                maxLength={180}
                onChange={(event) => updateForm((current) => ({ ...current, promotionLabel: event.target.value }))}
                className="mt-2 h-12 w-full rounded-lg border border-white/10 bg-black/50 px-4 text-sm normal-case text-white"
                placeholder="Optional"
              />
            </label>
          </section>

          <section className="rounded-lg border border-white/10 bg-white/[0.025] p-5">
            <h2 className="text-xl font-black">Global payment methods</h2>
            <p className="mt-1 text-sm text-zinc-500">Customer-specific settings can inherit or override each method.</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
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
                    className={`flex items-center gap-4 rounded-lg border p-4 text-left ${active ? "border-emerald-700/50 bg-emerald-950/15" : "border-white/10 bg-black/25 opacity-60"}`}
                  >
                    <Icon className={active ? "h-6 w-6 text-emerald-400" : "h-6 w-6 text-zinc-600"} />
                    <div>
                      <div className="font-black">{option.label}</div>
                      <div className="mt-1 text-xs text-zinc-500">{option.description}</div>
                    </div>
                    <span className="ml-auto text-xs font-black">{active ? "ON" : "OFF"}</span>
                  </button>
                );
              })}
            </div>
          </section>
        </fieldset>

        <aside className="h-fit rounded-lg border border-red-900/50 bg-red-950/10 p-5 lg:sticky lg:top-6">
          <div className="text-xs font-black uppercase tracking-[0.18em] text-red-400">Unsaved live preview</div>
          <div className="mt-3 text-5xl font-black tabular-nums">
            {preview ? `EUR ${formatUnitAmount(preview.customUnitPriceEuro)}` : "—"}
          </div>
          <div className="mt-1 text-sm text-zinc-500">per custom credit for inherited customers</div>
          {preview && (
            <div className="mt-6 space-y-2 border-t border-white/10 pt-5">
              {preview.packages.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate text-zinc-400">{item.credits} credits</span>
                  <span className="font-black tabular-nums">EUR {item.priceEuro.toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
          <div className="mt-6 border-t border-white/10 pt-5 text-sm leading-6 text-zinc-400">
            Package rates and custom credits use this global rule for new users and every customer without a price override. A customer fixed price remains exact and is not changed by this adjustment.
          </div>
          <div className="mt-4 text-xs font-bold text-zinc-600">
            {hasChanges ? "Preview has unsaved changes." : "Preview matches the saved global tariff."}
          </div>
        </aside>
      </div>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  suffix,
  min,
  max,
  step,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  suffix: string;
  min: number;
  max: number;
  step: number;
  disabled?: boolean;
}) {
  return (
    <label className="text-xs font-black uppercase text-zinc-500">
      {label}
      <div className="mt-2 flex h-12 overflow-hidden rounded-lg border border-white/10 bg-black/50">
        <input
          type="number"
          inputMode="decimal"
          step={step}
          min={min}
          max={max}
          disabled={disabled}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="min-w-0 flex-1 bg-transparent px-3 text-sm normal-case tabular-nums text-white outline-none disabled:cursor-not-allowed disabled:opacity-50"
        />
        <span className="flex min-w-14 items-center justify-center border-l border-white/10 px-3 text-xs text-zinc-500">{suffix}</span>
      </div>
    </label>
  );
}
