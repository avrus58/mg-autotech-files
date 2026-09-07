"use client";

import Image from "next/image";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ImagePlus, Loader2, RefreshCw, Trash2, Upload } from "lucide-react";
import { authenticatedFetchForUser, getStableSession } from "@/lib/authGuards";
import { supabase } from "@/lib/supabaseClient";
import { useActiveLocale } from "@/lib/useActiveLocale";
import { serviceReportT, type ServiceReportTranslationKey } from "@/lib/i18n/service-report-translations";

const inputMaxBytes = 2 * 1024 * 1024;
const dataUrlMaxLength = Math.ceil((512 * 1024) / 3) * 4 + 22;
type RequestTicket = { ownerId: string; version: number; signal: AbortSignal; abort(): void };

/** Identity changes and unmounts invalidate responses, including uncancellable auth recovery. */
export function createReportBrandingRequestGate() {
  let ownerId: string | null = null;
  let version = 0;
  let disposed = false;
  let controller: AbortController | null = null;
  const invalidate = () => { version += 1; controller?.abort(); controller = null; };
  return {
    owner: () => ownerId,
    setOwner(id: string | null) { invalidate(); ownerId = id; disposed = false; },
    begin(): RequestTicket | null {
      if (!ownerId || disposed) return null;
      invalidate();
      const next = new AbortController();
      controller = next;
      return { ownerId, version, signal: next.signal, abort: () => next.abort() };
    },
    isCurrent(ticket: RequestTicket) { return !disposed && ownerId === ticket.ownerId && version === ticket.version; },
    dispose() { invalidate(); ownerId = null; disposed = true; },
  };
}

export function parseReportBrandingPreview(payload: unknown): string | null {
  if (!payload || typeof payload !== "object" || !("logoDataUrl" in payload)) throw new Error("invalid_preview");
  const value = payload.logoDataUrl;
  if (value === null) return null;
  if (typeof value !== "string" || value.length > dataUrlMaxLength || !/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(value)) throw new Error("invalid_preview");
  return value;
}

