"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BadgeCheck,
  Car,
  CheckCircle2,
  Clock3,
  CreditCard,
  Cpu,
  Download,
  FileCode2,
  Gauge,
  Lock,
  LogIn,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Upload,
  UserPlus,
  Wrench,
  Zap,
} from "lucide-react";

const services = [
  "Stage 1 Tuning",
  "Stage 2 Tuning",
  "DPF OFF",
  "EGR / AGR OFF",
  "AdBlue / SCR OFF",
  "DTC OFF",
  "VMAX OFF",
  "TCU Tuning",
];

const stats = [
  { label: "Secure Customer Portal", value: "24/7" },
  { label: "Credit Based Ordering", value: "Live" },
  { label: "ECU / TCU File Service", value: "Pro" },
];

const workflow = [
  {
    icon: UserPlus,
    title: "Create Account",
    text: "Register and manage your MG AutoTech file service profile.",
  },
  {
    icon: CreditCard,
    title: "Buy Credits",
    text: "Use credits for tuning files, solutions and technical services.",
  },
  {
    icon: Upload,
    title: "Upload File",
    text: "Submit original ECU/TCU file, vehicle data and customer request.",
  },
  {
    icon: Download,
    title: "Download Result",
    text: "Track your order and download the completed file securely.",
  },
];

const benefits = [
  "No generic file workflow",
  "Private customer dashboard",
  "Credit balance from database",
  "Order tracking system",
  "Secure login/register",
  "Workshop and partner ready",
];

