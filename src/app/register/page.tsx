"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          role: "customer",
        },
      },
    });

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    setMessage("Account created successfully. You can now login.");
    setLoading(false);
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#070b12] px-4 text-white">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/[0.05] p-8 shadow-2xl">
        <h1 className="mb-2 text-3xl font-black">Create Account</h1>
        <p className="mb-6 text-sm text-slate-400">
          Register for the MG AutoTech file service platform.
        </p>

        <form onSubmit={handleRegister} className="space-y-4">
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Full name / Company"
            className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none"
            required
          />

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
            {loading ? "Creating account..." : "Register"}
          </button>
        </form>

        {message && (
          <div className="mt-5 rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-slate-300">
            {message}
          </div>
        )}

        <a href="/login" className="mt-6 block text-center text-sm text-red-300">
          Already have an account? Login
        </a>
      </div>
    </main>
  );
}