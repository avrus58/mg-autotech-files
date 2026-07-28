"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  BadgeEuro,
  CheckCircle2,
  Clock3,
  CreditCard,
  ExternalLink,
  Landmark,
  Loader2,
  RefreshCcw,
  RotateCcw,
  Search,
  ShieldCheck,
} from "lucide-react";
import { authenticatedFetch } from "@/lib/authGuards";

type Provider = "stripe" | "paypal" | "bank";
type Customer = {
  id: string;
  email: string | null;
  customer_id: string | null;
  full_name: string | null;
  company_name: string | null;
  credit_balance: number | null;
};
type PaymentRecord = {
  id: string;
  provider: Provider;
  external_id: string;
  provider_payment_id: string | null;
  status: string;
  payment_type: string;
  credits: number;
  amount_total: number | null;
  currency: string;
  customer_email: string | null;
  package_id: string | null;
  purchase_type: string | null;
  failure_message: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  created_at: string;
  creditMatched: boolean;
  customer: Customer | null;
};
type LedgerEntry = {
  id: string;
  user_id: string | null;
  type: string;
  source_type: string | null;
  source_id: string | null;
  credits_delta: number;
  balance_after: number;
  description: string | null;
  amount_total: number | null;
  currency: string | null;
  created_at: string;
};
type PaymentEvent = {
  id: string;
  payment_record_id: string | null;
  provider: Provider;
  event_type: string;
  status: string;
  message: string | null;
  created_at: string;
};
type BankForm = {
  customerUserId: string;
  reference: string;
  credits: string;
  amountEuro: string;
  note: string;
};
type Payload = {
  migrationReady: boolean;
  records: PaymentRecord[];
  ledger: LedgerEntry[];
  events: PaymentEvent[];
  customers: Customer[];
  metrics: {
    grossCents: number;
    refundedCents: number;
    netCents: number;
    creditsIssued: number;
    completedPayments: number;
    unresolved: number;
    pending: number;
  };
  providers: Array<{
    provider: Provider;
    total: number;
    succeeded: number;
    failed: number;
    pending: number;
    revenueCents: number;
  }>;
};

const PAGE_SIZE = 20;
const BANK_PAYMENT_LIMITS = {
  referenceMin: 3,
  referenceMax: 160,
  creditsMax: 100000,
  amountEuroMax: 1000000,
  noteMax: 1000,
} as const;
const emptyBankForm: BankForm = { customerUserId: "", reference: "", credits: "", amountEuro: "", note: "" };
const providerMeta = {
  stripe: { label: "Stripe", icon: CreditCard },
  paypal: { label: "Legacy", icon: Clock3 },
  bank: { label: "Bank", icon: Landmark },
} as const;

function money(cents: number | null | undefined, currency = "eur") {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: String(currency || "eur").toUpperCase(),
  }).format(Number(cents || 0) / 100);
}

