"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, BadgeEuro, CreditCard, Landmark, Loader2, Save, ShieldCheck, WalletCards } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

type AdjustmentType = "none" | "percentage" | "fixed";
type SettingsForm = {
  defaultCustomCreditPriceEuro: string;
  adjustmentType: AdjustmentType;
  adjustmentValue: string;
  promotionLabel: string;
  paymentMethods: { sumup: boolean; paypal: boolean; bank: boolean; stripe: boolean };
};

const paymentOptions = [
  { id: "sumup", label: "SumUp", description: "Automatic card and mobile checkout", icon: WalletCards },
  { id: "paypal", label: "PayPal", description: "Automatic PayPal checkout", icon: ShieldCheck },
  { id: "bank", label: "Bank transfer", description: "Manual SEPA verification", icon: Landmark },
  { id: "stripe", label: "Stripe", description: "Automatic card checkout", icon: CreditCard },
] as const;

export default function CommercialSettingsPage() {
  const [form, setForm] = useState<SettingsForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const authFetch = useCallback(async (url: string, init?: RequestInit) => {
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;
    if (!token) throw new Error("Unauthorized");
    return fetch(url, { ...init, headers: { ...init?.headers, Authorization: `Bearer ${token}` } });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await authFetch("/api/admin/commercial-settings");
      const payload = await response.json();
      if (response.status === 401) { window.location.href = "/login?redirect=/admin/commercial"; return; }
      if (!response.ok) throw new Error(payload.error || "Commercial settings could not be loaded.");
      const settings = payload.settings;
      setForm({
        defaultCustomCreditPriceEuro: String(settings.default_custom_credit_price_eur),
        adjustmentType: settings.global_adjustment_type,
        adjustmentValue: String(settings.global_adjustment_value),
        promotionLabel: settings.promotion_label || "",
        paymentMethods: {
          sumup: settings.payment_sumup_enabled,
          paypal: settings.payment_paypal_enabled,
          bank: settings.payment_bank_enabled,
          stripe: settings.payment_stripe_enabled,
        },
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Commercial settings could not be loaded.");
    } finally { setLoading(false); }
  }, [authFetch]);

  useEffect(() => { const timeout = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timeout); }, [load]);

  const previewUnit = useMemo(() => {
    if (!form) return 0;
    const base = Number(form.defaultCustomCreditPriceEuro || 0);
    const value = Number(form.adjustmentValue || 0);
    if (form.adjustmentType === "percentage") return Math.max(0.01, base * (1 - value / 100));
    if (form.adjustmentType === "fixed") return Math.max(0.01, base - value);
    return base;
  }, [form]);

  async function save() {
    if (!form) return;
    setSaving(true);
    setMessage("");
    try {
      const response = await authFetch("/api/admin/commercial-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          defaultCustomCreditPriceEuro: Number(form.defaultCustomCreditPriceEuro),
          adjustmentType: form.adjustmentType,
          adjustmentValue: Number(form.adjustmentValue || 0),
          promotionLabel: form.promotionLabel.trim() || null,
          paymentMethods: form.paymentMethods,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Commercial settings could not be saved.");
      setMessage("Global credit pricing and payment availability were updated.");
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Commercial settings could not be saved."); }
    finally { setSaving(false); }
  }

  if (loading) return <main className="flex min-h-screen items-center justify-center bg-[#050505] text-white"><Loader2 className="mr-3 h-5 w-5 animate-spin text-red-500" />Loading commercial controls...</main>;
  if (!form) return <main className="min-h-screen bg-[#050505] p-8 text-white"><Link href="/admin">Back</Link><div className="mt-8 text-red-300">{message}</div></main>;

  return <main className="min-h-screen bg-[#050505] text-white">
    <header className="border-b border-white/10 bg-black/80"><div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-5 sm:flex-row sm:items-center sm:justify-between"><div><Link href="/admin" className="text-sm font-bold text-zinc-500 hover:text-white"><ArrowLeft className="mr-2 inline h-4 w-4" />Admin operations</Link><h1 className="mt-3 text-3xl font-black">Commercial controls</h1><p className="mt-2 text-sm text-zinc-500">Global credit pricing, promotions and payment availability.</p></div><button onClick={() => void save()} disabled={saving} className="inline-flex h-12 items-center justify-center rounded-lg bg-[#b1121b] px-5 text-sm font-black hover:bg-[#c91824] disabled:opacity-50">{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Save settings</button></div></header>
    <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 lg:grid-cols-[1fr_360px]">
      <div className="space-y-6">
        {message && <div className="rounded-lg border border-red-800/40 bg-red-950/20 p-4 text-sm text-red-100">{message}</div>}
        <section className="rounded-lg border border-white/10 bg-white/[0.025] p-5"><div className="flex items-center gap-3"><BadgeEuro className="h-6 w-6 text-red-400" /><div><h2 className="text-xl font-black">Global credit price</h2><p className="mt-1 text-sm text-zinc-500">Positive adjustments reduce the price. Negative values create a surcharge.</p></div></div><div className="mt-5 grid gap-4 sm:grid-cols-3"><Field label="Custom-credit base price" value={form.defaultCustomCreditPriceEuro} onChange={(value) => setForm({ ...form, defaultCustomCreditPriceEuro: value })} suffix="EUR" /><label className="text-xs font-black uppercase text-zinc-500">Adjustment type<select value={form.adjustmentType} onChange={(event) => setForm({ ...form, adjustmentType: event.target.value as AdjustmentType })} className="mt-2 h-12 w-full rounded-lg border border-white/10 bg-black/50 px-3 text-sm normal-case text-white"><option value="none">None</option><option value="percentage">Percentage per credit</option><option value="fixed">Fixed EUR per credit</option></select></label><Field label="Adjustment value" value={form.adjustmentValue} onChange={(value) => setForm({ ...form, adjustmentValue: value })} suffix={form.adjustmentType === "percentage" ? "%" : "EUR"} /></div><label className="mt-4 block text-xs font-black uppercase text-zinc-500">Customer-facing promotion label<input value={form.promotionLabel} onChange={(event) => setForm({ ...form, promotionLabel: event.target.value })} className="mt-2 h-12 w-full rounded-lg border border-white/10 bg-black/50 px-4 text-sm normal-case text-white" placeholder="Optional" /></label></section>
        <section className="rounded-lg border border-white/10 bg-white/[0.025] p-5"><h2 className="text-xl font-black">Global payment methods</h2><p className="mt-1 text-sm text-zinc-500">Customer-specific settings can inherit or override each method.</p><div className="mt-5 grid gap-3 sm:grid-cols-2">{paymentOptions.map((option) => { const Icon = option.icon; const active = form.paymentMethods[option.id]; return <button key={option.id} type="button" onClick={() => setForm({ ...form, paymentMethods: { ...form.paymentMethods, [option.id]: !active } })} className={`flex items-center gap-4 rounded-lg border p-4 text-left ${active ? "border-emerald-700/50 bg-emerald-950/15" : "border-white/10 bg-black/25 opacity-60"}`}><Icon className={active ? "h-6 w-6 text-emerald-400" : "h-6 w-6 text-zinc-600"} /><div><div className="font-black">{option.label}</div><div className="mt-1 text-xs text-zinc-500">{option.description}</div></div><span className="ml-auto text-xs font-black">{active ? "ON" : "OFF"}</span></button>; })}</div></section>
      </div>
      <aside className="h-fit rounded-lg border border-red-900/50 bg-red-950/10 p-5 lg:sticky lg:top-6"><div className="text-xs font-black uppercase tracking-[0.18em] text-red-400">Live preview</div><div className="mt-3 text-5xl font-black">EUR {previewUnit.toFixed(2)}</div><div className="mt-1 text-sm text-zinc-500">per custom credit before customer-specific overrides</div><div className="mt-6 border-t border-white/10 pt-5 text-sm leading-6 text-zinc-400">Package volume prices use their own catalog base rate, then this global adjustment. A customer base-price override replaces the global result; the customer adjustment is applied last.</div></aside>
    </div>
  </main>;
}

function Field({ label, value, onChange, suffix }: { label: string; value: string; onChange: (value: string) => void; suffix: string }) {
  return <label className="text-xs font-black uppercase text-zinc-500">{label}<div className="mt-2 flex h-12 overflow-hidden rounded-lg border border-white/10 bg-black/50"><input type="number" step="0.01" value={value} onChange={(event) => onChange(event.target.value)} className="min-w-0 flex-1 bg-transparent px-3 text-sm normal-case text-white outline-none" /><span className="flex items-center border-l border-white/10 px-3 text-xs text-zinc-500">{suffix}</span></div></label>;
}
