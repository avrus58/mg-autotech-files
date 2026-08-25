"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import {
  Activity,
  BellRing,
  BrainCircuit,
  Braces,
  Clipboard,
  CreditCard,
  FileText,
  Gauge,
  History,
  LayoutDashboard,
  Plus,
  Settings,
  Upload,
  Wrench,
  type LucideIcon,
} from "lucide-react";

export type CustomerPortalActiveItem =
  | "dashboard"
  | "new-request"
  | "orders"
  | "needs-response"
  | "order-history"
  | "file-expert"
  | "log-analysis"
  | "widget"
  | "credits"
  | "credit-history"
  | "notifications"
  | "settings";

type CustomerPortalSidebarProps = {
  activeItem?: CustomerPortalActiveItem;
  credits: number | null;
};

type SidebarLinkItem = {
  activeKey: CustomerPortalActiveItem;
  href: string;
  label: string;
  icon: LucideIcon;
};

export const customerPortalSidebarSections: Array<{
  label: string;
  items: SidebarLinkItem[];
}> = [
  {
    label: "File Service",
    items: [
      { activeKey: "dashboard", href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { activeKey: "new-request", href: "/new-request", label: "New File Request", icon: Upload },
      { activeKey: "orders", href: "/dashboard/orders", label: "Active Orders", icon: FileText },
      {
        activeKey: "needs-response",
        href: "/dashboard/orders?view=needs_response",
        label: "Needs Response",
        icon: Clipboard,
      },
      { activeKey: "order-history", href: "/dashboard/orders?view=completed", label: "Order History", icon: History },
    ],
  },
  {
    label: "Tools",
    items: [
      { activeKey: "file-expert", href: "/dashboard/file-expert", label: "AI File Expert", icon: BrainCircuit },
      { activeKey: "log-analysis", href: "/dashboard/log-analysis", label: "Datalog Analysis Studio", icon: Activity },
      { activeKey: "widget", href: "/dashboard/widget", label: "Vehicle Widget", icon: Braces },
    ],
  },
  {
    label: "Account",
    items: [
      { activeKey: "credits", href: "/dashboard/credits", label: "Buy Credits", icon: CreditCard },
      { activeKey: "credit-history", href: "/dashboard/credits/history", label: "Credit History", icon: History },
      { activeKey: "notifications", href: "/dashboard/notifications", label: "Notifications", icon: BellRing },
      { activeKey: "settings", href: "/dashboard/settings", label: "Settings", icon: Settings },
    ],
  },
];

function formatSidebarCredits(credits: number | null) {
  if (credits === null || !Number.isFinite(credits)) return "--";
  return String(credits);
}

function SidebarNavLink({
  href,
  label,
  icon: Icon,
  active,
}: SidebarLinkItem & { active: boolean }) {
  const className = active
    ? "flex items-center gap-3 rounded-lg border border-[rgba(177,18,27,0.55)] bg-[rgba(177,18,27,0.18)] px-3 py-2.5 font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
    : "flex items-center gap-3 rounded-lg px-3 py-2.5 font-bold text-zinc-400 transition hover:bg-[#151515] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500";

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={className}
      data-customer-sidebar-link
    >
      <Icon className={`h-4 w-4 ${active ? "text-red-400" : ""}`} />
      <span className="min-w-0 truncate">{label}</span>
    </Link>
  );
}

