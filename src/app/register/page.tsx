"use client";

import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type FormEvent,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import {
  authenticatedFetch,
  getAuthenticatedHome,
  getAuthRedirect,
  signOutIfEmailUnverified,
} from "@/lib/authGuards";
import { TurnstileChallenge } from "@/components/auth/TurnstileChallenge";
import { GoogleIdentityButton } from "@/components/auth/GoogleIdentityButton";
import { CountrySelect } from "@/components/CountrySelect";
import { InternationalPhoneField } from "@/components/InternationalPhoneField";
import {
  authCaptchaBlocksSubmission,
  getAuthCaptchaToken,
  getPublicAuthCaptchaConfig,
} from "@/lib/authCaptcha";
import { supabase } from "@/lib/supabaseClient";
import { getPublicGoogleIdentityConfig } from "@/lib/googleIdentity";
import { resolveBrowserTransactionalEmailLanguage } from "@/lib/email/language";
import {
  normalizeCountryCode,
  normalizeCountryName,
  resolveDetectedCountrySelection,
} from "@/lib/countries";
import {
  formatInternationalPhone,
  getCountryCallingCode,
  resolveDetectedPhoneCountrySelection,
} from "@/lib/phoneCountries";
import { recordGrowthAccountCreated } from "@/lib/growth/client";
import {
  beginRegistrationConversion,
  trackRegistrationCompleted,
} from "@/lib/publicAnalytics";
import {
  createRegistrationProfileDraft,
  OAUTH_REGISTRATION_PROFILE_KEY,
  OAUTH_REGISTRATION_PROVIDER_KEY,
} from "@/lib/registrationProfile";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckCircle2,
  FileCheck2,
  Lock,
  Loader2,
  Mail,
  MapPin,
  ShieldCheck,
  Upload,
  User,
  RefreshCw,
} from "lucide-react";

type AccountType = "private" | "company";
type StepId = 1 | 2 | 3;
type CountryDetectionState = "detecting" | "detected" | "manual";

function getSelectedEmailLanguage() {
  return resolveBrowserTransactionalEmailLanguage({
    storedLocale: window.localStorage.getItem("mg_locale"),
    cookieHeader: document.cookie,
    browserLocale: window.navigator.language,
  });
}

