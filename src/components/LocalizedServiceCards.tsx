import type { LucideIcon } from "lucide-react";
import { RuntimePublicLocalization } from "@/components/RuntimePublicLocalization";
import type { LocaleCode } from "@/lib/i18nConfig";

export type SolutionCategory = {
  title: string;
  eyebrow: string;
  text: string;
  icon: LucideIcon;
  tone: "red" | "emerald" | "blue" | "amber";
  services: string[];
};

export function SolutionCategoryCard({
  category,
  locale,
}: {
  category: SolutionCategory;
  locale: LocaleCode;
}) {
  const Icon = category.icon;
  const toneClass =
    category.tone === "emerald"
      ? "border-emerald-500/25 bg-emerald-950/10 text-emerald-100"
      : category.tone === "blue"
        ? "border-blue-500/25 bg-blue-950/10 text-blue-100"
        : category.tone === "amber"
          ? "border-amber-500/25 bg-amber-950/10 text-amber-100"
          : "border-red-500/25 bg-red-950/10 text-red-100";

  return (
    <RuntimePublicLocalization locale={locale} scopes={["core", "services"]}>
      <article className="rounded-[1.5rem] border border-white/10 bg-white/[0.045] p-5 shadow-xl shadow-black/15">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.18em] text-red-300">
              {category.eyebrow}
            </div>
            <h3 className="mt-2 text-2xl font-black">{category.title}</h3>
          </div>
          <div
            className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl border ${toneClass}`}
          >
            <Icon className="h-6 w-6" />
          </div>
        </div>
        <p className="mt-4 min-h-20 text-sm leading-7 text-zinc-400">
          {category.text}
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          {category.services.map((service) => (
            <span
              key={service}
              className="rounded-full border border-white/10 bg-black/30 px-3 py-1.5 text-xs font-bold text-zinc-300"
            >
              {service}
            </span>
          ))}
        </div>
      </article>
    </RuntimePublicLocalization>
  );
}

export function DetailPanel({
  title,
  items,
  icon: Icon,
  locale,
}: {
  title: string;
  items: string[];
  icon: LucideIcon;
  locale: LocaleCode;
}) {
  return (
    <RuntimePublicLocalization locale={locale} scopes={["core", "services"]}>
      <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6">
        <Icon className="mb-5 h-8 w-8 text-red-500" />
        <h2 className="text-2xl font-black">{title}</h2>
        <div className="mt-5 grid gap-3">
          {items.map((item) => (
            <div
              key={item}
              className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm font-bold text-zinc-300"
            >
              {item}
            </div>
          ))}
        </div>
      </div>
    </RuntimePublicLocalization>
  );
}
