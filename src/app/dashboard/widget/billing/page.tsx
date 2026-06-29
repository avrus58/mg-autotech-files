"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, CreditCard, Loader2, ShieldCheck } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

export default function WidgetBillingPage() {
  const [loading, setLoading] = useState(false); const [message, setMessage] = useState("");
  async function openPortal() { setLoading(true); const token = (await supabase.auth.getSession()).data.session?.access_token; const response = await fetch("/api/stripe/widget-customer-portal", { method: "POST", headers: token ? { Authorization: `Bearer ${token}` } : {} }); const data = await response.json(); setLoading(false); if (!response.ok || !data.url) { setMessage(data.error || "Billing portal could not be opened."); return; } window.location.href = data.url; }
  return <main className="flex min-h-screen items-center justify-center bg-[#050505] p-4 text-white"><section className="w-full max-w-2xl border-y border-white/10 py-10"><Link href="/dashboard/widget" className="text-sm font-black text-zinc-400"><ArrowLeft className="mr-2 inline h-4 w-4" />Widget dashboard</Link><CreditCard className="mt-8 h-10 w-10 text-red-500" /><h1 className="mt-5 text-4xl font-black">Widget billing</h1><p className="mt-4 leading-7 text-zinc-400">Stripe Customer Portal lets you update your payment method, view invoices and cancel the subscription securely.</p><div className="mt-6 flex items-center gap-2 text-sm text-emerald-300"><ShieldCheck className="h-4 w-4" />Secure billing managed by Stripe</div>{message && <div className="mt-5 border border-red-800/40 bg-red-950/20 p-4 text-sm text-red-200">{message}</div>}<button onClick={openPortal} disabled={loading} className="mt-7 flex h-13 items-center rounded-lg bg-[#b1121b] px-6 text-sm font-black disabled:opacity-50">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Open billing portal"}</button></section></main>;
}

