"use client";

import Link from "next/link";
import {
  ArrowRight,
  Cpu,
  Mail,
  MapPin,
  MessageCircle,
  ShieldCheck,
} from "lucide-react";

const services = [
  { label: "Stage 1 Tuning", href: "/services/stage-1-tuning" },
  { label: "DPF OFF", href: "/services/dpf-off" },
  { label: "EGR / AGR OFF", href: "/services/egr-off" },
  { label: "AdBlue OFF", href: "/services/adblue-off" },
  { label: "TCU Tuning", href: "/services/tcu-tuning" },
  { label: "ECU Cloning", href: "/services/ecu-cloning" },
];

const platform = [
  { label: "Upload File", href: "/new-request" },
  { label: "Buy Credits", href: "/dashboard/credits" },
  { label: "Login", href: "/login" },
  { label: "Register", href: "/register" },
  { label: "Dashboard", href: "/dashboard" },
];

const legal = [
  { label: "Impressum", href: "/impressum" },
  { label: "Datenschutz", href: "/datenschutz" },
  { label: "AGB", href: "/agb" },
  { label: "Widerruf", href: "/widerruf" },
];

export function Footer() {
  return (
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

        <div className="grid gap-10 lg:grid-cols-[1.2fr_.8fr_.8fr_.8fr_1.2fr]">
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
                href="mailto:info@mgautotech.de"
                className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-zinc-300 transition hover:border-red-800/60 hover:text-white"
                aria-label="Email MG AutoTech"
              >
                <Mail className="h-5 w-5" />
              </a>
              <a
                href="https://wa.me/"
                className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-zinc-300 transition hover:border-red-800/60 hover:text-white"
                aria-label="WhatsApp MG AutoTech"
              >
                <MessageCircle className="h-5 w-5" />
              </a>
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
              {legal.map((item) => (
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
                <span>Germany / Stuttgart area</span>
              </div>
              <div className="flex items-start gap-3">
                <Mail className="mt-0.5 h-5 w-5 text-red-500" />
                <a href="mailto:info@mgautotech.de" className="hover:text-white">
                  info@mgautotech.de
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
  );
}
