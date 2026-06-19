"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, ShieldCheck, Upload } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [message, setMessage] = useState("Verifying your access...");

  useEffect(() => {
    const handleCallback = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const next = params.get("next") || "/dashboard";

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);

        if (error) {
          setMessage(error.message);
          return;
        }
      } else {
        const { data } = await supabase.auth.getSession();

        if (!data.session) {
          router.replace("/login");
          return;
        }
      }

      router.replace(next);
    };

    handleCallback();
  }, [router]);

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#050505] px-4 text-white">
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_25%_0%,rgba(160,18,28,0.28),transparent_32%),linear-gradient(135deg,#050505,#0d0d0f_48%,#160608)]" />

      <div className="w-full max-w-md rounded-[2rem] border border-white/10 bg-white/[0.04] p-8 text-center shadow-2xl shadow-black/50 backdrop-blur-xl">
        <Link href="/" className="mx-auto mb-7 flex w-fit items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-red-800/50 bg-[#111]">
            <Upload className="h-7 w-7 text-red-600" />
          </div>
          <div className="text-left">
            <div className="text-xl font-black">
              MG <span className="text-red-600">AUTOTECH</span>
            </div>
            <div className="text-xs text-zinc-400">Secure Auth</div>
          </div>
        </Link>

        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-red-800/50 bg-red-950/25 text-red-400">
          {message === "Verifying your access..." ? (
            <Loader2 className="h-7 w-7 animate-spin" />
          ) : (
            <ShieldCheck className="h-7 w-7" />
          )}
        </div>

        <h1 className="text-3xl font-black">Account verification</h1>
        <p className="mt-4 text-sm leading-7 text-zinc-400">{message}</p>

        {message !== "Verifying your access..." && (
          <Link
            href="/login"
            className="mt-6 inline-flex h-12 items-center justify-center rounded-2xl bg-[#b1121b] px-5 text-sm font-black text-white transition hover:bg-[#c91824]"
          >
            Back to login
          </Link>
        )}
      </div>
    </main>
  );
}
