"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Copy,
  CreditCard,
  Database,
  Download,
  Eye,
  FileCode2,
  FileDown,
  Gauge,
  Loader2,
  Lock,
  Mail,
  PackageCheck,
  RefreshCcw,
  Search,
  ShieldCheck,
  Upload,
  User,
  Users,
  Wrench,
  X,
} from "lucide-react";

type Order = {
  id: string;
  customer_id: string | null;
  customer_email: string | null;
  vehicle_brand: string | null;
  vehicle_model: string | null;
  vehicle_generation: string | null;
  vehicle_engine: string | null;
  service_type: string | null;
  credits_required: number | null;
  status: string | null;
  notes: string | null;
  ecu: string | null;
  gearbox: string | null;
  vehicle_year: string | null;
  read_method: string | null;
  license_plate: string | null;
  hw_sw: string | null;
  master_slave: string | null;
  uploaded_file_name: string | null;
  original_file_path: string | null;
  modified_file_path: string | null;
  created_at: string | null;
};

type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: string | null;
  credit_balance: number | string | null;
  created_at: string | null;
};

const statusOptions = [
  "all",
  "new_request",
  "file_check",
  "in_progress",
  "customer_info_needed",
  "completed",
  "revision",
  "cancelled",
];

const editableStatusOptions = statusOptions.filter((status) => status !== "all");

