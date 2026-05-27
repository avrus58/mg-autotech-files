"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { creditPackages } from "@/lib/creditPackages";
import {
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  Gauge,
  Loader2,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

export default function BuyCreditsPage() {
  const router = useRouter();
  const [loadingPackage, setLoadingPackage] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const startCheckout = async (packageId: string) => {
    setLoadingPackage(packageId);
    setMessage("");

    const { data: sessionData } = await supabase.auth.getSession();

    if (!sessionData.session) {
      router.push("/login");
      return;
    }

    const response = await fetch("/api/stripe/create-checkout-session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionData.session.access_token}`,
      },
      body: JSON.stringify({ packageId }),
    });

    const data = await response.json();

    setLoadingPackage(null);

    if (!response.ok) {
      setMessage(data.error ?? "Could not start Stripe checkout.");
      return;
    }

    if (!data.url) {
      setMessage("Stripe checkout URL was not returned.");
      return;
    }

    window.location.href = data.url;
  };

  return (
    <main className="min-h-screen bg-[#050505] text-white">
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_18%_0%,rgba(160,18,28,0.25),transparent_34%),linear-gradient(135deg,#050505,#0c0c0e_48%,#170507)]" />

      <header className="sticky top-0 z-50 border-b border-white/10 bg-black/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-red-800/50 bg-[#111] shadow-lg shadow-red-950/40">
              <Gauge className="h-7 w-7 text-red-600" />
            </div>

            <div>
              <div className="text-xl font-black tracking-wide">
                MG <span className="text-red-600">AUTOTECH</span>
              </div>
              <div className="text-xs text-zinc-400">Credit Checkout</div>
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

      <section className="mx-auto max-w-7xl px-4 py-10">
        <div className="mb-10 max-w-3xl">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-red-800/50 bg-red-950/25 px-4 py-2 text-sm font-semibold text-red-100">
            <CreditCard className="h-4 w-4 text-red-500" />
            Secure payment via Stripe
          </div>

          <h1 className="text-4xl font-black md:text-6xl">
            Buy <span className="text-red-600">MG AutoTech Credits</span>
          </h1>

          <p className="mt-4 text-lg leading-8 text-zinc-400">
            Choose a credit package and pay securely. After successful payment,
            credits will be added to your account automatically.
          </p>
        </div>

        {message && (
          <div className="mb-6 rounded-2xl border border-red-800/50 bg-red-950/30 p-4 text-sm text-red-200">
            {message}
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {creditPackages.map((item) => (
            <div
              key={item.id}
              className={`relative rounded-[2rem] border p-6 shadow-2xl shadow-black/20 ${
                item.highlight
                  ? "border-red-800/60 bg-red-950/25"
                  : "border-white/10 bg-white/[0.04]"
              }`}
            >
              {item.highlight && (
                <div className="absolute right-5 top-5 rounded-full bg-red-600 px-3 py-1 text-xs font-black text-white">
                  Popular
                </div>
              )}

              <Sparkles className="mb-5 h-8 w-8 text-red-500" />

              <div className="text-sm font-black uppercase tracking-[0.25em] text-red-500">
                {item.name}
              </div>

              <div className="mt-4 text-6xl font-black">{item.credits}</div>
              <div className="mt-1 text-sm text-zinc-400">Credits</div>

              <div className="mt-5 text-4xl font-black">{item.priceEuro} €</div>
              <p className="mt-4 min-h-16 text-sm leading-6 text-zinc-400">
                {item.description}
              </p>

              <div className="mt-6 space-y-3 text-sm text-zinc-300">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  Automatic credit top-up
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  Secure Stripe checkout
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  Usable for all file requests
                </div>
              </div>

              <button
                onClick={() => startCheckout(item.id)}
                disabled={loadingPackage === item.id}
                className="mt-7 flex w-full items-center justify-center rounded-xl bg-[#b1121b] px-5 py-4 text-sm font-black text-white transition hover:bg-[#c91824] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loadingPackage === item.id ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Opening Checkout...
                  </>
                ) : (
                  <>
                    <CreditCard className="mr-2 h-4 w-4" />
                    Buy Credits
                  </>
                )}
              </button>
            </div>
          ))}
        </div>

        <div className="mt-8 rounded-[2rem] border border-white/10 bg-white/[0.04] p-6">
          <div className="flex items-start gap-4">
            <ShieldCheck className="mt-1 h-8 w-8 shrink-0 text-red-500" />
            <div>
              <h2 className="text-2xl font-black">Important</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                Credits are added after Stripe confirms the payment. During local
                development, this requires the Stripe webhook listener to be active.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
