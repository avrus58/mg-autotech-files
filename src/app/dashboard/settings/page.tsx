"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CountrySelect } from "@/components/CountrySelect";
import { getStableSession, notifySessionRequired, signOutIfEmailUnverified } from "@/lib/authGuards";
import { normalizeCountryName } from "@/lib/countries";
import { supabase } from "@/lib/supabaseClient";
import { resolveTransactionalEmailLanguageFromMetadata } from "@/lib/email/language";
import type { TransactionalEmailLanguage } from "@/lib/email/types";
import { supportedLocales } from "@/lib/i18nConfig";
import { TrustedDevicesCard } from "@/components/account/TrustedDevicesCard";
import { CustomerPortalPageHeader } from "@/components/dashboard/CustomerPortalPageHeader";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Copy,
  CreditCard,
  Languages,
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

const SETTINGS_LOAD_ERROR_MESSAGE = "Customer profile could not be synced. Please try again.";
const SETTINGS_SAVE_ERROR_MESSAGE = "Settings could not be saved. Please try again. Your entered details are still shown.";

function hasSettingsValue(value: string | null | undefined) {
  return Boolean(value?.trim());
}

function getSettingsReadinessItems({
  fullName,
  phone,
  invoiceEmail,
  preferredContact,
  accountType,
  companyName,
  street,
  postalCode,
  city,
  country,
}: {
  fullName: string;
  phone: string;
  invoiceEmail: string;
  preferredContact: string;
  accountType: string;
  companyName: string;
  street: string;
  postalCode: string;
  city: string;
  country: string;
}) {
  const addressComplete =
    hasSettingsValue(street) &&
    hasSettingsValue(postalCode) &&
    hasSettingsValue(city) &&
    hasSettingsValue(country);

  return [
    {
      label: "Contact details",
      detail: "Name, phone and preferred contact method are ready for support handover.",
      complete: hasSettingsValue(fullName) && hasSettingsValue(phone) && hasSettingsValue(preferredContact),
    },
    {
      label: "Invoice contact",
      detail: "Invoice e-mail is available for payment and accounting follow-up.",
      complete: hasSettingsValue(invoiceEmail),
    },
    {
      label: "Billing address",
      detail: "Address fields are ready for future invoice workflows.",
      complete: addressComplete,
    },
    {
      label: accountType === "company" ? "Company profile" : "Account type",
      detail:
        accountType === "company"
          ? "Company / workshop name is available for B2B support context."
          : "Private customer profile is selected.",
      complete: accountType === "company" ? hasSettingsValue(companyName) : hasSettingsValue(accountType),
    },
  ];
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
  const [country, setCountry] = useState("");
  const [vatId, setVatId] = useState("");
  const [invoiceEmail, setInvoiceEmail] = useState("");
  const [preferredContact, setPreferredContact] = useState("email");
  const [emailLanguage, setEmailLanguage] = useState<TransactionalEmailLanguage>("en");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [loadError, setLoadError] = useState("");
  const [settingsReady, setSettingsReady] = useState(false);
  const [referenceCopied, setReferenceCopied] = useState(false);
  const customerReference = formatCustomerReference(customerId);
  const readinessItems = useMemo(
    () =>
      getSettingsReadinessItems({
        fullName,
        phone,
        invoiceEmail,
        preferredContact,
        accountType,
        companyName,
        street,
        postalCode,
        city,
        country,
      }),
    [accountType, city, companyName, country, fullName, invoiceEmail, phone, postalCode, preferredContact, street]
  );
  const completedReadinessItems = readinessItems.filter((item) => item.complete).length;
  const readinessPercent = Math.round((completedReadinessItems / readinessItems.length) * 100);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setMessage("");
    setLoadError("");

    const user = (await getStableSession()).session?.user;

    if (!user) {
      notifySessionRequired();
      setLoading(false);
      return;
    }

    if (await signOutIfEmailUnverified(user)) {
      router.push("/login?verify_email=1");
      return;
    }

    setEmail(user.email ?? null);
    setEmailLanguage(resolveTransactionalEmailLanguageFromMetadata(user.user_metadata));

    const { data: profile, error } = await supabase
      .from("profiles")
      .select(
        "customer_id, credit_balance, full_name, account_type, company_name, phone, street, postal_code, city, country, vat_id, invoice_email, preferred_contact"
      )
      .eq("id", user.id)
      .single();

    if (error) {
      setLoadError(SETTINGS_LOAD_ERROR_MESSAGE);
      setSettingsReady(false);
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
    setCountry(normalizeCountryName(data.country) ?? data.country?.trim() ?? "");
    setVatId(data.vat_id ?? "");
    setInvoiceEmail(data.invoice_email ?? user.email ?? "");
    setPreferredContact(data.preferred_contact ?? "email");

    setSettingsReady(true);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadSettings();
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [loadSettings]);

  const saveSettings = async (event: React.FormEvent) => {
    event.preventDefault();

    setSaving(true);
    setMessage("");

    const user = (await getStableSession()).session?.user;

    if (!user) {
      setSaving(false);
      notifySessionRequired();
      return;
    }

    if (await signOutIfEmailUnverified(user)) {
      setSaving(false);
      router.push("/login?verify_email=1");
      return;
    }

    const selectedCountry = normalizeCountryName(country) ?? country.trim();
    if (!selectedCountry) {
      setSaving(false);
      setMessage("Please select your country.");
      return;
    }

    const [profileResult, languageResult] = await Promise.all([
      supabase
        .from("profiles")
        .update({
          full_name: fullName.trim() || null,
          account_type: accountType,
          company_name: companyName.trim() || null,
          phone: phone.trim() || null,
          street: street.trim() || null,
          postal_code: postalCode.trim() || null,
          city: city.trim() || null,
          country: selectedCountry,
          vat_id: vatId.trim() || null,
          invoice_email: invoiceEmail.trim() || email,
          preferred_contact: preferredContact,
        })
        .eq("id", user.id),
      supabase.auth.updateUser({
        data: { email_language: emailLanguage, country: selectedCountry },
      }),
    ]);

    setSaving(false);

    if (profileResult.error || languageResult.error) {
      setMessage(SETTINGS_SAVE_ERROR_MESSAGE);
      return;
    }

    setMessage("Settings saved successfully.");
  };

  const copyCustomerReference = async () => {
    try {
      await navigator.clipboard.writeText(customerReference);
      setReferenceCopied(true);
      window.setTimeout(() => setReferenceCopied(false), 2000);
    } catch {
      setMessage("Customer reference could not be copied. Please copy it manually.");
    }
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

  if (loadError && !settingsReady) {
    return <SettingsLoadErrorState onRetry={() => void loadSettings()} />;
  }

  return (
    <main className="mg-compact-ui min-h-screen bg-[var(--mg-portal-canvas)] text-white">
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_18%_0%,rgba(160,18,28,0.25),transparent_34%),linear-gradient(135deg,#050505,#0c0c0e_48%,#170507)]" />

      <CustomerPortalPageHeader
        eyebrow="Account"
        title="Customer Settings"
        icon={User}
      />

      <section className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-8 grid gap-6 xl:grid-cols-[1fr_340px]">
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

        <form onSubmit={saveSettings} className="grid gap-6 xl:grid-cols-[1fr_0.8fr]">
          <section className="space-y-6">
            <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6">
              <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-emerald-200">
                    <ShieldCheck className="h-4 w-4" />
                    Account Readiness
                  </div>
                  <h2 className="text-2xl font-black">Profile completion for faster handling</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
                    Complete customer details before high-touch file service workflows so support,
                    billing and request review can move without extra back-and-forth.
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/30 px-5 py-4 text-right">
                  <div className="text-xs font-black uppercase tracking-[0.16em] text-zinc-500">
                    Ready
                  </div>
                  <div className="mt-1 text-3xl font-black text-emerald-300">
                    {readinessPercent}%
                  </div>
                  <div className="mt-1 text-xs text-zinc-500">
                    {completedReadinessItems}/{readinessItems.length} checks complete
                  </div>
                </div>
              </div>

              <div className="mt-6 grid gap-3 md:grid-cols-2">
                {readinessItems.map((item) => (
                  <div
                    key={item.label}
                    className={`rounded-2xl border p-4 ${
                      item.complete
                        ? "border-emerald-500/20 bg-emerald-500/10"
                        : "border-amber-500/20 bg-amber-500/10"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {item.complete ? (
                        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
                      ) : (
                        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
                      )}
                      <div>
                        <div className="font-black text-white">{item.label}</div>
                        <p className="mt-1 text-sm leading-6 text-zinc-400">{item.detail}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

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
                <SelectField
                  label="E-mail Language"
                  value={emailLanguage}
                  onChange={(value) => setEmailLanguage(value as TransactionalEmailLanguage)}
                  options={supportedLocales.map(({ code, name }) => [code, name])}
                />
                <Field label="Invoice E-mail" value={invoiceEmail} onChange={setInvoiceEmail} placeholder="invoice@example.com" type="email" />
              </div>
              <div className="mt-4 flex items-start gap-3 rounded-2xl border border-white/10 bg-black/25 p-4 text-sm leading-6 text-zinc-400">
                <Languages className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
                Account, request, payment and delivery emails use this language. All supported website languages now have a matching customer email version.
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
                <CountrySelect
                  value={country}
                  onChange={setCountry}
                  required
                  variant="settings"
                />
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
                <button
                  type="button"
                  onClick={copyCustomerReference}
                  className="mt-4 inline-flex items-center rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-black text-white transition hover:bg-white/10"
                >
                  <Copy className="mr-2 h-4 w-4" />
                  {referenceCopied ? "Reference copied" : "Copy reference"}
                </button>
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
        <TrustedDevicesCard />
      </section>
    </main>
  );
}

function SettingsLoadErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#050505] px-4 text-white">
      <div className="w-full max-w-xl rounded-[2rem] border border-red-800/40 bg-red-950/20 p-8 text-center shadow-2xl shadow-black/30" role="alert">
        <AlertTriangle className="mx-auto mb-5 h-10 w-10 text-red-300" />
        <h1 className="text-2xl font-black">Customer settings sync failed</h1>
        <p className="mt-3 leading-7 text-red-100/80">
          Your profile form is not shown until customer settings load successfully. This prevents default profile values or an incorrect bank-transfer reference from being displayed.
        </p>
        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          <button type="button" onClick={onRetry} className="rounded-xl bg-[#b1121b] px-5 py-3 text-sm font-black text-white hover:bg-[#c91824]">
            Try again
          </button>
          <Link href="/dashboard" className="rounded-xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-black text-white hover:bg-white/10">
            Back to dashboard
          </Link>
        </div>
      </div>
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