export function ReportBrandingCard() {
  const locale = useActiveLocale();
  const fileInputId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [gate] = useState(createReportBrandingRequestGate);
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [resolved, setResolved] = useState(false);
  const [image, setImage] = useState<string | null>(null);
  const [phase, setPhase] = useState<"loading" | "ready" | "error" | "uploading" | "removing">("loading");
  const [feedback, setFeedback] = useState<{ key: ServiceReportTranslationKey; error: boolean } | null>(null);
  const [sessionRetry, setSessionRetry] = useState(0);

  const run = useCallback(async (method: "GET" | "POST" | "DELETE", file?: File) => {
    const ticket = gate.begin();
    if (!ticket) return;
    setPhase(method === "GET" ? "loading" : method === "POST" ? "uploading" : "removing");
    setFeedback(null);
    const timeout = window.setTimeout(ticket.abort, 20_000);
    const errorKey = method === "GET" ? "brandingLoadError" : method === "POST" ? "brandingSaveError" : "brandingRemoveError";
    try {
      const response = await authenticatedFetchForUser(ticket.ownerId, "/api/account/report-branding", {
        method, cache: "no-store", signal: ticket.signal,
        headers: { "X-MG-Expected-User-Id": ticket.ownerId, ...(file ? { "Content-Type": file.type } : {}) },
        ...(file ? { body: file } : {}),
      });
      if (!gate.isCurrent(ticket)) return;
      if (!response.ok) {
        setFeedback({ key: method === "POST" && [400, 413].includes(response.status) ? "brandingInvalidImage" : errorKey, error: true });
        setPhase(method === "GET" ? "error" : "ready");
        return;
      }
      const payload: unknown = await response.json();
      if (!gate.isCurrent(ticket)) return;
      setImage(parseReportBrandingPreview(payload));
      setPhase("ready");
      if (method !== "GET") setFeedback({ key: method === "POST" ? "brandingSaved" : "brandingRemoved", error: false });
    } catch {
      if (gate.isCurrent(ticket)) {
        setFeedback({ key: errorKey, error: true });
        setPhase(method === "GET" ? "error" : "ready");
      }
    } finally { window.clearTimeout(timeout); }
  }, [gate]);

  useEffect(() => {
    let alive = true;
    let authEvents = 0;
    const adopt = (id: string | null) => {
      if (!alive) return;
      setResolved(true);
      if (id !== null && gate.owner() === id) return;
      gate.setOwner(id);
      setOwnerId(id);
      setImage(null);
      setFeedback(null);
      if (id) window.setTimeout(() => { if (alive && gate.owner() === id) void run("GET"); }, 0);
    };
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      authEvents += 1;
      adopt(session?.user.id ?? null);
    });
    void getStableSession().then((result) => {
      if (!alive || authEvents !== 0) return;
      if (!result.session && result.error) {
        setPhase("error");
        setFeedback({ key: "brandingLoadError", error: true });
        return;
      }
      adopt(result.session?.user.id ?? null);
    }).catch(() => {
      if (alive && authEvents === 0) { setPhase("error"); setFeedback({ key: "brandingLoadError", error: true }); }
    });
    return () => { alive = false; subscription.unsubscribe(); gate.dispose(); };
  }, [gate, run, sessionRetry]);

  if (resolved && !ownerId) return null;
  const busy = phase === "loading" || phase === "uploading" || phase === "removing";
  const statusKey = phase === "uploading" ? "brandingUploading" : phase === "removing" ? "brandingRemoving" : "brandingLoading";

  return (
    <section className="rounded-xl border border-white/10 bg-white/[0.04] p-4" aria-labelledby={`${fileInputId}-title`}>
      <h2 id={`${fileInputId}-title`} className="text-base font-bold text-white">{serviceReportT(locale, "brandingTitle")}</h2>
      <p className="mt-1 text-xs leading-5 text-zinc-400">{serviceReportT(locale, "brandingDescription")}</p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <div className="flex h-[72px] w-[72px] shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-black/30">
          {image ? <Image src={image} alt={serviceReportT(locale, "brandingImageAlt")} width={72} height={72} unoptimized className="h-full w-full object-contain" />
            : <ImagePlus className="h-6 w-6 text-zinc-500" aria-label={serviceReportT(locale, "brandingNoImage")} />}
        </div>
        <div className="flex min-w-0 flex-1 flex-wrap gap-2">
          <input ref={input} id={fileInputId} type="file" accept="image/png,image/jpeg" className="sr-only" disabled={phase !== "ready"}
            aria-label={serviceReportT(locale, "brandingUpload")}
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = "";
              if (!file) return;
              if (!file.size || file.size > inputMaxBytes || !["image/png", "image/jpeg"].includes(file.type)) {
                setFeedback({ key: "brandingInvalidImage", error: true });
                return;
              }
              void run("POST", file);
            }} />
          <button type="button" onClick={() => input.current?.click()} disabled={phase !== "ready"}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-red-800/50 px-3 text-xs font-bold text-red-200 disabled:opacity-50">
            <Upload className="h-4 w-4" aria-hidden="true" />{serviceReportT(locale, image ? "brandingReplace" : "brandingUpload")}
          </button>
          {image && <button type="button" onClick={() => void run("DELETE")} disabled={phase !== "ready"}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-white/10 px-3 text-xs font-bold text-zinc-300 disabled:opacity-50">
            <Trash2 className="h-4 w-4" aria-hidden="true" />{serviceReportT(locale, "brandingRemove")}
          </button>}
          {phase === "error" && <button type="button" onClick={() => { if (gate.owner()) void run("GET"); else setSessionRetry((value) => value + 1); }} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-white/10 px-3 text-xs font-bold text-zinc-300">
            <RefreshCw className="h-4 w-4" aria-hidden="true" />{serviceReportT(locale, "brandingRetry")}
          </button>}
        </div>
      </div>
      {busy && <p role="status" className="mt-3 flex items-center gap-2 text-xs text-zinc-400"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />{serviceReportT(locale, statusKey)}</p>}
      {feedback && <p role={feedback.error ? "alert" : "status"} className={`mt-3 text-xs leading-5 ${feedback.error ? "text-red-300" : "text-emerald-300"}`}>{serviceReportT(locale, feedback.key)}</p>}
    </section>
  );
}
