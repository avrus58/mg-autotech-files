"use client";

import Link from "next/link";
import {
  useState,
  type ButtonHTMLAttributes,
  type FormEvent,
  type ReactNode,
} from "react";
import { getAuthRedirect } from "@/lib/authGuards";
import { supabase } from "@/lib/supabaseClient";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckCircle2,
  Cpu,
  FileCheck2,
  Lock,
  Loader2,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  Upload,
  User,
  Zap,
} from "lucide-react";

type AccountType = "private" | "company";
type StepId = 1 | 2 | 3;

const steps: { id: StepId; label: string; subLabel: string }[] = [
  { id: 1, label: "Account Setup", subLabel: "Customer type" },
  { id: 2, label: "Login Details", subLabel: "E-mail & password" },
  { id: 3, label: "Billing Profile", subLabel: "Invoice & address" },
];

const accountCards: {
  id: AccountType;
  title: string;
  text: string;
  icon: ReactNode;
}[] = [
  {
    id: "private",
    title: "Private Customer",
    text: "For private drivers and single file requests.",
    icon: <User className="h-7 w-7" />,
  },
  {
    id: "company",
    title: "Workshop / Company",
    text: "For garages, dealers and recurring file service work.",
    icon: <Building2 className="h-7 w-7" />,
  },
];

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [taxNumber, setTaxNumber] = useState("");
  const [invoiceEmail, setInvoiceEmail] = useState("");
  const [street, setStreet] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("Germany");
  const [preferredContact, setPreferredContact] = useState("email");
  const [accountType, setAccountType] = useState<AccountType>("company");
  const [step, setStep] = useState<StepId>(1);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const cleanFullName = fullName.trim();
  const cleanCompanyName = companyName.trim();
  const cleanEmail = email.trim().toLowerCase();
  const displayName =
    accountType === "company" ? cleanCompanyName || cleanFullName : cleanFullName;

  const validateAccountStep = () => {
    if (!cleanFullName) {
      setMessage("Please enter your full name.");
      return false;
    }

    if (accountType === "company" && !cleanCompanyName) {
      setMessage("Please enter your company name.");
      return false;
    }

    return true;
  };

  const validateLoginStep = () => {
    if (!cleanEmail) {
      setMessage("Please enter your e-mail address.");
      return false;
    }

    if (password.length < 6) {
      setMessage("Password must be at least 6 characters.");
      return false;
    }

    if (password !== confirmPassword) {
      setMessage("Passwords do not match.");
      return false;
    }

    return true;
  };

  const goNext = () => {
    setMessage("");
    setSuccess(false);

    if (step === 1 && validateAccountStep()) setStep(2);
    if (step === 2 && validateLoginStep()) setStep(3);
  };

  const handleRegister = async (event: FormEvent) => {
    event.preventDefault();

    if (step !== 3) {
      goNext();
      return;
    }

    if (loading) return;

    setLoading(true);
    setMessage("");
    setSuccess(false);

    if (!validateAccountStep()) {
      setStep(1);
      setLoading(false);
      return;
    }

    if (!validateLoginStep()) {
      setStep(2);
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        emailRedirectTo: getAuthRedirect("/auth/callback?next=/dashboard"),
        data: {
          full_name: cleanFullName,
          account_type: accountType,
          company_name: cleanCompanyName || null,
          phone: phone.trim() || null,
          vat_id: taxNumber.trim() || null,
          tax_number: taxNumber.trim() || null,
          invoice_email: invoiceEmail.trim() || cleanEmail,
          street: street.trim() || null,
          postal_code: postalCode.trim() || null,
          city: city.trim() || null,
          country: country.trim() || "Germany",
          preferred_contact: preferredContact,
          role: "customer",
        },
      },
    });

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setMessage(
      "Account created. Please verify your e-mail address before logging in."
    );
    setPassword("");
    setConfirmPassword("");
    setLoading(false);
  };

  const handleGoogleRegister = async () => {
    if (googleLoading) return;

    setGoogleLoading(true);
    setMessage("");
    setSuccess(false);

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

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#050505] px-4 py-8 text-white sm:py-10">
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_18%_0%,rgba(177,18,27,0.28),transparent_34%),radial-gradient(circle_at_82%_100%,rgba(177,18,27,0.18),transparent_30%),linear-gradient(135deg,#050505,#0d0d0f_48%,#160608)]" />

      <div className="grid w-full max-w-7xl overflow-hidden rounded-[1.6rem] border border-white/10 bg-white/[0.04] shadow-2xl shadow-black/50 backdrop-blur-xl lg:grid-cols-[0.92fr_1.08fr] lg:rounded-[2rem]">
        <section className="relative hidden min-h-[760px] overflow-hidden border-r border-white/10 bg-black/40 p-10 lg:block">
          <div className="absolute -left-24 -top-24 h-80 w-80 rounded-full bg-red-700/20 blur-3xl" />
          <div className="absolute -bottom-24 -right-20 h-80 w-80 rounded-full bg-red-950/40 blur-3xl" />
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-red-500/60 to-transparent" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_68%_34%,rgba(177,18,27,0.16),transparent_22%),linear-gradient(140deg,transparent,rgba(255,255,255,0.04))]" />

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
              Verified customer workspace
            </div>

            <h1 className="max-w-xl text-5xl font-black leading-tight">
              File service account for workshops and drivers.
            </h1>

            <p className="mt-6 max-w-lg leading-8 text-zinc-400">
              Create a secure workspace for ECU / TCU uploads, credit balance,
              technical communication and completed file delivery.
            </p>
          </div>

          <div className="relative mt-14 grid gap-4">
            <FeatureCard
              icon={<Cpu className="h-6 w-6" />}
              title="Smart Vehicle Database"
              text="Select brand, model, generation and engine with automatic ECU and performance data."
            />
            <FeatureCard
              icon={<Zap className="h-6 w-6" />}
              title="Premium File Workflow"
              text="Submit original files, choose tuning services and receive your modified file through your dashboard."
            />
            <FeatureCard
              icon={<Building2 className="h-6 w-6" />}
              title="Private and business customers"
              text="Built for clean order handling, credit tracking and professional ECU service communication."
            />
          </div>

          <div className="relative mt-8 grid grid-cols-3 gap-3">
            {["Secure upload", "Credit wallet", "Live order status"].map((item) => (
              <div
                key={item}
                className="rounded-2xl border border-red-900/30 bg-red-950/15 p-4 text-center text-xs font-black uppercase tracking-[0.14em] text-red-100"
              >
                {item}
              </div>
            ))}
          </div>
        </section>

        <section className="p-5 sm:p-8 lg:p-10">
          <div className="mx-auto max-w-2xl">
            <div className="mb-8 lg:hidden">
              <Link href="/" className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-red-800/50 bg-[#111]">
                  <Upload className="h-7 w-7 text-red-600" />
                </div>
                <div>
                  <div className="text-xl font-black">
                    MG <span className="text-red-600">AUTOTECH</span>
                  </div>
                  <div className="text-xs text-zinc-400">Customer Register</div>
                </div>
              </Link>
            </div>

            <div className="mb-8">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-red-900/50 bg-red-950/20 px-3 py-1.5 text-xs font-black uppercase tracking-[0.16em] text-red-200">
                <ShieldCheck className="h-4 w-4" />
                Start your file service account
              </div>
              <h2 className="text-3xl font-black leading-tight sm:text-4xl">
                Create Account
              </h2>
              <p className="mt-3 leading-7 text-zinc-400">
                A guided setup for private customers and professional workshops.
              </p>
            </div>

            <StepProgress step={step} onStepChange={setStep} />

            <form onSubmit={handleRegister} className="space-y-5">
              {step === 1 && (
                <div className="space-y-5">
                  <div className="grid gap-4 sm:grid-cols-2">
                    {accountCards.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setAccountType(item.id)}
                        className={`rounded-3xl border p-5 text-left transition hover:-translate-y-0.5 sm:p-6 ${
                          accountType === item.id
                            ? "border-red-500 bg-red-950/25 shadow-xl shadow-red-950/20"
                            : "border-white/10 bg-black/25 hover:border-white/20"
                        }`}
                      >
                        <div className="mb-5 flex items-center justify-between gap-3">
                          <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-red-400">
                            {item.icon}
                          </span>
                          {accountType === item.id && (
                            <CheckCircle2 className="h-6 w-6 shrink-0 text-red-400" />
                          )}
                        </div>
                        <div className="text-lg font-black">{item.title}</div>
                        <p className="mt-2 text-sm leading-6 text-zinc-500">
                          {item.text}
                        </p>
                      </button>
                    ))}
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <TextField
                      label="Full Name"
                      value={fullName}
                      onChange={setFullName}
                      placeholder="Name and surname"
                      icon={<User className="h-5 w-5" />}
                      required
                    />
                    <TextField
                      label="Phone Number"
                      value={phone}
                      onChange={setPhone}
                      placeholder="+49 151 23456789"
                      icon={<Phone className="h-5 w-5" />}
                      type="tel"
                    />
                  </div>

                  {accountType === "company" && (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <TextField
                        label="Company Name"
                        value={companyName}
                        onChange={setCompanyName}
                        placeholder="Workshop / company"
                        icon={<Building2 className="h-5 w-5" />}
                        required
                      />
                      <TextField
                        label="VAT ID / Tax Number"
                        value={taxNumber}
                        onChange={setTaxNumber}
                        placeholder="Optional"
                        icon={<FileCheck2 className="h-5 w-5" />}
                      />
                    </div>
                  )}

                  <InfoBox>
                    Company details stay attached to requests for cleaner
                    workshop administration.
                  </InfoBox>

                  <PrimaryButton type="button" onClick={goNext}>
                    Continue
                    <ArrowRight className="ml-2 h-5 w-5 transition group-hover:translate-x-1" />
                  </PrimaryButton>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-5">
                  <TextField
                    label="E-mail"
                    value={email}
                    onChange={setEmail}
                    placeholder="you@example.com"
                    icon={<Mail className="h-5 w-5" />}
                    type="email"
                    required
                  />

                  <div className="grid gap-4 sm:grid-cols-2">
                    <TextField
                      label="Password"
                      value={password}
                      onChange={setPassword}
                      placeholder="Minimum 6 characters"
                      icon={<Lock className="h-5 w-5" />}
                      type="password"
                      required
                    />
                    <TextField
                      label="Confirm Password"
                      value={confirmPassword}
                      onChange={setConfirmPassword}
                      placeholder="Repeat password"
                      icon={<ShieldCheck className="h-5 w-5" />}
                      type="password"
                      required
                    />
                  </div>

                  <div className="rounded-2xl border border-emerald-900/40 bg-emerald-950/15 p-5">
                    <div className="flex items-start gap-3">
                      <ShieldCheck className="mt-1 h-5 w-5 shrink-0 text-emerald-400" />
                      <p className="text-sm leading-6 text-zinc-400">
                        E-mail verification is required before the customer
                        dashboard can be used.
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-[auto_1fr]">
                    <SecondaryButton type="button" onClick={() => setStep(1)}>
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Back
                    </SecondaryButton>
                    <PrimaryButton type="button" onClick={goNext}>
                      Continue
                      <ArrowRight className="ml-2 h-5 w-5 transition group-hover:translate-x-1" />
                    </PrimaryButton>
                  </div>

                  <Divider label="or" />

                  <button
                    type="button"
                    onClick={handleGoogleRegister}
                    disabled={googleLoading}
                    className="flex h-14 w-full items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-5 font-black text-white transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-60"
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
                </div>
              )}

              {step === 3 && (
                <div className="space-y-5">
                  <div className="rounded-3xl border border-white/10 bg-black/25 p-5">
                    <div className="mb-5 flex items-start gap-3">
                      <MapPin className="mt-1 h-6 w-6 shrink-0 text-red-400" />
                      <div>
                        <h3 className="text-xl font-black">Billing Profile</h3>
                        <p className="mt-1 text-sm leading-6 text-zinc-500">
                          Invoice details can be completed now or later in
                          account settings.
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-4">
                      <TextField
                        label="Invoice E-mail"
                        value={invoiceEmail}
                        onChange={setInvoiceEmail}
                        placeholder={cleanEmail || "invoice@example.com"}
                        icon={<Mail className="h-5 w-5" />}
                        type="email"
                      />
                      <TextField
                        label="Street / House Number"
                        value={street}
                        onChange={setStreet}
                        placeholder="Street and number"
                        icon={<MapPin className="h-5 w-5" />}
                      />
                      <div className="grid gap-4 sm:grid-cols-[0.7fr_1fr]">
                        <TextField
                          label="Postcode"
                          value={postalCode}
                          onChange={setPostalCode}
                          placeholder="70437"
                        />
                        <TextField
                          label="City"
                          value={city}
                          onChange={setCity}
                          placeholder="Stuttgart"
                        />
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <TextField
                          label="Country"
                          value={country}
                          onChange={setCountry}
                          placeholder="Germany"
                        />
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
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-red-900/40 bg-red-950/20 p-5">
                    <div className="text-xs font-black uppercase tracking-[0.16em] text-red-200">
                      Account summary
                    </div>
                    <div className="mt-2 break-words text-lg font-black">
                      {displayName || "Your MG AutoTech account"}
                    </div>
                    <div className="mt-1 text-sm text-zinc-500">
                      {accountType === "company"
                        ? "Workshop / company customer"
                        : "Private customer"}
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-[auto_1fr]">
                    <SecondaryButton type="button" onClick={() => setStep(2)}>
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Back
                    </SecondaryButton>
                    <PrimaryButton disabled={loading}>
                      {loading ? (
                        <>
                          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                          Creating account...
                        </>
                      ) : (
                        <>
                          Create Account
                          <ArrowRight className="ml-2 h-5 w-5 transition group-hover:translate-x-1" />
                        </>
                      )}
                    </PrimaryButton>
                  </div>
                </div>
              )}
            </form>

            {message && (
              <div
                className={`mt-5 rounded-2xl border p-4 text-sm ${
                  success
                    ? "border-green-800/50 bg-green-950/25 text-green-100"
                    : "border-red-800/50 bg-red-950/30 text-red-100"
                }`}
              >
                <div className="flex gap-3">
                  {success && (
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-400" />
                  )}
                  <span>{message}</span>
                </div>
              </div>
            )}

            <div className="mt-8 rounded-2xl border border-white/10 bg-black/30 p-5 text-center text-sm text-zinc-400">
              Already have an account?{" "}
              <Link href="/login" className="font-black text-red-400">
                Login
              </Link>
            </div>

            <p className="mt-5 text-center text-xs leading-5 text-zinc-600">
              By creating an account, you can submit ECU / TCU file requests and
              manage your MG AutoTech credit balance securely.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