export default function HomePage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#070707] text-white">
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_20%_10%,rgba(220,38,38,0.35),transparent_30%),radial-gradient(circle_at_80%_20%,rgba(255,255,255,0.10),transparent_25%),linear-gradient(135deg,#050505,#111111_45%,#190404)]" />
      <div className="fixed inset-0 -z-10 opacity-[0.06] bg-[linear-gradient(rgba(255,255,255,.8)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.8)_1px,transparent_1px)] bg-[size:56px_56px]" />

      <header className="sticky top-0 z-50 border-b border-white/10 bg-black/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-600 shadow-lg shadow-red-600/30">
              <Cpu className="h-7 w-7 text-white" />
            </div>
            <div>
              <div className="text-xl font-black tracking-wide">MG AutoTech</div>
              <div className="text-xs text-zinc-400">
                ECU / TCU File Service Platform
              </div>
            </div>
          </Link>

          <nav className="hidden items-center gap-7 text-sm text-zinc-300 lg:flex">
            <a href="#services" className="hover:text-white">Services</a>
            <a href="#workflow" className="hover:text-white">Workflow</a>
            <a href="#security" className="hover:text-white">Security</a>
            <a href="#contact" className="hover:text-white">Contact</a>
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="hidden rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10 md:flex"
            >
              <LogIn className="mr-2 h-4 w-4" />
              Login
            </Link>

            <Link
              href="/register"
              className="rounded-full bg-red-600 px-5 py-2 text-sm font-bold text-white shadow-lg shadow-red-600/30 hover:bg-red-500"
            >
              Register
            </Link>
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-12 px-4 py-16 md:py-24 lg:grid-cols-[1.05fr_.95fr] lg:items-center">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55 }}
        >
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-red-500/30 bg-red-600/10 px-4 py-2 text-sm font-semibold text-red-100">
            <Sparkles className="h-4 w-4 text-red-400" />
            Professional file service for workshops & partners
          </div>

          <h1 className="max-w-4xl text-5xl font-black leading-[1.02] tracking-tight md:text-7xl">
            Premium ECU & TCU
            <span className="block bg-gradient-to-r from-red-500 via-white to-red-200 bg-clip-text text-transparent">
              File Service Platform
            </span>
          </h1>

          <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-300">
            Upload original files, select professional software solutions, track
            your order and download the completed file through a secure MG AutoTech
            customer portal.
          </p>

          <div className="mt-8 flex flex-wrap gap-4">
            <Link
              href="/new-request"
              className="rounded-2xl bg-red-600 px-6 py-4 font-black text-white shadow-xl shadow-red-600/30 hover:bg-red-500"
            >
              <Upload className="mr-2 inline h-5 w-5" />
              Upload File
            </Link>

            <Link
              href="/dashboard"
              className="rounded-2xl border border-white/15 bg-white/5 px-6 py-4 font-black text-white hover:bg-white/10"
            >
              <CreditCard className="mr-2 inline h-5 w-5" />
              Buy Credits
            </Link>

            <a
              href="#contact"
              className="rounded-2xl border border-white/15 px-6 py-4 font-black text-zinc-200 hover:bg-white/10"
            >
              <MessageCircle className="mr-2 inline h-5 w-5" />
              Contact
            </a>
          </div>

          <div className="mt-10 grid max-w-2xl grid-cols-1 gap-3 sm:grid-cols-3">
            {stats.map((item) => (
              <div
                key={item.label}
                className="rounded-3xl border border-white/10 bg-white/[0.04] p-5"
              >
                <div className="text-3xl font-black text-white">{item.value}</div>
                <div className="mt-2 text-sm text-zinc-400">{item.label}</div>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.55, delay: 0.1 }}
          className="relative"
        >
          <div className="absolute -inset-6 rounded-[3rem] bg-red-600/20 blur-3xl" />

          <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#111]/90 shadow-2xl shadow-black">
            <div className="border-b border-white/10 bg-white/[0.04] p-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-zinc-400">Customer Dashboard</div>
                  <div className="text-xl font-black">Order #MGA-2026-001</div>
                </div>
                <div className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-300">
                  Completed
                </div>
              </div>
            </div>

            <div className="grid gap-4 p-5">
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-3xl bg-red-600/15 p-4">
                  <CreditCard className="mb-3 h-5 w-5 text-red-300" />
                  <div className="text-3xl font-black">50</div>
                  <div className="text-xs text-zinc-400">Credits</div>
                </div>

                <div className="rounded-3xl bg-white/[0.05] p-4">
                  <Clock3 className="mb-3 h-5 w-5 text-zinc-300" />
                  <div className="text-3xl font-black">1</div>
                  <div className="text-xs text-zinc-400">Open</div>
                </div>

                <div className="rounded-3xl bg-white/[0.05] p-4">
                  <Download className="mb-3 h-5 w-5 text-zinc-300" />
                  <div className="text-3xl font-black">12</div>
                  <div className="text-xs text-zinc-400">Done</div>
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-black/30 p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div className="font-bold">Mercedes-Benz E-Class</div>
                  <div className="text-sm font-bold text-red-300">Stage 1</div>
                </div>

                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="rounded-2xl bg-white/[0.05] p-3">
                    <div className="text-xs text-zinc-400">Stock</div>
                    <div className="mt-1 font-black">136 HP</div>
                  </div>
                  <div className="rounded-2xl bg-red-600/15 p-3">
                    <div className="text-xs text-zinc-400">Tuned</div>
                    <div className="mt-1 font-black">200 HP</div>
                  </div>
                  <div className="rounded-2xl bg-white/[0.05] p-3">
                    <div className="text-xs text-zinc-400">Gain</div>
                    <div className="mt-1 font-black text-red-300">+64 HP</div>
                  </div>
                </div>
              </div>

              {[
                "Original file uploaded",
                "ECU data checked",
                "Software solution prepared",
                "Modified file ready",
              ].map((item) => (
                <div
                  key={item}
                  className="flex items-center gap-3 rounded-2xl bg-white/[0.04] p-3 text-sm text-zinc-300"
                >
                  <CheckCircle2 className="h-5 w-5 text-emerald-300" />
                  {item}
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </section>

      <section id="services" className="border-y border-white/10 bg-white/[0.025] py-16">
        <div className="mx-auto max-w-7xl px-4">
          <div className="mb-10 max-w-3xl">
            <div className="mb-3 text-sm font-black uppercase tracking-[0.25em] text-red-400">
              Services
            </div>
            <h2 className="text-4xl font-black md:text-5xl">
              Professional software solutions for modern vehicles.
            </h2>
            <p className="mt-4 text-zinc-400">
              Clean file service workflow for ECU tuning, TCU tuning and technical software solutions.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {services.map((service) => (
              <div
                key={service}
                className="rounded-3xl border border-white/10 bg-black/30 p-5 transition hover:border-red-500/40 hover:bg-red-600/10"
              >
                <FileCode2 className="mb-4 h-6 w-6 text-red-400" />
                <div className="font-bold">{service}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="workflow" className="mx-auto max-w-7xl px-4 py-16">
        <div className="mb-10 text-center">
          <div className="mb-3 text-sm font-black uppercase tracking-[0.25em] text-red-400">
            Workflow
          </div>
          <h2 className="text-4xl font-black md:text-5xl">
            From upload to completed file.
          </h2>
        </div>

        <div className="grid gap-5 md:grid-cols-4">
          {workflow.map((step, index) => {
            const Icon = step.icon;

            return (
              <div
                key={step.title}
                className="rounded-3xl border border-white/10 bg-white/[0.04] p-6"
              >
                <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-600/15 text-red-300">
                  <Icon className="h-7 w-7" />
                </div>
                <div className="text-sm font-black text-red-400">
                  STEP {index + 1}
                </div>
                <h3 className="mt-2 text-xl font-black">{step.title}</h3>
                <p className="mt-3 text-sm leading-6 text-zinc-400">{step.text}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section id="security" className="border-y border-white/10 bg-white/[0.025] py-16">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 lg:grid-cols-[.9fr_1.1fr] lg:items-center">
          <div>
            <div className="mb-3 text-sm font-black uppercase tracking-[0.25em] text-red-400">
              Security
            </div>
            <h2 className="text-4xl font-black md:text-5xl">
              Built for secure customer accounts and controlled file handling.
            </h2>
            <p className="mt-5 leading-8 text-zinc-400">
              Customers only access their own dashboard, credits and orders.
              Sensitive actions like credit balance, order status and file access
              stay controlled through the backend and database rules.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {benefits.map((item) => (
              <div
                key={item}
                className="rounded-3xl border border-white/10 bg-black/30 p-5"
              >
                <ShieldCheck className="mb-4 h-6 w-6 text-red-400" />
                <div className="font-bold">{item}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="contact" className="mx-auto max-w-7xl px-4 py-16">
        <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.04]">
          <div className="grid lg:grid-cols-[1fr_.8fr]">
            <div className="p-8 md:p-12">
              <div className="mb-3 text-sm font-black uppercase tracking-[0.25em] text-red-400">
                MG AutoTech
              </div>
              <h2 className="text-4xl font-black md:text-5xl">
                Start your next file request.
              </h2>
              <p className="mt-5 max-w-2xl leading-8 text-zinc-400">
                Register, login and create your first file request directly inside
                the MG AutoTech customer portal.
              </p>

              <div className="mt-8 flex flex-wrap gap-4">
                <Link
                  href="/register"
                  className="rounded-2xl bg-red-600 px-6 py-4 font-black text-white shadow-lg shadow-red-600/30 hover:bg-red-500"
                >
                  Create Account
                  <ArrowRight className="ml-2 inline h-5 w-5" />
                </Link>

                <Link
                  href="/login"
                  className="rounded-2xl border border-white/15 px-6 py-4 font-black text-white hover:bg-white/10"
                >
                  Login
                </Link>
              </div>
            </div>

            <div className="border-t border-white/10 bg-red-600/10 p-8 md:p-12 lg:border-l lg:border-t-0">
              <div className="space-y-4">
                {[
                  { icon: Car, text: "Vehicle based file requests" },
                  { icon: Gauge, text: "Stage 1 / Stage 2 performance data" },
                  { icon: Lock, text: "Private customer dashboard" },
                  { icon: Wrench, text: "Workshop partner ready system" },
                  { icon: Zap, text: "Fast and clean workflow" },
                  { icon: BadgeCheck, text: "Professional MG AutoTech platform" },
                ].map((item) => {
                  const Icon = item.icon;

                  return (
                    <div
                      key={item.text}
                      className="flex items-center gap-3 rounded-2xl bg-black/30 p-4"
                    >
                      <Icon className="h-5 w-5 text-red-300" />
                      <span className="font-semibold text-zinc-200">
                        {item.text}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10 px-4 py-8 text-center text-sm text-zinc-500">
        © 2026 MG AutoTech. Professional ECU / TCU File Service Platform.
      </footer>
    </main>
  );
}