"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Mail, RefreshCw, Send, ShieldCheck } from "lucide-react";
import { authenticatedFetch } from "@/lib/authGuards";

type EmailAdminData = {
  provider: {
    provider: string;
    configured: boolean;
    dryRun: boolean;
    fromEmail: string;
  };
  templates: Array<{ eventType: string; label: string; audience: string }>;
  recentEvents: Array<Record<string, unknown>>;
  migrationReady: boolean;
};

export default function AdminEmailPage() {
  const [data, setData] = useState<EmailAdminData | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  async function load() {
    setLoading(true);
    setMessage("");
    try {
      const response = await authenticatedFetch("/api/admin/email");
      const payload = await response.json();
      if (!response.ok) setMessage(payload.error || "Email settings could not be loaded.");
      else setData(payload);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Email settings could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  async function sendTest() {
    setSending(true);
    setMessage("");
    try {
      const response = await authenticatedFetch("/api/admin/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventType: "admin_email_test" }),
      });
      const payload = await response.json();
      setMessage(response.ok ? `Test email result: ${payload.result?.status || "ok"}` : payload.error || "Test email failed.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Test email failed.");
    } finally {
      setSending(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <main className="min-h-screen bg-[#050505] text-white">
      <header className="border-b border-white/10 bg-black/70">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link href="/admin" className="text-sm font-black text-zinc-500">
              <ArrowLeft className="mr-2 inline h-4 w-4" />Admin
            </Link>
            <div className="mt-2 flex items-center gap-3">
              <Mail className="h-7 w-7 text-red-500" />
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-red-500">Transactional Email</p>
                <h1 className="text-2xl font-black">Email Control Center</h1>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => void load()} className="rounded-lg border border-white/10 px-3 py-2 text-sm font-black">
              <RefreshCw className="mr-2 inline h-4 w-4" />Refresh
            </button>
            <button disabled={sending} onClick={() => void sendTest()} className="rounded-lg bg-[#b1121b] px-3 py-2 text-sm font-black disabled:opacity-50">
              <Send className="mr-2 inline h-4 w-4" />Send admin test
            </button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-6">
        {message && <div className="mb-5 rounded-lg border border-amber-700/40 bg-amber-950/20 p-4 text-sm text-amber-200">{message}</div>}
        {loading && <div className="rounded-lg border border-white/10 p-5 text-sm text-zinc-400">Loading email settings...</div>}
        {data && (
          <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
            <aside className="space-y-4">
              <section className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-black">
                  <ShieldCheck className="h-4 w-4 text-emerald-400" />Provider
                </div>
                <Info label="Provider" value={data.provider.provider} />
                <Info label="From" value={data.provider.fromEmail} />
                <Info label="Configured" value={data.provider.configured ? "Yes" : "No"} />
                <Info label="Dry-run" value={data.provider.dryRun ? "Enabled" : "Disabled"} />
                <Info label="Log table" value={data.migrationReady ? "Ready" : "Migration needed"} />
              </section>
              <section className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
                <h2 className="text-sm font-black">Safety Rules</h2>
                <ul className="mt-3 space-y-2 text-xs leading-5 text-zinc-400">
                  <li>No raw binary, hex or storage paths in customer emails.</li>
                  <li>Internal notes never trigger customer emails.</li>
                  <li>Hidden customer messages are filtered before sending.</li>
                  <li>Admin test sends only to the current admin email.</li>
                </ul>
              </section>
            </aside>

            <div className="space-y-5">
              <section className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
                <h2 className="text-sm font-black">Templates</h2>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {data.templates.map((template) => (
                    <div key={template.eventType} className="rounded-lg border border-white/10 bg-black/25 p-3">
                      <div className="text-sm font-black">{template.label}</div>
                      <div className="mt-1 text-xs text-zinc-500">{template.eventType}</div>
                      <div className="mt-2 inline-flex rounded-md border border-white/10 px-2 py-1 text-[10px] font-black uppercase text-zinc-400">{template.audience}</div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
                <h2 className="text-sm font-black">Recent Events</h2>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full min-w-[760px] text-left text-sm">
                    <thead className="text-xs uppercase tracking-[0.12em] text-zinc-500">
                      <tr><th className="py-2 pr-3">Event</th><th className="py-2 pr-3">Recipient</th><th className="py-2 pr-3">Status</th><th className="py-2 pr-3">Provider</th><th className="py-2 pr-3">Created</th></tr>
                    </thead>
                    <tbody>
                      {data.recentEvents.length === 0 && <tr><td colSpan={5} className="py-4 text-zinc-500">No email events logged yet.</td></tr>}
                      {data.recentEvents.map((event) => (
                        <tr key={String(event.id)} className="border-t border-white/10">
                          <td className="py-3 pr-3 font-bold">{String(event.event_type || "-")}</td>
                          <td className="py-3 pr-3 text-zinc-400">{String(event.recipient_email || "-")}</td>
                          <td className="py-3 pr-3">{String(event.status || "-")}</td>
                          <td className="py-3 pr-3 text-zinc-400">{String(event.provider || "-")}</td>
                          <td className="py-3 pr-3 text-zinc-500">{String(event.created_at || "-")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-t border-white/10 py-2 text-sm first:border-t-0">
      <span className="text-zinc-500">{label}</span>
      <span className="break-words text-right font-bold">{value}</span>
    </div>
  );
}
