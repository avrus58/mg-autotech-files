import Link from "next/link";
import { Cpu, LayoutDashboard } from "lucide-react";

export function ToolsHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-black/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4">
        <Link href="/" className="flex min-w-0 items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-red-800/50 bg-[#111] shadow-lg shadow-red-950/40">
            <Cpu className="h-6 w-6 text-red-600" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-lg font-black tracking-wide">
              MG <span className="text-red-600">AUTOTECH</span>
            </span>
            <span className="block truncate text-[11px] text-zinc-500">
              Workshop Performance Tools
            </span>
          </span>
        </Link>

        <nav className="hidden items-center gap-6 text-sm font-bold text-zinc-400 md:flex">
          <Link href="/tools" className="text-white">
            Tools
          </Link>
          <Link href="/services/stage-1" className="transition hover:text-white">
            Services
          </Link>
          <Link href="/widget" className="transition hover:text-white">
            Vehicle Widget
          </Link>
        </nav>

        <Link
          href="/dashboard"
          className="inline-flex h-11 items-center justify-center rounded-lg bg-[#b1121b] px-4 text-xs font-black text-white shadow-lg shadow-red-950/30 transition hover:bg-[#c91824] sm:text-sm"
        >
          <LayoutDashboard className="mr-2 h-4 w-4" />
          <span className="hidden sm:inline">Customer portal</span>
          <span className="sm:hidden">Portal</span>
        </Link>
      </div>
    </header>
  );
}
