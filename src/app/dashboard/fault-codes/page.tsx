"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { signOutIfEmailUnverified } from "@/lib/authGuards";
import { faultCodes } from "@/lib/faultCodes";
import { supabase } from "@/lib/supabaseClient";
import {
  ArrowLeft,
  ArrowRight,
  Gauge,
  Loader2,
  Search,
  ShieldCheck,
  Wrench,
} from "lucide-react";

const PAGE_SIZE = 10;

function getSeverityClass(severity: string) {
  if (severity === "High") return "border-red-700/50 bg-red-950/30 text-red-200";
  if (severity === "Info") return "border-emerald-700/40 bg-emerald-950/25 text-emerald-200";
  return "border-amber-700/40 bg-amber-950/25 text-amber-200";
}

export default function FaultCodesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: userData } = await supabase.auth.getUser();

      if (!userData.user) {
        router.push("/login");
        return;
      }

      if (await signOutIfEmailUnverified(userData.user)) {
        router.push("/login?verify_email=1");
        return;
      }

      setLoading(false);
    };

    checkAuth();
  }, [router]);

  const filteredCodes = useMemo(() => {
    const cleanQuery = query.trim().toUpperCase();

    if (!cleanQuery) return faultCodes;

    return faultCodes.filter((item) => {
      const searchable = `${item.code} ${item.description} ${item.system}`.toUpperCase();
      return searchable.includes(cleanQuery);
    });
  }, [query]);

  const totalPages = Math.max(1, Math.ceil(filteredCodes.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visibleCodes = filteredCodes.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  useEffect(() => {
    setPage(1);
  }, [query]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#050505] text-white">
        <Loader2 className="h-8 w-8 animate-spin text-red-600" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#050505] text-white">
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_18%_0%,rgba(160,18,28,0.24),transparent_32%),linear-gradient(135deg,#050505,#0d0d0f_48%,#160608)]" />

      <header className="sticky top-0 z-40 border-b border-white/10 bg-black/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-5">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-red-800/50 bg-[#111] shadow-lg shadow-red-950/40">
              <Gauge className="h-6 w-6 text-red-600" />
            </div>
            <div>
              <div className="text-lg font-black tracking-wide">
                MG <span className="text-red-600">AUTOTECH</span>
              </div>
              <div className="text-xs text-zinc-400">Customer tools</div>
            </div>
          </Link>

          <Link
            href="/dashboard"
            className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-bold text-white transition hover:bg-white/10"
          >
            <ArrowLeft className="mr-2 inline h-4 w-4" />
            Dashboard
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-8 grid gap-6 lg:grid-cols-[1fr_360px] lg:items-end">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-red-800/50 bg-red-950/25 px-4 py-2 text-sm font-semibold text-red-100">
              <Wrench className="h-4 w-4 text-red-500" />
              Workshop reference tool
            </div>

            <h1 className="text-4xl font-black md:text-6xl">
              Fault <span className="text-red-600">Codes</span>
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-zinc-400 md:text-base">
              Search OBD diagnostic trouble codes before creating a file request.
              Standard codes include detailed descriptions; OEM-specific entries
              are marked clearly for vehicle-specific checking.
            </p>
          </div>

          <div className="rounded-[2rem] border border-red-900/50 bg-red-950/20 p-6">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-8 w-8 text-red-500" />
              <div>
                <div className="text-sm font-black uppercase tracking-[0.2em] text-red-400">
                  DTC Index
                </div>
                <p className="mt-1 text-sm text-zinc-400">
                  {faultCodes.length.toLocaleString("de-DE")} searchable fault code entries
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-6 rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-500" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search code, system or description..."
              className="h-14 w-full rounded-2xl border border-white/10 bg-black/35 pl-12 pr-4 text-base font-bold text-white outline-none transition placeholder:text-zinc-600 focus:border-red-700"
            />
          </label>
        </div>

        <div className="space-y-3">
          {visibleCodes.map((item) => (
            <div
              key={item.code}
              className="grid gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-5 transition hover:border-red-800/60 hover:bg-white/[0.07] sm:grid-cols-[120px_1fr_150px]"
            >
              <div>
                <div className="text-xs font-black uppercase tracking-[0.18em] text-red-500">
                  Code
                </div>
                <div className="mt-1 text-2xl font-black text-red-400">
                  {item.code}
                </div>
              </div>

              <div>
                <div className="font-black text-white">{item.description}</div>
                <div className="mt-2 text-sm text-zinc-500">{item.system}</div>
              </div>

              <div className="sm:text-right">
                <span
                  className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${getSeverityClass(
                    item.severity
                  )}`}
                >
                  {item.severity}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 flex flex-col gap-4 border-t border-white/10 pt-6 md:flex-row md:items-center md:justify-between">
          <div className="text-sm font-bold text-zinc-400">
            Showing {(currentPage - 1) * PAGE_SIZE + 1} to{" "}
            {Math.min(currentPage * PAGE_SIZE, filteredCodes.length)} of{" "}
            {filteredCodes.length.toLocaleString("de-DE")} entries
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              disabled={currentPage === 1}
              className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-black text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>

            <div className="rounded-xl border border-red-800/50 bg-red-950/30 px-4 py-3 text-sm font-black text-red-100">
              {currentPage} / {totalPages}
            </div>

            <button
              type="button"
              onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
              disabled={currentPage === totalPages}
              className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-black text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
