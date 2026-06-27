"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getAuthenticatedHome,
  getAuthRedirect,
  signOutIfEmailUnverified,
} from "@/lib/authGuards";
import { supabase } from "@/lib/supabaseClient";
import {
  ArrowRight,
  Cpu,
  Lock,
  Loader2,
  Mail,
  ShieldCheck,
  Upload,
  Zap,
} from "lucide-react";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const queryMessage = params.get("verify_email") === "1"
      ? "Please verify your e-mail address before accessing your account."
      : params.get("reset") === "success"
        ? "Password updated successfully. You can login now."
        : "";

    let active = true;

    const redirectAuthenticatedUser = async () => {
      const { data } = await supabase.auth.getUser();
      const user = data.user;

      if (!active) return;

      if (!user) {
        setMessage(queryMessage);
        setCheckingAuth(false);
        return;
      }

      if (await signOutIfEmailUnverified(user)) {
        setMessage("Please verify your e-mail address before accessing your account.");
        setCheckingAuth(false);
        return;
      }

      router.replace(await getAuthenticatedHome(user.id));
      router.refresh();
    };

    void redirectAuthenticatedUser();

    return () => {
      active = false;
    };
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (loading) return;

    setLoading(true);
    setMessage("");

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      setMessage(
        error.message.toLowerCase().includes("email not confirmed")
          ? "Please verify your e-mail address before logging in."
          : error.message
      );
      setLoading(false);
      return;
    }

    if (data.user && (await signOutIfEmailUnverified(data.user))) {
      setMessage("Please verify your e-mail address before accessing your account.");
      setLoading(false);
      return;
    }

    setLoading(false);
    router.replace(await getAuthenticatedHome(data.user!.id));
    router.refresh();
  };

  const handleGoogleLogin = async () => {
    if (googleLoading) return;

    setGoogleLoading(true);
    setMessage("");

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: getAuthRedirect("/auth/callback?next=/dashboard"),
      },
    });

    if (error) {
      setMessage(error.message);
      setGoogleLoading(false);
    }
  };

  if (checkingAuth) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#050505] text-white">
        <Loader2 className="h-8 w-8 animate-spin text-red-500" aria-label="Checking account" />
      </main>
    );
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#050505] px-4 py-10 text-white">
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_20%_0%,rgba(160,18,28,0.28),transparent_32%),radial-gradient(circle_at_80%_100%,rgba(160,18,28,0.18),transparent_30%),linear-gradient(135deg,#050505,#0d0d0f_48%,#160608)]" />

      <div className="grid w-full max-w-6xl overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.04] shadow-2xl shadow-black/50 backdrop-blur-xl lg:grid-cols-[1.1fr_0.9fr]">
        <section className="relative hidden min-h-[620px] overflow-hidden border-r border-white/10 bg-black/40 p-10 lg:block">
          <div className="absolute -left-20 -top-20 h-72 w-72 rounded-full bg-red-700/20 blur-3xl" />
          <div className="absolute -bottom-20 -right-20 h-72 w-72 rounded-full bg-red-950/40 blur-3xl" />

          <Link href="/" className="relative flex items-center gap-3">
            <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-red-800/50 bg-[#111] shadow-lg shadow-red-950/40">
              <Upload className="h-8 w-8 text-red-600" />
            </div>

            <div>
              <div className="text-2xl font-black tracking-wide">
                MG <span className="text-red-600">AUTOTECH</span>
              </div>
              <div className="text-xs text-zinc-400">
                ECU File Service Platform
              </div>
            </div>
          </Link>

          <div className="relative mt-20">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-red-800/50 bg-red-950/25 px-4 py-2 text-sm font-bold text-red-100">
              <ShieldCheck className="h-4 w-4 text-red-500" />
              Secure customer access
            </div>

            <h1 className="max-w-xl text-5xl font-black leading-tight">
              Professional ECU file service starts here.
            </h1>

            <p className="mt-6 max-w-lg leading-8 text-zinc-400">
              Login to upload files, create tuning requests, manage credits and
              track your MG AutoTech orders in one secure dashboard.
            </p>
          </div>

          <div className="relative mt-14 grid gap-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
              <Cpu className="mb-3 h-6 w-6 text-red-500" />
              <div className="font-black">Vehicle Intelligence</div>
              <p className="mt-2 text-sm leading-6 text-zinc-500">
                Dynamic vehicle database with ECU, Stage and service data.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
              <Zap className="mb-3 h-6 w-6 text-red-500" />
              <div className="font-black">Fast File Workflow</div>
              <p className="mt-2 text-sm leading-6 text-zinc-500">
                Upload original files and receive modified files through your
                dashboard.
              </p>
            </div>
          </div>
        </section>

        <section className="p-6 sm:p-10">
          <div className="mx-auto max-w-md">
            <div className="mb-8 lg:hidden">
              <Link href="/" className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-red-800/50 bg-[#111]">
                  <Upload className="h-7 w-7 text-red-600" />
                </div>
                <div>
                  <div className="text-xl font-black">
                    MG <span className="text-red-600">AUTOTECH</span>
                  </div>
                  <div className="text-xs text-zinc-400">Customer Login</div>
                </div>
              </Link>
            </div>

            <div className="mb-8">
              <div className="mb-3 text-sm font-bold text-red-400">
                Welcome back
              </div>
              <h2 className="text-4xl font-black">Login</h2>
              <p className="mt-3 leading-7 text-zinc-400">
                Access your file service dashboard and continue your ECU tuning
                requests.
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <label className="block">
                <div className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-zinc-500">
                  E-mail
                </div>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-500" />
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    type="email"
                    className="h-14 w-full rounded-2xl border border-white/10 bg-black/35 pl-12 pr-4 text-sm font-bold text-white outline-none transition placeholder:text-zinc-600 focus:border-red-700"
                    required
                  />
                </div>
              </label>

              <label className="block">
                <div className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-zinc-500">
                  Password
                </div>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-500" />
                  <input
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Your password"
                    type="password"
                    className="h-14 w-full rounded-2xl border border-white/10 bg-black/35 pl-12 pr-4 text-sm font-bold text-white outline-none transition placeholder:text-zinc-600 focus:border-red-700"
                    required
                  />
                </div>
              </label>

              <button
                disabled={loading}
                className="group flex h-14 w-full items-center justify-center rounded-2xl bg-[#b1121b] px-5 font-black text-white shadow-xl shadow-red-950/40 transition hover:bg-[#c91824] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Logging in...
                  </>
                ) : (
                  <>
                    Login
                    <ArrowRight className="ml-2 h-5 w-5 transition group-hover:translate-x-1" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-4 flex items-center gap-3 text-xs font-black uppercase tracking-[0.16em] text-zinc-600">
              <span className="h-px flex-1 bg-white/10" />
              or
              <span className="h-px flex-1 bg-white/10" />
            </div>

            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={googleLoading}
              className="mt-4 flex h-14 w-full items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-5 font-black text-white transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {googleLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-sm font-black text-black">
                  G
                </span>
              )}
              Continue with Google
            </button>

            <div className="mt-5 text-center">
              <Link href="/forgot-password" className="text-sm font-black text-red-400">
                Forgot password?
              </Link>
            </div>

            {message && (
              <div className="mt-5 rounded-2xl border border-red-800/50 bg-red-950/30 p-4 text-sm text-red-100">
                {message}
              </div>
            )}

            <div className="mt-8 rounded-2xl border border-white/10 bg-black/30 p-5 text-center text-sm text-zinc-400">
              No account yet?{" "}
              <Link href="/register" className="font-black text-red-400">
                Create customer account
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
