"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    router.push("/dashboard");
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#070b12] px-4 text-white">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/[0.05] p-8 shadow-2xl">
        <h1 className="mb-2 text-3xl font-black">Login</h1>
        <p className="mb-6 text-sm text-slate-400">
          Login to your MG AutoTech file service account.
        </p>

        <form onSubmit={handleLogin} className="space-y-4">
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="E-mail"
            type="email"
            className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none"
            required
          />

          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            type="password"
            className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none"
            required
          />

          <button
            disabled={loading}
            className="w-full rounded-2xl bg-red-600 px-5 py-4 font-bold text-white disabled:opacity-60"
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>

        {message && (
          <div className="mt-5 rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-slate-300">
            {message}
          </div>
        )}

        <a href="/register" className="mt-6 block text-center text-sm text-red-300">
          No account yet? Register
        </a>
      </div>
    </main>
  );
}