function StepProgress({
  step,
  onStepChange,
}: {
  step: StepId;
  onStepChange: (step: StepId) => void;
}) {
  return (
    <div className="mb-8">
      <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr] items-start gap-2 sm:gap-3">
        {steps.map((item, index) => (
          <div key={item.id} className="contents">
            <button
              type="button"
              onClick={() => onStepChange(item.id)}
              className="group flex min-w-0 flex-col items-center gap-2 text-center"
            >
              <span
                className={`flex h-10 w-10 items-center justify-center rounded-full border text-sm font-black transition sm:h-11 sm:w-11 ${
                  step >= item.id
                    ? "border-red-500 bg-red-950/40 text-white shadow-lg shadow-red-950/30"
                    : "border-white/20 bg-black/35 text-zinc-500"
                }`}
              >
                {item.id}
              </span>
              <span
                className={`text-[10px] font-black uppercase tracking-[0.1em] sm:text-[11px] ${
                  step >= item.id ? "text-red-200" : "text-zinc-600"
                }`}
              >
                {item.label}
              </span>
              <span className="hidden text-[11px] text-zinc-600 sm:block">
                {item.subLabel}
              </span>
            </button>
            {index < steps.length - 1 && (
              <span
                className={`mt-5 h-px w-full ${
                  step > item.id ? "bg-red-700/70" : "bg-white/15"
                }`}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  text,
}: {
  icon: ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
      <div className="mb-3 text-red-500">{icon}</div>
      <div className="font-black">{title}</div>
      <p className="mt-2 text-sm leading-6 text-zinc-500">{text}</p>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  icon,
  type = "text",
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  icon?: ReactNode;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block min-w-0">
      <div className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-zinc-500">
        {label}
      </div>
      <div className="relative">
        {icon && (
          <span className="absolute left-4 top-1/2 flex -translate-y-1/2 text-zinc-500">
            {icon}
          </span>
        )}
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          type={type}
          required={required}
          className={`h-14 w-full rounded-2xl border border-white/10 bg-black/35 px-4 text-sm font-bold text-white outline-none transition placeholder:text-zinc-600 focus:border-red-700 ${
            icon ? "pl-12" : ""
          }`}
        />
      </div>
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
    <label className="block min-w-0">
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

function InfoBox({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-5">
      <div className="flex items-start gap-3">
        <FileCheck2 className="mt-1 h-5 w-5 shrink-0 text-red-400" />
        <p className="text-sm leading-6 text-zinc-400">{children}</p>
      </div>
    </div>
  );
}

function Divider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 text-xs font-black uppercase tracking-[0.16em] text-zinc-600">
      <span className="h-px flex-1 bg-white/10" />
      {label}
      <span className="h-px flex-1 bg-white/10" />
    </div>
  );
}

function PrimaryButton({
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`group flex h-14 w-full items-center justify-center rounded-2xl bg-[#b1121b] px-5 font-black text-white shadow-xl shadow-red-950/40 transition hover:bg-[#c91824] disabled:cursor-not-allowed disabled:opacity-60 ${
        props.className ?? ""
      }`}
    >
      {children}
    </button>
  );
}

function SecondaryButton({
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`flex h-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] px-6 font-black text-white transition hover:bg-white/[0.08] ${
        props.className ?? ""
      }`}
    >
      {children}
    </button>
  );
}
