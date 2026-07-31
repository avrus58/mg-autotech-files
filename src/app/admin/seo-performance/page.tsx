import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  CircleAlert,
  Flag,
  Globe2,
  MousePointerClick,
  Search,
  ShieldCheck,
} from "lucide-react";
import { isValidGoogleAnalyticsMeasurementId } from "@/lib/publicAnalytics";

const searchConsolePerformanceUrl =
  "https://search.google.com/search-console/performance/search-analytics?resource_id=sc-domain%3Amgautotech.de";
const googleAnalyticsUrl = "https://analytics.google.com/analytics/web/";

const eventRows = [
  ["page_view", "Public landing-page reach", "Clean public path, URL and content group"],
  ["public_navigation_click", "Public content navigation", "Clean public source, destination and content group"],
  ["request_cta_click", "Clicks that open the secure request flow", "Clean public source and /new-request destination"],
  ["request_start", "Verified customer reaches the request workspace", "Static channel and fixed /new-request URL"],
  ["generate_lead", "A request is created successfully", "Static channel and fixed /new-request URL"],
] as const;

export default function SeoPerformancePage() {
  const measurementConfigured = isValidGoogleAnalyticsMeasurementId(
    process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID
  );

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#050505] text-white">
      <header className="border-b border-white/10 bg-black/90">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-6">
          <div>
            <Link href="/admin" className="inline-flex items-center gap-2 text-xs font-black text-zinc-500 hover:text-white">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />Admin Control Panel
            </Link>
            <div className="mt-3 flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-lg border border-red-800/50 bg-red-950/30 text-red-300">
                <BarChart3 className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-red-400">Growth measurement</p>
                <h1 className="text-2xl font-black sm:text-3xl">SEO & Conversion Center</h1>
              </div>
            </div>
          </div>
          <span className={`rounded-full border px-3 py-2 text-xs font-black ${measurementConfigured ? "border-emerald-700/40 bg-emerald-950/25 text-emerald-200" : "border-amber-700/40 bg-amber-950/25 text-amber-200"}`}>
            {measurementConfigured ? "GA4 measurement configured" : "GA4 measurement needs configuration"}
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
        <section className="grid gap-px overflow-hidden rounded-lg border border-white/10 bg-white/10 md:grid-cols-2 xl:grid-cols-4">
          <Signal icon={<Search />} label="Search queries" source="Google Search Console" state="Available in Search Performance" />
          <Signal icon={<Globe2 />} label="Country" source="Search Console + GA4" state="Country-level, not customer identity" />
          <Signal icon={<MousePointerClick />} label="Clicks" source="Search + public site events" state="Google clicks and internal CTA clicks" />
          <Signal icon={<Flag />} label="Request conversion" source="GA4 generate_lead" state="Successful request creation only" />
        </section>

        <section className="grid gap-5 lg:grid-cols-[1.1fr_.9fr]">
          <div className="rounded-lg border border-white/10 bg-[#0b0c0e] p-5 sm:p-6">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-red-400">Measurement sources</p>
            <h2 className="mt-2 text-2xl font-black">Two sources, one clear funnel</h2>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-zinc-400">
              Search Console remains the source of truth for Google query, country, impression and search-result click data. GA4 receives consented public navigation and request funnel events without operational request details.
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <ExternalReport href={searchConsolePerformanceUrl} title="Search Console Performance" detail="Queries, countries, clicks, impressions, CTR and average position." />
              <ExternalReport href={googleAnalyticsUrl} title="Google Analytics" detail="Landing pages, public CTA clicks, request starts and completed request conversions." />
            </div>
          </div>

          <div className="rounded-lg border border-white/10 bg-[#0b0c0e] p-5 sm:p-6">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-red-400">Activation status</p>
            <div className="mt-4 space-y-3">
              <StatusRow ready label="Search Console domain property" detail="sc-domain:mgautotech.de" />
              <StatusRow ready label="Public click event contract" detail="Only public paths and fixed event fields" />
              <StatusRow ready label="Request conversion event" detail="generate_lead after successful order creation" />
              <StatusRow ready label="Consent gate" detail="Google tag loads only after explicit analytics permission" />
              <StatusRow ready={measurementConfigured} label="GA4 measurement ID" detail={measurementConfigured ? "Configured without exposing the identifier" : "Set NEXT_PUBLIC_GOOGLE_ANALYTICS_ID during the approved release"} />
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-white/10 bg-[#0b0c0e]">
          <div className="border-b border-white/10 p-5 sm:p-6">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-red-400">Event dictionary</p>
            <h2 className="mt-2 text-2xl font-black">Exactly what the website can send</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="text-xs uppercase text-zinc-500"><tr><th className="px-5 py-4">Event</th><th className="px-5 py-4">Purpose</th><th className="px-5 py-4">Allowed fields</th></tr></thead>
              <tbody>
                {eventRows.map(([event, purpose, fields]) => (
                  <tr key={event} className="border-t border-white/10">
                    <td className="px-5 py-4 font-mono text-xs font-black text-red-200">{event}</td>
                    <td className="px-5 py-4 font-bold">{purpose}</td>
                    <td className="px-5 py-4 text-zinc-400">{fields}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="grid gap-5 md:grid-cols-2">
          <div className="rounded-lg border border-emerald-800/30 bg-emerald-950/15 p-5">
            <div className="flex items-center gap-2 text-emerald-200"><ShieldCheck className="h-5 w-5" /><h2 className="font-black">Privacy allowlist</h2></div>
            <p className="mt-3 text-sm leading-7 text-zinc-400">Only public paths, content groups, static channel labels and aggregate Google reporting dimensions are used.</p>
          </div>
          <div className="rounded-lg border border-red-800/30 bg-red-950/15 p-5">
            <div className="flex items-center gap-2 text-red-200"><CircleAlert className="h-5 w-5" /><h2 className="font-black">Always excluded</h2></div>
            <p className="mt-3 text-sm leading-7 text-zinc-400">No email, user ID, order ID, vehicle data, service selection, file name, storage path, credit value, notes, admin data or AI metadata.</p>
          </div>
        </section>
      </div>
    </main>
  );
}

function Signal({ icon, label, source, state }: { icon: ReactNode; label: string; source: string; state: string }) {
  return <div className="bg-[#0b0c0e] p-5"><div className="flex items-center gap-2 text-red-300 [&>svg]:h-5 [&>svg]:w-5">{icon}<span className="font-black text-white">{label}</span></div><div className="mt-4 text-sm font-bold text-zinc-300">{source}</div><div className="mt-1 text-xs leading-5 text-zinc-500">{state}</div></div>;
}

function StatusRow({ ready, label, detail }: { ready: boolean; label: string; detail: string }) {
  return <div className="flex items-start gap-3 rounded-lg border border-white/10 bg-black/25 p-3">{ready ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" /> : <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />}<div><div className="text-sm font-black">{label}</div><div className="mt-1 text-xs leading-5 text-zinc-500">{detail}</div></div></div>;
}

function ExternalReport({ href, title, detail }: { href: string; title: string; detail: string }) {
  return <a href={href} target="_blank" rel="noreferrer" className="group rounded-lg border border-white/10 bg-white/[0.025] p-4 transition hover:border-red-800/50 hover:bg-white/[0.05]"><div className="flex items-center justify-between gap-3 font-black">{title}<ArrowUpRight className="h-4 w-4 text-zinc-500 transition group-hover:text-red-300" /></div><p className="mt-2 text-xs leading-5 text-zinc-500">{detail}</p></a>;
}