function clearOAuthRegistrationDraft() {
  try {
    window.sessionStorage.removeItem(OAUTH_REGISTRATION_PROVIDER_KEY);
    window.sessionStorage.removeItem(OAUTH_REGISTRATION_PROFILE_KEY);
  } catch {
    // Browser privacy settings may deny storage; auth cleanup must still finish.
  }
}

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
  const router = useRouter();
  const authCaptchaConfig = getPublicAuthCaptchaConfig();
  const googleIdentityConfig = getPublicGoogleIdentityConfig();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneCountryCode, setPhoneCountryCode] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [taxNumber, setTaxNumber] = useState("");
  const [invoiceEmail, setInvoiceEmail] = useState("");
  const [street, setStreet] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [countryDetection, setCountryDetection] =
    useState<CountryDetectionState>("detecting");
  const [preferredContact, setPreferredContact] = useState("email");
  const [accountType, setAccountType] = useState<AccountType>("company");
  const [step, setStep] = useState<StepId>(1);
  const [message, setMessage] = useState("");
  const [googleMessage, setGoogleMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [verificationPending, setVerificationPending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [resendingVerification, setResendingVerification] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaResetKey, setCaptchaResetKey] = useState(0);
  const authRequestInFlightRef = useRef(false);
  const countryManuallySelectedRef = useRef(false);
  const phoneCountryManuallySelectedRef = useRef(false);
  const countrySelectRef = useRef<HTMLSelectElement>(null);
  const stepPanelRef = useRef<HTMLDivElement>(null);
  const previousStepRef = useRef<StepId>(step);

  useEffect(() => {
    if (previousStepRef.current === step) return;
    previousStepRef.current = step;
    const frameId = window.requestAnimationFrame(() => {
      stepPanelRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [step]);

  useEffect(() => {
    let active = true;

    const redirectAuthenticatedUser = async () => {
      const { data } = await supabase.auth.getUser();
      const user = data.user;

      if (!active) return;

      if (!user) {
        setCheckingAuth(false);
        return;
      }

      if (await signOutIfEmailUnverified(user)) {
        router.replace("/login?verify_email=1");
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

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 4_000);

    void fetch("/api/public/country", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) return null;
        return (await response.json()) as { countryCode?: unknown };
      })
      .then((payload) => {
        if (!active) return;
        const detectedCountryCode = normalizeCountryCode(payload?.countryCode);
        if (!detectedCountryCode || countryManuallySelectedRef.current) {
          setCountryDetection("manual");
          return;
        }

        setCountry((currentCountry) =>
          resolveDetectedCountrySelection({
            currentCountry,
            detectedCountryCode,
            manuallySelected: countryManuallySelectedRef.current,
          })
        );
        setPhoneCountryCode((currentCountryCode) =>
          resolveDetectedPhoneCountrySelection({
            currentCountryCode,
            detectedCountryCode,
            manuallySelected: phoneCountryManuallySelectedRef.current,
          })
        );
        setCountryDetection("detected");
      })
      .catch(() => {
        if (active) setCountryDetection("manual");
      })
      .finally(() => window.clearTimeout(timeout));

    return () => {
      active = false;
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, []);

  const cleanFullName = fullName.trim();
  const cleanCompanyName = companyName.trim();
  const cleanEmail = email.trim().toLowerCase();
  const displayName =
    accountType === "company" ? cleanCompanyName || cleanFullName : cleanFullName;
  const formattedPhone = formatInternationalPhone({
    countryCode: phoneCountryCode,
    nationalNumber: phone,
  });
  const countryHint =
    countryDetection === "detecting"
      ? "Detecting your country..."
      : countryDetection === "detected"
        ? "Country selected automatically. You can change it."
        : "Select the country used for your customer profile.";

  const changeStep = (nextStep: StepId) => {
    if (loading || resendingVerification || authRequestInFlightRef.current) return;
    if (nextStep !== step) {
      setCaptchaToken(null);
      setCaptchaResetKey((value) => value + 1);
      setGoogleMessage("");
    }
    setStep(nextStep);
  };

  const validateAccountStep = () => {
    if (!cleanFullName) {
      setMessage("Please enter your full name.");
      return false;
    }

    if (accountType === "company" && !cleanCompanyName) {
      setMessage("Please enter your company name.");
      return false;
    }

    if (phone.trim() && !formattedPhone) {
      setMessage(
        "Please check the calling code and phone number. For special carrier plans, enter the complete international number beginning with +."
      );
      return false;
    }

    if (!normalizeCountryName(country)) {
      setMessage("Please select your country.");
      setCountryDetection("manual");
      window.setTimeout(() => countrySelectRef.current?.focus(), 0);
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

    if (step === 1 && validateAccountStep()) changeStep(2);
    if (step === 2 && validateLoginStep()) changeStep(3);
  };

  const handleRegister = async (event: FormEvent) => {
    event.preventDefault();

    if (step !== 3) {
      goNext();
      return;
    }

    if (loading || resendingVerification || authRequestInFlightRef.current) return;

    setMessage("");
    setSuccess(false);
    setVerificationPending(false);

    if (!validateAccountStep()) {
      setStep(1);
      return;
    }

    if (!validateLoginStep()) {
      setStep(2);
      return;
    }

    const selectedCountry = normalizeCountryName(country);
    if (!selectedCountry) {
      setStep(1);
      return;
    }

    setLoading(true);

    let requestCaptchaToken: string | undefined;
    try {
      requestCaptchaToken = getAuthCaptchaToken(
        authCaptchaConfig,
        captchaToken
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Security verification failed."
      );
      setLoading(false);
      return;
    }

    authRequestInFlightRef.current = true;
    if (requestCaptchaToken) setCaptchaToken(null);

    const response = await Promise.resolve()
      .then(() => {
        beginRegistrationConversion();
        return supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            emailRedirectTo: getAuthRedirect("/auth/callback?next=/dashboard"),
            ...(requestCaptchaToken
              ? { captchaToken: requestCaptchaToken }
              : {}),
            data: {
              full_name: cleanFullName,
              account_type: accountType,
              company_name: accountType === "company" ? cleanCompanyName : null,
              phone: formattedPhone,
              vat_id: accountType === "company" ? taxNumber.trim() || null : null,
              tax_number: accountType === "company" ? taxNumber.trim() || null : null,
              invoice_email: invoiceEmail.trim() || cleanEmail,
              street: street.trim() || null,
              postal_code: postalCode.trim() || null,
              city: city.trim() || null,
              country: selectedCountry,
              preferred_contact: preferredContact,
              email_language: getSelectedEmailLanguage(),
              registration_country_required: false,
              registration_country_confirmed: true,
              role: "customer",
            },
          },
        });
      })
      .catch(() => null)
      .finally(() => {
        authRequestInFlightRef.current = false;
        if (!requestCaptchaToken) return;
        setCaptchaResetKey((value) => value + 1);
      });

    if (!response) {
      setMessage("Account creation could not be completed. Please try again.");
      setLoading(false);
      return;
    }
    const { data, error } = response;

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    const isAlreadyVerified = Boolean(data.session && data.user?.email_confirmed_at);
    if (isAlreadyVerified) {
      void recordGrowthAccountCreated();
      void trackRegistrationCompleted();
      void authenticatedFetch("/api/email/new-customer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: "email" }),
      }).catch(() => undefined);
    }

    setSuccess(true);
    setVerificationPending(!isAlreadyVerified);
    setMessage(
      isAlreadyVerified
        ? "Account created and verified. You can now open your customer dashboard."
        : "Account created. Please verify your e-mail address before logging in."
    );
    setPassword("");
    setConfirmPassword("");
    setLoading(false);
  };

  const handleResendVerification = async () => {
    if (
      resendingVerification ||
      loading ||
      authRequestInFlightRef.current ||
      !cleanEmail
    ) return;

    let requestCaptchaToken: string | undefined;
    try {
      requestCaptchaToken = getAuthCaptchaToken(
        authCaptchaConfig,
        captchaToken
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Security verification failed."
      );
      return;
    }

    authRequestInFlightRef.current = true;
    if (requestCaptchaToken) setCaptchaToken(null);

    setResendingVerification(true);
    setMessage("");
    const response = await supabase.auth.resend({
        type: "signup",
        email: cleanEmail,
        options: {
          emailRedirectTo: getAuthRedirect("/auth/callback?next=/dashboard"),
          ...(requestCaptchaToken
            ? { captchaToken: requestCaptchaToken }
            : {}),
        },
      })
      .catch(() => null)
      .finally(() => {
        authRequestInFlightRef.current = false;
        if (!requestCaptchaToken) return;
        setCaptchaResetKey((value) => value + 1);
      });
    if (!response) {
      setResendingVerification(false);
      setSuccess(false);
      setMessage("Verification e-mail could not be sent. Please try again.");
      return;
    }
    const { error } = response;
    setResendingVerification(false);
    setSuccess(!error);
    setMessage(
      error
        ? error.message
        : "A new verification e-mail has been sent. Please also check your spam folder."
    );
  };

  const handleGoogleRegister = async (credential: string, nonce: string) => {
    if (
      googleLoading ||
      loading ||
      resendingVerification ||
      authRequestInFlightRef.current
    ) return;

    if (!validateAccountStep()) {
      changeStep(1);
      return;
    }

    if (googleIdentityConfig.status !== "ready") {
      setGoogleMessage(
        googleIdentityConfig.status === "misconfigured"
          ? googleIdentityConfig.message
          : "Google account creation is temporarily unavailable. You can continue with e-mail."
      );
      return;
    }

    const selectedCountry = normalizeCountryName(country);
    if (!selectedCountry) {
      changeStep(1);
      return;
    }

    let requestCaptchaToken: string | undefined;
    try {
      requestCaptchaToken = getAuthCaptchaToken(
        authCaptchaConfig,
        captchaToken
      );
    } catch (error) {
      setGoogleMessage(
        error instanceof Error ? error.message : "Security verification failed."
      );
      setCaptchaResetKey((value) => value + 1);
      return;
    }

    authRequestInFlightRef.current = true;
    if (requestCaptchaToken) setCaptchaToken(null);
    setGoogleLoading(true);
    setGoogleMessage("");
    setSuccess(false);
    const response = await Promise.resolve()
      .then(() => {
        beginRegistrationConversion();
        window.sessionStorage.setItem(OAUTH_REGISTRATION_PROVIDER_KEY, "google");
        const profileDraft = createRegistrationProfileDraft({
          fullName: cleanFullName,
          accountType,
          companyName: cleanCompanyName,
          phone: formattedPhone ?? "",
          taxNumber,
          country: selectedCountry,
          emailLanguage: getSelectedEmailLanguage(),
        });
        if (!profileDraft) throw new Error("registration-profile");
        window.sessionStorage.setItem(
          OAUTH_REGISTRATION_PROFILE_KEY,
          JSON.stringify(profileDraft)
        );

        return supabase.auth.signInWithIdToken({
          provider: "google",
          token: credential,
          nonce,
          ...(requestCaptchaToken
            ? { options: { captchaToken: requestCaptchaToken } }
            : {}),
        });
      })
      .catch(() => null)
      .finally(() => {
        if (!requestCaptchaToken) return;
        setCaptchaResetKey((value) => value + 1);
      });

    if (!response) {
      authRequestInFlightRef.current = false;
      clearOAuthRegistrationDraft();
      setGoogleMessage("Google account creation could not be completed. Please try again.");
      setGoogleLoading(false);
      return;
    }

    const { data, error } = response;

    if (error || !data.session) {
      authRequestInFlightRef.current = false;
      clearOAuthRegistrationDraft();
      setGoogleMessage("Google account creation could not be completed. Please try again.");
      setGoogleLoading(false);
      return;
    }

    router.replace("/auth/callback?next=/dashboard");
  };

  if (checkingAuth) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#050505] text-white">
        <Loader2 className="h-8 w-8 animate-spin text-red-500" aria-label="Checking account" />
      </main>
    );
  }

  return (
    <main className="relative flex min-h-screen items-start justify-center overflow-x-hidden bg-[#050505] px-3 py-3 text-white sm:px-4 sm:py-5 lg:items-center lg:py-6">
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_18%_0%,rgba(177,18,27,0.28),transparent_34%),radial-gradient(circle_at_82%_100%,rgba(177,18,27,0.18),transparent_30%),linear-gradient(135deg,#050505,#0d0d0f_48%,#160608)]" />

      <div className="w-full max-w-[760px] overflow-hidden rounded-[1.4rem] border border-white/10 bg-white/[0.04] shadow-2xl shadow-black/50 backdrop-blur-xl lg:rounded-[1.6rem]">
        <header className="flex items-center justify-between gap-4 border-b border-white/10 bg-black/25 px-4 py-3.5 sm:px-6">
          <Link href="/" className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-red-800/50 bg-[#111] shadow-lg shadow-red-950/30">
              <Upload className="h-5 w-5 text-red-600" />
            </div>
            <div className="min-w-0">
              <div className="text-lg font-black tracking-wide">
                MG <span className="text-red-600">AUTOTECH</span>
              </div>
              <div className="truncate text-[11px] text-zinc-500">
                ECU File Service Platform
              </div>
            </div>
          </Link>

          <div className="hidden shrink-0 items-center gap-2 rounded-full border border-red-900/40 bg-red-950/20 px-3 py-1.5 text-[11px] font-bold text-red-100 sm:inline-flex">
            <ShieldCheck className="h-3.5 w-3.5 text-red-500" />
            Verified customer workspace
          </div>
        </header>

        <section className="p-4 sm:p-6 lg:p-7">
          <div className="mx-auto max-w-[650px]">
            <div className="mb-4">
              <h1 className="text-2xl font-black leading-tight">
                Create Account
              </h1>
              <p className="mt-1.5 text-sm leading-5 text-zinc-400">
                A guided setup for private customers and professional workshops.
              </p>
            </div>

            <StepProgress step={step} onStepChange={changeStep} />

            <div
              ref={stepPanelRef}
              role="region"
              aria-labelledby="register-step-heading"
              tabIndex={-1}
              className="scroll-mt-4 outline-none"
            >
              <h2 id="register-step-heading" className="sr-only">
                Step {step}: {steps.find((item) => item.id === step)?.label}
              </h2>

              {step === 2 && (
                <div className="mb-4 space-y-3">
                  {googleIdentityConfig.status === "ready" &&
                    authCaptchaConfig.status === "ready" && (
                      <TurnstileChallenge
                        siteKey={authCaptchaConfig.siteKey}
                        action="auth_register_google"
                        resetKey={captchaResetKey}
                        onToken={setCaptchaToken}
                        appearance="interaction-only"
                      />
                    )}

                  {(authCaptchaConfig.status === "misconfigured" ||
                    googleIdentityConfig.status === "misconfigured") && (
                    <div
                      role="alert"
                      className="rounded-xl border border-red-800/50 bg-red-950/30 p-4 text-sm text-red-100"
                    >
                      {authCaptchaConfig.status === "misconfigured"
                        ? authCaptchaConfig.message
                        : googleIdentityConfig.status === "misconfigured"
                          ? googleIdentityConfig.message
                          : null}
                    </div>
                  )}

                  {googleIdentityConfig.status === "ready" &&
                    authCaptchaConfig.status !== "misconfigured" && (
                      <GoogleIdentityButton
                        clientId={googleIdentityConfig.clientId}
                        disabled={
                          googleLoading ||
                          loading ||
                          resendingVerification ||
                          authCaptchaBlocksSubmission(
                            authCaptchaConfig,
                            captchaToken
                          )
                        }
                        loading={googleLoading}
                        resetKey={captchaResetKey}
                        onCredential={(credential, nonce) =>
                          void handleGoogleRegister(credential, nonce)
                        }
                        onReady={() =>
                          setGoogleMessage((current) =>
                            current.startsWith(
                              "Google sign-in could not be loaded"
                            )
                              ? ""
                              : current
                          )
                        }
                        onError={(reason) => {
                          if (reason === "credential") {
                            setCaptchaToken(null);
                            setCaptchaResetKey((value) => value + 1);
                          }
                          setGoogleMessage(
                            reason === "load"
                              ? "Google sign-in could not be loaded. You can retry or continue with e-mail."
                              : "Google account creation could not be completed. Please try again."
                          );
                        }}
                      />
                    )}

                  {googleMessage && (
                    <div
                      role="alert"
                      aria-live="assertive"
                      className="rounded-xl border border-red-800/50 bg-red-950/30 p-4 text-sm text-red-100"
                    >
                      {googleMessage}
                    </div>
                  )}
                </div>
              )}

              <form onSubmit={handleRegister} className="space-y-4">
              {step === 1 && (
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2" role="group" aria-label="Customer type">
                    {accountCards.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setAccountType(item.id)}
                        aria-pressed={accountType === item.id}
                        className={`grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-start gap-3 rounded-xl border p-3 text-left transition hover:-translate-y-0.5 ${
                          accountType === item.id
                            ? "border-red-500 bg-red-950/25 shadow-xl shadow-red-950/20"
                            : "border-white/10 bg-black/25 hover:border-white/20"
                        }`}
                      >
                        <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-red-400">
                          {item.icon}
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-black sm:text-base">
                            {item.title}
                          </span>
                          <span className="mt-1 block text-xs leading-5 text-zinc-500">
                            {item.text}
                          </span>
                        </span>
                        {accountType === item.id ? (
                          <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-red-400" />
                        ) : (
                          <span className="h-5 w-5" aria-hidden="true" />
                        )}
                      </button>
                    ))}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <TextField
                      label="Full Name"
                      value={fullName}
                      onChange={setFullName}
                      placeholder="Name and surname"
                      icon={<User className="h-5 w-5" />}
                      autoComplete="name"
                      maxLength={120}
                      required
                    />
                    <InternationalPhoneField
                      countryCode={phoneCountryCode}
                      nationalNumber={phone}
                      onCountryCodeChange={(countryCode) => {
                        phoneCountryManuallySelectedRef.current = true;
                        setPhoneCountryCode(countryCode);
                      }}
                      onNationalNumberChange={setPhone}
                    />
                  </div>

                  <CountrySelect
                    value={country}
                    onChange={(value) => {
                      countryManuallySelectedRef.current = true;
                      setCountry(value);
                      setCountryDetection("manual");
                    }}
                    onCountryCodeChange={(countryCode) => {
                      if (phoneCountryManuallySelectedRef.current) return;
                      setPhoneCountryCode(
                        getCountryCallingCode(countryCode) ? countryCode : ""
                      );
                    }}
                    required
                    detecting={countryDetection === "detecting"}
                    hint={countryHint}
                    selectRef={countrySelectRef}
                  />

                  {accountType === "company" && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <TextField
                        label="Company Name"
                        value={companyName}
                        onChange={setCompanyName}
                        placeholder="Workshop / company"
                        icon={<Building2 className="h-5 w-5" />}
                        autoComplete="organization"
                        maxLength={120}
                        required
                      />
                      <TextField
                        label="VAT ID / Tax Number"
                        value={taxNumber}
                        onChange={setTaxNumber}
                        placeholder="Optional"
                        icon={<FileCheck2 className="h-5 w-5" />}
                        maxLength={80}
                      />
                    </div>
                  )}

                  {accountType === "company" && (
                    <InfoBox>
                      Company details stay attached to requests for cleaner
                      workshop administration.
                    </InfoBox>
                  )}

                  <PrimaryButton type="button" onClick={goNext}>
                    Continue
                    <ArrowRight className="ml-2 h-5 w-5 transition group-hover:translate-x-1" />
                  </PrimaryButton>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-4">
                  <TextField
                    label="E-mail"
                    value={email}
                    onChange={setEmail}
                    placeholder="you@example.com"
                    icon={<Mail className="h-5 w-5" />}
                    type="email"
                    autoComplete="email"
                    required
                  />

                  <div className="grid gap-3 sm:grid-cols-2">
                    <TextField
                      label="Password"
                      value={password}
                      onChange={setPassword}
                      placeholder="Minimum 6 characters"
                      icon={<Lock className="h-5 w-5" />}
                      type="password"
                      autoComplete="new-password"
                      required
                    />
                    <TextField
                      label="Confirm Password"
                      value={confirmPassword}
                      onChange={setConfirmPassword}
                      placeholder="Repeat password"
                      icon={<ShieldCheck className="h-5 w-5" />}
                      type="password"
                      autoComplete="new-password"
                      required
                    />
                  </div>

                  <div className="rounded-xl border border-emerald-900/40 bg-emerald-950/15 p-4">
                    <div className="flex items-start gap-3">
                      <ShieldCheck className="mt-1 h-5 w-5 shrink-0 text-emerald-400" />
                      <p className="text-sm leading-6 text-zinc-400">
                        E-mail verification is required before the customer
                        dashboard can be used.
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-[auto_1fr]">
                    <SecondaryButton type="button" onClick={() => changeStep(1)}>
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Back
                    </SecondaryButton>
                    <PrimaryButton type="button" onClick={goNext}>
                      Continue
                      <ArrowRight className="ml-2 h-5 w-5 transition group-hover:translate-x-1" />
                    </PrimaryButton>
                  </div>

                </div>
              )}

              {step === 3 && (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                    <div className="mb-4 flex items-start gap-3">
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
                        autoComplete="email"
                      />
                      <TextField
                        label="Street / House Number"
                        value={street}
                        onChange={setStreet}
                        placeholder="Street and number"
                        icon={<MapPin className="h-5 w-5" />}
                        autoComplete="street-address"
                      />
                      <div className="grid gap-4 sm:grid-cols-[0.7fr_1fr]">
                        <TextField
                          label="Postcode"
                          value={postalCode}
                          onChange={setPostalCode}
                          placeholder="70437"
                          autoComplete="postal-code"
                        />
                        <TextField
                          label="City"
                          value={city}
                          onChange={setCity}
                          placeholder="Stuttgart"
                          autoComplete="address-level2"
                        />
                      </div>
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

                  <div className="rounded-xl border border-red-900/40 bg-red-950/20 p-4">
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

                  {authCaptchaConfig.status === "ready" && (
                    <TurnstileChallenge
                      siteKey={authCaptchaConfig.siteKey}
                      action="auth_register"
                      resetKey={captchaResetKey}
                      onToken={setCaptchaToken}
                      appearance="interaction-only"
                    />
                  )}

                  {authCaptchaConfig.status === "misconfigured" && (
                    <div
                      role="alert"
                      className="rounded-xl border border-red-800/50 bg-red-950/30 p-4 text-sm text-red-100"
                    >
                      {authCaptchaConfig.message}
                    </div>
                  )}

                  <div className="grid gap-3 sm:grid-cols-[auto_1fr]">
                    <SecondaryButton type="button" onClick={() => changeStep(2)}>
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Back
                    </SecondaryButton>
                    <PrimaryButton
                      disabled={
                        loading ||
                        resendingVerification ||
                        authCaptchaBlocksSubmission(
                          authCaptchaConfig,
                          captchaToken
                        )
                      }
                    >
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
            </div>

            {message && (
              <div
                role={success ? "status" : "alert"}
                aria-live={success ? "polite" : "assertive"}
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

            {success && verificationPending && cleanEmail && (
              <button
                type="button"
                onClick={() => void handleResendVerification()}
                disabled={
                  resendingVerification ||
                  loading ||
                  authCaptchaBlocksSubmission(authCaptchaConfig, captchaToken)
                }
                className="mt-3 inline-flex items-center text-sm font-black text-red-400 transition hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {resendingVerification ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                Resend verification e-mail
              </button>
            )}

            <div className="mt-5 text-center text-sm text-zinc-400">
              Already have an account?{" "}
              <Link href="/login" className="font-black text-red-400">
                Login
              </Link>
            </div>

            <p className="mt-3 text-center text-xs leading-5 text-zinc-500">
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
    <div className="mb-4">
      <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr] items-start gap-2 sm:gap-3">
        {steps.map((item, index) => (
          <div key={item.id} className="contents">
            <button
              type="button"
              onClick={() => onStepChange(item.id)}
              aria-current={step === item.id ? "step" : undefined}
              className="group flex min-w-0 flex-col items-center gap-1.5 text-center"
            >
              <span
                className={`flex h-9 w-9 items-center justify-center rounded-full border text-sm font-black transition ${
                  step >= item.id
                    ? "border-red-500 bg-red-950/40 text-white shadow-lg shadow-red-950/30"
                    : "border-white/20 bg-black/35 text-zinc-500"
                }`}
              >
                {item.id}
              </span>
              <span
                className={`text-[9px] font-black uppercase tracking-[0.08em] sm:text-[10px] ${
                  step >= item.id ? "text-red-200" : "text-zinc-600"
                }`}
              >
                {item.label}
              </span>
              <span className="hidden text-[10px] text-zinc-600 2xl:block">
                {item.subLabel}
              </span>
            </button>
            {index < steps.length - 1 && (
              <span
                className={`mt-[18px] h-px w-full ${
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

function TextField({
  label,
  value,
  onChange,
  placeholder,
  icon,
  type = "text",
  autoComplete,
  maxLength,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  icon?: ReactNode;
  type?: string;
  autoComplete?: string;
  maxLength?: number;
  required?: boolean;
}) {
  return (
    <label className="block min-w-0">
      <div className="mb-1.5 text-[11px] font-black uppercase tracking-[0.14em] text-zinc-500">
        {label}
        {required && (
          <span className="ml-1 text-red-400" aria-hidden="true">
            *
          </span>
        )}
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
          autoComplete={autoComplete}
          maxLength={maxLength}
          required={required}
          className={`h-11 w-full rounded-xl border border-white/10 bg-black/35 px-4 text-sm font-bold text-white outline-none transition placeholder:text-zinc-600 focus:border-red-700 ${
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
      <div className="mb-1.5 text-[11px] font-black uppercase tracking-[0.14em] text-zinc-500">
        {label}
      </div>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-xl border border-white/10 bg-black/35 px-4 text-sm font-bold text-white outline-none transition focus:border-red-700"
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
    <div className="rounded-xl border border-white/10 bg-black/25 p-3">
      <div className="flex items-start gap-3">
        <FileCheck2 className="mt-1 h-5 w-5 shrink-0 text-red-400" />
        <p className="text-sm leading-6 text-zinc-400">{children}</p>
      </div>
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
      className={`group flex h-12 w-full items-center justify-center rounded-xl bg-[#b1121b] px-5 font-black text-white shadow-xl shadow-red-950/40 transition hover:bg-[#c91824] disabled:cursor-not-allowed disabled:opacity-60 ${
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
      className={`flex h-12 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] px-6 font-black text-white transition hover:bg-white/[0.08] ${
        props.className ?? ""
      }`}
    >
      {children}
    </button>
  );
}
