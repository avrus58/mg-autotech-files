import Link from "next/link";
import { Cpu, LayoutGrid } from "lucide-react";
import { RuntimePublicLocalization } from "@/components/RuntimePublicLocalization";
import type { LocaleCode } from "@/lib/i18nConfig";
import { getLocalizedPublicHref } from "@/lib/i18nRoutes";

export function PublicSeoHeader({ locale = "en" }: { locale?: LocaleCode }) {
  const href = (pathname: string) => getLocalizedPublicHref(pathname, locale);

  return (
    <RuntimePublicLocalization locale={locale} scopes={["core"]}>
      <header className="sticky top-0 z-40 border-b border-white/10 bg-black/90 text-white backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4">
        <Link href={href("/")} className="flex min-w-0 items-center gap-3" aria-label="MG AutoTech home">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-red-800/50 bg-[#111]">
            <Cpu className="h-6 w-6 text-red-500" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block whitespace-nowrap text-base font-black sm:text-lg">MG <span className="text-red-500">AUTOTECH</span></span>
            <span className="hidden text-[11px] text-zinc-400 sm:block">ECU / TCU File Service</span>
          </span>
        </Link>
        <nav
          aria-label="Primary navigation"
          className="hidden items-center gap-3 text-[13px] font-bold text-zinc-300 lg:flex xl:gap-4 [&_a]:whitespace-nowrap"
        >
          <Link href={href("/file-service")} className="hover:text-white">File service</Link>
          <Link href={href("/services")} className="hover:text-white">Services</Link>
          <Link href={href("/how-it-works")} className="hover:text-white">How it works</Link>
          <Link href={href("/brands")} className="hover:text-white">Vehicle brands</Link>
          <Link href={href("/ecu-platforms")} className="hover:text-white">ECU platforms</Link>
          <Link href={href("/workshop-guides")} className="hover:text-white">Workshop guides</Link>
          <Link href={href("/tools")} className="hover:text-white">Workshop tools</Link>
          <Link href={href("/about")} className="hover:text-white">About</Link>
          <Link href={href("/contact")} className="hover:text-white">Contact</Link>
        </nav>
        <div className="flex items-center gap-2">
          <Link
            href="/services"
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 text-zinc-200 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 lg:hidden"
            aria-label="Browse ECU file services"
            title="Services"
          >
            <LayoutGrid className="h-4 w-4" aria-hidden="true" />
          </Link>
          <Link href="/login" className="hidden rounded-lg border border-white/10 px-4 py-2.5 text-sm font-bold hover:bg-white/10 sm:inline-flex">Login</Link>
          <Link href="/new-request" className="rounded-lg bg-[#b1121b] px-3 py-2.5 text-sm font-black hover:bg-[#c91824] sm:px-4"><span className="sm:hidden">Request</span><span className="hidden sm:inline">Start request</span></Link>
        </div>
      </div>
      </header>
    </RuntimePublicLocalization>
  );
}
