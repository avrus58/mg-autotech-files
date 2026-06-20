"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signOutIfEmailUnverified } from "@/lib/authGuards";
import { supabase } from "@/lib/supabaseClient";
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  CreditCard,
  Gauge,
  Loader2,
  MapPin,
  Save,
  ShieldCheck,
  User,
} from "lucide-react";

type Profile = {
  customer_id: string | null;
  credit_balance: number | string | null;
  full_name: string | null;
  account_type: string | null;
  company_name: string | null;
  phone: string | null;
  street: string | null;
  postal_code: string | null;
  city: string | null;
  country: string | null;
  vat_id: string | null;
  invoice_email: string | null;
  preferred_contact: string | null;
};

function formatCustomerReference(customerId: string | null) {
  if (!customerId) return "MGA-10001";

  const cleanId = customerId.trim().toUpperCase();
  if (/^MGA-\d{5,}$/.test(cleanId)) return cleanId;
  if (/^\d+$/.test(cleanId)) return `MGA-${cleanId.padStart(5, "0")}`;
  return "MGA-10001";
}

export default function CustomerSettingsPage() {
  const router = useRouter();

  const [email, setEmail] = useState<string | null>(null);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [credits, setCredits] = useState<number>(0);

  const [fullName, setFullName] = useState("");
  const [accountType, setAccountType] = useState("private");
  const [companyName, setCompanyName] = useState("");
  const [phone, setPhone] = useState("");
  const [street, setStreet] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("Germany");
  const [vatId, setVatId] = useState("");
  const [invoiceEmail, setInvoiceEmail] = useState("");
  const [preferredContact, setPreferredContact] = useState("email");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const customerReference = formatCustomerReference(customerId);

  useEffect(() => {
    const loadSettings = async () => {
      setLoading(true);
      setMessage("");

      const { data: userData } = await supabase.auth.getUser();

      if (!userData.user) {
        router.push("/login");
        return;
      }

      const user = userData.user;

      if (await signOutIfEmailUnverified(user)) {
        router.push("/login?verify_email=1");
        return;
      }

      setEmail(user.email ?? null);

      const { data: profile, error } = await supabase
        .from("profiles")
        .select(
          "customer_id, credit_balance, full_name, account_type, company_name, phone, street, postal_code, city, country, vat_id, invoice_email, preferred_contact"
        )
        .eq("id", user.id)
        .single();

      if (error) {
        setMessage(error.message);
        setLoading(false);
        return;
      }

      const data = profile as Profile;

      setCustomerId(data.customer_id ?? null);
      setCredits(Number(data.credit_balance ?? 0));
      setFullName(data.full_name ?? "");
      setAccountType(data.account_type ?? "private");
      setCompanyName(data.company_name ?? "");
      setPhone(data.phone ?? "");
      setStreet(data.street ?? "");
      setPostalCode(data.postal_code ?? "");
      setCity(data.city ?? "");
      setCountry(data.country ?? "Germany");
      setVatId(data.vat_id ?? "");
      setInvoiceEmail(data.invoice_email ?? user.email ?? "");
      setPreferredContact(data.preferred_contact ?? "email");

      setLoading(false);
    };

    loadSettings();
  }, [router]);

  const saveSettings = async (event: React.FormEvent) => {
    event.preventDefault();

    setSaving(true);
    setMessage("");

    const { data: userData } = await supabase.auth.getUser();

    if (!userData.user) {
      router.push("/login");
      return;
    }

    if (await signOutIfEmailUnverified(userData.user)) {
      router.push("/login?verify_email=1");
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: fullName.trim() || null,
        account_type: accountType,
        company_name: companyName.trim() || null,
        phone: phone.trim() || null,
        street: street.trim() || null,
        postal_code: postalCode.trim() || null,
        city: city.trim() || null,
        country: country.trim() || "Germany",
        vat_id: vatId.trim() || null,
        invoice_email: invoiceEmail.trim() || email,
        preferred_contact: preferredContact,
      })
      .eq("id", userData.user.id);

    setSaving(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Settings saved successfully.");
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#050505] text-white">
        <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-6 py-5">
          <Loader2 className="h-5 w-5 animate-spin text-red-500" />
          Loading customer settings...
        </div>
      </main>
    );
  }

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
              <div className="text-xs text-zinc-400">Customer Settings</div>
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
        <div className="mb-8 grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="relative overflow-hidden rounded-[2rem] border border-red-900/50 bg-gradient-to-br from-red-950/30 via-white/[0.04] to-black p-7 shadow-2xl shadow-black/30">
            <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-red-700/20 blur-3xl" />
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-red-500/60 to-transparent" />

            <div className="relative">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-red-800/50 bg-red-950/30 px-4 py-2 text-sm font-bold text-red-100">
                <ShieldCheck className="h-4 w-4 text-red-500" />
                Private customer profile
              </div>

              <h1 className="text-4xl font-black md:text-5xl">
                Account <span className="text-red-500">Settings</span>
              </h1>

              <p className="mt-4 max-w-3xl leading-8 text-zinc-400">
                Manage your billing, company and contact details for file
                service requests, support and future invoice workflows.
              </p>
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-black/20">
            <div className="mb-5 flex items-center gap-3">
              <User className="h-8 w-8 text-red-500" />
              <div>
                <div className="text-sm font-black uppercase tracking-[0.2em] text-red-600">
                  Customer ID
                </div>
                <div className="mt-1 text-2xl font-black">
                  {customerReference}
                </div>
              </div>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between rounded-2xl bg-black/30 p-4">
                <span className="text-zinc-500">Login E-mail</span>
                <span className="max-w-[180px] truncate font-bold">{email}</span>
              </div>

              <div className="flex items-center justify-between rounded-2xl bg-black/30 p-4">
                <span className="text-zinc-500">Credits</span>
                <span className="font-black text-red-400">{credits}</span>
              </div>
            </div>
          </div>
        </div>

        {message && (
          <div
            className={`mb-6 rounded-2xl border p-4 text-sm ${
              message.includes("successfully")
                ? "border-emerald-700/40 bg-emerald-950/25 text-emerald-300"
                : "border-red-800/50 bg-red-950/30 text-red-200"
            }`}
          >
            {message.includes("successfully") && (
              <CheckCircle2 className="mr-2 inline h-4 w-4" />
            )}
            {message}
          </div>
        )}

        <form onSubmit={saveSettings} className="grid gap-6 lg:grid-cols-[1fr_0.8fr]">
          <section className="space-y-6">
            <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6">
              <div className="mb-6 flex items-center gap-3">
                <User className="h-7 w-7 text-red-500" />
                <div>
                  <h2 className="text-2xl font-black">Personal Details</h2>
                  <p className="mt-1 text-sm text-zinc-500">
                    Basic contact information for your account.
                  </p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Full Name" value={fullName} onChange={setFullName} placeholder="John Doe" />
                <Field label="Phone Number" value={phone} onChange={setPhone} placeholder="+49..." />
                <SelectField
                  label="Preferred Contact"
                  value={preferredContact}
                  onChange={setPreferredContact}
                  options={[
                    ["email", "E-mail"],
                    ["whatsapp", "WhatsApp"],
                    ["phone", "Phone"],
                  ]}
                />
                <Field label="Invoice E-mail" value={invoiceEmail} onChange={setInvoiceEmail} placeholder="invoice@example.com" type="email" />
              </div>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6">
              <div className="mb-6 flex items-center gap-3">
                <Building2 className="h-7 w-7 text-red-500" />
                <div>
                  <h2 className="text-2xl font-black">Company / Billing</h2>
                  <p className="mt-1 text-sm text-zinc-500">
                    Optional billing and company information.
                  </p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <SelectField
                  label="Account Type"
                  value={accountType}
                  onChange={setAccountType}
                  options={[
                    ["private", "Private Customer"],
                    ["company", "Company / Workshop"],
                  ]}
                />
                <Field label="Company Name" value={companyName} onChange={setCompanyName} placeholder="Company / Workshop name" />
                <Field label="VAT ID / Tax Number" value={vatId} onChange={setVatId} placeholder="DE..." />
              </div>
            </div>
          </section>

          <aside className="space-y-6">
            <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6">
              <div className="mb-6 flex items-center gap-3">
                <MapPin className="h-7 w-7 text-red-500" />
                <div>
                  <h2 className="text-2xl font-black">Address</h2>
                  <p className="mt-1 text-sm text-zinc-500">
                    Used for billing and future service workflows.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <Field label="Street / House Number" value={street} onChange={setStreet} placeholder="Böckinger Str. 32" />
                <div className="grid gap-4 sm:grid-cols-[0.7fr_1fr]">
                  <Field label="Postcode" value={postalCode} onChange={setPostalCode} placeholder="70437" />
                  <Field label="City" value={city} onChange={setCity} placeholder="Stuttgart" />
                </div>
                <Field label="Country" value={country} onChange={setCountry} placeholder="Germany" />
              </div>
            </div>

            <div className="rounded-[2rem] border border-red-900/40 bg-red-950/20 p-6">
              <CreditCard className="mb-5 h-10 w-10 text-red-500" />
              <h3 className="text-2xl font-black">Bank Transfer Reference</h3>
              <p className="mt-3 text-sm leading-6 text-zinc-400">
                For manual bank transfer top-ups, use your Customer ID as the
                payment reference.
              </p>

              <div className="mt-5 rounded-2xl border border-white/10 bg-black/30 p-4">
                <div className="text-xs font-black uppercase tracking-[0.16em] text-zinc-500">
                  Reference
                </div>
                <div className="mt-2 text-2xl font-black text-red-400">
                  {customerReference}
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="flex w-full items-center justify-center rounded-2xl bg-[#b1121b] px-5 py-5 text-sm font-black text-white shadow-xl shadow-red-950/40 transition hover:bg-[#c91824] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving Settings...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Settings
                </>
              )}
            </button>
          </aside>
        </form>
      </section>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: string;
}) {
  return (
    <label className="block">
      <div className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-zinc-500">
        {label}
      </div>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-14 w-full rounded-2xl border border-white/10 bg-black/35 px-4 text-sm font-bold text-white outline-none transition placeholder:text-zinc-600 focus:border-red-700"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: [string, string][];
}) {
  return (
    <label className="block">
      <div className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-zinc-500">
        {label}
      </div>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-14 w-full rounded-2xl border border-white/10 bg-black/35 px-4 text-sm font-bold text-white outline-none transition focus:border-red-700"
      >
        {options.map(([value, label]) => (
          <option key={value} value={value} className="bg-[#111]">
            {label}
          </option>
        ))}
      </select>
    </label>
  );
}
