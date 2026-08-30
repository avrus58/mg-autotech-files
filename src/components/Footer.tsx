"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowRight,
  Cpu,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  ShieldCheck,
} from "lucide-react";
import { companyAddress, contactEmail, contactPhone } from "@/lib/seo";
import { LocalizedHomepageTree } from "@/lib/homepageLocalization";
import {
  getAnalyticsConsentLocale,
  getAnalyticsPrivacyPath,
} from "@/lib/analyticsConsentI18n";

const services = [
  { label: "Services Overview", href: "/services" },
  { label: "Stage 1 Tuning", href: "/services/stage-1" },
  { label: "Stage 2 File Service", href: "/services/stage-2" },
  { label: "Stage 3 Custom Calibration", href: "/services/stage-3" },
  { label: "Audi ECU Software", href: "/brands/audi" },
  { label: "TCU Tuning", href: "/services/tcu-tuning" },
  { label: "ECU File Check", href: "/services/ecu-file-check" },
  { label: "DPF OFF", href: "/services/dpf-off" },
  { label: "EGR / AGR OFF", href: "/services/egr-off" },
  { label: "AdBlue OFF", href: "/services/adblue-off" },
  { label: "DTC OFF", href: "/services/dtc-off" },
];

const platform = [
  { label: "File Service Hub", href: "/file-service" },
  { label: "How It Works", href: "/how-it-works" },
  { label: "Vehicle Brands", href: "/brands" },
  { label: "ECU Platforms", href: "/ecu-platforms" },
  { label: "Workshop Tools", href: "/tools" },
  { label: "Workshop Guides", href: "/workshop-guides" },
  { label: "Vehicle Widget", href: "/widget" },
  { label: "Windows App Beta", href: "/download/windows" },
  { label: "Upload File", href: "/new-request" },
  { label: "Buy Credits", href: "/dashboard/credits" },
  { label: "Login", href: "/login" },
  { label: "Register", href: "/register" },
  { label: "Dashboard", href: "/dashboard" },
];

const company = [
  { label: "About MG AutoTech", href: "/about" },
  { label: "Contact", href: "/contact" },
];

const whatsappNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.replace(/\D/g, "");
const whatsappMessage = encodeURIComponent(
  "Hello MG AutoTech, I need help with a file service request."
);
const whatsappHref = whatsappNumber
  ? `https://wa.me/${whatsappNumber}?text=${whatsappMessage}`
  : null;

