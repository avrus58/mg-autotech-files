import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

type CustomerPortalPageHeaderProps = {
  eyebrow: string;
  title: ReactNode;
  icon: LucideIcon;
  actions?: ReactNode;
  heading?: boolean;
  width?: "6xl" | "7xl" | "wide";
};

const widthClasses = {
  "6xl": "max-w-6xl",
  "7xl": "max-w-7xl",
  wide: "max-w-[1500px]",
} as const;

export function CustomerPortalPageHeader({
  eyebrow,
  title,
  icon: Icon,
  actions,
  heading = false,
  width = "7xl",
}: CustomerPortalPageHeaderProps) {
  const titleClassName = "break-words text-xl font-black text-white sm:text-2xl lg:text-xl";

  return (
    <header
      data-customer-page-header
      className="sticky top-0 z-40 shrink-0 border-b border-[var(--mg-portal-border)] bg-[var(--mg-portal-header)] backdrop-blur-xl"
    >
      <div
        className={`mx-auto flex min-h-[4.75rem] flex-wrap items-center justify-between gap-3 px-4 py-3 lg:min-h-16 lg:px-5 lg:py-2.5 ${widthClasses[width]}`}
      >
        <div className="flex min-w-0 flex-1 basis-56 items-center gap-3 lg:gap-2.5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-red-800/50 bg-red-950/25 text-red-400 lg:h-9 lg:w-9">
            <Icon className="h-5 w-5 lg:h-4 lg:w-4" />
          </span>
          <div className="min-w-0">
            <div className="break-words text-[10px] font-black uppercase tracking-[0.18em] text-red-500 sm:text-xs">
              {eyebrow}
            </div>
            {heading ? (
              <h1 className={titleClassName}>{title}</h1>
            ) : (
              <div className={titleClassName}>{title}</div>
            )}
          </div>
        </div>

        {actions ? <div className="flex max-w-full flex-wrap items-center gap-2 lg:gap-1.5">{actions}</div> : null}
      </div>
    </header>
  );
}
