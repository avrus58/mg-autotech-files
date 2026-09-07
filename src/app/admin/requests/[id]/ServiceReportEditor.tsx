"use client";

import { useEffect, useId, useRef, useState } from "react";
import { FileText, Loader2, Save } from "lucide-react";
import { authenticatedFetch } from "@/lib/authGuards";
import { serviceReportDetailsSchema, type ServiceReportDetails, type ServiceReportEditorState } from "@/lib/serviceReports/model";

const metricFields = [
  { key: "beforeHp", label: "Before · hp", max: 5000 }, { key: "afterHp", label: "After · hp", max: 5000 },
  { key: "beforeNm", label: "Before · Nm", max: 20000 }, { key: "afterNm", label: "After · Nm", max: 20000 },
] as const;
const control = "mt-1 w-full min-w-0 rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white disabled:opacity-60";

export function ServiceReportEditor({ orderId, canEdit }: { orderId: string; canEdit: boolean }) {
  const controlId = useId();
  const [state, setState] = useState<ServiceReportEditorState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const saveAbort = useRef<AbortController | null>(null);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15000);
    const start = window.setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const response = await authenticatedFetch(`/api/admin/requests/${orderId}/service-report`, { cache: "no-store", signal: controller.signal });
        const payload = await response.json();
        if (!response.ok || !serviceReportDetailsSchema.safeParse(payload.details).success) throw new Error("unavailable");
        if (active) { setState(payload); setDirty(false); setMessage(""); }
      } catch { if (active) setError("Report details could not be loaded. Retry before editing."); }
      finally { window.clearTimeout(timeout); if (active) setLoading(false); }
    }, 0);
    return () => { active = false; controller.abort(); saveAbort.current?.abort(); saveAbort.current = null; window.clearTimeout(start); window.clearTimeout(timeout); };
  }, [orderId, reload]);

  function edit(patch: Partial<ServiceReportDetails>) {
    setState((current) => current ? { ...current, details: { ...current.details, ...patch } } : current);
    setDirty(true);
    setError("");
    setMessage("");
  }

  async function save() {
    if (!state || saving || !canEdit) return;
    const parsed = serviceReportDetailsSchema.safeParse(state.details);
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Check the report values."); return; }
    const controller = new AbortController();
    saveAbort.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 15000);
    setSaving(true); setError(""); setMessage("");
    try {
      const response = await authenticatedFetch(`/api/admin/requests/${orderId}/service-report`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ expectedRevision: state.revision, details: parsed.data }), signal: controller.signal });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.code === "REPORT_CONFLICT" ? "Another admin saved newer details. Your changes are still here; reload saved details before editing again." : "Report details could not be saved. Your changes are still here; please retry.");
      if (!serviceReportDetailsSchema.safeParse(payload.details).success || !Number.isInteger(payload.revision)) throw new Error("Report save could not be confirmed. Reload saved details to verify.");
      if (controller.signal.aborted) return;
      setState((current) => current ? { ...current, revision: payload.revision, details: payload.details } : current);
      setDirty(false); setMessage("Saved. The next download uses these details in a new report revision.");
    } catch (cause) {
      if (saveAbort.current === controller) setError(cause instanceof Error && cause.name !== "AbortError" ? cause.message : "The save timed out. Your changes are still here; reload saved details to check whether it completed.");
    } finally { window.clearTimeout(timeout); if (saveAbort.current === controller) { setSaving(false); saveAbort.current = null; } }
  }

  return (
    <section className="min-w-0 rounded-2xl border border-white/10 bg-[#0d0d0f] p-4" aria-labelledby="service-report-title">
      <div className="flex items-center gap-2"><FileText className="h-4 w-4 text-red-400" /><h2 id="service-report-title" className="text-sm font-bold">Service report</h2></div>
      <p className="mt-2 text-xs leading-5 text-zinc-400">The PDF is available automatically when the order is completed. Optional details below enrich it; already issued reports are never overwritten.</p>
      {loading && <p role="status" className="mt-3 text-xs text-zinc-400"><Loader2 className="mr-1 inline h-3 w-3 animate-spin" />Loading report details…</p>}
      {error && <p role="alert" className="mt-3 break-words text-xs leading-5 text-red-300">{error}</p>}
      {message && <p role="status" className="mt-3 text-xs leading-5 text-emerald-300">{message}</p>}
      {!loading && state && <details className="mt-3">
        <summary className="cursor-pointer text-sm font-semibold text-zinc-200">Optional report details · revision {state.revision}</summary>
        <fieldset disabled={!canEdit || saving} className="mt-3 min-w-0 space-y-3">
          <p className="break-words text-xs text-zinc-400">Requested: {state.requestedServices.join(" · ") || "No service labels supplied"}</p>
          <div className="text-xs text-zinc-300"><label htmlFor={`${controlId}-services`}>Completed services (one per line)</label>
            <textarea id={`${controlId}-services`} className={control} rows={3} maxLength={4800} value={state.details.performedServices.join("\n")} onChange={(event) => edit({ performedServices: event.target.value.split("\n") })} onBlur={() => edit({ performedServices: state.details.performedServices.map((value) => value.trim()).filter(Boolean) })} />
          </div>
          <p className="text-xs leading-5 text-zinc-500">Only list services you confirm were performed. Leave empty if not confirmed; the requested scope remains separate.</p>
          <div className="grid grid-cols-2 gap-2">{metricFields.map((field) => <div key={field.key} className="min-w-0 text-xs text-zinc-300"><label htmlFor={`${controlId}-${field.key}`}>{field.label}</label><input id={`${controlId}-${field.key}`} className={control} type="number" min={0} max={field.max} step="0.1" value={state.details[field.key] ?? ""} onChange={(event) => edit({ [field.key]: event.target.value === "" ? null : Number(event.target.value) })} /></div>)}</div>
          <div className="text-xs text-zinc-300"><label htmlFor={`${controlId}-source`}>Performance source</label>
            <select id={`${controlId}-source`} className={control} value={state.details.metricSource ?? ""} onChange={(event) => edit({ metricSource: event.target.value ? event.target.value as ServiceReportDetails["metricSource"] : null })}>
              <option value="">No values supplied</option><option value="measured">Measured</option><option value="datalog_estimate">Datalog estimate</option><option value="catalog_reference">Catalog reference</option><option value="manually_declared">Manually declared</option>
            </select>
          </div>
          <div className="text-xs text-zinc-300"><label htmlFor={`${controlId}-reference`}>Source / reference (required with any value)</label><textarea id={`${controlId}-reference`} className={control} rows={2} maxLength={2000} value={state.details.sourceNote} onChange={(event) => edit({ sourceNote: event.target.value })} /></div>
          <p className="text-xs leading-5 text-zinc-500">Use hp and Nm. A catalog reference or datalog estimate is not a measured dyno result. These notes appear in the customer PDF.</p>
          <div className="text-xs text-zinc-300"><label htmlFor={`${controlId}-note`}>Customer report note</label><textarea id={`${controlId}-note`} className={control} rows={2} maxLength={2000} value={state.details.customerNote} onChange={(event) => edit({ customerNote: event.target.value })} /></div>
          {canEdit && <button type="button" disabled={saving || !dirty} onClick={() => void save()} className="inline-flex items-center gap-2 rounded-lg bg-red-700 px-3 py-2 text-sm font-semibold disabled:opacity-50"><Save className="h-4 w-4" />{saving ? "Saving…" : "Save report details"}</button>}
        </fieldset>
        {!canEdit && <p className="mt-3 text-xs text-zinc-500">Order management permission is required to edit report details.</p>}
      </details>}
      {!loading && (error || dirty) && <button type="button" disabled={saving} className="mt-3 text-xs text-zinc-300 underline disabled:opacity-50" onClick={() => setReload((value) => value + 1)}>{dirty ? "Reload saved details (discard edits)" : "Retry loading details"}</button>}
    </section>
  );
}