function dateTime(value: string) {
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function parseFormNumber(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getBankPaymentValidation(bankForm: BankForm, customers: Customer[]) {
  const errors: string[] = [];
  const referenceLength = bankForm.reference.trim().length;
  const credits = parseFormNumber(bankForm.credits);
  const amountEuro = parseFormNumber(bankForm.amountEuro);
  const customerExists = customers.some((customer) => customer.id === bankForm.customerUserId);

  if (!bankForm.customerUserId) {
    errors.push("Select a customer from the loaded customer list.");
  } else if (!isUuid(bankForm.customerUserId) || !customerExists) {
    errors.push("Select a valid customer from the loaded customer list.");
  }
  if (referenceLength < BANK_PAYMENT_LIMITS.referenceMin || referenceLength > BANK_PAYMENT_LIMITS.referenceMax) {
    errors.push("Bank reference must be 3-160 characters.");
  }
  if (credits === null || credits <= 0 || credits > BANK_PAYMENT_LIMITS.creditsMax) {
    errors.push("Credits must be greater than 0 and no more than 100000.");
  }
  if (amountEuro === null || amountEuro <= 0 || amountEuro > BANK_PAYMENT_LIMITS.amountEuroMax) {
    errors.push("Amount EUR must be greater than 0 and no more than 1000000.");
  }
  if (bankForm.note.length > BANK_PAYMENT_LIMITS.noteMax) {
    errors.push("Internal note must be 1000 characters or fewer.");
  }

  return {
    errors,
    isValid: errors.length === 0,
    noteRemaining: BANK_PAYMENT_LIMITS.noteMax - bankForm.note.length,
  };
}

function StatusBadge({ status }: { status: string }) {
  const style = status === "succeeded"
    ? "border-emerald-700/40 bg-emerald-950/25 text-emerald-300"
    : status === "refunded"
      ? "border-blue-700/40 bg-blue-950/25 text-blue-300"
      : status === "pending"
        ? "border-amber-700/40 bg-amber-950/25 text-amber-300"
        : "border-red-800/40 bg-red-950/25 text-red-300";
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-black capitalize ${style}`}>{status.replaceAll("_", " ")}</span>;
}

export default function PaymentControlPage() {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [provider, setProvider] = useState<"all" | Provider>("all");
  const [status, setStatus] = useState("all");
  const [view, setView] = useState<"payments" | "ledger" | "events">("payments");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<PaymentRecord | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [bankForm, setBankForm] = useState<BankForm>(emptyBankForm);

  const authFetch = useCallback(
    (init?: RequestInit) => authenticatedFetch("/api/admin/payments", { ...init, cache: "no-store" }),
    [],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await authFetch();
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Payment data could not be loaded.");
      setData(payload);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Payment data could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timeout);
  }, [load]);

  const filteredRecords = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (data?.records ?? []).filter((record) => {
      if (provider !== "all" && record.provider !== provider) return false;
      if (status !== "all" && record.status !== status) return false;
      if (!term) return true;
      return [
        record.external_id,
        record.provider_payment_id,
        record.customer_email,
        record.customer?.customer_id,
        record.customer?.full_name,
        record.customer?.company_name,
      ].some((value) => String(value || "").toLowerCase().includes(term));
    });
  }, [data, provider, search, status]);
  const pageCount = Math.max(1, Math.ceil(filteredRecords.length / PAGE_SIZE));
  const visibleRecords = filteredRecords.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const bankFormValidation = useMemo(
    () => getBankPaymentValidation(bankForm, data?.customers ?? []),
    [bankForm, data?.customers]
  );
  const canRecordBankPayment = Boolean(data?.migrationReady) && bankFormValidation.isValid && !saving;

  async function post(body: Record<string, unknown>) {
    setSaving(true);
    setMessage("");
    try {
      const response = await authFetch({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Payment action failed.");
      setMessage("Payment action completed and audited.");
      await load();
      return true;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Payment action failed.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function recordBankPayment() {
    if (!bankFormValidation.isValid) {
      setMessage(bankFormValidation.errors[0] ?? "Complete the bank payment form before posting.");
      return;
    }
    if (!data?.migrationReady) {
      setMessage("Payment Control migration is required before recording bank payments.");
      return;
    }
    const success = await post({
      action: "record_bank_payment",
      customerUserId: bankForm.customerUserId,
      reference: bankForm.reference,
      credits: Number(bankForm.credits),
      amountEuro: Number(bankForm.amountEuro),
      note: bankForm.note.trim() || null,
    });
    if (success) setBankForm(emptyBankForm);
  }

  async function refundPayment(record: PaymentRecord) {
    if (!reviewNote.trim()) {
      setMessage("Enter an audit note before issuing a refund.");
      return;
    }
    if (!window.confirm(`Issue a full ${providerMeta[record.provider].label} refund and reverse ${record.credits} credits?`)) return;
    const success = await post({ action: "refund", paymentId: record.id, note: reviewNote.trim() });
    if (success) { setSelected(null); setReviewNote(""); }
  }

  if (loading && !data) {
    return <main className="flex min-h-screen items-center justify-center bg-[#050505] text-white"><Loader2 className="mr-3 h-5 w-5 animate-spin text-red-500" />Loading payment control...</main>;
  }

  return (
    <main className="mg-compact-ui min-h-screen bg-[#050505] text-white">
      <header className="border-b border-white/10 bg-black/80">
        <div className="mx-auto flex max-w-[1500px] flex-col gap-4 px-4 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link href="/admin" className="text-sm font-black text-zinc-500 hover:text-white"><ArrowLeft className="mr-2 inline h-4 w-4" />Admin operations</Link>
            <h1 className="mt-3 text-3xl font-black">Payment & Revenue Control</h1>
            <p className="mt-2 text-sm text-zinc-500">Finance operations · EUR ledger · Provider reconciliation</p>
          </div>
          <div className="flex gap-2">
            <Link href="/admin/commercial" className="inline-flex h-11 items-center rounded-lg border border-white/10 px-4 text-sm font-black text-zinc-300">Pricing</Link>
            <button onClick={() => void load()} className="inline-flex h-11 items-center rounded-lg bg-[#b1121b] px-4 text-sm font-black"><RefreshCcw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />Refresh</button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1500px] px-4 py-8">
        {message && <div className="mb-5 rounded-lg border border-red-800/40 bg-red-950/20 p-4 text-sm text-red-100">{message}</div>}
        {!data?.migrationReady && <div className="mb-5 rounded-lg border border-amber-700/40 bg-amber-950/20 p-4 text-sm text-amber-200"><AlertTriangle className="mr-2 inline h-4 w-4" />Run <strong>scripts/add-payment-revenue-control.sql</strong> in Supabase to activate payment attempts, webhook events, bank matching and refunds.</div>}

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <Metric icon={<BadgeEuro />} label="Gross revenue" value={money(data?.metrics.grossCents)} />
          <Metric icon={<ShieldCheck />} label="Net revenue" value={money(data?.metrics.netCents)} tone="green" />
          <Metric icon={<RotateCcw />} label="Refunded" value={money(data?.metrics.refundedCents)} />
          <Metric icon={<CreditCard />} label="Credits issued" value={String(data?.metrics.creditsIssued ?? 0)} />
          <Metric icon={<AlertTriangle />} label="Needs review" value={String(data?.metrics.unresolved ?? 0)} tone={(data?.metrics.unresolved ?? 0) > 0 ? "red" : "green"} />
        </section>

        <section className="mt-6 grid gap-3 md:grid-cols-3">
          {(data?.providers ?? []).map((item) => {
            const meta = providerMeta[item.provider];
            const Icon = meta.icon;
            const healthy = item.failed === 0;
            return <div key={item.provider} className="rounded-lg border border-white/10 bg-white/[0.025] p-5"><div className="flex items-center justify-between"><div className="flex items-center gap-3"><Icon className="h-6 w-6 text-red-400" /><div className="font-black">{meta.label}</div></div><span className={`h-2.5 w-2.5 rounded-full ${healthy ? "bg-emerald-400" : "bg-red-500"}`} /></div><div className="mt-5 grid grid-cols-3 gap-2 text-center"><Small label="Success" value={String(item.succeeded)} /><Small label="Failed" value={String(item.failed)} /><Small label="Pending" value={String(item.pending)} /></div><div className="mt-4 text-sm font-black text-zinc-300">{money(item.revenueCents)}</div></div>;
          })}
        </section>

        <section className="mt-8 grid gap-8 xl:grid-cols-[1fr_360px]">
          <div className="min-w-0">
            <div className="flex flex-wrap gap-2 border-b border-white/10 pb-4">
              {(["payments", "ledger", "events"] as const).map((item) => <button key={item} onClick={() => { setView(item); setPage(1); }} className={`rounded-lg px-4 py-2.5 text-sm font-black capitalize ${view === item ? "bg-[#b1121b]" : "border border-white/10 text-zinc-400"}`}>{item}</button>)}
            </div>

            {view === "payments" && <>
              <div className="my-5 grid gap-3 md:grid-cols-[1fr_170px_190px]">
                <label className="relative"><Search className="absolute left-4 top-3.5 h-4 w-4 text-zinc-600" /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Customer, reference or payment ID" className="h-11 w-full rounded-lg border border-white/10 bg-black/40 pl-11 pr-4 text-sm outline-none focus:border-red-700" /></label>
                <select value={provider} onChange={(event) => { setProvider(event.target.value as "all" | Provider); setPage(1); }} className="h-11 rounded-lg border border-white/10 bg-black/40 px-3 text-sm font-bold"><option value="all">All providers</option><option value="stripe">Stripe</option><option value="bank">Bank</option></select>
                <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} className="h-11 rounded-lg border border-white/10 bg-black/40 px-3 text-sm font-bold"><option value="all">All statuses</option><option value="pending">Pending</option><option value="succeeded">Succeeded</option><option value="failed">Failed</option><option value="requires_review">Needs review</option><option value="refunded">Refunded</option><option value="cancelled">Cancelled</option></select>
              </div>
              <div className="hidden overflow-x-auto border-y border-white/10 lg:block"><table className="w-full min-w-[980px] text-left text-sm"><thead className="text-xs uppercase text-zinc-500"><tr>{["Provider","Customer","Amount","Credits","Status","Credit match","Created","Action"].map((item) => <th key={item} className="px-3 py-4">{item}</th>)}</tr></thead><tbody>{visibleRecords.map((record) => <tr key={record.id} className="border-t border-white/10"><td className="px-3 py-4 font-black">{providerMeta[record.provider].label}</td><td className="px-3 py-4"><div className="font-bold">{record.customer?.customer_id || record.customer_email || "-"}</div><div className="mt-1 max-w-52 truncate text-xs text-zinc-600">{record.customer?.company_name || record.customer?.full_name || record.external_id}</div></td><td className="px-3 py-4 font-black">{money(record.amount_total, record.currency)}</td><td className="px-3 py-4 font-black">{record.credits}</td><td className="px-3 py-4"><StatusBadge status={record.status} /></td><td className="px-3 py-4">{record.creditMatched ? <CheckCircle2 className="h-5 w-5 text-emerald-400" /> : <AlertTriangle className="h-5 w-5 text-amber-400" />}</td><td className="px-3 py-4 text-zinc-500">{dateTime(record.created_at)}</td><td className="px-3 py-4"><button onClick={() => { setSelected(record); setReviewNote(record.review_note || ""); }} className="rounded-lg border border-white/10 px-3 py-2 text-xs font-black">Review</button></td></tr>)}</tbody></table></div>
              <div className="grid gap-3 lg:hidden">{visibleRecords.map((record) => <button key={record.id} onClick={() => { setSelected(record); setReviewNote(record.review_note || ""); }} className="rounded-lg border border-white/10 bg-white/[0.025] p-4 text-left"><div className="flex items-start justify-between gap-3"><div><div className="font-black">{providerMeta[record.provider].label} · {money(record.amount_total, record.currency)}</div><div className="mt-1 text-sm text-zinc-500">{record.customer?.customer_id || record.customer_email || record.external_id}</div></div><StatusBadge status={record.status} /></div><div className="mt-4 flex items-center justify-between text-xs text-zinc-500"><span>{record.credits} credits</span><span>{dateTime(record.created_at)}</span></div></button>)}</div>
              {!visibleRecords.length && <Empty text="No payment records match the selected filters." />}
              <div className="mt-5 flex items-center justify-between text-sm text-zinc-500"><span>{filteredRecords.length} records</span><div className="flex items-center gap-2"><button disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="rounded-lg border border-white/10 px-3 py-2 disabled:opacity-30">Previous</button><span>{page} / {pageCount}</span><button disabled={page >= pageCount} onClick={() => setPage((value) => value + 1)} className="rounded-lg border border-white/10 px-3 py-2 disabled:opacity-30">Next</button></div></div>
            </>}

            {view === "ledger" && <div className="mt-5 space-y-2">{(data?.ledger ?? []).map((entry) => <div key={entry.id} className="grid gap-3 rounded-lg border border-white/10 bg-white/[0.02] p-4 sm:grid-cols-[1fr_auto_auto]"><div><div className="font-black">{entry.description || entry.source_type || "Credit transaction"}</div><div className="mt-1 text-xs text-zinc-600">{entry.source_type} · {entry.source_id}</div></div><div className={`font-black ${Number(entry.credits_delta) >= 0 ? "text-emerald-300" : "text-red-300"}`}>{Number(entry.credits_delta) > 0 ? "+" : ""}{entry.credits_delta} credits</div><div className="text-sm text-zinc-500">{money(entry.amount_total, entry.currency || "eur")}<br />{dateTime(entry.created_at)}</div></div>)}{!(data?.ledger.length) && <Empty text="No purchase or refund ledger entries yet." />}</div>}

            {view === "events" && <div className="mt-5 space-y-2">{(data?.events ?? []).map((event) => <div key={event.id} className="flex gap-4 border-b border-white/10 py-4"><div className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${event.status === "failed" ? "bg-red-500" : event.status === "processed" ? "bg-emerald-400" : "bg-zinc-500"}`} /><div className="min-w-0"><div className="font-black">{providerMeta[event.provider].label} · {event.event_type.replaceAll("_", " ")}</div><div className="mt-1 text-sm text-zinc-500">{event.message || "No message"}</div><div className="mt-1 text-xs text-zinc-700">{dateTime(event.created_at)}</div></div></div>)}{!(data?.events.length) && <Empty text="No provider or webhook events recorded yet." />}</div>}
          </div>

          <aside className="space-y-5">
            <section className="rounded-lg border border-white/10 bg-white/[0.025] p-5">
              <h2 className="text-lg font-black">Record bank payment</h2>
              <div className="mt-4 space-y-3">
                <label className="block text-xs font-black uppercase text-zinc-600">
                  Customer
                  <select required value={bankForm.customerUserId} aria-invalid={!bankForm.customerUserId} onChange={(event) => setBankForm({ ...bankForm, customerUserId: event.target.value })} className="mt-2 h-11 w-full rounded-lg border border-white/10 bg-black/50 px-3 text-sm normal-case text-white outline-none focus:border-red-700"><option value="">Select customer</option>{(data?.customers ?? []).map((customer) => <option key={customer.id} value={customer.id}>{customer.customer_id || customer.email} · {customer.company_name || customer.full_name || "Customer"}</option>)}</select>
                  <span className="mt-1 block text-[11px] leading-4 text-zinc-500">Required. Must be one loaded customer profile.</span>
                </label>
                <Input
                  required
                  label="Bank reference"
                  value={bankForm.reference}
                  onChange={(value) => setBankForm({ ...bankForm, reference: value })}
                  maxLength={BANK_PAYMENT_LIMITS.referenceMax}
                  help="Required. 3-160 characters."
                  invalid={bankForm.reference.trim().length > 0 && bankForm.reference.trim().length < BANK_PAYMENT_LIMITS.referenceMin}
                />
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    required
                    label="Credits"
                    type="number"
                    value={bankForm.credits}
                    onChange={(value) => setBankForm({ ...bankForm, credits: value })}
                    min="0.01"
                    max={BANK_PAYMENT_LIMITS.creditsMax}
                    step="0.01"
                    help="Required. More than 0, max 100000."
                    invalid={bankForm.credits.trim() !== "" && (parseFormNumber(bankForm.credits) === null || Number(bankForm.credits) <= 0 || Number(bankForm.credits) > BANK_PAYMENT_LIMITS.creditsMax)}
                  />
                  <Input
                    required
                    label="Amount EUR"
                    type="number"
                    value={bankForm.amountEuro}
                    onChange={(value) => setBankForm({ ...bankForm, amountEuro: value })}
                    min="0.01"
                    max={BANK_PAYMENT_LIMITS.amountEuroMax}
                    step="0.01"
                    help="Required. More than 0, max 1000000."
                    invalid={bankForm.amountEuro.trim() !== "" && (parseFormNumber(bankForm.amountEuro) === null || Number(bankForm.amountEuro) <= 0 || Number(bankForm.amountEuro) > BANK_PAYMENT_LIMITS.amountEuroMax)}
                  />
                </div>
                <label className="block text-xs font-black uppercase text-zinc-600">
                  Internal note
                  <textarea maxLength={BANK_PAYMENT_LIMITS.noteMax} value={bankForm.note} onChange={(event) => setBankForm({ ...bankForm, note: event.target.value })} placeholder="Internal note" aria-invalid={bankForm.note.length > BANK_PAYMENT_LIMITS.noteMax} className="mt-2 min-h-20 w-full resize-none rounded-lg border border-white/10 bg-black/50 p-3 text-sm normal-case text-white outline-none focus:border-red-700" />
                  <span className="mt-1 block text-[11px] leading-4 text-zinc-500">{Math.max(0, bankFormValidation.noteRemaining)} characters remaining. Optional, max 1000.</span>
                </label>
                {!bankFormValidation.isValid && <div className="rounded-lg border border-amber-700/40 bg-amber-950/20 p-3 text-xs leading-5 text-amber-100"><div className="font-black">Complete the bank payment contract before posting:</div><ul className="mt-1 list-disc space-y-1 pl-4">{bankFormValidation.errors.map((error) => <li key={error}>{error}</li>)}</ul></div>}
                <button disabled={!canRecordBankPayment} onClick={() => void recordBankPayment()} className="h-11 w-full rounded-lg bg-[#b1121b] text-sm font-black disabled:opacity-40">Match payment & add credits</button>
              </div>
            </section>

            {selected && <section className="rounded-lg border border-red-900/40 bg-red-950/10 p-5">
              <div className="flex items-start justify-between gap-3"><div><div className="text-xs font-black uppercase text-red-400">Payment review</div><div className="mt-1 text-lg font-black">{providerMeta[selected.provider].label} · {money(selected.amount_total, selected.currency)}</div></div><button onClick={() => setSelected(null)} className="text-zinc-500">Close</button></div>
              <div className="mt-4 space-y-2 text-sm"><Detail label="Status" value={selected.status} /><Detail label="Credits" value={String(selected.credits)} /><Detail label="Credit match" value={selected.creditMatched ? "Matched" : "Missing"} /><Detail label="External ID" value={selected.external_id} /></div>
              {selected.failure_message && <div className="mt-4 rounded-lg border border-red-800/40 bg-black/30 p-3 text-sm text-red-200">{selected.failure_message}</div>}
              <textarea value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} placeholder="Required audit note" className="mt-4 min-h-24 w-full resize-none rounded-lg border border-white/10 bg-black/50 p-3 text-sm outline-none focus:border-red-700" />
              <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
                <button disabled={saving || !reviewNote.trim()} onClick={() => void post({ action: "mark_reviewed", paymentId: selected.id, note: reviewNote.trim() })} className="h-11 rounded-lg border border-white/10 text-sm font-black disabled:opacity-40">Mark reviewed</button>
                {selected.status === "succeeded" && selected.creditMatched && selected.provider !== "paypal" && <button disabled={saving || !reviewNote.trim()} onClick={() => void refundPayment(selected)} className="h-11 rounded-lg border border-red-800/50 bg-red-950/30 text-sm font-black text-red-200 disabled:opacity-40"><RotateCcw className="mr-2 inline h-4 w-4" />Full refund</button>}
              </div>
              {selected.provider_payment_id && selected.provider === "stripe" && <a href={`https://dashboard.stripe.com/payments/${selected.provider_payment_id}`} target="_blank" rel="noreferrer" className="mt-3 flex h-11 items-center justify-center rounded-lg border border-white/10 text-sm font-black text-zinc-300">Open provider <ExternalLink className="ml-2 h-4 w-4" /></a>}
            </section>}
          </aside>
        </section>
      </div>
    </main>
  );
}

