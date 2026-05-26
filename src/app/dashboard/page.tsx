"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import { Upload, CreditCard, FileText, LogOut } from "lucide-react";

export default function DashboardPage() {
  const router = useRouter();

  const [email, setEmail] = useState<string | null>(null);
  const [credits, setCredits] = useState<number>(0);
  const [ordersCount, setOrdersCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkUser = async () => {
      const { data } = await supabase.auth.getUser();

      if (!data.user) {
        router.push("/login");
        return;
      }

      setEmail(data.user.email ?? null);

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("credit_balance")
        .eq("id", data.user.id)
        .single();

      if (!profileError && profile) {
        setCredits(Number(profile.credit_balance ?? 0));
      }

      const { count, error: ordersError } = await supabase
        .from("orders")
        .select("*", { count: "exact", head: true })
        .eq("customer_id", data.user.id);

      if (!ordersError) {
        setOrdersCount(count ?? 0);
      }

      setLoading(false);
    };

    checkUser();
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const goToNewRequest = () => {
    router.push("/new-request");
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#070b12] text-white">
        Loading dashboard...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#070b12] px-4 py-10 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex items-center justify-between rounded-3xl border border-white/10 bg-white/[0.05] p-6">
          <div>
            <h1 className="text-3xl font-black">Customer Dashboard</h1>
            <p className="mt-2 text-sm text-slate-400">
              Logged in as: {email}
            </p>
          </div>

          <button
            onClick={handleLogout}
            className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm font-bold text-white"
          >
            <LogOut className="mr-2 inline h-4 w-4" />
            Logout
          </button>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          <div className="rounded-3xl border border-white/10 bg-white/[0.05] p-6">
            <CreditCard className="mb-4 h-8 w-8 text-red-400" />
            <div className="text-sm text-slate-400">Credit Balance</div>
            <div className="mt-2 text-4xl font-black">{credits}</div>
            <p className="mt-3 text-sm text-slate-400">
              This value is loaded from the database.
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.05] p-6">
            <FileText className="mb-4 h-8 w-8 text-red-400" />
            <div className="text-sm text-slate-400">Orders</div>
            <div className="mt-2 text-4xl font-black">{ordersCount}</div>
            <p className="mt-3 text-sm text-slate-400">
              Your file request count is loaded from the database.
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.05] p-6">
            <Upload className="mb-4 h-8 w-8 text-red-400" />
            <div className="text-sm text-slate-400">Upload File</div>
            <button
              onClick={goToNewRequest}
              className="mt-4 w-full rounded-2xl bg-red-600 px-5 py-4 font-bold text-white"
            >
              New File Request
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}