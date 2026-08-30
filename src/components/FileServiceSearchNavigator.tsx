import Link from "next/link";
import { ArrowRight, ChevronDown, Search, Waypoints } from "lucide-react";
import { RuntimePublicLocalization } from "@/components/RuntimePublicLocalization";
import { fileServiceSearchIntentGroups } from "@/lib/fileServiceSearchIntents";
import { defaultLocale, type LocaleCode } from "@/lib/i18nConfig";

export function FileServiceSearchNavigator({
  locale = defaultLocale,
}: {
  locale?: LocaleCode;
}) {
  return (
    <RuntimePublicLocalization locale={locale} scopes={["core", "services"]}>
    <section
      id="file-service-search-intent-map"
      className="border-y border-white/10 bg-[#07090d] py-14"
      aria-labelledby="file-service-search-intent-title"
    >
      <div className="mx-auto max-w-7xl px-4">
        <div className="grid gap-6 lg:grid-cols-[0.72fr_1.28fr] lg:items-end">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-red-400">
              <Waypoints className="h-4 w-4" aria-hidden="true" />
              Workshop search navigator
            </div>
            <h2
              id="file-service-search-intent-title"
              className="mt-3 max-w-3xl text-3xl font-black leading-tight md:text-5xl"
            >
              Find the file-service route that matches the real job.
            </h2>
          </div>
          <p className="max-w-3xl text-sm leading-7 text-zinc-400 lg:justify-self-end">
            Workshops often use different wording for the same need. Choose the
            closest job context below; every search phrase points to one
            authoritative MG AutoTech route instead of a duplicate landing page.
          </p>
        </div>

        <div className="mt-8 grid gap-3 lg:grid-cols-2">
          {fileServiceSearchIntentGroups.map((group) => (
            <details
              key={group.id}
              open={"featured" in group && group.featured}
              className="group self-start overflow-hidden rounded-lg border border-white/10 bg-white/[0.035] open:border-red-500/30 open:bg-red-950/[0.09]"
            >
              <summary className="flex min-h-24 cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-red-600 [&::-webkit-details-marker]:hidden">
                <span className="flex min-w-0 items-start gap-3">
                  <span className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-red-500/25 bg-red-950/25 text-red-200">
                    <Search className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span>
                    <span className="block text-base font-black text-white">
                      {group.title}
                    </span>
                    <span className="mt-1 block text-sm leading-6 text-zinc-500">
                      {group.summary}
                    </span>
                  </span>
                </span>
                <ChevronDown
                  className="h-5 w-5 shrink-0 text-zinc-500 transition group-open:rotate-180 group-open:text-red-300"
                  aria-hidden="true"
                />
              </summary>

              <div className="border-t border-white/10 p-3">
                <div className="grid gap-3">
                  {group.destinations.map((destination) => (
                    <article
                      key={destination.id}
                      className="rounded-lg border border-white/10 bg-black/35 p-4"
                    >
                      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                        <div className="min-w-0">
                          <h3 className="text-base font-black text-white">
                            {destination.title}
                          </h3>
                          <p className="mt-2 text-sm leading-6 text-zinc-400">
                            {destination.decision}
                          </p>
                        </div>
                        <Link
                          href={destination.href}
                          className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-lg border border-red-500/30 bg-red-950/20 px-3 text-xs font-black text-red-100 transition hover:border-red-400/60 hover:bg-red-950/35 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
                        >
                          Open route
                          <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                        </Link>
                      </div>

                      {locale === "en" && (
                        <div className="mt-4 border-t border-white/10 pt-3">
                          <div className="text-[0.68rem] font-black uppercase tracking-[0.16em] text-zinc-600">
                            Also described as
                          </div>
                          <p className="mt-2 text-xs leading-6 text-zinc-500">
                            {destination.searchTerms.slice(0, 3).join(" / ")}
                          </p>
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              </div>
            </details>
          ))}
        </div>

        <div className="mt-5 flex flex-col justify-between gap-3 rounded-lg border border-emerald-500/20 bg-emerald-950/10 px-4 py-3 text-sm leading-6 text-emerald-100 sm:flex-row sm:items-center">
          <span>
            Exact vehicle and controller support is confirmed from the submitted
            identity, source file, read method and request context.
          </span>
          <Link
            href="/tools/request-brief-builder"
            className="inline-flex min-h-10 shrink-0 items-center font-black text-white underline decoration-red-500 underline-offset-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
          >
            Build a request brief
          </Link>
        </div>
      </div>
    </section>
    </RuntimePublicLocalization>
  );
}
