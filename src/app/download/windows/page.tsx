import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Download, LockKeyhole, ShieldCheck, Wifi } from "lucide-react";
import { Footer } from "@/components/Footer";
import { PublicSeoHeader } from "@/components/PublicSeoHeader";
import { absoluteUrl, contactEmail, siteName } from "@/lib/seo";

const title = "MG AutoTech Windows Upload Assistant Beta";
const description = "The MG AutoTech File Upload Assistant for Windows is currently available only for selected beta customers. Public downloads are not enabled yet.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: absoluteUrl("/download/windows") },
  robots: { index: false, follow: true },
  openGraph: {
    title: `${title} | MG AutoTech`,
    description,
    url: absoluteUrl("/download/windows"),
    siteName,
    type: "website",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: title }],
  },
};

const safetyPoints = [
  {
    icon: Wifi,
    title: "Online verification required",
    text: "The app must connect to MG AutoTech before login, request creation or upload finalization.",
  },
  {
    icon: LockKeyhole,
    title: "Selected beta access",
    text: "Installer access is controlled manually while the Windows app remains in internal beta.",
  },
  {
    icon: ShieldCheck,
    title: "Private upload workflow",
    text: "The app uploads only customer-selected files through the secure MG AutoTech request flow.",
  },
];

export default function WindowsDownloadPage() {
  return (
    <main data-no-translate className="min-h-screen bg-[#050505] text-white">
      <PublicSeoHeader />

      <section className="border-b border-white/10 bg-[radial-gradient(circle_at_78%_12%,rgba(177,18,27,0.28),transparent_34%),#050505]">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 lg:grid-cols-[1.05fr_.95fr] lg:py-24">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-red-500">Windows beta</p>
            <h1 className="mt-6 max-w-4xl text-[clamp(2.5rem,7vw,5rem)] font-black leading-[0.96]">
              MG AutoTech File Upload Assistant
            </h1>
            <p className="mt-7 max-w-2xl text-lg leading-8 text-zinc-300">
              The Windows upload app is being prepared for selected beta customers. Public download is not enabled yet, and no installer is available from this page.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/new-request" className="inline-flex items-center justify-center rounded-lg bg-[#b1121b] px-6 py-4 text-sm font-black hover:bg-[#c91824]">
                Use Web Upload
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
              <a href={`mailto:${contactEmail}?subject=${encodeURIComponent("Windows Upload Assistant beta access")}`} className="inline-flex items-center justify-center rounded-lg border border-white/15 bg-white/[0.04] px-6 py-4 text-sm font-black hover:bg-white/10">
                Request Beta Access
              </a>
            </div>
          </div>

          <aside className="border border-white/10 bg-[#0b0d10] p-6">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-red-900/50 bg-red-950/30">
              <Download className="h-7 w-7 text-red-400" />
            </div>
            <h2 className="mt-6 text-2xl font-black">Download disabled</h2>
            <p className="mt-4 text-sm leading-7 text-zinc-400">
              MG AutoTech will publish a signed Windows build only after beta validation, installer signing, clean Windows testing and update-channel preparation are complete.
            </p>
            <div className="mt-6 rounded-xl border border-amber-800/40 bg-amber-950/20 p-4 text-sm leading-6 text-amber-100">
              There is no direct installer link on this page. Do not install MG AutoTech desktop builds from unofficial sources.
            </div>
          </aside>
        </div>
      </section>

      <section className="border-b border-white/10 bg-[#08090b]">
        <div className="mx-auto max-w-7xl px-4 py-14">
          <div className="grid gap-4 md:grid-cols-3">
            {safetyPoints.map(({ icon: Icon, title: itemTitle, text }) => (
              <article key={itemTitle} className="border border-white/10 bg-[#0d0f13] p-6">
                <Icon className="h-6 w-6 text-red-500" />
                <h2 className="mt-5 text-xl font-black">{itemTitle}</h2>
                <p className="mt-3 text-sm leading-7 text-zinc-400">{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#050505]">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-14 lg:grid-cols-2">
          <div className="border border-white/10 bg-[#0b0c0e] p-6">
            <h2 className="text-2xl font-black">Current recommendation</h2>
            <p className="mt-4 text-sm leading-7 text-zinc-300">
              Use the secure web dashboard for production requests until MG AutoTech enables beta desktop distribution for your account.
            </p>
            <Link href="/dashboard" className="mt-6 inline-flex items-center text-sm font-black text-red-400 hover:text-red-300">
              Open Dashboard
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </div>
          <div className="border border-white/10 bg-[#0b0c0e] p-6">
            <h2 className="text-2xl font-black">What the app does not do</h2>
            <p className="mt-4 text-sm leading-7 text-zinc-300">
              The upload assistant does not modify files, generate tuning files, work offline, access unrelated files or expose admin systems. It is only a secure customer upload client.
            </p>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
