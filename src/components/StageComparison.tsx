import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { RuntimePublicLocalization } from "@/components/RuntimePublicLocalization";
import { defaultLocale, type LocaleCode } from "@/lib/i18nConfig";
import { stageTuningComparisons } from "@/lib/stageTuning";

const comparisonRows = [
  { label: "Typical hardware", key: "hardwareCondition" },
  { label: "Calibration scope", key: "calibrationScope" },
  { label: "Supporting modifications", key: "supportingModifications" },
  { label: "Logging", key: "logging" },
  { label: "Intended customer", key: "intendedFor" },
  { label: "Review", key: "reviewRequirement" },
  { label: "Ordering", key: "orderingMethod" },
] as const;

export function StageComparison({
  compact = false,
  locale = defaultLocale,
}: {
  compact?: boolean;
  locale?: LocaleCode;
}) {
  return (
    <RuntimePublicLocalization locale={locale} scopes={["core", "services"]}>
    <section id="stage-comparison" className="border-y border-white/10 bg-[#080a0d]">
      <div className={`mx-auto max-w-7xl px-4 ${compact ? "py-12" : "py-16 lg:py-20"}`}>
        <div className="max-w-3xl">
          <p className="text-xs font-black uppercase tracking-normal text-red-400">
            Calibration route comparison
          </p>
          <h2 className="mt-3 text-3xl font-black sm:text-4xl">
            Stage 1 vs Stage 2 vs Stage 3 ECU tuning files.
          </h2>
          <p className="mt-4 text-sm leading-7 text-zinc-400 sm:text-base">
            The stage name is only a starting point. Vehicle condition, ECU software, fuel,
            gearbox limits and installed hardware determine what can be reviewed for the
            submitted file. No stage promises a universal result.
          </p>
        </div>

        <div className="mt-8 grid gap-px overflow-hidden rounded-lg border border-white/10 bg-white/10 lg:grid-cols-3">
          {stageTuningComparisons.map((stage) => (
            <article key={stage.slug} className="min-w-0 bg-[#0b0d10] p-5 sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-black uppercase tracking-normal text-red-300">
                  {stage.shortName}
                </span>
                <CheckCircle2 className="h-5 w-5 text-emerald-400" aria-hidden="true" />
              </div>
              <h3 className="mt-3 text-xl font-black">{stage.name}</h3>
              <p className="mt-3 text-sm leading-7 text-zinc-400">{stage.summary}</p>

              <dl className="mt-6 divide-y divide-white/10 border-y border-white/10">
                {comparisonRows.map((row) => (
                  <div key={row.key} className="py-3">
                    <dt className="text-[11px] font-black uppercase tracking-normal text-zinc-500">
                      {row.label}
                    </dt>
                    <dd className="mt-1 text-sm leading-6 text-zinc-200">{stage[row.key]}</dd>
                  </div>
                ))}
              </dl>

              <Link
                href={stage.href}
                className="mt-6 inline-flex items-center text-sm font-black text-red-300 transition hover:text-red-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
              >
                Explore {stage.shortName}
                <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
              </Link>
            </article>
          ))}
        </div>
      </div>
    </section>
    </RuntimePublicLocalization>
  );
}