function Metric({ icon, label, value, tone = "default" }: { icon: ReactNode; label: string; value: string; tone?: "default" | "green" | "red" }) {
  const color = tone === "green" ? "text-emerald-300" : tone === "red" ? "text-red-300" : "text-white";
  return <div className="rounded-lg border border-white/10 bg-white/[0.025] p-5"><div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-950/30 text-red-400">{icon}</div><div className="mt-4 text-xs font-black uppercase text-zinc-500">{label}</div><div className={`mt-1 text-2xl font-black ${color}`}>{value}</div></div>;
}
function Small({ label, value }: { label: string; value: string }) { return <div className="rounded-lg bg-black/30 p-2"><div className="text-[10px] uppercase text-zinc-600">{label}</div><div className="mt-1 font-black">{value}</div></div>; }
function Empty({ text }: { text: string }) { return <div className="py-16 text-center text-sm text-zinc-600"><Clock3 className="mx-auto mb-3 h-7 w-7" />{text}</div>; }
function Input({ label, value, onChange, type = "text", min, max, step, maxLength, help, required = false, invalid = false }: { label: string; value: string; onChange: (value: string) => void; type?: string; min?: string; max?: number; step?: string; maxLength?: number; help?: string; required?: boolean; invalid?: boolean }) { return <label className="block text-xs font-black uppercase text-zinc-600">{label}<input required={required} type={type} value={value} min={min} max={max} step={step} maxLength={maxLength} aria-invalid={invalid} onChange={(event) => onChange(event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-white/10 bg-black/50 px-3 text-sm normal-case text-white outline-none focus:border-red-700" />{help && <span className="mt-1 block text-[11px] leading-4 text-zinc-500">{help}</span>}</label>; }
function Detail({ label, value }: { label: string; value: string }) { return <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-2"><span className="text-zinc-600">{label}</span><span className="max-w-[220px] break-all text-right font-bold">{value}</span></div>; }
