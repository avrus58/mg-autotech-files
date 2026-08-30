import Link from "next/link";
import {
  ArrowRight,
  CarFront,
  CheckCircle2,
  CircuitBoard,
  CircleAlert,
  Gauge,
} from "lucide-react";
import { RuntimePublicLocalization } from "@/components/RuntimePublicLocalization";
import { defaultLocale, type LocaleCode } from "@/lib/i18nConfig";

export const stage1BrandRoutes = [
  { label: "BMW Stage 1 files", href: "/brands/bmw" },
  { label: "Mercedes-Benz Stage 1 files", href: "/brands/mercedes-benz" },
  { label: "Audi Stage 1 files", href: "/brands/audi" },
  { label: "Volkswagen Stage 1 files", href: "/brands/volkswagen" },
  { label: "Porsche Stage 1 files", href: "/brands/porsche" },
  { label: "Opel Stage 1 files", href: "/brands/opel" },
  { label: "Renault Stage 1 files", href: "/brands/renault" },
  { label: "Peugeot Stage 1 files", href: "/brands/peugeot" },
] as const;

export const stage1PlatformRoutes = [
  { label: "Bosch EDC17", href: "/ecu-platforms/bosch-edc17" },
  { label: "Bosch MD1", href: "/ecu-platforms/bosch-md1" },
  { label: "Bosch MG1", href: "/ecu-platforms/bosch-mg1" },
  { label: "Continental SIMOS", href: "/ecu-platforms/continental-simos" },
  { label: "Continental SID", href: "/ecu-platforms/continental-sid" },
  { label: "Delphi DCM", href: "/ecu-platforms/delphi-dcm" },
  { label: "Denso", href: "/ecu-platforms/denso" },
] as const;

const fitChecks = [
  {
    title: "Turbo petrol",
    text: "A standard or near-standard setup can be reviewed from the exact ECU software, fuel grade and original read.",
    icon: Gauge,
    tone: "positive",
  },
  {
    title: "Turbo diesel",
    text: "Engine, gearbox, read method and current diagnostic condition must stay attached to the request.",
    icon: CheckCircle2,
    tone: "positive",
  },
  {
    title: "Naturally aspirated",
    text: "A file can be checked, but realistic gains are usually more limited than on a supported turbo application.",
    icon: CircleAlert,
    tone: "caution",
  },
  {
    title: "Modified hardware",
    text: "Turbo, exhaust, fuel-system or other supporting changes should be declared and may require Stage 2 or custom review.",
    icon: CircuitBoard,
    tone: "caution",
  },
] as const;

export function Stage1Authority({
  locale = defaultLocale,
}: {
  locale?: LocaleCode;
}) {
  return (
    <RuntimePublicLocalization locale={locale} scopes={["core", "services"]}>
    <section
      aria-labelledby="stage-1-fit-heading"
      className="border-y border-white/10 bg-[#080b0f]"
    >
      <div className="mx-auto max-w-7xl px-4 py-14 lg:py-16">
        <div className="grid gap-8 lg:grid-cols-[0.78fr_1.22fr] lg:items-start">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.2em] text-red-500">
              Stage 1 request fit
            </div>
            <h2 id="stage-1-fit-heading" className="mt-3 text-3xl font-black sm:text-4xl">
              Is this a Stage 1 file-service request?
            </h2>
            <p className="mt-4 max-w-xl text-sm leading-7 text-zinc-400">
              Stage 1 is a vehicle- and software-specific review for standard or near-standard
              hardware. The original ECU read and exact controller identity matter more than the
              model badge alone.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row lg:flex-col xl:flex-row">
              <Link
                href="/new-request"
                className="inline-flex items-center justify-center rounded-lg bg-[#b1121b] px-5 py-3.5 text-sm font-black text-white transition hover:bg-[#c91824]"
              >
                Start Stage 1 request
                <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
              </Link>
              <Link
                href="/tools/request-brief-builder"
                className="inline-flex items-center justify-center rounded-lg border border-white/15 bg-white/[0.04] px-5 py-3.5 text-sm font-black text-white transition hover:bg-white/10"
              >
                Prepare request details
              </Link>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {fitChecks.map((item) => {
              const Icon = item.icon;
              const isCaution = item.tone === "caution";

              return (
                <article key={item.title} className="rounded-lg border border-white/10 bg-black/30 p-5">
                  <div className="flex items-start gap-3">
                    <Icon
                      className={`mt-0.5 h-5 w-5 shrink-0 ${isCaution ? "text-amber-300" : "text-emerald-400"}`}
                      aria-hidden="true"
                    />
                    <div>
                      <h3 className="text-base font-black text-white">{item.title}</h3>
                      <p className="mt-2 text-sm leading-6 text-zinc-400">{item.text}</p>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>

        <div className="mt-8 grid gap-3 lg:grid-cols-2">
          <RouteDisclosure
            locale={locale}
            icon={CarFront}
            title="Stage 1 vehicle brand guides"
            description="Open the brand route before submitting when model, engine or controller context is unclear."
            routes={stage1BrandRoutes}
          />
          <RouteDisclosure
            locale={locale}
            icon={CircuitBoard}
            title="Stage 1 ECU platform guides"
            description="Use the controller guide to check the identity and read-method details needed with the original file."
            routes={stage1PlatformRoutes}
          />
        </div>
      </div>
    </section>
    </RuntimePublicLocalization>
  );
}

function RouteDisclosure({
  icon: Icon,
  title,
  description,
  routes,
  locale,
}: {
  icon: typeof CarFront;
  title: string;
  description: string;
  routes: ReadonlyArray<{ label: string; href: string }>;
  locale: LocaleCode;
}) {
  return (
    <RuntimePublicLocalization locale={locale} scopes={["core", "services"]}>
    <details className="group rounded-lg border border-white/10 bg-white/[0.035] p-5">
      <summary className="flex cursor-pointer list-none items-start justify-between gap-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-red-500">
        <span className="flex items-start gap-3">
          <Icon className="mt-0.5 h-5 w-5 shrink-0 text-red-500" aria-hidden="true" />
          <span>
            <span className="block text-base font-black text-white">{title}</span>
            <span className="mt-1 block text-sm leading-6 text-zinc-500">{description}</span>
          </span>
        </span>
        <span className="shrink-0 text-sm font-black text-red-400 group-open:hidden">View</span>
        <span className="hidden shrink-0 text-sm font-black text-red-400 group-open:inline">Close</span>
      </summary>
      <div className="mt-5 flex flex-wrap gap-2 border-t border-white/10 pt-5">
        {routes.map((route) => (
          <Link
            key={route.href}
            href={route.href}
            className="inline-flex items-center rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs font-bold text-zinc-200 transition hover:border-red-800/70 hover:text-white"
          >
            {route.label}
            <ArrowRight className="ml-1.5 h-3.5 w-3.5 text-red-500" aria-hidden="true" />
          </Link>
        ))}
      </div>
    </details>
    </RuntimePublicLocalization>
  );
}
