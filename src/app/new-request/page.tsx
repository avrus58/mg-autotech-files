"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function NewRequestPage() {
  const router = useRouter();

  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  const [vehicleBrand, setVehicleBrand] = useState("");
  const [vehicleModel, setVehicleModel] = useState("");
  const [vehicleGeneration, setVehicleGeneration] = useState("");
  const [vehicleEngine, setVehicleEngine] = useState("");
  const [serviceType, setServiceType] = useState("Stage 1");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    const checkUser = async () => {
      const { data } = await supabase.auth.getUser();

      if (!data.user) {
        router.push("/login");
        return;
      }

      setUserId(data.user.id);
      setEmail(data.user.email ?? "");
      setLoading(false);
    };

    checkUser();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!userId) {
      setMessage("User not found. Please login again.");
      return;
    }

    setSubmitting(true);
    setMessage("");

    const { error } = await supabase.from("orders").insert({
      customer_id: userId,
      customer_email: email,
      vehicle_brand: vehicleBrand,
      vehicle_model: vehicleModel,
      vehicle_generation: vehicleGeneration,
      vehicle_engine: vehicleEngine,
      service_type: serviceType,
      credits_required: 10,
      status: "new_request",
      notes,
    });

    if (error) {
      setMessage(error.message);
      setSubmitting(false);
      return;
    }

    setMessage("File request created successfully.");
    setSubmitting(false);

    setTimeout(() => {
      router.push("/dashboard");
    }, 1000);
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#070b12] text-white">
        Loading...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#070b12] px-4 py-10 text-white">
      <div className="mx-auto max-w-3xl rounded-3xl border border-white/10 bg-white/[0.05] p-8 shadow-2xl">
        <button
          onClick={() => router.push("/dashboard")}
          className="mb-6 rounded-2xl border border-white/10 bg-black/30 px-4 py-2 text-sm text-slate-300"
        >
          ← Back to Dashboard
        </button>

        <h1 className="text-3xl font-black">New File Request</h1>
        <p className="mt-2 text-sm text-slate-400">
          Submit vehicle and service information for MG AutoTech file service.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 grid gap-4">
          <input
            value={vehicleBrand}
            onChange={(e) => setVehicleBrand(e.target.value)}
            placeholder="Vehicle Brand - example: Mercedes-Benz"
            className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none"
            required
          />

          <input
            value={vehicleModel}
            onChange={(e) => setVehicleModel(e.target.value)}
            placeholder="Vehicle Model - example: E-Class"
            className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none"
            required
          />

          <input
            value={vehicleGeneration}
            onChange={(e) => setVehicleGeneration(e.target.value)}
            placeholder="Generation / Year - example: W212 2013-2016"
            className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none"
            required
          />

          <input
            value={vehicleEngine}
            onChange={(e) => setVehicleEngine(e.target.value)}
            placeholder="Engine - example: 200 CDI 136hp"
            className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none"
            required
          />

          <select
            value={serviceType}
            onChange={(e) => setServiceType(e.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none"
          >
            <option value="Stage 1">Stage 1</option>
            <option value="Stage 2">Stage 2</option>
            <option value="DPF OFF">DPF OFF</option>
            <option value="EGR OFF">EGR OFF</option>
            <option value="AdBlue OFF">AdBlue OFF</option>
            <option value="DTC OFF">DTC OFF</option>
            <option value="Custom Request">Custom Request</option>
          </select>

          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Customer notes / requested solution"
            rows={5}
            className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none"
          />

          <button
            disabled={submitting}
            className="rounded-2xl bg-red-600 px-5 py-4 font-bold text-white disabled:opacity-60"
          >
            {submitting ? "Creating request..." : "Create File Request"}
          </button>
        </form>

        {message && (
          <div className="mt-5 rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-slate-300">
            {message}
          </div>
        )}
      </div>
    </main>
  );
}