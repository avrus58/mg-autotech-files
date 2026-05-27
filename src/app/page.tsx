"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { motion, type Variants } from "framer-motion";
import {
  ArrowRight,
  BadgeCheck,
  Car,
  CheckCircle2,
  ChevronDown,
  Clock3,
  CreditCard,
  Cpu,
  Download,
  FileCode2,
  Gauge,
  Lock,
  LogIn,
  Mail,
  MessageCircle,
  Search,
  ShieldCheck,
  Star,
  Upload,
  UserPlus,
  Wrench,
} from "lucide-react";
import { Footer } from "@/components/Footer";
import { OnlineStatus } from "@/components/OnlineStatus";

const services = [
  {
    title: "Stage 1",
    text: "Performance optimization for stock vehicles.",
    credits: "10 Credits",
  },
  {
    title: "DPF OFF",
    text: "Technical software solution for diesel vehicles.",
    credits: "6 Credits",
  },
  {
    title: "EGR / AGR OFF",
    text: "EGR related software solution and DTC support.",
    credits: "6 Credits",
  },
  {
    title: "AdBlue OFF",
    text: "SCR / AdBlue software solution for supported ECUs.",
    credits: "11 Credits",
  },
  {
    title: "DTC OFF",
    text: "Diagnostic trouble code removal by request.",
    credits: "4 Credits",
  },
  {
    title: "TCU Tuning",
    text: "Gearbox software optimization for supported TCUs.",
    credits: "Manual",
  },
];

const steps = [
  {
    icon: UserPlus,
    title: "Register",
    text: "Create your customer account inside the MG AutoTech portal.",
  },
  {
    icon: CreditCard,
    title: "Load Credits",
    text: "Buy credits and use them for file service requests.",
  },
  {
    icon: Upload,
    title: "Upload File",
    text: "Upload original ECU/TCU file and vehicle information.",
  },
  {
    icon: Download,
    title: "Download File",
    text: "Track the status and download the completed file.",
  },
];

const recentWorks = [
  { car: "Mercedes-Benz E-Class", job: "Stage 1", date: "Today" },
  { car: "BMW 320d", job: "EGR OFF", date: "Today" },
  { car: "Audi A6 3.0 TDI", job: "Stage 1 + DTC", date: "Yesterday" },
  { car: "VW Golf 7 GTD", job: "DPF / EGR", date: "Yesterday" },
];

const creditPackages = [
  { credits: "10", price: "€45", each: "€4.50 / Credit" },
  { credits: "50", price: "€225", each: "€4.50 / Credit" },
  { credits: "100", price: "€400", each: "€4.00 / Credit", popular: true },
  { credits: "250", price: "€875", each: "€3.50 / Credit" },
];

const securityItems = [
  { title: "Private Dashboard", icon: Lock },
  { title: "Database Credits", icon: CreditCard },
  { title: "Order Tracking", icon: Gauge },
  { title: "Workshop Ready", icon: Wrench },
  { title: "Secure Login", icon: ShieldCheck },
  { title: "File Workflow", icon: Upload },
];

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 34 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.65,
      ease: [0.16, 1, 0.3, 1],
    },
  },
};

const stagger: Variants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.1,
    },
  },
};

function AnimatedSection({
  children,
  className = "",
  id,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <motion.section
      id={id}
      variants={fadeUp}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.16 }}
      className={className}
    >
      {children}
    </motion.section>
  );
}

function FloatingTechBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(160,18,28,0.28),transparent_32%),linear-gradient(135deg,#050505,#0d0d0f_48%,#160608)]" />

      <motion.div
        animate={{
          x: [0, 45, 0],
          y: [0, -25, 0],
          opacity: [0.16, 0.3, 0.16],
        }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        className="absolute left-[8%] top-[18%] h-72 w-72 rounded-full bg-red-900/30 blur-3xl"
      />

      <motion.div
        animate={{
          x: [0, -35, 0],
          y: [0, 35, 0],
          opacity: [0.1, 0.22, 0.1],
        }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        className="absolute right-[8%] top-[28%] h-96 w-96 rounded-full bg-red-800/25 blur-3xl"
      />

      <motion.div
        animate={{ x: ["-20%", "120%"] }}
        transition={{ duration: 9, repeat: Infinity, ease: "linear" }}
        className="absolute top-[42%] h-px w-[260px] bg-gradient-to-r from-transparent via-red-700/60 to-transparent"
      />

      <motion.div
        animate={{ x: ["120%", "-20%"] }}
        transition={{ duration: 13, repeat: Infinity, ease: "linear" }}
        className="absolute top-[62%] h-px w-[340px] bg-gradient-to-r from-transparent via-white/20 to-transparent"
      />
    </div>
  );
}

function RatingStars() {
  return (
    <div className="flex items-center gap-1 text-red-500">
      {[1, 2, 3, 4, 5].map((item) => (
        <Star key={item} className="h-3 w-3 fill-current" />
      ))}
    </div>
  );
}

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#050505] text-white">
      <FloatingTechBackground />

      <header className="sticky top-0 z-50 border-b border-white/10 bg-black/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-2 text-xs text-zinc-300">
          <div className="hidden items-center gap-3 md:flex">
            <RatingStars />
            <span className="rounded-md bg-[#b1121b] px-2 py-0.5 font-bold text-white">
              9.9/10
            </span>
            <span className="flex items-center gap-1">
              <Mail className="h-3 w-3" />
              Email Support
            </span>
          </div>

          <div className="ml-auto flex items-center gap-5">
            <a href="#services" className="hover:text-white">
              Services
            </a>
            <a href="#prices" className="hover:text-white">
              Prices
            </a>
            <a href="#contact" className="hover:text-white">
              Contact
            </a>
            <Link href="/login" className="hover:text-white">
              Login
            </Link>
          </div>
        </div>

        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5">
          <Link href="/" className="flex items-center gap-3">
            <motion.div
              whileHover={{ scale: 1.05, rotate: -1 }}
              className="relative flex h-12 w-12 items-center justify-center rounded-2xl border border-red-800/50 bg-[#111] shadow-lg shadow-red-950/40"
            >
              <div className="absolute -top-2 h-5 w-10 rounded-t-full border-t-2 border-red-700" />
              <Cpu className="h-7 w-7 text-red-600" />
            </motion.div>

            <div>
              <div className="text-xl font-black tracking-wide">
                MG <span className="text-red-600">AUTOTECH</span>
              </div>
              <div className="text-xs text-zinc-400">
                ECU / TCU File Service
              </div>
            </div>
          </Link>

          <nav className="hidden items-center gap-7 text-sm font-semibold text-zinc-300 lg:flex">
            <a href="#home" className="text-red-500">
              Home
            </a>
            <a href="#workflow" className="hover:text-white">
              How It Works
            </a>
            <a href="#services" className="hover:text-white">
              Services
            </a>
            <a href="#prices" className="hover:text-white">
              Credit Prices
            </a>
            <a href="#security" className="hover:text-white">
              Security
            </a>
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="hidden rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white transition duration-300 hover:bg-white/10 md:flex"
            >
              <LogIn className="mr-2 h-4 w-4" />
              Login
            </Link>

            <Link
              href="/register"
              className="rounded-xl bg-[#b1121b] px-5 py-3 text-sm font-black text-white shadow-lg shadow-red-950/40 transition duration-300 hover:-translate-y-0.5 hover:bg-[#c91824]"
            >
              Register
            </Link>
          </div>
        </div>
      </header>

      <section id="home" className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(0,0,0,0.94),rgba(0,0,0,0.68),rgba(0,0,0,0.94))]" />
        <motion.div
          animate={{ rotate: [0, 2, 0], scale: [1, 1.02, 1] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute right-[-140px] top-14 -z-10 hidden h-[520px] w-[900px] rounded-full border-[32px] border-red-800/50 opacity-70 lg:block"
        />
        <div className="absolute right-[-20px] top-36 -z-10 hidden h-[280px] w-[650px] rounded-[4rem] bg-[linear-gradient(135deg,#111,#050505)] opacity-80 shadow-2xl shadow-black lg:block" />
        <motion.div
          animate={{ opacity: [0.55, 1, 0.55], width: ["420px", "540px", "420px"] }}
          transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
          className="absolute right-20 top-52 -z-10 hidden h-3 rounded-full bg-red-700 blur-sm lg:block"
        />
        <motion.div
          animate={{ opacity: [0.55, 1, 0.55] }}
          transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute right-32 top-52 -z-10 hidden h-1 w-[480px] rounded-full bg-red-500 lg:block"
        />

        <div className="mx-auto grid max-w-7xl gap-12 px-4 py-20 lg:grid-cols-[1.05fr_.95fr] lg:items-center">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55 }}
          >
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-red-800/50 bg-red-950/25 px-4 py-2 text-sm font-semibold text-red-100">
              <BadgeCheck className="h-4 w-4 text-red-500" />
              Professional online file service platform
            </div>

            <h1 className="max-w-4xl text-5xl font-black uppercase leading-[1.05] tracking-[0.08em] md:text-7xl">
              Custom ECU & TCU
              <span className="block text-red-600">Tuning Files</span>
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-300">
              Upload original ECU/TCU files, select your service, track your
              order and download the completed file directly through the secure
              MG AutoTech customer portal.
            </p>

            <div className="mt-9 flex flex-wrap gap-4">
              <Link
                href="/login"
                className="rounded-xl border border-white/10 bg-white/10 px-10 py-4 font-black text-white transition duration-300 hover:-translate-y-1 hover:bg-white/15"
              >
                Login
              </Link>

              <Link
                href="/register"
                className="rounded-xl bg-[#b1121b] px-10 py-4 font-black text-white shadow-xl shadow-red-950/40 transition duration-300 hover:-translate-y-1 hover:bg-[#c91824]"
              >
                Register
              </Link>

              <Link
                href="/new-request"
                className="rounded-xl border border-red-800/50 px-10 py-4 font-black text-white transition duration-300 hover:-translate-y-1 hover:bg-red-950/25"
              >
                Upload File
              </Link>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.96, x: 24 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.12 }}
            className="hidden lg:block"
          >
            <motion.div
              animate={{ y: [0, -9, 0] }}
              transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut" }}
              className="relative"
            >
              <div className="absolute -inset-8 -z-10 rounded-[3rem] bg-red-700/20 blur-3xl" />
              <div className="absolute -right-6 -top-6 z-10 rounded-2xl border border-red-800/50 bg-black/80 px-4 py-3 shadow-2xl shadow-black backdrop-blur-xl">
                <div className="flex items-center gap-3">
                  <span className="flex h-3 w-3 rounded-full bg-emerald-400 shadow-lg shadow-emerald-500/40" />
                  <div>
                    <div className="text-xs font-black uppercase tracking-[0.18em] text-emerald-300">
                      Live Workflow
                    </div>
                    <div className="text-xs text-zinc-400">Secure file processing</div>
                  </div>
                </div>
              </div>

              <div className="overflow-hidden rounded-[2.25rem] border border-white/10 bg-[#08090c]/80 shadow-2xl shadow-black backdrop-blur-xl">
                <div className="border-b border-white/10 bg-white/[0.035] px-6 py-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-black uppercase tracking-[0.22em] text-red-500">
                        MG AutoTech Portal
                      </div>
                      <div className="mt-1 text-2xl font-black">
                        File Request Console
                      </div>
                    </div>

                    <div className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs font-black text-emerald-300">
                      Ready
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 p-6">
                  <div className="rounded-3xl border border-white/10 bg-black/45 p-5">
                    <div className="mb-4 flex items-start justify-between gap-4">
                      <div>
                        <div className="text-sm text-zinc-400">Vehicle</div>
                        <div className="mt-1 text-xl font-black">
                          Mercedes-Benz E-Class
                        </div>
                        <div className="mt-1 text-sm text-zinc-500">
                          2.2 CDI · Bosch EDC17 · OBD Read
                        </div>
                      </div>

                      <div className="rounded-2xl bg-red-950/35 p-3 text-right">
                        <div className="text-xs text-zinc-400">Order</div>
                        <div className="font-black text-red-400">#MGA-2405</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                        <Gauge className="mb-3 h-5 w-5 text-red-500" />
                        <div className="text-xs text-zinc-500">Service</div>
                        <div className="mt-1 font-black">Stage 1</div>
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                        <CreditCard className="mb-3 h-5 w-5 text-red-500" />
                        <div className="text-xs text-zinc-500">Credits</div>
                        <div className="mt-1 font-black">25 Used</div>
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                        <Download className="mb-3 h-5 w-5 text-emerald-400" />
                        <div className="text-xs text-zinc-500">Status</div>
                        <div className="mt-1 font-black text-emerald-300">Done</div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-red-900/40 bg-red-950/15 p-5">
                    <div className="mb-4 flex items-center justify-between">
                      <div className="font-black">Calibration Summary</div>
                      <div className="rounded-full bg-black/35 px-3 py-1 text-xs font-bold text-zinc-300">
                        Verified
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div className="rounded-2xl bg-black/35 p-4">
                        <div className="text-xs text-zinc-500">Stock</div>
                        <div className="mt-1 text-xl font-black">136 HP</div>
                        <div className="mt-1 text-xs text-zinc-500">360 Nm</div>
                      </div>

                      <div className="rounded-2xl border border-red-800/50 bg-red-950/35 p-4">
                        <div className="text-xs text-zinc-500">Optimized</div>
                        <div className="mt-1 text-xl font-black">200 HP</div>
                        <div className="mt-1 text-xs text-zinc-500">430 Nm</div>
                      </div>

                      <div className="rounded-2xl bg-black/35 p-4">
                        <div className="text-xs text-zinc-500">Gain</div>
                        <div className="mt-1 text-xl font-black text-red-500">+64 HP</div>
                        <div className="mt-1 text-xs text-red-400">+70 Nm</div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-white/10 bg-black/45 p-5">
                    <div className="mb-4 flex items-center justify-between">
                      <div className="font-black">Processing Timeline</div>
                      <Clock3 className="h-5 w-5 text-zinc-500" />
                    </div>

                    <div className="space-y-3">
                      {[
                        "Original file uploaded",
                        "ECU data checked",
                        "Custom file prepared",
                        "Modified file ready",
                      ].map((item) => (
                        <div key={item} className="flex items-center gap-3 text-sm">
                          <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                          <span className="text-zinc-300">{item}</span>
                          <span className="ml-auto h-px w-12 bg-gradient-to-r from-red-700 to-transparent" />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>

        <div className="relative bg-[#b1121b] py-10">
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_70%_0%,white,transparent_28%)]" />
          <div className="mx-auto max-w-7xl px-4">
            <h2 className="text-2xl font-black md:text-3xl">
              View tuning data and create your file request online.
            </h2>

            <div className="mt-7 grid gap-4 md:grid-cols-5">
              {[
                "Select Vehicle Brand",
                "Choose Model",
                "Select Generation",
                "Select Engine",
              ].map((item) => (
                <button
                  key={item}
                  className="flex items-center justify-between rounded-md bg-white/10 px-4 py-4 text-left text-sm font-bold text-white backdrop-blur transition duration-300 hover:-translate-y-1 hover:bg-white/15"
                >
                  {item}
                  <ChevronDown className="h-4 w-4" />
                </button>
              ))}

              <Link
                href="/new-request"
                className="flex items-center justify-center rounded-md bg-white px-4 py-4 text-sm font-black text-[#b1121b] transition duration-300 hover:-translate-y-1 hover:bg-zinc-100"
              >
                <Search className="mr-2 h-4 w-4" />
                Search
              </Link>
            </div>
          </div>
        </div>
      </section>

      <AnimatedSection id="workflow" className="bg-[#0b1226] py-20">
        <div className="mx-auto max-w-7xl px-4">
          <div className="mb-12 flex items-end justify-between gap-6">
            <div>
              <div className="text-sm font-black uppercase tracking-[0.25em] text-red-500">
                Workflow
              </div>
              <h2 className="mt-3 text-4xl font-black uppercase tracking-wide md:text-5xl">
                Get your files in 4 simple steps
              </h2>
              <p className="mt-3 text-zinc-400">
                A clean process for customers, workshops and partners.
              </p>
            </div>

            <Link
              href="/register"
              className="hidden rounded-xl bg-[#b1121b] p-4 text-white transition duration-300 hover:-translate-y-1 hover:bg-[#c91824] md:block"
            >
              <ArrowRight />
            </Link>
          </div>

          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.2 }}
            className="grid gap-5 md:grid-cols-4"
          >
            {steps.map((step, index) => {
              const Icon = step.icon;

              return (
                <motion.div
                  variants={fadeUp}
                  key={step.title}
                  className={`relative rounded-3xl border border-white/10 bg-white/[0.04] p-7 text-center transition duration-300 hover:-translate-y-2 hover:border-red-800/60 hover:bg-white/[0.07] ${
                    index === 1 || index === 3 ? "md:mt-10" : ""
                  }`}
                >
                  <Icon className="mx-auto mb-5 h-10 w-10 text-red-500" />
                  <h3 className="text-xl font-black">{step.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-zinc-400">
                    {step.text}
                  </p>
                  <div className="absolute -bottom-5 left-1/2 flex h-11 w-11 -translate-x-1/2 items-center justify-center rounded-full bg-[#b1121b] text-lg font-black shadow-lg shadow-red-950/40">
                    {index + 1}
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </AnimatedSection>

      <AnimatedSection id="services" className="bg-[#eef1f4] py-20 text-[#111827]">
        <div className="mx-auto max-w-7xl px-4">
          <div className="mb-12">
            <div className="text-sm font-black uppercase tracking-[0.25em] text-red-700">
              Our Services
            </div>
            <h2 className="mt-3 max-w-3xl text-4xl font-black md:text-5xl">
              Professional ECU and TCU software solutions.
            </h2>
          </div>

          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.18 }}
            className="grid gap-5 md:grid-cols-3"
          >
            {services.map((service) => (
              <motion.div
                variants={fadeUp}
                key={service.title}
                className="rounded-3xl bg-white p-6 shadow-xl shadow-black/5 transition duration-300 hover:-translate-y-2 hover:shadow-2xl"
              >
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-700">
                  <FileCode2 />
                </div>
                <h3 className="text-xl font-black">{service.title}</h3>
                <p className="mt-3 text-sm leading-6 text-zinc-600">
                  {service.text}
                </p>
                <div className="mt-5 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-black text-red-700">
                  {service.credits}
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </AnimatedSection>

      <AnimatedSection className="bg-[#050505] py-20">
        <div className="mx-auto max-w-7xl px-4">
          <div className="mb-10">
            <div className="text-sm font-black uppercase tracking-[0.25em] text-red-600">
              Latest Works
            </div>
            <h2 className="mt-3 text-4xl font-black md:text-5xl">
              Recent file service requests
            </h2>
          </div>

          <div className="grid gap-5 md:grid-cols-4">
            {recentWorks.map((work) => (
              <div
                key={work.car}
                className="rounded-3xl border border-red-900/50 bg-white/[0.03] p-6 transition duration-300 hover:-translate-y-2 hover:border-red-700 hover:bg-white/[0.06]"
              >
                <Car className="mb-5 h-10 w-10 text-zinc-500" />
                <h3 className="font-black">{work.car}</h3>
                <p className="mt-4 text-sm font-bold text-red-500">
                  {work.job}
                </p>
                <p className="mt-4 text-xs text-zinc-500">{work.date}</p>
              </div>
            ))}
          </div>
        </div>
      </AnimatedSection>

      <AnimatedSection id="prices" className="bg-[#0b1226] py-20">
        <div className="mx-auto max-w-7xl px-4">
          <div className="mb-10">
            <div className="text-sm font-black uppercase tracking-[0.25em] text-red-500">
              Credit Prices
            </div>
            <h2 className="mt-3 text-4xl font-black md:text-5xl">
              Flexible credit packages
            </h2>
            <p className="mt-3 text-zinc-400">
              Volume based pricing for customers, workshops and partners.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-4">
            {creditPackages.map((pack) => (
              <div
                key={pack.credits}
                className={`relative rounded-3xl border p-7 transition duration-300 hover:-translate-y-2 hover:shadow-2xl hover:shadow-red-950/30 ${
                  pack.popular
                    ? "border-red-700 bg-white/[0.08]"
                    : "border-white/10 bg-white/[0.04]"
                }`}
              >
                {pack.popular && (
                  <div className="absolute right-5 top-5 rounded-full bg-[#b1121b] px-3 py-1 text-xs font-black">
                    Popular
                  </div>
                )}
                <div className="text-sm text-zinc-400">
                  {pack.credits} Credits
                </div>
                <div className="mt-4 text-4xl font-black">{pack.price}</div>
                <div className="mt-3 text-sm text-zinc-400">{pack.each}</div>
                <Link
                  href="/dashboard/credits"
                  className="mt-7 block rounded-xl border border-red-800/70 px-5 py-3 text-center font-black text-white transition duration-300 hover:bg-red-950/30"
                >
                  Buy
                </Link>
              </div>
            ))}
          </div>
        </div>
      </AnimatedSection>

      <AnimatedSection id="security" className="bg-[#050505] py-20">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <div className="text-sm font-black uppercase tracking-[0.25em] text-red-600">
              Security
            </div>
            <h2 className="mt-3 text-4xl font-black md:text-5xl">
              Secure customer portal with controlled file workflow.
            </h2>
            <p className="mt-5 leading-8 text-zinc-400">
              Customers can only access their own dashboard, credits and orders.
              Critical actions like credits, files and order status stay
              controlled by backend logic and database rules.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {securityItems.map((item) => {
              const Icon = item.icon;

              return (
                <div
                  key={item.title}
                  className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 transition duration-300 hover:-translate-y-2 hover:border-red-800/60 hover:bg-white/[0.07]"
                >
                  <Icon className="mb-4 h-7 w-7 text-red-600" />
                  <div className="font-black">{item.title}</div>
                </div>
              );
            })}
          </div>
        </div>
      </AnimatedSection>

      <section id="contact" className="bg-[#b1121b] py-16">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 px-4 md:flex-row md:items-center">
          <div>
            <h2 className="text-4xl font-black">
              Start your next file request.
            </h2>
            <p className="mt-3 text-red-100">
              Register, login and create your first MG AutoTech file request.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/register"
              className="rounded-xl bg-white px-7 py-4 font-black text-[#b1121b] transition duration-300 hover:-translate-y-1 hover:bg-zinc-100"
            >
              Create Account
            </Link>
            <Link
              href="/login"
              className="rounded-xl border border-white/30 px-7 py-4 font-black text-white transition duration-300 hover:-translate-y-1 hover:bg-white/10"
            >
              Login
            </Link>
            <a
              href="mailto:info@mgautotech.de"
              className="rounded-xl border border-white/30 px-7 py-4 font-black text-white transition duration-300 hover:-translate-y-1 hover:bg-white/10"
            >
              <MessageCircle className="mr-2 inline h-5 w-5" />
              Contact
            </a>
          </div>
        </div>
      </section>

      <Footer />
      <OnlineStatus />
    </main>
  );
}