export function Footer({ variant = "default" }: { variant?: "default" | "homepage" }) {
  const pathname = usePathname();
  const privacyLocale = getAnalyticsConsentLocale(pathname);
  const legalLinks = [
    { label: "Impressum", href: "/impressum" },
    {
      label: privacyLocale === "de" ? "Datenschutz" : "Privacy",
      href: getAnalyticsPrivacyPath(pathname),
    },
    { label: "AGB", href: "/agb" },
    { label: "Widerruf", href: "/widerruf" },
  ];

  if (variant === "homepage") {
    const compactGroups = [
      {
        title: "File Service",
        links: [
          { label: "Services Overview", href: "/services" },
          { label: "How It Works", href: "/how-it-works" },
          { label: "Vehicle Brands", href: "/brands" },
          { label: "ECU Platforms", href: "/ecu-platforms" },
        ],
      },
      {
        title: "Workshop",
        links: [
          { label: "Workshop Tools", href: "/tools" },
          { label: "Workshop Guides", href: "/workshop-guides" },
          { label: "Credit Prices", href: "/#prices" },
          { label: "Customer Dashboard", href: "/dashboard" },
        ],
      },
    ];

    return (
      <LocalizedHomepageTree>
        <footer id="contact" className="border-t border-white/10 bg-[#060607] text-white">
          <div className="mx-auto max-w-[86rem] px-4 py-10 sm:px-6">
            <div className="grid gap-8 lg:grid-cols-[1.25fr_.75fr_.75fr_1fr]">
              <div className="max-w-sm">
                <Link href="/" className="inline-flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-red-500/30 bg-red-500/10">
                    <Cpu className="h-5 w-5 text-red-500" />
                  </span>
                  <span>
                    <span className="block text-base font-black tracking-wide">MG <span className="text-red-500">AUTOTECH</span></span>
                    <span className="block text-[0.65rem] text-zinc-400">ECU / TCU File Service</span>
                  </span>
                </Link>
                <p className="mt-4 text-sm leading-6 text-zinc-400">
                  Professional ECU and TCU file service platform for customers, workshops and partners. Upload files, buy credits, track orders and download completed files online.
                </p>
              </div>

              {compactGroups.map((group) => (
                <div key={group.title}>
                  <h3 className="text-xs font-black uppercase tracking-[0.18em] text-zinc-300">{group.title}</h3>
                  <div className="mt-4 grid gap-2.5">
                    {group.links.map((item) => (
                      <Link key={item.label} href={item.href} className="w-fit text-sm text-zinc-400 transition hover:text-white">
                        {item.label}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}

              <div>
                <h3 className="text-xs font-black uppercase tracking-[0.18em] text-zinc-300">Contact</h3>
                <div className="mt-4 grid gap-3 text-sm text-zinc-400">
                  <a href={`mailto:${contactEmail}`} className="flex items-center gap-2 transition hover:text-white">
                    <Mail className="h-4 w-4 text-red-500" /> {contactEmail}
                  </a>
                  <a href={`tel:${contactPhone.replace(/\s/g, "")}`} className="flex items-center gap-2 transition hover:text-white">
                    <Phone className="h-4 w-4 text-red-500" /> {contactPhone}
                  </a>
                  <span className="flex items-start gap-2">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                    <span>{companyAddress.streetAddress}, {companyAddress.postalCode} {companyAddress.addressLocality}</span>
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-8 flex flex-col gap-4 border-t border-white/10 pt-5 text-xs text-zinc-400 md:flex-row md:items-center md:justify-between">
              <span>© 2026 MG AutoTech. All rights reserved.</span>
              <nav aria-label="Legal" className="flex flex-wrap gap-x-4 gap-y-2">
                {legalLinks.map((item) => (
                  <Link key={item.label} href={item.href} className="transition hover:text-zinc-300">{item.label}</Link>
                ))}
              </nav>
            </div>
          </div>
        </footer>
      </LocalizedHomepageTree>
    );
  }

  return (
    <LocalizedHomepageTree>
      <footer className="relative overflow-hidden border-t border-white/10 bg-[#07090d] text-white">
      <div className="absolute inset-0 opacity-40 bg-[radial-gradient(circle_at_80%_0%,rgba(177,18,27,0.24),transparent_32%),linear-gradient(135deg,#07090d,#10151f_55%,#08090d)]" />

      <div className="relative mx-auto max-w-7xl px-4 py-14">
        <div className="mb-12 border-b border-white/10 pb-8">
          <div className="flex flex-wrap items-center justify-center gap-8 opacity-50 grayscale">
            {["WinOLS", "Autotuner", "Alientech", "Magic Motorsport", "CMD", "Flex", "ECM Titanium"].map((item) => (
              <div
                key={item}
                className="rounded-xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-black tracking-wide text-zinc-300"
              >
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-[1.2fr_.8fr_.8fr_.8fr_1.2fr]">
          <div>
            <Link href="/" className="mb-5 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-red-800/50 bg-[#111] shadow-lg shadow-red-950/40">
                <Cpu className="h-7 w-7 text-red-600" />
              </div>
              <div>
                <div className="text-xl font-black tracking-wide">
                  MG <span className="text-red-600">AUTOTECH</span>
                </div>
                <div className="text-xs text-zinc-400">
                  ECU / TCU File Service
                </div>
              </div>
            </Link>

            <p className="max-w-sm text-sm leading-7 text-zinc-400">
              Professional ECU and TCU file service platform for customers,
              workshops and partners. Upload files, buy credits, track orders and
              download completed files online.
            </p>

            <div className="mt-5 flex flex-wrap gap-3">
              <a
                href={`mailto:${contactEmail}`}
                className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-zinc-300 transition hover:border-red-800/60 hover:text-white"
                aria-label="Email MG AutoTech"
              >
                <Mail className="h-5 w-5" />
              </a>
              {whatsappHref && (
                <a
                  href={whatsappHref}
                  className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-zinc-300 transition hover:border-red-800/60 hover:text-white"
                  aria-label="WhatsApp MG AutoTech"
                  target="_blank"
                  rel="noreferrer"
                >
                  <MessageCircle className="h-5 w-5" />
                </a>
              )}
            </div>
          </div>

          <div>
            <h3 className="mb-5 text-lg font-black">Services</h3>
            <div className="space-y-3">
              {services.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className="block text-sm text-zinc-400 transition hover:text-white"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>

          <div>
            <h3 className="mb-5 text-lg font-black">Platform</h3>
            <div className="space-y-3">
              {platform.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className="block text-sm text-zinc-400 transition hover:text-white"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>

          <div>
            <h3 className="mb-5 text-lg font-black">Legal</h3>
            <div className="space-y-3">
              {company.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className="block text-sm text-zinc-400 transition hover:text-white"
                >
                  {item.label}
                </Link>
              ))}
              {legalLinks.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className="block text-sm text-zinc-400 transition hover:text-white"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>

          <div>
            <h3 className="mb-5 text-lg font-black">Contact</h3>
            <div className="space-y-4 text-sm text-zinc-400">
              <div className="flex items-start gap-3">
                <MapPin className="mt-0.5 h-5 w-5 text-red-500" />
                <span>{companyAddress.streetAddress}<br />{companyAddress.postalCode} {companyAddress.addressLocality}, Germany</span>
              </div>
              <div className="flex items-start gap-3">
                <Phone className="mt-0.5 h-5 w-5 text-red-500" />
                <a href={`tel:${contactPhone.replace(/\s/g, "")}`} className="hover:text-white">
                  {contactPhone}
                </a>
              </div>
              <div className="flex items-start gap-3">
                <Mail className="mt-0.5 h-5 w-5 text-red-500" />
                <a href={`mailto:${contactEmail}`} className="hover:text-white">
                  {contactEmail}
                </a>
              </div>
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 text-red-500" />
                <span>Secure customer dashboard and private file workflow.</span>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-red-900/40 bg-red-950/20 p-5">
              <div className="text-sm font-black text-white">
                Ready to upload a file?
              </div>
              <Link
                href="/new-request"
                className="mt-4 inline-flex items-center rounded-xl bg-[#b1121b] px-4 py-3 text-sm font-black text-white transition hover:bg-[#c91824]"
              >
                Start Request
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-white/10 pt-6 text-sm text-zinc-500 md:flex-row md:items-center md:justify-between">
          <div>© 2026 MG AutoTech. All rights reserved.</div>
          <div>
            Professional ECU / TCU File Service Platform.
          </div>
        </div>
      </div>
      </footer>
    </LocalizedHomepageTree>
  );
}