function statusLabel(status: string | null) {
  if (!status) return "Unknown";

  return status
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusClass(status: string | null) {
  if (status === "completed") {
    return "border-emerald-700/40 bg-emerald-950/30 text-emerald-300";
  }

  if (status === "in_progress") {
    return "border-blue-700/40 bg-blue-950/30 text-blue-300";
  }

  if (status === "file_check") {
    return "border-yellow-700/40 bg-yellow-950/30 text-yellow-300";
  }

  if (status === "customer_info_needed") {
    return "border-orange-700/40 bg-orange-950/30 text-orange-300";
  }

  if (status === "revision") {
    return "border-purple-700/40 bg-purple-950/30 text-purple-300";
  }

  if (status === "cancelled") {
    return "border-zinc-700/40 bg-zinc-900/50 text-zinc-400";
  }

  return "border-red-800/40 bg-red-950/25 text-red-300";
}

function formatDate(value: string | null) {
  if (!value) return "-";

  return new Date(value).toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function shortId(id: string) {
  return id.slice(0, 8).toUpperCase();
}

export default function AdminPage() {
  const router = useRouter();

  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Profile[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [onlyWithFile, setOnlyWithFile] = useState(false);
  const [creditInputs, setCreditInputs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [creditUpdatingId, setCreditUpdatingId] = useState<string | null>(null);
  const [uploadingModifiedId, setUploadingModifiedId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const loadAdminData = async () => {
    setLoading(true);
    setMessage("");

    const { data: userData } = await supabase.auth.getUser();

    if (!userData.user) {
      router.push("/login");
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userData.user.id)
      .single();

    if (profileError || profile?.role !== "admin") {
      setMessage("You are not authorized to access the admin panel.");
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    const { data: profileList, error: customerError } = await supabase
      .from("profiles")
      .select("id, email, full_name, role, credit_balance, created_at")
      .order("created_at", { ascending: false });

    if (customerError) {
      setMessage(customerError.message);
      setLoading(false);
      return;
    }

    setOrders((data ?? []) as Order[]);
    setCustomers((profileList ?? []) as Profile[]);
    setLoading(false);
  };

  useEffect(() => {
    loadAdminData();
  }, []);

  const stats = useMemo(() => {
    const total = orders.length;
    const newRequests = orders.filter((order) => order.status === "new_request").length;
    const fileCheck = orders.filter((order) => order.status === "file_check").length;
    const inProgress = orders.filter((order) => order.status === "in_progress").length;
    const completed = orders.filter((order) => order.status === "completed").length;
    const withFile = orders.filter((order) => Boolean(order.original_file_path)).length;
    const totalCredits = orders.reduce(
      (sum, order) => sum + Number(order.credits_required ?? 0),
      0
    );

    return {
      total,
      customers: customers.length,
      newRequests,
      fileCheck,
      inProgress,
      completed,
      withFile,
      totalCredits,
    };
  }, [orders, customers]);

  const filteredOrders = useMemo(() => {
    const term = search.trim().toLowerCase();

    return orders.filter((order) => {
      if (selectedStatus !== "all" && order.status !== selectedStatus) {
        return false;
      }

      if (onlyWithFile && !order.original_file_path) {
        return false;
      }

      if (!term) return true;

      const fullText = [
        order.id,
        order.customer_email,
        order.vehicle_brand,
        order.vehicle_model,
        order.vehicle_generation,
        order.vehicle_engine,
        order.service_type,
        order.ecu,
        order.gearbox,
        order.vehicle_year,
        order.read_method,
        order.hw_sw,
        order.license_plate,
        order.master_slave,
        order.status,
        order.uploaded_file_name,
        order.notes,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return fullText.includes(term);
    });
  }, [orders, search, selectedStatus, onlyWithFile]);

  const filteredCustomers = useMemo(() => {
    const term = customerSearch.trim().toLowerCase();

    if (!term) return customers;

    return customers.filter((customer) => {
      const fullText = [
        customer.email,
        customer.full_name,
        customer.role,
        customer.id,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return fullText.includes(term);
    });
  }, [customers, customerSearch]);

  const addCreditsToCustomer = async (customer: Profile, amountToAdd: number) => {
    if (!Number.isFinite(amountToAdd) || amountToAdd <= 0) {
      setMessage("Please enter a valid credit amount.");
      return;
    }

    setCreditUpdatingId(customer.id);
    setMessage("");

    const currentBalance = Number(customer.credit_balance ?? 0);
    const newBalance = currentBalance + amountToAdd;

    const { error } = await supabase
      .from("profiles")
      .update({ credit_balance: newBalance })
      .eq("id", customer.id);

    setCreditUpdatingId(null);

    if (error) {
      setMessage(error.message);
      return;
    }

    setCustomers((current) =>
      current.map((item) =>
        item.id === customer.id
          ? {
              ...item,
              credit_balance: newBalance,
            }
          : item
      )
    );

    setCreditInputs((current) => ({
      ...current,
      [customer.id]: "",
    }));

    setMessage(`${amountToAdd} credits added to ${customer.email ?? "customer"}.`);
  };

  const handleCustomCreditAdd = (customer: Profile) => {
    const amount = Number(creditInputs[customer.id] ?? 0);
    addCreditsToCustomer(customer, amount);
  };

  const updateStatus = async (orderId: string, newStatus: string) => {
    setUpdatingId(orderId);
    setMessage("");

    const { error } = await supabase
      .from("orders")
      .update({ status: newStatus })
      .eq("id", orderId);

    setUpdatingId(null);

    if (error) {
      setMessage(error.message);
      return;
    }

    setOrders((current) =>
      current.map((order) =>
        order.id === orderId ? { ...order, status: newStatus } : order
      )
    );

    setSelectedOrder((current) =>
      current?.id === orderId ? { ...current, status: newStatus } : current
    );
  };

  const downloadOriginalFile = async (order: Order) => {
    if (!order.original_file_path) {
      setMessage("No original file path found for this order.");
      return;
    }

    setMessage("");

    const { data, error } = await supabase.storage
      .from("customer-files")
      .createSignedUrl(order.original_file_path, 60);

    if (error) {
      setMessage(error.message);
      return;
    }

    window.open(data.signedUrl, "_blank");
  };

  const uploadModifiedFile = async (order: Order, file: File | null) => {
    if (!file) return;

    setUploadingModifiedId(order.id);
    setMessage("");

    const safeFileName = file.name
      .replaceAll(" ", "_")
      .replace(/[^a-zA-Z0-9._-]/g, "");

    const customerFolder = order.customer_id ?? "unknown-customer";
    const filePath = `${customerFolder}/modified/${order.id}/${Date.now()}-${safeFileName}`;

    const { error: uploadError } = await supabase.storage
      .from("customer-files")
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      setUploadingModifiedId(null);
      setMessage(uploadError.message);
      return;
    }

    const { error: updateError } = await supabase
      .from("orders")
      .update({
        modified_file_path: filePath,
        status: "completed",
      })
      .eq("id", order.id);

    setUploadingModifiedId(null);

    if (updateError) {
      setMessage(updateError.message);
      return;
    }

    setOrders((current) =>
      current.map((item) =>
        item.id === order.id
          ? {
              ...item,
              modified_file_path: filePath,
              status: "completed",
            }
          : item
      )
    );

    setSelectedOrder((current) =>
      current?.id === order.id
        ? {
            ...current,
            modified_file_path: filePath,
            status: "completed",
          }
        : current
    );

    setMessage("Modified file uploaded and order marked as completed.");
  };

  const copyOrderId = async (id: string) => {
    await navigator.clipboard.writeText(id);
    setMessage("Order ID copied.");
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#050505] text-white">
        <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-6 py-5">
          <Loader2 className="h-5 w-5 animate-spin text-red-500" />
          Loading admin panel...
        </div>
      </main>
    );
  }

  if (message === "You are not authorized to access the admin panel.") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#050505] px-4 text-white">
        <div className="max-w-md rounded-[2rem] border border-red-900/40 bg-red-950/20 p-8 text-center">
          <Lock className="mx-auto mb-5 h-12 w-12 text-red-500" />
          <h1 className="text-3xl font-black">Access Denied</h1>
          <p className="mt-3 text-zinc-400">{message}</p>
          <Link
            href="/dashboard"
            className="mt-6 inline-flex rounded-xl bg-[#b1121b] px-5 py-3 font-black text-white"
          >
            Back to Dashboard
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#050505] text-white">
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_18%_0%,rgba(160,18,28,0.25),transparent_34%),linear-gradient(135deg,#050505,#0c0c0e_48%,#170507)]" />

      <header className="sticky top-0 z-50 border-b border-white/10 bg-black/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between px-4 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-red-800/50 bg-[#111] shadow-lg shadow-red-950/40">
              <ShieldCheck className="h-7 w-7 text-red-600" />
            </div>

            <div>
              <div className="text-xl font-black tracking-wide">
                MG <span className="text-red-600">AUTOTECH</span>
              </div>
              <div className="text-xs text-zinc-400">
                File Service Admin Operations
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadAdminData}
              className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-bold text-white transition hover:bg-white/10"
            >
              <RefreshCcw className="mr-2 inline h-4 w-4" />
              Refresh
            </button>

            <Link
              href="/dashboard"
              className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-bold text-white transition hover:bg-white/10"
            >
              <ArrowLeft className="mr-2 inline h-4 w-4" />
              Dashboard
            </Link>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-[1500px] px-4 py-8">
        <div className="mb-8">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-red-800/50 bg-red-950/25 px-4 py-2 text-sm font-semibold text-red-100">
            <Database className="h-4 w-4 text-red-500" />
            Live order management
          </div>

          <h1 className="text-4xl font-black md:text-5xl">
            Admin <span className="text-red-600">Control Panel</span>
          </h1>

          <p className="mt-3 max-w-3xl text-zinc-400">
            Manage customer requests, download original files, update order
            status and inspect technical vehicle data from one clean workspace.
          </p>
        </div>

        <div className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-8">
          <StatCard icon={<FileCode2 />} label="Total Orders" value={stats.total} />
          <StatCard icon={<Users />} label="Customers" value={stats.customers} />
          <StatCard icon={<Upload />} label="New" value={stats.newRequests} />
          <StatCard icon={<Search />} label="File Check" value={stats.fileCheck} />
          <StatCard icon={<Wrench />} label="In Progress" value={stats.inProgress} />
          <StatCard icon={<CheckCircle2 />} label="Completed" value={stats.completed} />
          <StatCard icon={<FileDown />} label="With File" value={stats.withFile} />
          <StatCard icon={<CreditCard />} label="Credits Used" value={stats.totalCredits} highlight />
        </div>

        {message && (
          <div className="mb-6 rounded-2xl border border-red-800/50 bg-red-950/30 p-4 text-sm text-red-200">
            {message}
          </div>
        )}

        <section className="mb-8 rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 shadow-2xl shadow-black/20">
          <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h2 className="text-2xl font-black">Customers & Credits</h2>
              <p className="mt-1 text-sm text-zinc-500">
                Manage customer credit balances after payment confirmation.
              </p>
            </div>

            <div className="relative">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <input
                value={customerSearch}
                onChange={(event) => setCustomerSearch(event.target.value)}
                placeholder="Search customer email, name or role..."
                className="h-12 w-full rounded-xl border border-white/10 bg-black/35 pl-11 pr-4 text-sm font-bold text-white outline-none transition placeholder:text-zinc-600 focus:border-red-700 md:w-96"
              />
            </div>
          </div>

          <div className="hidden overflow-hidden rounded-2xl border border-white/10 xl:block">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-black/50 text-xs uppercase tracking-[0.14em] text-zinc-500">
                <tr>
                  <th className="px-4 py-4">Customer</th>
                  <th className="px-4 py-4">Role</th>
                  <th className="px-4 py-4">Balance</th>
                  <th className="px-4 py-4">Quick Add</th>
                  <th className="px-4 py-4">Custom Add</th>
                  <th className="px-4 py-4 text-right">Created</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-white/10">
                {filteredCustomers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-zinc-500">
                      No customers found.
                    </td>
                  </tr>
                ) : (
                  filteredCustomers.map((customer) => (
                    <tr
                      key={customer.id}
                      className="bg-black/20 transition hover:bg-white/[0.04]"
                    >
                      <td className="px-4 py-4 align-top">
                        <div className="font-black text-white">
                          {customer.email || "-"}
                        </div>
                        <div className="mt-1 text-xs text-zinc-500">
                          {customer.full_name || customer.id}
                        </div>
                      </td>

                      <td className="px-4 py-4 align-top">
                        <span
                          className={`rounded-xl border px-3 py-2 text-xs font-black ${
                            customer.role === "admin"
                              ? "border-red-700/40 bg-red-950/30 text-red-300"
                              : "border-white/10 bg-white/[0.04] text-zinc-300"
                          }`}
                        >
                          {customer.role || "customer"}
                        </span>
                      </td>

                      <td className="px-4 py-4 align-top">
                        <div className="w-28 rounded-xl bg-red-950/30 px-3 py-2 text-center font-black text-red-300">
                          {Number(customer.credit_balance ?? 0)}
                        </div>
                      </td>

                      <td className="px-4 py-4 align-top">
                        <div className="flex flex-wrap gap-2">
                          {[10, 25, 50, 100].map((amount) => (
                            <button
                              key={amount}
                              onClick={() => addCreditsToCustomer(customer, amount)}
                              disabled={creditUpdatingId === customer.id}
                              className="rounded-xl border border-emerald-700/40 bg-emerald-950/30 px-3 py-2 text-xs font-black text-emerald-300 transition hover:bg-emerald-900/40 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              +{amount}
                            </button>
                          ))}
                        </div>
                      </td>

                      <td className="px-4 py-4 align-top">
                        <div className="flex gap-2">
                          <input
                            type="number"
                            min="1"
                            value={creditInputs[customer.id] ?? ""}
                            onChange={(event) =>
                              setCreditInputs((current) => ({
                                ...current,
                                [customer.id]: event.target.value,
                              }))
                            }
                            placeholder="Amount"
                            className="h-10 w-28 rounded-xl border border-white/10 bg-black/35 px-3 text-sm font-bold text-white outline-none placeholder:text-zinc-600 focus:border-red-700"
                          />

                          <button
                            onClick={() => handleCustomCreditAdd(customer)}
                            disabled={creditUpdatingId === customer.id}
                            className="h-10 rounded-xl bg-[#b1121b] px-4 text-xs font-black text-white transition hover:bg-[#c91824] disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {creditUpdatingId === customer.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              "Add"
                            )}
                          </button>
                        </div>
                      </td>

                      <td className="px-4 py-4 text-right align-top text-sm text-zinc-500">
                        {formatDate(customer.created_at)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="space-y-4 xl:hidden">
            {filteredCustomers.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-black/30 p-8 text-center text-zinc-500">
                No customers found.
              </div>
            ) : (
              filteredCustomers.map((customer) => (
                <div
                  key={customer.id}
                  className="rounded-2xl border border-white/10 bg-black/30 p-5"
                >
                  <div className="mb-4 flex items-start justify-between gap-4">
                    <div>
                      <div className="font-black">{customer.email || "-"}</div>
                      <div className="mt-1 text-sm text-zinc-500">
                        {customer.full_name || customer.id}
                      </div>
                    </div>

                    <div className="rounded-xl bg-red-950/30 px-3 py-2 text-center font-black text-red-300">
                      {Number(customer.credit_balance ?? 0)}
                    </div>
                  </div>

                  <div className="mb-4 flex flex-wrap gap-2">
                    {[10, 25, 50, 100].map((amount) => (
                      <button
                        key={amount}
                        onClick={() => addCreditsToCustomer(customer, amount)}
                        disabled={creditUpdatingId === customer.id}
                        className="rounded-xl border border-emerald-700/40 bg-emerald-950/30 px-3 py-2 text-xs font-black text-emerald-300 disabled:opacity-50"
                      >
                        +{amount}
                      </button>
                    ))}
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="number"
                      min="1"
                      value={creditInputs[customer.id] ?? ""}
                      onChange={(event) =>
                        setCreditInputs((current) => ({
                          ...current,
                          [customer.id]: event.target.value,
                        }))
                      }
                      placeholder="Custom amount"
                      className="h-11 min-w-0 flex-1 rounded-xl border border-white/10 bg-black/35 px-3 text-sm font-bold text-white outline-none placeholder:text-zinc-600 focus:border-red-700"
                    />

                    <button
                      onClick={() => handleCustomCreditAdd(customer)}
                      disabled={creditUpdatingId === customer.id}
                      className="h-11 rounded-xl bg-[#b1121b] px-4 text-sm font-black text-white disabled:opacity-50"
                    >
                      Add
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 shadow-2xl shadow-black/20">
          <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h2 className="text-2xl font-black">Orders</h2>
              <p className="mt-1 text-sm text-zinc-500">
                Showing {filteredOrders.length} of {orders.length} requests.
              </p>
            </div>

            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search customer, vehicle, ECU, file..."
                  className="h-12 w-full rounded-xl border border-white/10 bg-black/35 pl-11 pr-4 text-sm font-bold text-white outline-none transition placeholder:text-zinc-600 focus:border-red-700 md:w-96"
                />
              </div>

              <button
                onClick={() => setOnlyWithFile((current) => !current)}
                className={`h-12 rounded-xl border px-4 text-sm font-black transition ${
                  onlyWithFile
                    ? "border-red-700 bg-red-950/40 text-red-200"
                    : "border-white/10 bg-black/35 text-zinc-400 hover:text-white"
                }`}
              >
                <FileDown className="mr-2 inline h-4 w-4" />
                Only With File
              </button>
            </div>
          </div>

          <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
            {statusOptions.map((status) => {
              const active = selectedStatus === status;
              const count =
                status === "all"
                  ? orders.length
                  : orders.filter((order) => order.status === status).length;

              return (
                <button
                  key={status}
                  onClick={() => setSelectedStatus(status)}
                  className={`shrink-0 rounded-xl border px-4 py-3 text-sm font-black transition ${
                    active
                      ? "border-red-700 bg-red-950/40 text-white"
                      : "border-white/10 bg-black/30 text-zinc-400 hover:text-white"
                  }`}
                >
                  {status === "all" ? "All" : statusLabel(status)}
                  <span className="ml-2 rounded-full bg-white/10 px-2 py-0.5 text-xs">
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="hidden overflow-hidden rounded-2xl border border-white/10 xl:block">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-black/50 text-xs uppercase tracking-[0.14em] text-zinc-500">
                <tr>
                  <th className="px-4 py-4">Order</th>
                  <th className="px-4 py-4">Customer</th>
                  <th className="px-4 py-4">Vehicle</th>
                  <th className="px-4 py-4">ECU / Read</th>
                  <th className="px-4 py-4">Service</th>
                  <th className="px-4 py-4">Credits</th>
                  <th className="px-4 py-4">Status</th>
                  <th className="px-4 py-4">File</th>
                  <th className="px-4 py-4 text-right">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-white/10">
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-zinc-500">
                      No orders found.
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((order) => (
                    <tr key={order.id} className="bg-black/20 transition hover:bg-white/[0.04]">
                      <td className="px-4 py-4 align-top">
                        <div className="font-black text-white">#{shortId(order.id)}</div>
                        <div className="mt-1 flex items-center gap-1 text-xs text-zinc-500">
                          <CalendarDays className="h-3 w-3" />
                          {formatDate(order.created_at)}
                        </div>
                      </td>

                      <td className="px-4 py-4 align-top">
                        <div className="font-bold text-white">
                          {order.customer_email || "-"}
                        </div>
                        <div className="mt-1 text-xs text-zinc-500">
                          {order.customer_id ? order.customer_id.slice(0, 8) : "-"}
                        </div>
                      </td>

                      <td className="px-4 py-4 align-top">
                        <div className="font-black">
                          {order.vehicle_brand || "-"} {order.vehicle_model || ""}
                        </div>
                        <div className="mt-1 text-xs text-zinc-500">
                          {order.vehicle_generation || "-"} · {order.vehicle_engine || "-"}
                        </div>
                      </td>

                      <td className="px-4 py-4 align-top">
                        <div className="font-bold">{order.ecu || "-"}</div>
                        <div className="mt-1 text-xs text-zinc-500">
                          {order.read_method || "-"} · {order.gearbox || "-"}
                        </div>
                      </td>

                      <td className="max-w-[260px] px-4 py-4 align-top">
                        <div className="line-clamp-2 font-bold text-zinc-200">
                          {order.service_type || "-"}
                        </div>
                      </td>

                      <td className="px-4 py-4 align-top">
                        <div className="rounded-xl bg-red-950/30 px-3 py-2 text-center font-black text-red-300">
                          {order.credits_required ?? 0}
                        </div>
                      </td>

                      <td className="px-4 py-4 align-top">
                        <select
                          value={order.status ?? "new_request"}
                          onChange={(event) => updateStatus(order.id, event.target.value)}
                          disabled={updatingId === order.id}
                          className={`w-44 rounded-xl border px-3 py-2 text-xs font-black outline-none ${statusClass(
                            order.status
                          )}`}
                        >
                          {editableStatusOptions.map((status) => (
                            <option key={status} value={status} className="bg-[#111]">
                              {statusLabel(status)}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td className="px-4 py-4 align-top">
                        {order.original_file_path ? (
                          <div className="rounded-xl border border-emerald-700/40 bg-emerald-950/25 px-3 py-2 text-xs font-bold text-emerald-300">
                            Original Ready
                          </div>
                        ) : (
                          <div className="rounded-xl border border-zinc-700/40 bg-zinc-900/40 px-3 py-2 text-xs font-bold text-zinc-500">
                            No Original
                          </div>
                        )}

                        {order.modified_file_path && (
                          <div className="mt-1 rounded-xl border border-blue-700/40 bg-blue-950/25 px-3 py-2 text-xs font-bold text-blue-300">
                            Modified Ready
                          </div>
                        )}

                        <div className="mt-1 max-w-[160px] truncate text-xs text-zinc-500">
                          {order.uploaded_file_name || "-"}
                        </div>
                      </td>

                      <td className="px-4 py-4 align-top">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => downloadOriginalFile(order)}
                            disabled={!order.original_file_path}
                            className="rounded-xl bg-[#b1121b] px-3 py-2 text-xs font-black text-white transition hover:bg-[#c91824] disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <Download className="mr-1 inline h-4 w-4" />
                            Original
                          </button>

                          <label className="cursor-pointer rounded-xl border border-emerald-700/40 bg-emerald-950/30 px-3 py-2 text-xs font-black text-emerald-300 transition hover:bg-emerald-900/40">
                            {uploadingModifiedId === order.id ? (
                              <>
                                <Loader2 className="mr-1 inline h-4 w-4 animate-spin" />
                                Uploading
                              </>
                            ) : (
                              <>
                                <Upload className="mr-1 inline h-4 w-4" />
                                Upload Mod
                              </>
                            )}

                            <input
                              type="file"
                              className="hidden"
                              disabled={uploadingModifiedId === order.id}
                              onChange={(event) => {
                                const file = event.target.files?.[0] ?? null;
                                uploadModifiedFile(order, file);
                                event.target.value = "";
                              }}
                            />
                          </label>

                          <button
                            onClick={() => setSelectedOrder(order)}
                            className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-black text-white transition hover:bg-white/10"
                          >
                            <Eye className="mr-1 inline h-4 w-4" />
                            Details
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="space-y-4 xl:hidden">
            {filteredOrders.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-black/30 p-8 text-center text-zinc-500">
                No orders found.
              </div>
            ) : (
              filteredOrders.map((order) => (
                <div
                  key={order.id}
                  className="rounded-2xl border border-white/10 bg-black/30 p-5"
                >
                  <div className="mb-4 flex items-start justify-between gap-4">
                    <div>
                      <div className="text-lg font-black">
                        {order.vehicle_brand || "-"} {order.vehicle_model || ""}
                      </div>
                      <div className="mt-1 text-sm text-zinc-500">
                        #{shortId(order.id)} · {formatDate(order.created_at)}
                      </div>
                    </div>

                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-bold ${statusClass(
                        order.status
                      )}`}
                    >
                      {statusLabel(order.status)}
                    </span>
                  </div>

                  <div className="grid gap-3 text-sm md:grid-cols-2">
                    <MiniInfo label="Customer" value={order.customer_email} />
                    <MiniInfo label="Engine" value={order.vehicle_engine} />
                    <MiniInfo label="ECU" value={order.ecu} />
                    <MiniInfo label="Service" value={order.service_type} />
                  </div>

                  <div className="mt-4 flex flex-col gap-2 md:flex-row">
                    <select
                      value={order.status ?? "new_request"}
                      onChange={(event) => updateStatus(order.id, event.target.value)}
                      disabled={updatingId === order.id}
                      className={`h-11 rounded-xl border px-3 text-xs font-black outline-none ${statusClass(
                        order.status
                      )}`}
                    >
                      {editableStatusOptions.map((status) => (
                        <option key={status} value={status} className="bg-[#111]">
                          {statusLabel(status)}
                        </option>
                      ))}
                    </select>

                    <button
                      onClick={() => downloadOriginalFile(order)}
                      disabled={!order.original_file_path}
                      className="h-11 rounded-xl bg-[#b1121b] px-4 text-sm font-black text-white disabled:opacity-40"
                    >
                      <Download className="mr-2 inline h-4 w-4" />
                      Original
                    </button>

                    <label className="flex h-11 cursor-pointer items-center justify-center rounded-xl border border-emerald-700/40 bg-emerald-950/30 px-4 text-sm font-black text-emerald-300">
                      {uploadingModifiedId === order.id ? (
                        <>
                          <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                          Uploading
                        </>
                      ) : (
                        <>
                          <Upload className="mr-2 inline h-4 w-4" />
                          Upload Mod
                        </>
                      )}

                      <input
                        type="file"
                        className="hidden"
                        disabled={uploadingModifiedId === order.id}
                        onChange={(event) => {
                          const file = event.target.files?.[0] ?? null;
                          uploadModifiedFile(order, file);
                          event.target.value = "";
                        }}
                      />
                    </label>

                    <button
                      onClick={() => setSelectedOrder(order)}
                      className="h-11 rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm font-black text-white"
                    >
                      <Eye className="mr-2 inline h-4 w-4" />
                      Details
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </section>

      {selectedOrder && (
        <OrderDetailModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onDownload={() => downloadOriginalFile(selectedOrder)}
          onCopy={() => copyOrderId(selectedOrder.id)}
          onStatusChange={(status) => updateStatus(selectedOrder.id, status)}
          onUploadModified={(file) => uploadModifiedFile(selectedOrder, file)}
          updating={updatingId === selectedOrder.id}
          uploadingModified={uploadingModifiedId === selectedOrder.id}
        />
      )}
    </main>
  );
}

function StatCard({
  icon,
  label,
  value,
  highlight = false,
}: {
  icon: ReactNode;
  label: string;
  value: string | number;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-[2rem] border p-5 ${
        highlight
          ? "border-red-900/40 bg-red-950/20"
          : "border-white/10 bg-white/[0.04]"
      }`}
    >
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-red-950/40 text-red-400">
        {icon}
      </div>
      <div className="text-sm text-zinc-400">{label}</div>
      <div className="mt-2 text-3xl font-black">{value}</div>
    </div>
  );
}

function MiniInfo({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  return (
    <div className="rounded-xl bg-white/[0.04] p-3">
      <div className="text-xs uppercase tracking-[0.12em] text-zinc-500">
        {label}
      </div>
      <div className="mt-1 font-bold text-white">{value || "-"}</div>
    </div>
  );
}

function Detail({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string | number | null | undefined;
}) {
  return (
    <div className="flex gap-3 rounded-2xl bg-white/[0.04] p-4">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-red-950/40 text-red-400">
        {icon}
      </div>
      <div>
        <div className="text-xs uppercase tracking-[0.14em] text-zinc-500">
          {label}
        </div>
        <div className="mt-1 break-words font-bold text-white">{value || "-"}</div>
      </div>
    </div>
  );
}

function OrderDetailModal({
  order,
  onClose,
  onDownload,
  onCopy,
  onStatusChange,
  onUploadModified,
  updating,
  uploadingModified,
}: {
  order: Order;
  onClose: () => void;
  onDownload: () => void;
  onCopy: () => void;
  onStatusChange: (status: string) => void;
  onUploadModified: (file: File | null) => void;
  updating: boolean;
  uploadingModified: boolean;
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 px-4 py-6 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-6xl overflow-auto rounded-[2rem] border border-white/10 bg-[#090909] shadow-2xl shadow-black">
        <div className="sticky top-0 z-10 border-b border-white/10 bg-[#090909]/95 p-5 backdrop-blur-xl">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full border px-3 py-1 text-xs font-bold ${statusClass(
                    order.status
                  )}`}
                >
                  {statusLabel(order.status)}
                </span>

                <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-bold text-zinc-400">
                  #{shortId(order.id)}
                </span>
              </div>

              <h2 className="text-3xl font-black">
                {order.vehicle_brand || "-"} {order.vehicle_model || ""}
              </h2>

              <p className="mt-1 text-sm text-zinc-500">
                {order.customer_email || "-"} · {formatDate(order.created_at)}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={onCopy}
                className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-black text-white transition hover:bg-white/10"
              >
                <Copy className="mr-2 inline h-4 w-4" />
                Copy ID
              </button>

              <button
                onClick={onDownload}
                disabled={!order.original_file_path}
                className="rounded-xl bg-[#b1121b] px-4 py-3 text-sm font-black text-white transition hover:bg-[#c91824] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Download className="mr-2 inline h-4 w-4" />
                Download Original
              </button>

              <label className="cursor-pointer rounded-xl border border-emerald-700/40 bg-emerald-950/30 px-4 py-3 text-sm font-black text-emerald-300 transition hover:bg-emerald-900/40">
                {uploadingModified ? (
                  <>
                    <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                    Uploading Modified
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 inline h-4 w-4" />
                    Upload Modified
                  </>
                )}

                <input
                  type="file"
                  className="hidden"
                  disabled={uploadingModified}
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    onUploadModified(file);
                    event.target.value = "";
                  }}
                />
              </label>

              <button
                onClick={onClose}
                className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-black text-white transition hover:bg-white/10"
              >
                <X className="mr-2 inline h-4 w-4" />
                Close
              </button>
            </div>
          </div>
        </div>

        <div className="grid gap-6 p-5 lg:grid-cols-[1fr_340px]">
          <div className="space-y-6">
            <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
              <h3 className="mb-4 text-xl font-black">Technical Details</h3>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <Detail icon={<Gauge />} label="Engine" value={order.vehicle_engine} />
                <Detail icon={<FileCode2 />} label="Generation" value={order.vehicle_generation} />
                <Detail icon={<CalendarDays />} label="Year" value={order.vehicle_year} />
                <Detail icon={<Wrench />} label="ECU / TCU" value={order.ecu} />
                <Detail icon={<Wrench />} label="Gearbox" value={order.gearbox} />
                <Detail icon={<FileCode2 />} label="Read Method" value={order.read_method} />
                <Detail icon={<Database />} label="HW / SW" value={order.hw_sw} />
                <Detail icon={<PackageCheck />} label="Master / Slave" value={order.master_slave} />
                <Detail icon={<FileDown />} label="Uploaded File" value={order.uploaded_file_name} />
              </div>
            </section>

            <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
              <h3 className="mb-4 text-xl font-black">Requested Service</h3>

              <div className="rounded-2xl bg-black/30 p-5 text-sm leading-7 text-zinc-300">
                {order.service_type || "-"}
              </div>
            </section>

            <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
              <h3 className="mb-4 text-xl font-black">Customer Notes</h3>

              <div className="min-h-32 whitespace-pre-wrap rounded-2xl bg-black/30 p-5 text-sm leading-7 text-zinc-300">
                {order.notes || "-"}
              </div>
            </section>
          </div>

          <aside className="space-y-6">
            <section className="rounded-[2rem] border border-red-900/40 bg-red-950/20 p-5">
              <CreditCard className="mb-4 h-8 w-8 text-red-400" />
              <div className="text-sm text-zinc-400">Credits Used</div>
              <div className="mt-2 text-5xl font-black">
                {order.credits_required ?? 0}
              </div>
            </section>

            <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
              <h3 className="mb-4 text-xl font-black">Order Status</h3>

              <select
                value={order.status ?? "new_request"}
                onChange={(event) => onStatusChange(event.target.value)}
                disabled={updating}
                className={`h-12 w-full rounded-xl border px-4 text-sm font-black outline-none ${statusClass(
                  order.status
                )}`}
              >
                {editableStatusOptions.map((status) => (
                  <option key={status} value={status} className="bg-[#111]">
                    {statusLabel(status)}
                  </option>
                ))}
              </select>

              {updating && (
                <div className="mt-3 flex items-center gap-2 text-xs text-zinc-500">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Updating status...
                </div>
              )}
            </section>

            <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
              <h3 className="mb-4 text-xl font-black">Customer</h3>

              <div className="space-y-3">
                <Detail icon={<Mail />} label="Email" value={order.customer_email} />
                <Detail icon={<User />} label="Customer ID" value={order.customer_id} />
              </div>

              {order.customer_email && (
                <a
                  href={`mailto:${order.customer_email}`}
                  className="mt-4 flex w-full items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-black text-white transition hover:bg-white/10"
                >
                  <Mail className="mr-2 h-4 w-4" />
                  Email Customer
                </a>
              )}
            </section>

            <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
              <h3 className="mb-4 text-xl font-black">File Paths</h3>

              <div className="space-y-3 text-xs">
                <div className="rounded-2xl bg-black/30 p-4">
                  <div className="mb-1 uppercase tracking-[0.14em] text-zinc-500">
                    Original
                  </div>
                  <div className="break-all text-zinc-300">
                    {order.original_file_path || "-"}
                  </div>
                </div>

                <div className="rounded-2xl bg-black/30 p-4">
                  <div className="mb-1 uppercase tracking-[0.14em] text-zinc-500">
                    Modified
                  </div>
                  <div className="break-all text-zinc-300">
                    {order.modified_file_path || "Not uploaded yet"}
                  </div>
                </div>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}