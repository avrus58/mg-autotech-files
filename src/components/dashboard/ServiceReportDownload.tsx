"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Download, FileText, Loader2, RefreshCw } from "lucide-react";
import { authenticatedFetchForUser, getStableSession } from "@/lib/authGuards";
import { supabase } from "@/lib/supabaseClient";
import { serviceReportT, type ServiceReportTranslationKey } from "@/lib/i18n/service-report-translations";
import { useActiveLocale } from "@/lib/useActiveLocale";
import { readServiceReportDownload, ServiceReportDownloadError } from "@/lib/serviceReports/download";

type Props = { orderId: string; status: string };

export default function ServiceReportDownload(props: Props) {
  return <ServiceReportDownloadContent key={`${props.orderId}:${props.status}`} {...props} />;
}

function ServiceReportDownloadContent({ orderId, status }: Props) {
  const locale = useActiveLocale();
  const titleId = useId();
  const descriptionId = useId();
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ key: ServiceReportTranslationKey } | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(false);
  const accountRef = useRef<string | null | undefined>(undefined);
  const boundAccountRef = useRef<string | null>(null);
  const urlsRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const completed = status === "completed";
  const t = (key: ServiceReportTranslationKey) => serviceReportT(locale, key);

  useEffect(() => {
    mountedRef.current = true;
    const urls = urlsRef.current;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextAccount = session?.user.id ?? null;
      if (accountRef.current !== undefined && accountRef.current !== nextAccount) {
        controllerRef.current?.abort();
        controllerRef.current = null;
        setFeedback({ key: "downloadUnauthorized" });
        setBusy(false);
      }
      accountRef.current = nextAccount;
      if (!boundAccountRef.current && nextAccount) boundAccountRef.current = nextAccount;
    });
    return () => {
      mountedRef.current = false;
      controllerRef.current?.abort();
      subscription.unsubscribe();
      for (const [url, timer] of urls) {
        clearTimeout(timer);
        URL.revokeObjectURL(url);
      }
      urls.clear();
    };
  }, []);

  useEffect(() => {
    if (!completed) controllerRef.current?.abort();
  }, [completed]);

  const download = async () => {
    if (!completed || controllerRef.current) return;
    const controller = new AbortController();
    controllerRef.current = controller;
    setBusy(true);
    setFeedback(null);
    const timeout = setTimeout(() => {
      if (controller.signal.aborted) return;
      controller.abort();
      if (mountedRef.current && controllerRef.current === controller) {
        controllerRef.current = null;
        setBusy(false);
        setFeedback({ key: "downloadError" });
      }
    }, 60_000);
    const current = () => mountedRef.current && !controller.signal.aborted;
    try {
      const session = (await getStableSession()).session;
      if (!current()) return;
      const userId = session?.user.id;
      if (!userId || (boundAccountRef.current && boundAccountRef.current !== userId) || (accountRef.current !== undefined && accountRef.current !== userId)) {
        throw new ServiceReportDownloadError("downloadUnauthorized");
      }
      boundAccountRef.current = userId;
      accountRef.current = userId;
      const response = await authenticatedFetchForUser(userId, `/api/requests/${encodeURIComponent(orderId)}/service-report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale }),
        cache: "no-store",
        signal: controller.signal,
      });
      if (!current()) return;
      const blob = await readServiceReportDownload(response);
      const latestSession = (await getStableSession()).session;
      if (!current()) return;
      if (accountRef.current !== userId || latestSession?.user.id !== userId) throw new ServiceReportDownloadError("downloadUnauthorized");
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      // Only a local fixed filename is used; server filenames and customer data
      // are not interpreted as paths or DOM markup.
      link.download = `MG-AutoTech-${orderId.replace(/[^a-zA-Z0-9-]/g, "").slice(0, 64)}-${locale}.pdf`;
      link.hidden = true;
      document.body.appendChild(link);
      try {
        link.click();
      } finally {
        link.remove();
        const timer = setTimeout(() => { URL.revokeObjectURL(url); urlsRef.current.delete(url); }, 30_000);
        urlsRef.current.set(url, timer);
      }
      setFeedback({ key: "downloadStarted" });
    } catch (error) {
      if (mountedRef.current && !controller.signal.aborted) setFeedback({ key: error instanceof ServiceReportDownloadError ? error.translationKey : "downloadError" });
    } finally {
      clearTimeout(timeout);
      if (controllerRef.current === controller) {
        controllerRef.current = null;
        if (mountedRef.current) setBusy(false);
      }
    }
  };

  const isError = feedback !== null && feedback.key !== "downloadStarted";
  return (
    <section aria-labelledby={titleId} className="min-w-0 rounded-xl border border-white/10 bg-[var(--mg-portal-surface)] p-3 sm:p-4">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 id={titleId} className="flex items-center gap-2 text-sm font-black text-white"><FileText aria-hidden="true" className="h-4 w-4 shrink-0 text-red-400" />{t("downloadTitle")}</h2>
          <p id={descriptionId} className="mt-1 max-w-2xl break-words text-xs leading-5 text-zinc-400">{completed ? t("downloadDescription") : t("downloadPending")}</p>
        </div>
        <button type="button" onClick={download} disabled={!completed || busy} aria-busy={busy} aria-describedby={descriptionId} className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-center text-xs font-bold text-red-300 transition hover:bg-red-500/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-400 disabled:cursor-not-allowed disabled:opacity-50">
          {busy ? <Loader2 aria-hidden="true" className="h-4 w-4 shrink-0 animate-spin motion-reduce:animate-none" /> : isError ? <RefreshCw aria-hidden="true" className="h-4 w-4 shrink-0" /> : <Download aria-hidden="true" className="h-4 w-4 shrink-0" />}
          <span className="break-words">{busy ? t("downloadLoading") : isError ? t("retry") : t("downloadPdf")}</span>
        </button>
      </div>
      <p role={isError ? "alert" : "status"} aria-live={isError ? "assertive" : "polite"} className={`mt-2 break-words text-xs leading-5 ${isError ? "text-red-300" : "text-emerald-400"}`}>{feedback ? t(feedback.key) : null}</p>
    </section>
  );
}