export function CustomerPortalSidebar({
  activeItem = "dashboard",
  credits,
}: CustomerPortalSidebarProps) {
  const creditDisplay = formatSidebarCredits(credits);

  return (
    <aside
      data-customer-portal-sidebar
      className="hidden w-60 shrink-0 border-r border-[var(--mg-portal-border)] bg-[var(--mg-portal-sidebar)] lg:block"
    >
      <div className="sticky top-0 flex h-screen flex-col px-3 py-3">
        <Link href="/" className="mb-4 flex items-center gap-2.5 px-2">
          <div className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-red-800/60 bg-[var(--mg-portal-control)]">
            <div className="absolute -top-1.5 h-3 w-8 rounded-t-full border-t border-[#b1121b]" />
            <Gauge className="h-4 w-4 text-red-400" />
          </div>

          <div className="min-w-0">
            <div className="truncate text-sm font-black tracking-wide">
              MG <span className="text-red-500">AUTOTECH</span>
            </div>
            <div className="text-[11px] text-zinc-400">Customer Panel</div>
          </div>
        </Link>

        <nav
          aria-label="Primary navigation"
          className="mg-dense-scroll min-h-0 flex-1 space-y-3.5 overflow-y-auto pr-1 text-[13px]"
        >
          {customerPortalSidebarSections.map((section) => (
            <div key={section.label} className="space-y-1">
              <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-600">
                {section.label}
              </div>
              {section.items.map((item) => (
                <SidebarNavLink key={`${item.href}-${item.label}`} {...item} active={item.activeKey === activeItem} />
              ))}
            </div>
          ))}

          <a
            href="mailto:info@mgautotech.de"
            data-customer-sidebar-link
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 font-bold text-zinc-400 transition hover:bg-[#151515] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
          >
            <Wrench className="h-4 w-4" />
            <span className="min-w-0 truncate">Support</span>
          </a>
        </nav>

        <div className="mt-3 shrink-0 rounded-lg border border-[var(--mg-portal-border)] bg-[var(--mg-portal-surface)] p-2.5">
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-400">
            Current Balance
          </div>
          <div className="mt-1.5 flex items-end justify-between gap-3">
            <div className="min-w-0 truncate text-xl font-black tabular-nums">{creditDisplay}</div>
            <CreditCard className="mb-1 h-4 w-4 shrink-0 text-red-500" />
          </div>
          <div className="mt-1 text-[11px] text-zinc-400">Available Credits</div>
          <Link
            href="/dashboard/credits"
            className="mt-2.5 inline-flex h-8 w-full items-center justify-center rounded-lg bg-[#b1121b] px-3 text-xs font-black text-white transition hover:bg-[#c91824] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
          >
            <Plus className="mr-2 h-4 w-4" />
            Buy Credits
          </Link>
        </div>
      </div>
    </aside>
  );
}

export function CustomerPortalMobileNav({
  activeItem,
}: {
  activeItem: CustomerPortalActiveItem;
}) {
  const navRef = useRef<HTMLElement | null>(null);
  const activeLinkRef = useRef<HTMLAnchorElement | null>(null);

  useEffect(() => {
    const nav = navRef.current;
    const activeLink = activeLinkRef.current;
    if (!nav || !activeLink) return;

    const centeredLeft =
      activeLink.offsetLeft - (nav.clientWidth - activeLink.offsetWidth) / 2;
    nav.scrollTo({ left: Math.max(0, centeredLeft), behavior: "auto" });
  }, [activeItem]);

  return (
    <nav
      ref={navRef}
      aria-label="Mobile navigation"
      className="mg-dense-scroll flex gap-2 overflow-x-auto border-b border-[var(--mg-portal-border)] bg-[var(--mg-portal-sidebar)] px-4 py-2.5 lg:hidden"
    >
      {customerPortalSidebarSections.flatMap((section) =>
        section.items.map((item) => {
          const Icon = item.icon;
          const active = item.activeKey === activeItem;

          return (
            <Link
              ref={active ? activeLinkRef : undefined}
              key={`${section.label}-${item.href}-${item.activeKey}`}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={
                active
                  ? "inline-flex min-h-10 shrink-0 items-center rounded-lg border border-[rgba(177,18,27,0.55)] bg-[rgba(177,18,27,0.18)] px-3 py-2 text-xs font-black text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                  : "inline-flex min-h-10 shrink-0 items-center rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-black text-zinc-300 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
              }
            >
              <Icon className={`mr-2 h-4 w-4 ${active ? "text-red-400" : ""}`} />
              {item.label}
            </Link>
          );
        })
      )}
      <a
        href="mailto:info@mgautotech.de"
        className="inline-flex min-h-10 shrink-0 items-center rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-black text-zinc-300 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
      >
        <Wrench className="mr-2 h-4 w-4" />
        Support
      </a>
    </nav>
  );
}
