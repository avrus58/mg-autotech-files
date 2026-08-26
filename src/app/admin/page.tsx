"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AUTH_SESSION_RECOVERY_MESSAGE,
  AUTH_SESSION_REQUIRED_MESSAGE,
  authenticatedFetch,
  getStableSession,
} from "@/lib/authGuards";
import { resolveAdminAccess } from "@/lib/adminAccessClient";
import {
  ADMIN_SYNC_INCIDENT_HEADER,
  getAdminSyncPresentation,
  getAdminSyncRetryDelay,
  isRetryableAdminSyncFailure,
  readAdminSyncIncidentCode,
  type AdminSyncFailureKind,
  type AdminSyncState,
} from "@/lib/adminSyncResilience";
import { supabase } from "@/lib/supabaseClient";
import {
  creditPackages,
  MAX_CREDIT_PACKAGE_TOTAL_EURO,
  MAX_CUSTOM_CREDIT_UNIT_PRICE_EURO,
  minimumCreditPackageTotalEuro,
  type CreditPackageId,
  type CreditPackagePriceOverrideMap,
} from "@/lib/creditPackages";
import RequestChat from "@/components/RequestChat";
import { AdminNotificationCenter } from "@/components/admin/AdminNotificationCenter";
import type { AdminEmailDeliveryIssue } from "@/lib/adminNotificationCenter";
import {
  adsPerformancePermissions,
  customerIntelligencePermissions,
  growthReportPermissions,
} from "@/lib/growth/access";
import {
  hasAllStaffPermissions,
  hasStaffPermission,
  isPrimaryOwner,
  type StaffAccess,
} from "@/lib/staffPermissions";
import { countCompletedToday } from "@/lib/adminDashboardMetrics";
import { hasAdminSnapshotRegression } from "@/lib/adminDataStability";
import {
  FILE_VERSION_LABEL_MAX_LENGTH,
  buildFileVersionPathSegment,
  formatFileVersionLabel,
  normalizeFileVersionLabel,
} from "@/lib/fileVersionLabels";
import {
  generateCustomerReplacementPassword,
  validateCustomerReplacementPassword,
} from "@/lib/customerPasswordSecurity";
import {
  completeStaffCreditAdjustmentAttempt,
  getStaffCreditAdjustmentSessionStorage,
  hashStaffCreditAdjustmentPayload,
  hashStaffCreditAdjustmentScope,
  prepareStaffCreditAdjustmentAttempt,
  StaffCreditAdjustmentOperationGuard,
} from "@/lib/staffCreditAdjustmentRetry";
import {
  Activity,
  ArrowLeft,
  BarChart3,
  BadgeEuro,
  BellRing,
  BrainCircuit,
  Braces,
  Building2,
  CalendarDays,
  Car,
  CheckCircle2,
  Clipboard,
  Clock3,
  Copy,
  CreditCard,
  Database,
  Download,
  Eye,
  EyeOff,
  FileCode2,
  FileDown,
  Gauge,
  HeartHandshake,
  KeyRound,
  Loader2,
  LogIn,
  Lock,
  Mail,
  MapPin,
  Megaphone,
  MinusCircle,
  PackageCheck,
  Phone,
  RefreshCcw,
  Save,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Tags,
  TriangleAlert,
  Upload,
  User,
  Users,
  WandSparkles,
  WifiOff,
  Wrench,
  X,
} from "lucide-react";

type AdminTab = "orders" | "customers";

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
  modified_files: ModifiedFileVersion[] | null;
  estimated_delivery_label: DeliveryEstimate | null;
  estimated_delivery_note: string | null;
  customer_upload_enabled?: boolean | null;
  customer_uploads?: CustomerUpload[] | null;
  created_at: string | null;
};

type CustomerUpload = {
  id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  uploaded_at: string;
};

type DeliveryEstimate = "usually_30_min" | "same_day" | "24h" | "48h" | "manual_review";
type DeliveryEstimateSelection = DeliveryEstimate | "";

type ModifiedFileVersion = {
  id: string;
  label: string;
  file_name: string;
  file_path: string;
  uploaded_at: string;
};

type CustomerTag = "workshop" | "reseller" | "vip" | "blocked" | "negative_credit";
type PaymentOverride = "inherit" | "enabled" | "disabled";
type CustomerPricingLoadState = "idle" | "loading" | "ready" | "error";

type CustomerCommercialPolicyPayload = {
  user_id: string;
  pricing_model_version: 2;
  package_price_overrides_eur: CreditPackagePriceOverrideMap;
  custom_credit_unit_price_override_eur: number | null;
  payment_stripe_enabled: boolean | null;
  payment_bank_enabled: boolean | null;
  internal_note: string | null;
  updated_at?: string;
};

type CustomerCommercialQuotePayload = {
  customUnitPriceEuro?: number;
  globalCustomUnitPriceEuro?: number;
  packages?: Array<{
    id: CreditPackageId;
    globalPriceEuro: number;
    priceEuro: number;
  }>;
};

type Profile = {
  id: string;
  email: string | null;
  customer_id: string | null;
  full_name: string | null;
  role: string | null;
  credit_balance: number | string | null;
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
  allow_negative_credits: boolean | null;
  negative_credit_limit: number | string | null;
  account_status: string | null;
  customer_tags: CustomerTag[] | null;
  internal_admin_note: string | null;
  created_at: string | null;
};

type CustomerForm = {
  full_name: string;
  account_type: string;
  company_name: string;
  phone: string;
  street: string;
  postal_code: string;
  city: string;
  country: string;
  vat_id: string;
  invoice_email: string;
  preferred_contact: string;
  allow_negative_credits: boolean;
  negative_credit_limit: string;
  account_status: string;
  customer_tags: CustomerTag[];
  internal_admin_note: string;
  commercial_package_price_overrides_eur: Record<CreditPackageId, string>;
  commercial_custom_unit_price_override_eur: string;
  payment_stripe: PaymentOverride;
  payment_bank: PaymentOverride;
  commercial_internal_note: string;
  global_package_prices_eur: Record<CreditPackageId, string>;
  effective_package_prices_eur: Record<CreditPackageId, string>;
  global_custom_unit_price_eur: string;
  effective_custom_unit_price_eur: string;
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
const accountStatusOptions = ["active", "suspended", "blocked"];
const adminOrdersPageSize = 15;
const ADMIN_LOAD_ERROR_MESSAGE =
  "Admin operations could not be loaded. Retry before treating the queue as empty.";
type AdminSyncIssue = {
  kind: AdminSyncFailureKind;
  incidentCode: string | null;
  consecutiveFailures: number;
  retryDelayMs: number | null;
};
type AdminLoadOptions = { silent?: boolean; automatic?: boolean; manual?: boolean };
type AdminSyncFailureInput = { kind: AdminSyncFailureKind; incidentCode?: string | null };
type AdminOrderGroup = "open" | "completed" | "cancelled" | "all";

type AdminStats = {
  total: number;
  customers: number;
  suspendedCustomers: number;
  newRequests: number;
  fileCheck: number;
  inProgress: number;
  revisionRequested: number;
  customerInfoNeeded: number;
  completed: number;
  completedToday: number;
  withFile: number;
  totalCredits: number;
};

type AdminCommandLink = {
  href: string;
  label: string;
  detail: string;
  badge: string;
  icon: ReactNode;
};

const adminOrderGroups: Array<{
  value: AdminOrderGroup;
  label: string;
  description: string;
}> = [
  {
    value: "open",
    label: "Open Work",
    description: "New, file check, progress, revision and info-needed requests.",
  },
  {
    value: "completed",
    label: "Completed Archive",
    description: "Finished orders kept away from the daily work queue.",
  },
  {
    value: "cancelled",
    label: "Cancelled",
    description: "Cancelled requests for later reference.",
  },
  {
    value: "all",
    label: "All Orders",
    description: "Full recent order list.",
  },
];

const deliveryEstimateOptions: Array<{
  value: DeliveryEstimate;
  label: string;
  description: string;
}> = [
  {
    value: "usually_30_min",
    label: "Usually around 30 min",
    description: "Default fast file service estimate for standard requests.",
  },
  {
    value: "same_day",
    label: "Same day",
    description: "For priority or normal same-day handling.",
  },
  {
    value: "24h",
    label: "24h",
    description: "For requests that need additional review.",
  },
  {
    value: "48h",
    label: "48h",
    description: "For complex projects or busy workload.",
  },
  {
    value: "manual_review",
    label: "Manual review",
    description: "Delivery depends on project complexity.",
  },
];

const customerTagOptions: Array<{
  value: CustomerTag;
  label: string;
  className: string;
}> = [
  {
    value: "workshop",
    label: "Workshop",
    className: "border-blue-700/40 bg-blue-950/30 text-blue-300",
  },
  {
    value: "reseller",
    label: "Reseller",
    className: "border-cyan-700/40 bg-cyan-950/30 text-cyan-300",
  },
  {
    value: "vip",
    label: "VIP",
    className: "border-yellow-700/40 bg-yellow-950/30 text-yellow-300",
  },
  {
    value: "blocked",
    label: "Blocked",
    className: "border-red-700/40 bg-red-950/30 text-red-300",
  },
  {
    value: "negative_credit",
    label: "Negative Credit",
    className: "border-orange-700/40 bg-orange-950/30 text-orange-300",
  },
];

function statusLabel(status: string | null) {
  if (!status) return "Unknown";
  return status.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusClass(status: string | null) {
  if (status === "completed") return "border-emerald-700/40 bg-emerald-950/30 text-emerald-300";
  if (status === "in_progress") return "border-blue-700/40 bg-blue-950/30 text-blue-300";
  if (status === "file_check") return "border-yellow-700/40 bg-yellow-950/30 text-yellow-300";
  if (status === "customer_info_needed") return "border-orange-700/40 bg-orange-950/30 text-orange-300";
  if (status === "revision") return "border-purple-700/40 bg-purple-950/30 text-purple-300";
  if (status === "cancelled") return "border-zinc-700/40 bg-zinc-900/50 text-zinc-400";
  return "border-red-800/40 bg-red-950/25 text-red-300";
}

function accountStatusClass(status: string | null) {
  if (status === "blocked") return "border-red-700/40 bg-red-950/30 text-red-300";
  if (status === "suspended") return "border-orange-700/40 bg-orange-950/30 text-orange-300";
  return "border-emerald-700/40 bg-emerald-950/30 text-emerald-300";
}

function customerTagClass(tag: CustomerTag) {
  return (
    customerTagOptions.find((option) => option.value === tag)?.className ??
    "border-white/10 bg-white/[0.04] text-zinc-300"
  );
}

function customerTagLabel(tag: CustomerTag) {
  return customerTagOptions.find((option) => option.value === tag)?.label ?? tag;
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

function adminSyncToneClass(tone: ReturnType<typeof getAdminSyncPresentation>["tone"]) {
  if (tone === "success") return "border-emerald-700/30 bg-emerald-950/20 text-emerald-300";
  if (tone === "warning") return "border-amber-700/35 bg-amber-950/20 text-amber-200";
  if (tone === "danger") return "border-red-700/40 bg-red-950/25 text-red-200";
  return "border-white/10 bg-white/[0.04] text-zinc-300";
}

function shortId(id: string) {
  return id.slice(0, 8).toUpperCase();
}

function splitServiceItems(service: string | null) {
  if (!service) return [];
  return service.split(/[,;+|]/).map((item) => item.trim()).filter(Boolean);
}

function getWorkflowStep(order: Order) {
  if (order.modified_file_path || order.status === "completed") return 4;
  if (order.status === "in_progress" || order.status === "revision") return 3;
  if (order.status === "file_check" || order.status === "customer_info_needed") return 2;
  if (order.original_file_path) return 1;
  return 0;
}

function getModifiedFileVersions(order: Order) {
  const versions = Array.isArray(order.modified_files) ? order.modified_files : [];

  if (versions.length > 0) return versions;

  if (!order.modified_file_path) return [];

  return [
    {
      id: "legacy-final",
      label: "final" as const,
      file_name: order.modified_file_path.split("/").pop() || "Modified file",
      file_path: order.modified_file_path,
      uploaded_at: order.created_at || new Date().toISOString(),
    },
  ];
}

function formatDeliveryEstimate(value: DeliveryEstimateSelection | string | null) {
  return (
    deliveryEstimateOptions.find((option) => option.value === value)?.label ??
    "Estimate not set yet"
  );
}

function workflowLabel(index: number) {
  const labels = ["Created", "Original File", "File Check", "Processing", "Completed"];
  return labels[index] ?? "Created";
}

function emptyPackagePriceText(): Record<CreditPackageId, string> {
  return {
    credits_10: "",
    credits_50: "",
    credits_100: "",
    credits_250: "",
    credits_500: "",
  };
}

function makeCustomerForm(customer: Profile): CustomerForm {
  return {
    full_name: customer.full_name ?? "",
    account_type: customer.account_type ?? "private",
    company_name: customer.company_name ?? "",
    phone: customer.phone ?? "",
    street: customer.street ?? "",
    postal_code: customer.postal_code ?? "",
    city: customer.city ?? "",
    country: customer.country ?? "",
    vat_id: customer.vat_id ?? "",
    invoice_email: customer.invoice_email ?? "",
    preferred_contact: customer.preferred_contact ?? "",
    allow_negative_credits: Boolean(customer.allow_negative_credits),
    negative_credit_limit: String(customer.negative_credit_limit ?? 0),
    account_status: customer.account_status ?? "active",
    customer_tags: Array.isArray(customer.customer_tags)
      ? customer.customer_tags
      : [],
    internal_admin_note: customer.internal_admin_note ?? "",
    commercial_package_price_overrides_eur: emptyPackagePriceText(),
    commercial_custom_unit_price_override_eur: "",
    payment_stripe: "inherit",
    payment_bank: "inherit",
    commercial_internal_note: "",
    global_package_prices_eur: emptyPackagePriceText(),
    effective_package_prices_eur: emptyPackagePriceText(),
    global_custom_unit_price_eur: "",
    effective_custom_unit_price_eur: "",
  };
}

function formatCreditUnitAmount(value: number) {
  return value.toLocaleString("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  });
}

function applyCustomerPricingPayload(
  current: CustomerForm,
  policy: CustomerCommercialPolicyPayload,
  quote?: CustomerCommercialQuotePayload,
): CustomerForm {
  const globalPackagePrices = emptyPackagePriceText();
  const effectivePackagePrices = emptyPackagePriceText();
  for (const item of quote?.packages ?? []) {
    if (item.id in globalPackagePrices) {
      globalPackagePrices[item.id] = String(item.globalPriceEuro);
      effectivePackagePrices[item.id] = String(item.priceEuro);
    }
  }

  return {
    ...current,
    commercial_package_price_overrides_eur: Object.fromEntries(
      creditPackages.map((item) => [
        item.id,
        policy.package_price_overrides_eur[item.id] == null
          ? ""
          : String(policy.package_price_overrides_eur[item.id]),
      ]),
    ) as Record<CreditPackageId, string>,
    commercial_custom_unit_price_override_eur:
      policy.custom_credit_unit_price_override_eur == null
        ? ""
        : String(policy.custom_credit_unit_price_override_eur),
    payment_stripe: paymentOverride(policy.payment_stripe_enabled),
    payment_bank: paymentOverride(policy.payment_bank_enabled),
    commercial_internal_note: policy.internal_note || "",
    global_package_prices_eur: globalPackagePrices,
    effective_package_prices_eur: effectivePackagePrices,
    global_custom_unit_price_eur: String(quote?.globalCustomUnitPriceEuro ?? ""),
    effective_custom_unit_price_eur: String(quote?.customUnitPriceEuro ?? ""),
  };
}

function parseOptionalPackageTotal(rawValue: string, credits: number) {
  const raw = rawValue.trim();
  if (raw === "") return { valid: true, value: null as number | null };
  const value = Number(raw);
  if (
    !Number.isFinite(value) ||
    value < minimumCreditPackageTotalEuro(credits) ||
    value > MAX_CREDIT_PACKAGE_TOTAL_EURO ||
    Math.abs(value * 100 - Math.round(value * 100)) > 0.000001
  ) {
    return { valid: false, value: null as number | null };
  }
  return { valid: true, value: Math.round(value * 100) / 100 };
}

function parseOptionalCustomUnitPrice(rawValue: string) {
  const raw = rawValue.trim();
  if (raw === "") return { valid: true, value: null as number | null };
  const value = Number(raw);
  if (
    !Number.isFinite(value) ||
    value < 0.01 ||
    value > MAX_CUSTOM_CREDIT_UNIT_PRICE_EURO ||
    Math.abs(value * 10_000 - Math.round(value * 10_000)) > 0.000001
  ) {
    return { valid: false, value: null as number | null };
  }
  return { valid: true, value: Math.round(value * 10_000) / 10_000 };
}

function paymentOverride(value: boolean | null | undefined): PaymentOverride {
  return value == null ? "inherit" : value ? "enabled" : "disabled";
}

function paymentOverrideValue(value: PaymentOverride) {
  return value === "inherit" ? null : value === "enabled";
}

function playAdminNotificationSound() {
  try {
    const AudioContextClass = window.AudioContext || (window as typeof window & {
      webkitAudioContext?: typeof AudioContext;
    }).webkitAudioContext;
    if (!AudioContextClass) return;
    const audioContext = new AudioContextClass();
    const oscillatorOne = audioContext.createOscillator();
    const oscillatorTwo = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    oscillatorOne.type = "sine";
    oscillatorTwo.type = "triangle";
    oscillatorOne.frequency.setValueAtTime(1040, audioContext.currentTime);
    oscillatorOne.frequency.setValueAtTime(760, audioContext.currentTime + 0.12);
    oscillatorTwo.frequency.setValueAtTime(520, audioContext.currentTime);
    oscillatorTwo.frequency.setValueAtTime(640, audioContext.currentTime + 0.12);
    gainNode.gain.setValueAtTime(0.0001, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.12, audioContext.currentTime + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.38);
    oscillatorOne.connect(gainNode);
    oscillatorTwo.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillatorOne.start();
    oscillatorTwo.start();
    oscillatorOne.stop(audioContext.currentTime + 0.42);
    oscillatorTwo.stop(audioContext.currentTime + 0.42);
  } catch {}
}

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<AdminTab>("orders");
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Profile[]>([]);
  const [emailDeliveryIssues, setEmailDeliveryIssues] = useState<AdminEmailDeliveryIssue[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Profile | null>(null);
  const [customerForm, setCustomerForm] = useState<CustomerForm | null>(null);
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [onlyWithFile, setOnlyWithFile] = useState(false);
  const [creditInputs, setCreditInputs] = useState<Record<string, string>>({});
  const [creditNotes, setCreditNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [creditUpdatingIds, setCreditUpdatingIds] = useState<Set<string>>(() => new Set());
  const [customerSavingId, setCustomerSavingId] = useState<string | null>(null);
  const [customerPricingSavingId, setCustomerPricingSavingId] = useState<string | null>(null);
  const [customerPricingLoadState, setCustomerPricingLoadState] = useState<CustomerPricingLoadState>("idle");
  const [customerPricingError, setCustomerPricingError] = useState("");
  const [customerPricingMessage, setCustomerPricingMessage] = useState("");
  const [customerPricingUpdatedAt, setCustomerPricingUpdatedAt] = useState<string | null>(null);
  const [customerPricingWritesEnabled, setCustomerPricingWritesEnabled] = useState(false);
  const [uploadingModifiedId, setUploadingModifiedId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [adminLoadError, setAdminLoadError] = useState("");
  const [adminSyncIssue, setAdminSyncIssue] = useState<AdminSyncIssue | null>(null);
  const [adminSyncState, setAdminSyncState] = useState<AdminSyncState>("connecting");
  const [adminDataReady, setAdminDataReady] = useState(false);
  const [autoRefreshing, setAutoRefreshing] = useState(false);
  const [newOrderNotice, setNewOrderNotice] = useState("");
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const [adminAccess, setAdminAccess] = useState<StaffAccess | null>(null);
  const [adminAccessDenied, setAdminAccessDenied] = useState(false);

  const knownOrderIdsRef = useRef<Set<string>>(new Set());
  const knownCustomerIdsRef = useRef<Set<string>>(new Set());
  const initialOrdersLoadedRef = useRef(false);
  const hasLoadedAdminDataRef = useRef(false);
  const adminRefreshInFlightRef = useRef(false);
  const adminLoadSequenceRef = useRef(0);
  const adminRetryTimerRef = useRef<number | null>(null);
  const adminRetryFailureCountRef = useRef(0);
  const adminPageMountedRef = useRef(false);
  const loadAdminDataActionRef = useRef<(options?: AdminLoadOptions) => Promise<void>>(async () => undefined);
  const handleAdminSyncFailureActionRef = useRef<(input: AdminSyncFailureInput) => void>(() => undefined);
  const creditAdjustmentGuardRef = useRef(new StaffCreditAdjustmentOperationGuard());
  const customerPricingLoadRequestRef = useRef(0);
  const customerPricingSaveRequestRef = useRef(0);
  const selectedCustomerIdRef = useRef<string | null>(null);

  const clearAdminRetryTimer = useCallback(() => {
    if (adminRetryTimerRef.current !== null) {
      window.clearTimeout(adminRetryTimerRef.current);
      adminRetryTimerRef.current = null;
    }
  }, []);

  const resetAdminRetryBudget = useCallback(() => {
    clearAdminRetryTimer();
    adminRetryFailureCountRef.current = 0;
  }, [clearAdminRetryTimer]);

  const handleAdminSyncFailure = useCallback((input: AdminSyncFailureInput) => {
    const incidentCode = readAdminSyncIncidentCode(input.incidentCode);
    const hasVerifiedSnapshot = hasLoadedAdminDataRef.current;

    if (input.kind === "offline") {
      clearAdminRetryTimer();
      setAdminLoadError("This device is offline. Verified admin data will remain visible and sync will resume automatically when the connection returns.");
      setAdminSyncIssue({
        kind: input.kind,
        incidentCode,
        consecutiveFailures: adminRetryFailureCountRef.current,
        retryDelayMs: null,
      });
      setAdminSyncState("offline");
      return;
    }

    if (input.kind === "session_required") {
      resetAdminRetryBudget();
      setAdminLoadError(AUTH_SESSION_REQUIRED_MESSAGE);
      setAdminSyncIssue({
        kind: input.kind,
        incidentCode,
        consecutiveFailures: 0,
        retryDelayMs: null,
      });
      setAdminSyncState("session_required");
      return;
    }

    const consecutiveFailures = adminRetryFailureCountRef.current + 1;
    adminRetryFailureCountRef.current = consecutiveFailures;
    const retryDelayMs = isRetryableAdminSyncFailure(input.kind)
      ? getAdminSyncRetryDelay(consecutiveFailures)
      : null;

    setAdminLoadError(
      input.kind === "session_recovery"
        ? AUTH_SESSION_RECOVERY_MESSAGE
        : ADMIN_LOAD_ERROR_MESSAGE
    );
    setAdminSyncIssue({
      kind: input.kind,
      incidentCode,
      consecutiveFailures,
      retryDelayMs,
    });

    if (input.kind === "session_recovery" && retryDelayMs !== null) {
      setAdminSyncState("session_recovering");
    } else if (retryDelayMs !== null) {
      setAdminSyncState("reconnecting");
    } else {
      setAdminSyncState(hasVerifiedSnapshot ? "degraded" : "unavailable");
    }

    clearAdminRetryTimer();
    if (retryDelayMs === null) return;

    adminRetryTimerRef.current = window.setTimeout(() => {
      adminRetryTimerRef.current = null;
      if (!adminPageMountedRef.current) return;
      if (!navigator.onLine) {
        handleAdminSyncFailureActionRef.current({ kind: "offline", incidentCode });
        return;
      }
      if (document.visibilityState !== "visible") {
        setAdminSyncState(hasLoadedAdminDataRef.current ? "degraded" : "reconnecting");
        return;
      }
      void loadAdminDataActionRef.current({ silent: hasLoadedAdminDataRef.current, automatic: true });
    }, retryDelayMs);
  }, [clearAdminRetryTimer, resetAdminRetryBudget]);

  const loadAdminData = useCallback(async (options?: AdminLoadOptions) => {
    if (adminRefreshInFlightRef.current) return;
    if (options?.manual) {
      resetAdminRetryBudget();
      setAdminLoadError("");
      setAdminSyncIssue(null);
    }

    const loadSequence = ++adminLoadSequenceRef.current;
    const hasVerifiedSnapshot = hasLoadedAdminDataRef.current;
    const silent = Boolean(options?.silent || options?.automatic || hasVerifiedSnapshot);
    adminRefreshInFlightRef.current = true;
    if (silent) setAutoRefreshing(true);
    else setLoading(true);
    setMessage("");
    setAdminSyncState(hasVerifiedSnapshot ? "syncing" : options?.automatic ? "reconnecting" : "connecting");

    try {
      if (!navigator.onLine) {
        handleAdminSyncFailure({ kind: "offline" });
        return;
      }

      const response = await authenticatedFetch("/api/admin/dashboard", {
        cache: "no-store",
      });
      if (loadSequence !== adminLoadSequenceRef.current) return;

      const payload = await response.json().catch(() => null) as {
        access?: StaffAccess;
        orders?: Order[];
        customers?: Profile[];
        emailIssues?: AdminEmailDeliveryIssue[];
        incidentCode?: unknown;
      } | null;
      const responseIncidentCode = readAdminSyncIncidentCode(
        response.headers.get(ADMIN_SYNC_INCIDENT_HEADER)
      ) ?? readAdminSyncIncidentCode(payload?.incidentCode);

      if (response.status === 403) {
        const accessResolution = await resolveAdminAccess();
        if (loadSequence !== adminLoadSequenceRef.current) return;

        if (accessResolution.state === "denied") {
          resetAdminRetryBudget();
          setAdminAccess(null);
          setAdminAccessDenied(true);
          setAdminDataReady(false);
          setAdminLoadError("");
          setAdminSyncIssue(null);
          return;
        }

        if (accessResolution.state === "authorized") {
          setAdminAccess(accessResolution.access);
          setAdminAccessDenied(false);
          handleAdminSyncFailure({ kind: "session_recovery", incidentCode: responseIncidentCode });
        } else {
          handleAdminSyncFailure({ kind: "network", incidentCode: responseIncidentCode });
        }
        return;
      }

      if (!response.ok) {
        const failureKind: AdminSyncFailureKind = response.status === 429
          ? "rate_limited"
          : response.status >= 500
            ? "server"
            : "invalid_response";
        handleAdminSyncFailure({ kind: failureKind, incidentCode: responseIncidentCode });
        return;
      }

      if (
        !payload?.access ||
        !Array.isArray(payload.orders) ||
        !Array.isArray(payload.customers)
      ) {
        handleAdminSyncFailure({ kind: "invalid_response", incidentCode: responseIncidentCode });
        return;
      }

      const access = payload.access;
      const nextOrders = payload.orders;
      const nextCustomers = payload.customers;
      const nextEmailIssues = Array.isArray(payload.emailIssues) ? payload.emailIssues : [];
      setAdminAccess(access);
      setAdminAccessDenied(false);
      if (!silent && window.location.hash === "#customers" && hasStaffPermission(access, "customers.view")) {
        setActiveTab("customers");
      }
      const orderSnapshotRegressed = hasAdminSnapshotRegression(
        knownOrderIdsRef.current,
        nextOrders.map((order) => order.id)
      );
      const customerSnapshotRegressed = hasStaffPermission(access, "customers.view") && hasAdminSnapshotRegression(
        knownCustomerIdsRef.current,
        nextCustomers.map((customer) => customer.id)
      );

      if (hasLoadedAdminDataRef.current && (orderSnapshotRegressed || customerSnapshotRegressed)) {
        // Never replace a verified snapshot with a transient empty/partial
        // response while a refreshed token or read replica catches up.
        handleAdminSyncFailure({ kind: "invalid_response", incidentCode: responseIncidentCode });
        return;
      }

      if (initialOrdersLoadedRef.current) {
        const previousIds = knownOrderIdsRef.current;
        const newOrders = nextOrders.filter((order) => !previousIds.has(order.id));
        if (newOrders.length > 0) {
          const newestOrder = newOrders[0];
          const vehicle = [newestOrder.vehicle_brand, newestOrder.vehicle_model].filter(Boolean).join(" ");
          setNewOrderNotice(`${newOrders.length} new request${newOrders.length > 1 ? "s" : ""} received${vehicle ? ` · ${vehicle}` : ""}`);
          playAdminNotificationSound();
          window.setTimeout(() => setNewOrderNotice(""), 9000);
        }
      }

      knownOrderIdsRef.current = new Set(nextOrders.map((order) => order.id));
      knownCustomerIdsRef.current = new Set(nextCustomers.map((customer) => customer.id));
      initialOrdersLoadedRef.current = true;
      hasLoadedAdminDataRef.current = true;
      resetAdminRetryBudget();

      setOrders(nextOrders);
      setCustomers(nextCustomers);
      setEmailDeliveryIssues(nextEmailIssues);
      setSelectedOrder((current) => (current ? nextOrders.find((order) => order.id === current.id) ?? current : null));
      setSelectedCustomer((current) => {
        if (!current) return null;
        const updated = nextCustomers.find((customer) => customer.id === current.id) ?? current;
        setCustomerForm(makeCustomerForm(updated));
        return updated;
      });
      setAdminLoadError("");
      setAdminSyncIssue(null);
      setAdminDataReady(true);
      setLastSyncAt(new Date());
      setAdminSyncState("live");
    } catch (error) {
      if (loadSequence !== adminLoadSequenceRef.current) return;
      const errorMessage = error instanceof Error ? error.message : "";
      const failureKind: AdminSyncFailureKind = !navigator.onLine
        ? "offline"
        : errorMessage === AUTH_SESSION_REQUIRED_MESSAGE
          ? "session_required"
          : errorMessage === AUTH_SESSION_RECOVERY_MESSAGE
            ? "session_recovery"
            : "network";
      handleAdminSyncFailure({ kind: failureKind });
    } finally {
      if (loadSequence === adminLoadSequenceRef.current) {
        setLoading(false);
        setAutoRefreshing(false);
      }
      adminRefreshInFlightRef.current = false;
    }
  }, [handleAdminSyncFailure, resetAdminRetryBudget]);

  useEffect(() => {
    loadAdminDataActionRef.current = loadAdminData;
    handleAdminSyncFailureActionRef.current = handleAdminSyncFailure;
  }, [loadAdminData, handleAdminSyncFailure]);

  useEffect(() => {
    adminPageMountedRef.current = true;
    const timeout = window.setTimeout(() => {
      if (navigator.onLine) void loadAdminDataActionRef.current({ manual: true });
      else {
        setLoading(false);
        handleAdminSyncFailureActionRef.current({ kind: "offline" });
      }
    }, 0);
    return () => {
      adminPageMountedRef.current = false;
      window.clearTimeout(timeout);
      if (adminRetryTimerRef.current !== null) {
        window.clearTimeout(adminRetryTimerRef.current);
        adminRetryTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const refreshAdminData = (recoveryEvent = false) => {
      if (
        adminRefreshInFlightRef.current ||
        document.visibilityState !== "visible" ||
        !navigator.onLine ||
        (!recoveryEvent && adminRetryTimerRef.current !== null)
      ) {
        return;
      }

      if (adminRetryTimerRef.current !== null) {
        window.clearTimeout(adminRetryTimerRef.current);
        adminRetryTimerRef.current = null;
      }
      void loadAdminDataActionRef.current({ silent: hasLoadedAdminDataRef.current, automatic: true });
    };

    // Successful snapshots keep a low-frequency safety poll. Connection and
    // visibility events recover immediately even before the first success.
    const interval = window.setInterval(() => {
      if (hasLoadedAdminDataRef.current) refreshAdminData();
    }, 20000);
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") refreshAdminData(true);
    };
    const handleOnline = () => {
      if (adminRetryTimerRef.current !== null) {
        window.clearTimeout(adminRetryTimerRef.current);
        adminRetryTimerRef.current = null;
      }
      adminRetryFailureCountRef.current = 0;
      setAdminSyncState(hasLoadedAdminDataRef.current ? "syncing" : "reconnecting");
      refreshAdminData(true);
    };
    const handleOffline = () => {
      handleAdminSyncFailureActionRef.current({ kind: "offline" });
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const stats = useMemo<AdminStats>(() => {
    const total = orders.length;
    const newRequests = orders.filter((order) => order.status === "new_request").length;
    const fileCheck = orders.filter((order) => order.status === "file_check").length;
    const inProgress = orders.filter((order) => order.status === "in_progress").length;
    const revisionRequested = orders.filter((order) => order.status === "revision").length;
    const customerInfoNeeded = orders.filter((order) => order.status === "customer_info_needed").length;
    const completed = orders.filter((order) => order.status === "completed").length;
    const completedToday = countCompletedToday(orders);
    const withFile = orders.filter((order) => Boolean(order.original_file_path)).length;
    const totalCredits = orders.reduce((sum, order) => sum + Number(order.credits_required ?? 0), 0);
    const suspendedCustomers = customers.filter((customer) => customer.account_status === "suspended" || customer.account_status === "blocked").length;
    return { total, customers: customers.length, suspendedCustomers, newRequests, fileCheck, inProgress, revisionRequested, customerInfoNeeded, completed, completedToday, withFile, totalCredits };
  }, [orders, customers]);

  const customerById = useMemo(() => new Map(customers.map((customer) => [customer.id, customer])), [customers]);
  const latestOrders = useMemo(
    () =>
      [...orders]
        .sort(
          (left, right) =>
            new Date(right.created_at ?? 0).getTime() - new Date(left.created_at ?? 0).getTime()
        )
        .slice(0, 5),
    [orders]
  );

  const adminCommandLinks = useMemo<AdminCommandLink[]>(() => {
    const links: AdminCommandLink[] = [];

    if (hasStaffPermission(adminAccess, "orders.view")) {
      links.push({
        href: "/admin/requests",
        label: "Work-order center",
        detail: "Open the reviewed request queue and timeline view.",
        badge: "Queue",
        icon: <Clipboard className="h-5 w-5" />,
      });
    }

    if (hasAllStaffPermissions(adminAccess, adsPerformancePermissions)) {
      links.push({
        href: "/admin/ads-performance",
        label: "Ads readiness",
        detail: "Verify consented registration, request and payment measurement.",
        badge: "Acquire",
        icon: <Megaphone className="h-5 w-5" />,
      });
    }

    if (hasStaffPermission(adminAccess, "file_expert.manage")) {
      links.push({
        href: "/admin/file-expert",
        label: "File Expert review",
        detail: "Check customer-safe analysis jobs and review evidence.",
        badge: "Evidence",
        icon: <BrainCircuit className="h-5 w-5" />,
      });
    }

    if (hasStaffPermission(adminAccess, "vehicles.manage")) {
      links.push({
        href: "/admin/vehicles",
        label: "Vehicle database",
        detail: "Review catalog quality, imports and enrichment drafts.",
        badge: "Catalog",
        icon: <Car className="h-5 w-5" />,
      });
    }

    if (hasStaffPermission(adminAccess, "credits.manage")) {
      links.push({
        href: "/admin/payments",
        label: "Revenue control",
        detail: "Inspect payment and credit review panels.",
        badge: "Finance",
        icon: <CreditCard className="h-5 w-5" />,
      });
    }

    return links;
  }, [adminAccess]);

  const filteredOrders = useMemo(() => {
    const term = search.trim().toLowerCase();
    return orders.filter((order) => {
      if (onlyWithFile && !order.original_file_path) return false;
      if (!term) return true;
      const fullText = [
        order.id,
        order.customer_email,
        customerById.get(order.customer_id ?? "")?.customer_id,
        customerById.get(order.customer_id ?? "")?.full_name,
        customerById.get(order.customer_id ?? "")?.company_name,
        order.vehicle_brand,
        order.vehicle_model,
        order.vehicle_engine,
        order.service_type,
        order.ecu,
        order.gearbox,
        order.read_method,
        order.hw_sw,
        order.license_plate,
        order.uploaded_file_name,
        order.notes,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return fullText.includes(term);
    });
  }, [orders, search, onlyWithFile, customerById]);

  const filteredCustomers = useMemo(() => {
    const term = customerSearch.trim().toLowerCase();
    if (!term) return customers;
    return customers.filter((customer) =>
      [customer.email, customer.customer_id, customer.full_name, customer.company_name, customer.phone, customer.role, customer.account_status, ...(customer.customer_tags ?? []), customer.id]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term)
    );
  }, [customers, customerSearch]);

  function focusOrderQueue(status: string) {
    setActiveTab("orders");
    setSelectedStatus(status);
    setSearch("");
    setOnlyWithFile(false);
    window.requestAnimationFrame(() => {
      document.getElementById("admin-order-list")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  const showInitialAdminLoadError = Boolean(adminLoadError && !adminDataReady);
  const lastSyncLabel = lastSyncAt
    ? lastSyncAt.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })
    : null;
  const adminSyncPresentation = getAdminSyncPresentation({
    state: adminSyncState,
    lastSyncLabel,
    retryDelayMs: adminSyncIssue?.retryDelayMs,
  });

  async function loadCustomerPricing(customerId: string) {
    const requestId = ++customerPricingLoadRequestRef.current;
    setCustomerPricingLoadState("loading");
    setCustomerPricingError("");
    setCustomerPricingMessage("");
    setCustomerPricingUpdatedAt(null);
    setCustomerPricingWritesEnabled(false);

    try {
      const response = await authenticatedFetch(
        `/api/admin/customers/${customerId}/commercial-policy`,
        { cache: "no-store" },
      );
      const payload = await response.json().catch(() => null) as {
        error?: string;
        policy?: CustomerCommercialPolicyPayload;
        effectiveQuote?: CustomerCommercialQuotePayload;
        explicitPricingWritesEnabled?: boolean;
      } | null;

      if (
        customerPricingLoadRequestRef.current !== requestId ||
        selectedCustomerIdRef.current !== customerId
      ) return;
      if (
        !response.ok ||
        !payload?.policy ||
        payload.policy.user_id !== customerId ||
        payload.policy.pricing_model_version !== 2 ||
        typeof payload.explicitPricingWritesEnabled !== "boolean" ||
        !payload.policy.package_price_overrides_eur
      ) {
        throw new Error(payload?.error || "Customer pricing policy could not be loaded.");
      }
      const policyHasSavedValues =
        payload.policy.custom_credit_unit_price_override_eur != null ||
        creditPackages.some(
          (item) => payload.policy!.package_price_overrides_eur[item.id] != null,
        ) ||
        payload.policy.payment_stripe_enabled != null ||
        payload.policy.payment_bank_enabled != null ||
        payload.policy.internal_note != null;
      if (policyHasSavedValues && typeof payload.policy.updated_at !== "string") {
        throw new Error("Customer pricing revision could not be verified. Reload before making changes.");
      }

      setCustomerForm((current) => current
        ? applyCustomerPricingPayload(current, payload.policy as CustomerCommercialPolicyPayload, payload.effectiveQuote)
        : current);
      setCustomerPricingUpdatedAt(
        typeof payload.policy.updated_at === "string" ? payload.policy.updated_at : null,
      );
      setCustomerPricingLoadState("ready");
      setCustomerPricingWritesEnabled(payload.explicitPricingWritesEnabled);
    } catch (error) {
      if (
        customerPricingLoadRequestRef.current !== requestId ||
        selectedCustomerIdRef.current !== customerId
      ) return;
      setCustomerPricingLoadState("error");
      setCustomerPricingWritesEnabled(false);
      setCustomerPricingError(
        error instanceof Error
          ? error.message
          : "Customer pricing policy could not be loaded.",
      );
    }
  }

  function openCustomer(customer: Profile) {
    customerPricingSaveRequestRef.current += 1;
    selectedCustomerIdRef.current = customer.id;
    setCustomerPricingSavingId(null);
    setSelectedCustomer(customer);
    setCustomerForm(makeCustomerForm(customer));
    void loadCustomerPricing(customer.id);
  }

  async function saveCustomerPricing() {
    if (!hasStaffPermission(adminAccess, "credits.manage")) {
      setCustomerPricingError("Your staff role cannot update customer pricing.");
      return;
    }
    if (!selectedCustomer || !customerForm) return;
    if (selectedCustomerIdRef.current !== selectedCustomer.id) {
      setCustomerPricingLoadState("error");
      setCustomerPricingError("The selected customer changed. Reopen the customer before saving pricing.");
      return;
    }
    if (customerPricingLoadState !== "ready") {
      setCustomerPricingError("Load the current customer pricing policy before saving.");
      return;
    }

    const customerId = selectedCustomer.id;
    const parsedPackageOverrides = creditPackages.map((item) => {
      const parsedOverride = parseOptionalPackageTotal(
        customerForm.commercial_package_price_overrides_eur[item.id],
        item.credits,
      );
      return parsedOverride.valid ? [item.id, parsedOverride.value] as const : null;
    });
    if (parsedPackageOverrides.some((entry) => entry == null)) {
      setCustomerPricingError(
        "Package overrides must be blank to inherit or at least EUR 0.01 per credit, with at most 2 decimals.",
      );
      return;
    }
    const packagePriceOverridesEuro = Object.fromEntries(
      parsedPackageOverrides as Array<readonly [CreditPackageId, number | null]>,
    ) as CreditPackagePriceOverrideMap;

    const parsedCustomOverride = parseOptionalCustomUnitPrice(
      customerForm.commercial_custom_unit_price_override_eur,
    );
    if (!parsedCustomOverride.valid) {
      setCustomerPricingError(
        "Custom-credit override must be blank to inherit or EUR 0.01–4,000 with at most 4 decimals.",
      );
      return;
    }
    const customUnitPriceOverrideEuro = parsedCustomOverride.value;

    const requestId = ++customerPricingSaveRequestRef.current;
    setCustomerPricingSavingId(customerId);
    setCustomerPricingError("");
    setCustomerPricingMessage("");

    try {
      const response = await authenticatedFetch(
        `/api/admin/customers/${customerId}/commercial-policy`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            packagePriceOverridesEuro,
            customUnitPriceOverrideEuro,
            paymentMethods: {
              stripe: paymentOverrideValue(customerForm.payment_stripe),
              bank: paymentOverrideValue(customerForm.payment_bank),
            },
            internalNote: customerForm.commercial_internal_note.trim() || null,
            expectedUpdatedAt: customerPricingUpdatedAt,
          }),
        },
      );
      const payload = await response.json().catch(() => null) as {
        error?: string;
        policy?: CustomerCommercialPolicyPayload;
        effectiveQuote?: CustomerCommercialQuotePayload;
        explicitPricingWritesEnabled?: boolean;
      } | null;

      if (
        customerPricingSaveRequestRef.current !== requestId ||
        selectedCustomerIdRef.current !== customerId
      ) return;
      if (
        !response.ok ||
        !payload?.policy ||
        payload.policy.user_id !== customerId ||
        payload.policy.pricing_model_version !== 2 ||
        typeof payload.explicitPricingWritesEnabled !== "boolean" ||
        !payload.policy.package_price_overrides_eur
      ) {
        if (response.status === 409) setCustomerPricingLoadState("error");
        throw new Error(payload?.error || "Customer pricing policy could not be saved.");
      }
      if (typeof payload.policy.updated_at !== "string") {
        setCustomerPricingLoadState("error");
        throw new Error("Saved pricing revision could not be verified. Reload before making another change.");
      }

      setCustomerForm((current) => current
        ? applyCustomerPricingPayload(current, payload.policy as CustomerCommercialPolicyPayload, payload.effectiveQuote)
        : current);
      setCustomerPricingUpdatedAt(
        typeof payload.policy.updated_at === "string" ? payload.policy.updated_at : null,
      );
      setCustomerPricingLoadState("ready");
      setCustomerPricingWritesEnabled(payload.explicitPricingWritesEnabled);
      const priceOverrideCount = Object.values(packagePriceOverridesEuro)
        .filter((value) => value != null).length +
        (customUnitPriceOverrideEuro == null ? 0 : 1);
      setCustomerPricingMessage(
        priceOverrideCount === 0
          ? "All customer price fields now inherit the matching global price."
          : `${priceOverrideCount} exact customer price override${priceOverrideCount === 1 ? "" : "s"} saved atomically.`,
      );
    } catch (error) {
      if (
        customerPricingSaveRequestRef.current !== requestId ||
        selectedCustomerIdRef.current !== customerId
      ) return;
      setCustomerPricingError(
        error instanceof Error
          ? error.message
          : "Customer pricing policy could not be saved.",
      );
    } finally {
      if (
        customerPricingSaveRequestRef.current === requestId &&
        selectedCustomerIdRef.current === customerId
      ) {
        setCustomerPricingSavingId(null);
      }
    }
  }

  async function adjustCredits(customer: Profile, amount: number, note?: string) {
    if (!hasStaffPermission(adminAccess, "credits.manage")) {
      setMessage("Your staff role cannot adjust customer credits.");
      return;
    }
    if (!Number.isInteger(amount) || amount === 0 || Math.abs(amount) > 100000) {
      setMessage("Please enter a non-zero whole credit amount within the supported range.");
      return;
    }

    const acquisition = creditAdjustmentGuardRef.current.tryAcquire(customer.id);
    if (acquisition === "in-flight") {
      setMessage("A credit adjustment for this customer is already running.");
      return;
    }
    if (acquisition === "blocked") {
      setMessage("Further credit adjustments for this customer are blocked in this tab until the ledger is reconciled and the page is reloaded.");
      return;
    }
    setCreditUpdatingIds((current) => new Set(current).add(customer.id));
    setMessage("");
    let retryAttemptPrepared = false;

    try {
      const { session: actorSession, error: actorError } = await getStableSession();
      if (actorError || !actorSession?.user.id) {
        setMessage("Your staff session could not be verified. Sign in again before adjusting credits.");
        return;
      }
      const actorId = actorSession.user.id;
      const resolvedNote = note || "Admin credit adjustment";
      const [scopeFingerprint, payloadFingerprint] = await Promise.all([
        hashStaffCreditAdjustmentScope(actorId, customer.id),
        hashStaffCreditAdjustmentPayload({
          actorId,
          customerId: customer.id,
          amount,
          note: resolvedNote,
        }),
      ]);

      const storage = getStaffCreditAdjustmentSessionStorage();
      const preparation = prepareStaffCreditAdjustmentAttempt(storage, {
        scopeFingerprint,
        payloadFingerprint,
        legacyCustomerId: customer.id,
      });
      if (preparation.kind === "blocked") {
        const blockedMessages = {
          conflict: "A different unresolved credit adjustment exists for this customer. Restore its exact amount and note to retry, or reconcile the ledger before continuing.",
          stale: "This customer's unresolved credit adjustment is outside the safe retry window. Reconcile the ledger before continuing.",
          legacy: "This customer has an unresolved legacy credit adjustment in this tab. Reconcile it before continuing.",
          capacity: "This tab already has 12 unresolved credit adjustments. Reconcile an existing adjustment before starting another.",
          unavailable: "Secure retry storage is unavailable in this tab. Credits were not adjusted.",
        } satisfies Record<typeof preparation.reason, string>;
        setMessage(blockedMessages[preparation.reason]);
        return;
      }
      const attempt = preparation.attempt;
      retryAttemptPrepared = true;
      const { data, error } = await supabase.rpc("staff_adjust_customer_credits", {
        p_customer_id: customer.id,
        p_amount: amount,
        p_note: resolvedNote,
        p_idempotency_key: attempt.idempotencyKey,
      });

      if (error) {
        setMessage(`${error.message} Retry the exact unchanged adjustment safely, or reconcile the ledger before changing its values.`);
        return;
      }

      const newBalance = Number(data ?? Number(customer.credit_balance ?? 0) + amount);
      setCustomers((current) => current.map((item) => (item.id === customer.id ? { ...item, credit_balance: newBalance } : item)));
      setSelectedCustomer((current) => (current?.id === customer.id ? { ...current, credit_balance: newBalance } : current));

      const completion = completeStaffCreditAdjustmentAttempt(
        storage,
        scopeFingerprint,
        attempt,
      );
      if (completion.kind !== "cleared") {
        creditAdjustmentGuardRef.current.block(customer.id);
        setMessage("Credits were adjusted, but secure retry cleanup could not be verified. Further changes for this customer are blocked in this tab; reconcile the ledger before reloading.");
        return;
      }

      setCreditInputs((current) => ({ ...current, [customer.id]: "" }));
      setCreditNotes((current) => ({ ...current, [customer.id]: "" }));
      setMessage(`${amount > 0 ? "+" : ""}${amount} credits adjusted for ${customer.customer_id ?? customer.email ?? "customer"}. Ledger entry created.`);
    } catch {
      setMessage(retryAttemptPrepared
        ? "The credit adjustment response was interrupted. Retry the unchanged adjustment; it will use the same safety key."
        : "Secure retry preparation failed. Credits were not adjusted; retry when browser storage is available.");
    } finally {
      creditAdjustmentGuardRef.current.release(customer.id);
      setCreditUpdatingIds((current) => {
        const next = new Set(current);
        next.delete(customer.id);
        return next;
      });
    }
  }

  function quickAdjustCredits(customer: Profile, amount: number) {
    adjustCredits(customer, amount, `Quick admin adjustment: ${amount > 0 ? "+" : ""}${amount} credits`);
  }

  function handleCustomCreditAdjust(customer: Profile) {
    adjustCredits(customer, Number(creditInputs[customer.id] ?? 0), creditNotes[customer.id] || undefined);
  }

  async function saveCustomerSettings() {
    if (!hasStaffPermission(adminAccess, "customers.manage")) {
      setMessage("Your staff role cannot update customer profiles.");
      return;
    }
    if (!selectedCustomer || !customerForm) return;
    const customerId = selectedCustomer.id;
    const customerSnapshot = selectedCustomer;
    setCustomerSavingId(customerId);
    setMessage("");

    const updatePayload = {
      full_name: customerForm.full_name.trim() || null,
      account_type: customerForm.account_type,
      company_name: customerForm.company_name.trim() || null,
      phone: customerForm.phone.trim() || null,
      street: customerForm.street.trim() || null,
      postal_code: customerForm.postal_code.trim() || null,
      city: customerForm.city.trim() || null,
      country: customerForm.country.trim() || null,
      vat_id: customerForm.vat_id.trim() || null,
      invoice_email: customerForm.invoice_email.trim() || null,
      preferred_contact: customerForm.preferred_contact.trim() || null,
      account_status: customerForm.account_status,
      customer_tags: customerForm.customer_tags,
      internal_admin_note: customerForm.internal_admin_note.trim() || null,
      ...(hasStaffPermission(adminAccess, "credits.manage")
        ? {
            allow_negative_credits: customerForm.allow_negative_credits,
            negative_credit_limit: Number(customerForm.negative_credit_limit || 0),
          }
        : {}),
    };

    try {
      const profileResponse = await authenticatedFetch(
        `/api/admin/customers/${customerId}/profile`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updatePayload),
        },
      );
      const profilePayload = await profileResponse.json().catch(() => ({}));

      if (!profileResponse.ok) {
        if (selectedCustomerIdRef.current === customerId) {
          setMessage(profilePayload.error || "Customer profile could not be saved.");
        }
        return;
      }

      const updatedCustomer = {
        ...customerSnapshot,
        ...updatePayload,
        ...(profilePayload.customer ?? {}),
        id: customerId,
      } as Profile;
      setCustomers((current) => current.map((customer) => (
        customer.id === customerId ? updatedCustomer : customer
      )));
      if (selectedCustomerIdRef.current !== customerId) return;
      setSelectedCustomer((current) => (
        current?.id === customerId ? updatedCustomer : current
      ));
      setMessage(`${customerSnapshot.customer_id ?? customerSnapshot.email ?? "Customer"} updated.`);
    } catch {
      if (selectedCustomerIdRef.current === customerId) {
        setMessage("Customer profile could not be saved. Check the connection and retry.");
      }
    } finally {
      setCustomerSavingId((current) => current === customerId ? null : current);
    }
  }

  async function updateStatus(orderId: string, newStatus: string) {
    if (!hasStaffPermission(adminAccess, "orders.manage")) {
      setMessage("Your staff role cannot update order status.");
      return;
    }
    setUpdatingId(orderId);
    setMessage("");
    const response = await authenticatedFetch(`/api/admin/orders/${orderId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    const payload = await response.json().catch(() => ({}));
    setUpdatingId(null);
    if (!response.ok) {
      setMessage(payload.error || "Order status could not be updated.");
      return;
    }
    setOrders((current) => current.map((order) => (order.id === orderId ? { ...order, status: newStatus } : order)));
    setSelectedOrder((current) => (current?.id === orderId ? { ...current, status: newStatus } : current));
    if (newStatus === "completed") {
      void authenticatedFetch(`/api/admin/orders/${orderId}/training-capture`, {
        method: "POST",
      }).catch(() => undefined);
    }
  }

  async function updateDeliveryEstimate(
    orderId: string,
    estimate: DeliveryEstimate,
    note: string
  ) {
    if (!hasStaffPermission(adminAccess, "orders.manage")) {
      setMessage("Your staff role cannot update delivery estimates.");
      return;
    }
    setUpdatingId(orderId);
    setMessage("");

    const response = await authenticatedFetch(
      `/api/admin/orders/${orderId}/delivery-estimate`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          estimate,
          note: note.trim() || null,
        }),
      }
    );
    const payload = await response.json().catch(() => ({}));

    setUpdatingId(null);

    if (!response.ok) {
      setMessage(payload.error || "Estimated delivery could not be saved.");
      return;
    }

    const update = {
      estimated_delivery_label: estimate,
      estimated_delivery_note: note.trim() || null,
    };

    setOrders((current) =>
      current.map((order) =>
        order.id === orderId ? { ...order, ...update } : order
      )
    );
    setSelectedOrder((current) =>
      current?.id === orderId ? { ...current, ...update } : current
    );
    setMessage("Estimated delivery updated.");
  }

  async function downloadOriginalFile(order: Order) {
    if (!hasStaffPermission(adminAccess, "files.download")) {
      setMessage("Your staff role cannot download customer files.");
      return;
    }
    if (!order.original_file_path) {
      setMessage("No original file path found for this order.");
      return;
    }
    setMessage("");
    const { data, error } = await supabase.storage.from("customer-files").createSignedUrl(order.original_file_path, 60);
    if (error) {
      setMessage(error.message);
      return;
    }
    window.open(data.signedUrl, "_blank");
  }

  async function uploadModifiedFile(
    order: Order,
    file: File | null,
    label: string
  ) {
    if (!hasStaffPermission(adminAccess, "files.upload")) {
      setMessage("Your staff role cannot upload completed files.");
      return;
    }
    if (!file) return;
    const normalizedLabel = normalizeFileVersionLabel(label);
    const labelPathSegment = normalizedLabel
      ? buildFileVersionPathSegment(normalizedLabel)
      : null;
    if (!normalizedLabel || !labelPathSegment) {
      setMessage("Enter a valid version label before uploading the modified file.");
      return;
    }
    setUploadingModifiedId(order.id);
    setMessage("");
    const safeFileName = file.name.replaceAll(" ", "_").replace(/[^a-zA-Z0-9._-]/g, "");
    const customerFolder = order.customer_id ?? "unknown-customer";
    const timestamp = Date.now();
    const filePath = `${customerFolder}/modified/${order.id}/${labelPathSegment}/${timestamp}-${safeFileName}`;
    const { error: uploadError } = await supabase.storage.from("customer-files").upload(filePath, file, { cacheControl: "3600", upsert: false });
    if (uploadError) {
      setUploadingModifiedId(null);
      setMessage(uploadError.message);
      return;
    }

    const version: ModifiedFileVersion = {
      id: `${labelPathSegment}-${timestamp}`,
      label: normalizedLabel,
      file_name: file.name,
      file_path: filePath,
      uploaded_at: new Date().toISOString(),
    };
    const modifiedFiles = [...getModifiedFileVersions(order), version];
    const deliveryResponse = await authenticatedFetch(`/api/admin/orders/${order.id}/complete-delivery`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        filePath,
        fileName: file.name,
        label: normalizedLabel,
        versionId: version.id,
        uploadedAt: version.uploaded_at,
      }),
    });
    const deliveryPayload = await deliveryResponse.json();
    setUploadingModifiedId(null);
    if (!deliveryResponse.ok) {
      setMessage(deliveryPayload.error || "Completed file delivery could not be saved.");
      return;
    }
    setOrders((current) => current.map((item) => (item.id === order.id ? { ...item, modified_file_path: filePath, modified_files: modifiedFiles, status: "completed" } : item)));
    setSelectedOrder((current) => (current?.id === order.id ? { ...current, modified_file_path: filePath, modified_files: modifiedFiles, status: "completed" } : current));
    setMessage(`${formatFileVersionLabel(normalizedLabel)} modified file uploaded and the order was completed.`);
  }

  async function downloadModifiedFile(filePath: string) {
    setMessage("");
    const { data, error } = await supabase.storage.from("customer-files").createSignedUrl(filePath, 60);
    if (error) {
      setMessage(error.message);
      return;
    }
    window.open(data.signedUrl, "_blank");
  }

  async function updateCustomerUploadPermission(orderId: string, enabled: boolean) {
    if (!hasStaffPermission(adminAccess, "orders.manage")) {
      setMessage("Your staff role cannot change customer upload permission.");
      return;
    }

    setUpdatingId(orderId);
    setMessage("");
    const response = await authenticatedFetch(`/api/admin/orders/${orderId}/upload-permission`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ enabled }),
    });
    const result = await response.json();
    setUpdatingId(null);
    if (!response.ok) {
      setMessage(result.error || "Upload permission could not be updated.");
      return;
    }

    setOrders((current) => current.map((order) =>
      order.id === orderId ? { ...order, customer_upload_enabled: enabled } : order
    ));
    setSelectedOrder((current) => current?.id === orderId
      ? { ...current, customer_upload_enabled: enabled }
      : current
    );
    setMessage(enabled
      ? "Customer can now upload one additional file to this request."
      : "Additional customer upload permission disabled."
    );
  }

  async function copyOrderId(id: string) {
    await navigator.clipboard.writeText(id);
    setMessage("Order ID copied.");
  }

  async function copyValue(value: string | null | undefined, label: string) {
    if (!value) {
      setMessage(`${label} is empty.`);
      return;
    }
    await navigator.clipboard.writeText(value);
    setMessage(`${label} copied.`);
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#050505] text-white">
        <div role="status" aria-live="polite" className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-6 py-5">
          <Loader2 className="h-5 w-5 animate-spin text-red-500" />
          {adminSyncPresentation.label}
        </div>
      </main>
    );
  }

  if (adminAccessDenied) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#050505] px-4 text-white">
        <div className="max-w-md rounded-[2rem] border border-red-900/40 bg-red-950/20 p-8 text-center">
          <Lock className="mx-auto mb-5 h-12 w-12 text-red-500" />
          <h1 className="text-3xl font-black">Access Denied</h1>
          <p className="mt-3 text-zinc-400">You are not authorized to access the admin panel.</p>
          <Link href="/dashboard" className="mt-6 inline-flex rounded-xl bg-[#b1121b] px-5 py-3 font-black text-white">
            Back to Dashboard
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mg-compact-ui min-h-screen overflow-x-hidden bg-[#050505] text-white">
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_18%_0%,rgba(160,18,28,0.25),transparent_34%),linear-gradient(135deg,#050505,#0c0c0e_48%,#170507)]" />

      <header className="sticky top-0 z-50 border-b border-white/10 bg-black/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1760px] items-center justify-between gap-3 px-3 py-2.5 sm:px-4 sm:py-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-red-800/50 bg-[#111] shadow-lg shadow-red-950/40 sm:h-10 sm:w-10">
              <ShieldCheck className="h-5 w-5 text-red-600 sm:h-6 sm:w-6" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-lg font-black tracking-wide sm:text-xl">MG <span className="text-red-600">AUTOTECH</span></div>
              <div className="truncate text-xs text-zinc-400">File Service Admin Operations</div>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <div
              role="status"
              aria-live="polite"
              title={adminSyncPresentation.detail}
              className={`hidden rounded-lg border px-3 py-2 text-xs font-black md:block ${adminSyncToneClass(adminSyncPresentation.tone)}`}
            >
              {adminSyncPresentation.label}
            </div>
            <AdminNotificationCenter
              orders={orders}
              emailIssues={emailDeliveryIssues}
              loading={loading && !adminDataReady}
              refreshing={autoRefreshing}
              error={adminLoadError}
              lastSyncAt={lastSyncAt}
              onRefresh={() => { void loadAdminData({ silent: adminDataReady, manual: true }); }}
              onOpenOrder={(orderId) => {
                const order = orders.find((candidate) => candidate.id === orderId);
                if (order) setSelectedOrder(order);
              }}
              onFilterQueue={focusOrderQueue}
            />
            <button onClick={() => loadAdminData({ silent: adminDataReady, manual: true })} disabled={loading || autoRefreshing} className="h-11 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-sm font-bold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60 lg:h-10">
              <RefreshCcw className={`mr-2 inline h-4 w-4 ${loading || autoRefreshing ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <Link href="/dashboard" className="inline-flex h-11 items-center rounded-lg border border-white/10 bg-white/[0.04] px-3 text-sm font-bold text-white transition hover:bg-white/10 lg:h-10">
              <ArrowLeft className="mr-2 inline h-4 w-4" />
              <span className="hidden sm:inline">Dashboard</span>
            </Link>
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-[1760px] min-w-0 gap-4 px-2 py-4 sm:px-3 sm:py-5 xl:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="order-2 h-fit min-w-0 rounded-xl border border-white/10 bg-white/[0.04] p-3 shadow-2xl shadow-black/20 xl:order-1 xl:sticky xl:top-20">
          <div className="mb-3 px-2">
            <div className="text-xs font-black uppercase tracking-[0.22em] text-zinc-500">Admin Workspace</div>
            <div className="mt-1 text-lg font-black text-white">Operations</div>
          </div>
          <nav className="space-y-2">
            <SidebarButton active={activeTab === "orders"} icon={<FileCode2 />} label="Orders" count={adminDataReady ? stats.total : "—"} onClick={() => setActiveTab("orders")} />
            {hasStaffPermission(adminAccess, "orders.view") && (
              <Link
                href="/admin/operations"
                className="flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left text-sm font-black text-zinc-400 transition hover:bg-white/[0.06] hover:text-white"
              >
                <span className="flex items-center gap-3">
                  <Activity className="h-5 w-5" />
                  Operations Intelligence
                </span>
                <span className="rounded-full bg-emerald-950/40 px-2 py-1 text-[10px] font-black text-emerald-200">LIVE</span>
              </Link>
            )}
            {hasStaffPermission(adminAccess, "orders.view") && (
              <Link
                href="/admin/seo-performance"
                className="flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left text-sm font-black text-zinc-400 transition hover:bg-white/[0.06] hover:text-white"
              >
                <span className="flex items-center gap-3">
                  <BarChart3 className="h-5 w-5" />
                  SEO & Conversion
                </span>
                <span className="rounded-full bg-sky-950/40 px-2 py-1 text-[10px] font-black text-sky-200">MEASURE</span>
              </Link>
            )}
            {hasAllStaffPermissions(adminAccess, adsPerformancePermissions) && (
              <Link
                href="/admin/ads-performance"
                className="flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left text-sm font-black text-zinc-400 transition hover:bg-white/[0.06] hover:text-white"
              >
                <span className="flex items-center gap-3">
                  <Megaphone className="h-5 w-5" />
                  Ads Readiness
                </span>
                <span className="rounded-full bg-red-950/40 px-2 py-1 text-[10px] font-black text-red-200">ACQUIRE</span>
              </Link>
            )}
            {hasAllStaffPermissions(adminAccess, growthReportPermissions) && (
              <Link
                href="/admin/growth"
                className="flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left text-sm font-black text-zinc-400 transition hover:bg-white/[0.06] hover:text-white"
              >
                <span className="flex items-center gap-3">
                  <HeartHandshake className="h-5 w-5" />
                  Growth & Success
                </span>
                <span className="rounded-full bg-emerald-950/40 px-2 py-1 text-[10px] font-black text-emerald-200">ACTION</span>
              </Link>
            )}
            {hasStaffPermission(adminAccess, "orders.view") && (
              <Link
                href="/admin/requests"
                className="flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left text-sm font-black text-zinc-400 transition hover:bg-white/[0.06] hover:text-white"
              >
                <span className="flex items-center gap-3">
                  <Clipboard className="h-5 w-5" />
                  Request Control
                </span>
                <span className="rounded-full bg-red-950/40 px-2 py-1 text-[10px] font-black text-red-200">WORK</span>
              </Link>
            )}
            {hasStaffPermission(adminAccess, "customers.view") && (
              <SidebarButton active={activeTab === "customers"} icon={<Users />} label="Customers" count={adminDataReady ? stats.customers : "—"} onClick={() => setActiveTab("customers")} />
            )}
            {hasStaffPermission(adminAccess, "file_expert.manage") && (
              <Link
                href="/admin/file-expert"
                className="flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left text-sm font-black text-zinc-400 transition hover:bg-white/[0.06] hover:text-white"
              >
                <span className="flex items-center gap-3">
                  <BrainCircuit className="h-5 w-5" />
                  File Expert
                </span>
                <span className="rounded-full bg-red-950/40 px-2 py-1 text-xs text-red-200">AI</span>
              </Link>
            )}
            {hasStaffPermission(adminAccess, "ai_training.manage") && (
              <Link
                href="/admin/ai-training"
                className="flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left text-sm font-black text-zinc-400 transition hover:bg-white/[0.06] hover:text-white"
              >
                <span className="flex items-center gap-3">
                  <Database className="h-5 w-5" />
                  ECU Learning
                </span>
                <span className="rounded-full bg-emerald-950/40 px-2 py-1 text-xs text-emerald-200">DATA</span>
              </Link>
            )}
            {hasStaffPermission(adminAccess, "vehicles.manage") && (
              <Link
                href="/admin/vehicles"
                className="flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left text-sm font-black text-zinc-400 transition hover:bg-white/[0.06] hover:text-white"
              >
                <span className="flex items-center gap-3">
                  <Car className="h-5 w-5" />
                  Vehicle Database
                </span>
                <span className="rounded-full bg-red-950/40 px-2 py-1 text-[10px] font-black text-red-200">CONTROL</span>
              </Link>
            )}
            {hasStaffPermission(adminAccess, "widget.manage") && (
              <Link
                href="/admin/widget-clients"
                className="flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left text-sm font-black text-zinc-400 transition hover:bg-white/[0.06] hover:text-white"
              >
                <span className="flex items-center gap-3">
                  <Braces className="h-5 w-5" />
                  Widget SaaS
                </span>
                <span className="rounded-full bg-red-950/40 px-2 py-1 text-[10px] font-black text-red-200">NEW</span>
              </Link>
            )}
            {hasStaffPermission(adminAccess, "credits.manage") && (
              <Link
                href="/admin/payments"
                className="flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left text-sm font-black text-zinc-400 transition hover:bg-white/[0.06] hover:text-white"
              >
                <span className="flex items-center gap-3">
                  <CreditCard className="h-5 w-5" />
                  Revenue Control
                </span>
                <span className="rounded-full bg-emerald-950/40 px-2 py-1 text-[10px] font-black text-emerald-200">LIVE</span>
              </Link>
            )}
            {hasStaffPermission(adminAccess, "credits.manage") && (
              <Link
                href="/admin/commercial"
                className="flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left text-sm font-black text-zinc-400 transition hover:bg-white/[0.06] hover:text-white"
              >
                <span className="flex items-center gap-3">
                  <BadgeEuro className="h-5 w-5" />
                  Pricing Rules
                </span>
                <span className="rounded-full bg-red-950/40 px-2 py-1 text-[10px] font-black text-red-200">PRICING</span>
              </Link>
            )}
            {isPrimaryOwner(adminAccess) && (
              <Link
                href="/admin/team"
                className="flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left text-sm font-black text-zinc-400 transition hover:bg-white/[0.06] hover:text-white"
              >
                <span className="flex items-center gap-3">
                  <Lock className="h-5 w-5" />
                  Team & Permissions
                </span>
                <span className="rounded-full border border-amber-700/30 bg-amber-950/20 px-2 py-1 text-[10px] font-black text-amber-300">OWNER</span>
              </Link>
            )}
          </nav>
          <div className="mt-4 rounded-xl border border-red-900/40 bg-red-950/20 p-3">
            <div className="text-xs font-black uppercase tracking-[0.18em] text-red-300">Open Work</div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-center">
              <MiniStat label="New" value={adminDataReady ? stats.newRequests : "—"} />
              <MiniStat label="Progress" value={adminDataReady ? stats.inProgress : "—"} />
            </div>
          </div>
        </aside>

        <div className="order-1 min-w-0 xl:order-2">
          <div className="mb-4">
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-red-800/50 bg-red-950/25 px-3 py-1.5 text-xs font-semibold text-red-100">
              <Database className="h-4 w-4 text-red-500" />
              Admin operations
            </div>
            <h1 className="text-2xl font-black md:text-3xl">Admin <span className="text-red-600">Control Panel</span></h1>
            <p className="mt-1 max-w-3xl text-sm text-zinc-400">Live orders, queue priorities and operational controls in one workspace.</p>
          </div>

          {adminDataReady && adminSyncIssue && (
            <AdminSyncWarningState
              presentation={adminSyncPresentation}
              issue={adminSyncIssue}
              retrying={autoRefreshing}
              onRetry={() => loadAdminData({ silent: true, manual: true })}
            />
          )}

          {adminDataReady && (
            <AdminOperationsOverview
              stats={stats}
              latestOrders={latestOrders}
              customerById={customerById}
              lastSyncAt={lastSyncAt}
              commandLinks={adminCommandLinks}
              onFilter={focusOrderQueue}
              onOpenOrder={setSelectedOrder}
            />
          )}

          {newOrderNotice && (
            <div className="mb-4 flex items-center gap-3 rounded-xl border border-emerald-700/40 bg-emerald-950/30 p-3 text-sm font-black text-emerald-200 shadow-xl shadow-emerald-950/20">
              <BellRing className="h-5 w-5 text-emerald-300" />
              {newOrderNotice}
            </div>
          )}

          {message && (
            <div className="mb-4 rounded-xl border border-red-800/50 bg-red-950/30 p-3 text-sm text-red-200">{message}</div>
          )}

          {showInitialAdminLoadError ? (
            <AdminLoadErrorState
              message={adminLoadError}
              presentation={adminSyncPresentation}
              issue={adminSyncIssue}
              retrying={loading || autoRefreshing}
              onRetry={() => loadAdminData({ manual: true })}
            />
          ) : activeTab === "orders" ? (
            <OrdersPanel
              filteredOrders={filteredOrders}
              customerById={customerById}
              selectedStatus={selectedStatus}
              setSelectedStatus={setSelectedStatus}
              search={search}
              setSearch={setSearch}
              onlyWithFile={onlyWithFile}
              setOnlyWithFile={setOnlyWithFile}
              updatingId={updatingId}
              setSelectedOrder={setSelectedOrder}
              updateStatus={updateStatus}
            />
          ) : (
            <CustomersPanel
              customers={customers}
              filteredCustomers={filteredCustomers}
              customerSearch={customerSearch}
              setCustomerSearch={setCustomerSearch}
              creditUpdatingIds={creditUpdatingIds}
              openCustomer={openCustomer}
              quickAdjustCredits={quickAdjustCredits}
            />
          )}
        </div>
      </section>

      {selectedOrder && (
        <OrderDetailModal
          order={selectedOrder}
          customer={customerById.get(selectedOrder.customer_id ?? "") ?? null}
          onClose={() => setSelectedOrder(null)}
          onDownload={() => downloadOriginalFile(selectedOrder)}
          onCopy={() => copyOrderId(selectedOrder.id)}
          onCopyValue={copyValue}
          onStatusChange={(status) => updateStatus(selectedOrder.id, status)}
          onDeliveryUpdate={(estimate, note) =>
            updateDeliveryEstimate(selectedOrder.id, estimate, note)
          }
          onUploadModified={(file, label) => uploadModifiedFile(selectedOrder, file, label)}
          onDownloadModified={downloadModifiedFile}
          onCustomerUploadPermission={(enabled) =>
            updateCustomerUploadPermission(selectedOrder.id, enabled)
          }
          canManageOrders={hasStaffPermission(adminAccess, "orders.manage")}
          canDownloadFiles={hasStaffPermission(adminAccess, "files.download")}
          canUploadFiles={hasStaffPermission(adminAccess, "files.upload")}
          canManageMessages={hasStaffPermission(adminAccess, "messages.manage")}
          updating={updatingId === selectedOrder.id}
          uploadingModified={uploadingModifiedId === selectedOrder.id}
        />
      )}

      {selectedCustomer && customerForm && (
        <CustomerDetailModal
          customer={selectedCustomer}
          form={customerForm}
          setForm={setCustomerForm}
          creditInput={creditInputs[selectedCustomer.id] ?? ""}
          setCreditInput={(value) => {
            setCreditInputs((current) => ({ ...current, [selectedCustomer.id]: value }));
          }}
          creditNote={creditNotes[selectedCustomer.id] ?? ""}
          setCreditNote={(value) => {
            setCreditNotes((current) => ({ ...current, [selectedCustomer.id]: value }));
          }}
          creditUpdating={creditUpdatingIds.has(selectedCustomer.id)}
          saving={customerSavingId === selectedCustomer.id}
          onClose={() => {
            customerPricingLoadRequestRef.current += 1;
            customerPricingSaveRequestRef.current += 1;
            selectedCustomerIdRef.current = null;
            setSelectedCustomer(null);
            setCustomerForm(null);
            setCustomerPricingLoadState("idle");
            setCustomerPricingError("");
            setCustomerPricingMessage("");
            setCustomerPricingUpdatedAt(null);
            setCustomerPricingWritesEnabled(false);
            setCustomerPricingSavingId(null);
          }}
          onSave={saveCustomerSettings}
          pricingLoadState={customerPricingLoadState}
          pricingError={customerPricingError}
          pricingMessage={customerPricingMessage}
          pricingUpdatedAt={customerPricingUpdatedAt}
          pricingSaving={customerPricingSavingId === selectedCustomer.id}
          pricingWritesEnabled={customerPricingWritesEnabled}
          onReloadPricing={() => void loadCustomerPricing(selectedCustomer.id)}
          onSavePricing={() => void saveCustomerPricing()}
          onQuickAdjust={(amount) => quickAdjustCredits(selectedCustomer, amount)}
          onCustomAdjust={() => handleCustomCreditAdjust(selectedCustomer)}
          onCopyValue={copyValue}
          canManageSecurity={hasStaffPermission(adminAccess, "customers.manage")}
          canManageCredits={hasStaffPermission(adminAccess, "credits.manage")}
          canViewCustomerIntelligence={hasAllStaffPermissions(adminAccess, customerIntelligencePermissions)}
          canReplacePassword={isPrimaryOwner(adminAccess)}
        />
      )}
    </main>
  );
}

function AdminSyncWarningState({
  presentation,
  issue,
  retrying,
  onRetry,
}: {
  presentation: ReturnType<typeof getAdminSyncPresentation>;
  issue: AdminSyncIssue;
  retrying: boolean;
  onRetry: () => void;
}) {
  return (
    <section role="alert" className="mb-5 rounded-lg border border-amber-700/35 bg-amber-950/15 p-4 text-amber-100">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          {issue.kind === "offline" ? (
            <WifiOff className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
          ) : (
            <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
          )}
          <div className="min-w-0">
            <div className="font-black text-white">{presentation.label}</div>
            <p className="mt-1 text-sm leading-6 text-amber-100/75">{presentation.detail}</p>
            {issue.incidentCode && (
              <p className="mt-1 text-xs text-zinc-500">
                Support reference <code className="font-black text-zinc-300">{issue.incidentCode}</code>
              </p>
            )}
          </div>
        </div>
        {issue.kind === "session_required" ? (
          <Link href="/login?redirect=%2Fadmin" className="inline-flex h-10 shrink-0 items-center justify-center rounded-xl bg-red-600 px-4 text-sm font-black text-white transition hover:bg-red-500">
            <LogIn className="mr-2 h-4 w-4" /> Sign in again
          </Link>
        ) : (
          <button type="button" onClick={onRetry} disabled={retrying} className="inline-flex h-10 shrink-0 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-950/30 px-4 text-sm font-black text-white transition hover:bg-amber-900/40 disabled:cursor-not-allowed disabled:opacity-60">
            <RefreshCcw className={`mr-2 h-4 w-4 ${retrying ? "animate-spin" : ""}`} /> Retry now
          </button>
        )}
      </div>
    </section>
  );
}

function AdminLoadErrorState({
  message,
  presentation,
  issue,
  retrying,
  onRetry,
}: {
  message: string;
  presentation: ReturnType<typeof getAdminSyncPresentation>;
  issue: AdminSyncIssue | null;
  retrying: boolean;
  onRetry: () => void;
}) {
  const retrySeconds = issue?.retryDelayMs ? Math.ceil(issue.retryDelayMs / 1_000) : null;
  const title = issue?.kind === "session_required"
    ? "Secure session ended"
    : issue?.kind === "offline"
      ? "Admin panel is offline"
      : "Admin data sync failed";

  return (
    <section role="alert" className="rounded-[2rem] border border-red-800/50 bg-red-950/20 p-6 text-red-100 sm:p-8">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-red-700/40 bg-red-950/40 text-red-200">
            {issue?.kind === "offline" ? <WifiOff className="h-6 w-6" /> : <Database className="h-6 w-6" />}
          </div>
          <h2 className="break-words text-2xl font-black text-white">{title}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-red-100/80">{message}</p>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">
            The queue is not shown until orders and customers load successfully, so this screen cannot be mistaken for an empty operation list.
          </p>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">{presentation.detail}</p>
          {retrySeconds && (
            <p className="mt-2 text-sm font-bold text-amber-200">
              Automatic retry in {retrySeconds} seconds · attempt {Math.min((issue?.consecutiveFailures ?? 0) + 1, 4)} of 4
            </p>
          )}
          {issue?.incidentCode && (
            <p className="mt-3 text-xs text-zinc-500">
              Support reference <code className="font-black text-zinc-300">{issue.incidentCode}</code>
            </p>
          )}
        </div>
        {issue?.kind === "session_required" ? (
          <Link href="/login?redirect=%2Fadmin" className="inline-flex h-11 shrink-0 items-center justify-center rounded-xl border border-red-500/40 bg-red-600 px-4 text-sm font-black text-white transition hover:bg-red-500">
            <LogIn className="mr-2 h-4 w-4" /> Sign in again
          </Link>
        ) : (
          <button
            type="button"
            onClick={onRetry}
            disabled={retrying}
            className="inline-flex h-11 shrink-0 items-center justify-center rounded-xl border border-red-500/40 bg-red-600 px-4 text-sm font-black text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCcw className={`mr-2 h-4 w-4 ${retrying ? "animate-spin" : ""}`} />
            Try again
          </button>
        )}
      </div>
    </section>
  );
}

function OrdersPanel({
  filteredOrders,
  customerById,
  selectedStatus,
  setSelectedStatus,
  search,
  setSearch,
  onlyWithFile,
  setOnlyWithFile,
  updatingId,
  setSelectedOrder,
  updateStatus,
}: {
  filteredOrders: Order[];
  customerById: Map<string, Profile>;
  selectedStatus: string;
  setSelectedStatus: (value: string) => void;
  search: string;
  setSearch: (value: string) => void;
  onlyWithFile: boolean;
  setOnlyWithFile: React.Dispatch<React.SetStateAction<boolean>>;
  updatingId: string | null;
  setSelectedOrder: (order: Order) => void;
  updateStatus: (orderId: string, newStatus: string) => void;
}) {
  const [orderGroup, setOrderGroup] = useState<AdminOrderGroup>("all");
  const [visibleCount, setVisibleCount] = useState(adminOrdersPageSize);

  const groupedOrders = useMemo(() => {
    if (orderGroup === "completed") {
      return filteredOrders.filter((order) => order.status === "completed");
    }

    if (orderGroup === "cancelled") {
      return filteredOrders.filter((order) => order.status === "cancelled");
    }

    if (orderGroup === "open") {
      return filteredOrders.filter(
        (order) => order.status !== "completed" && order.status !== "cancelled"
      );
    }

    return filteredOrders;
  }, [filteredOrders, orderGroup]);

  const statusFilteredGroupedOrders = useMemo(() => {
    if (selectedStatus === "all") return groupedOrders;
    return groupedOrders.filter((order) => order.status === selectedStatus);
  }, [groupedOrders, selectedStatus]);

  const visibleOrders = statusFilteredGroupedOrders.slice(0, visibleCount);
  const groupCounts = useMemo(
    () => ({
      open: filteredOrders.filter(
        (order) => order.status !== "completed" && order.status !== "cancelled"
      ).length,
      completed: filteredOrders.filter((order) => order.status === "completed").length,
      cancelled: filteredOrders.filter((order) => order.status === "cancelled").length,
      all: filteredOrders.length,
    }),
    [filteredOrders]
  );
  const visibleStatusOptions = useMemo(() => {
    if (orderGroup === "completed") return ["all", "completed"];
    if (orderGroup === "cancelled") return ["all", "cancelled"];
    if (orderGroup === "open") {
      return statusOptions.filter(
        (status) => status !== "completed" && status !== "cancelled"
      );
    }

    return statusOptions;
  }, [orderGroup]);

  useEffect(() => {
    if (!visibleStatusOptions.includes(selectedStatus)) {
      setSelectedStatus("all");
    }
  }, [selectedStatus, setSelectedStatus, visibleStatusOptions]);

  useEffect(() => {
    const timeout = window.setTimeout(() => setVisibleCount(adminOrdersPageSize), 0);
    return () => window.clearTimeout(timeout);
  }, [orderGroup, statusFilteredGroupedOrders.length, selectedStatus, search, onlyWithFile]);

  return (
    <section id="admin-order-list" className="min-w-0 scroll-mt-20 rounded-xl border border-white/10 bg-white/[0.04] p-3 shadow-2xl shadow-black/20 sm:p-4">
      <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <h2 className="text-xl font-black">Orders</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Showing {visibleOrders.length} of {statusFilteredGroupedOrders.length} in this view.
          </p>
        </div>

        <div className="flex min-w-0 flex-col gap-2 md:flex-row md:items-center">
          <div className="relative min-w-0">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search customer, vehicle, ECU, file..."
              className="h-11 w-full rounded-lg border border-white/10 bg-black/35 pl-11 pr-3 text-sm font-bold text-white outline-none transition placeholder:text-zinc-600 focus:border-red-700 md:w-80 lg:h-10 2xl:w-96"
            />
          </div>

          <button
            onClick={() => setOnlyWithFile((current) => !current)}
            className={`h-11 rounded-lg border px-3 text-xs font-black transition lg:h-10 ${
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

      <div className="mb-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {adminOrderGroups.map((group) => {
          const active = orderGroup === group.value;
          const count = groupCounts[group.value];

          return (
            <button
              key={group.value}
              type="button"
              onClick={() => {
                setOrderGroup(group.value);
                setSelectedStatus("all");
              }}
              className={`min-w-0 rounded-lg border p-3 text-left transition ${
                active
                  ? "border-red-700 bg-red-950/35 text-white"
                  : "border-white/10 bg-black/30 text-zinc-400 hover:border-red-800/50 hover:text-white"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="font-black">{group.label}</span>
                <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-black">
                  {count}
                </span>
              </div>
              <div className="mt-1 line-clamp-1 text-[11px] leading-4 text-zinc-500">
                {group.description}
              </div>
            </button>
          );
        })}
      </div>

      <div className="mb-4 flex min-w-0 flex-wrap gap-2 pb-1">
        {visibleStatusOptions.map((status) => {
          const active = selectedStatus === status;
          const count =
            status === "all"
              ? groupedOrders.length
              : groupedOrders.filter((order) => order.status === status).length;
          return (
            <button
              key={status}
              onClick={() => setSelectedStatus(status)}
              className={`min-h-11 rounded-lg border px-3 py-2 text-xs font-black transition lg:min-h-0 ${
                active ? "border-red-700 bg-red-950/40 text-white" : "border-white/10 bg-black/30 text-zinc-400 hover:text-white"
              }`}
            >
              {status === "all" ? "All" : statusLabel(status)}
              <span className="ml-2 rounded-full bg-white/10 px-2 py-0.5 text-xs">{count}</span>
            </button>
          );
        })}
      </div>

      <div className="hidden overflow-x-auto rounded-2xl border border-white/10 2xl:block">
        <table className="w-full table-fixed border-collapse text-left text-sm">
          <colgroup>
            <col className="w-[8%]" />
            <col className="w-[14%]" />
            <col className="w-[12%]" />
            <col className="w-[13%]" />
            <col className="w-[10%]" />
            <col className="w-[7%]" />
            <col className="w-[13%]" />
            <col className="w-[12%]" />
            <col className="w-[10%]" />
          </colgroup>
          <thead className="bg-black/50 text-xs uppercase tracking-[0.14em] text-zinc-500">
            <tr>
              <th scope="col" className="px-3 py-4">Order</th>
              <th scope="col" className="px-3 py-4">Customer</th>
              <th scope="col" className="px-3 py-4">Vehicle</th>
              <th scope="col" className="px-3 py-4">ECU / Read</th>
              <th scope="col" className="px-3 py-4">Service</th>
              <th scope="col" className="px-3 py-4">Credits</th>
              <th scope="col" className="px-3 py-4">Status</th>
              <th scope="col" className="px-3 py-4">File</th>
              <th scope="col" className="px-2 py-4 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {statusFilteredGroupedOrders.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-zinc-500">No orders found.</td>
              </tr>
            ) : (
              visibleOrders.map((order) => (
                <tr key={order.id} className="bg-black/20 transition hover:bg-white/[0.04]">
                  <td className="px-2 py-3 align-top 2xl:px-3">
                    <div className="truncate font-black text-white">#{shortId(order.id)}</div>
                    <div className="mt-1 flex items-center gap-1 text-xs text-zinc-500">
                      <CalendarDays className="h-3 w-3" />
                      {formatDate(order.created_at)}
                    </div>
                  </td>
                  <td className="px-2 py-3 align-top 2xl:px-3">
                    <div className="truncate font-bold text-white">{order.customer_email || "-"}</div>
                    <div className="mt-1 text-xs font-black text-red-400">
                      {customerById.get(order.customer_id ?? "")?.customer_id || (order.customer_id ? order.customer_id.slice(0, 8) : "-")}
                    </div>
                    <div className="mt-1 max-w-[180px] truncate text-xs text-zinc-500">
                      {customerById.get(order.customer_id ?? "")?.full_name || customerById.get(order.customer_id ?? "")?.company_name || "-"}
                    </div>
                  </td>
                  <td className="px-2 py-3 align-top 2xl:px-3">
                    <div className="line-clamp-2 font-black">{order.vehicle_brand || "-"} {order.vehicle_model || ""}</div>
                    <div className="mt-1 line-clamp-2 text-xs text-zinc-500">{order.vehicle_generation || "-"} · {order.vehicle_engine || "-"}</div>
                  </td>
                  <td className="px-2 py-3 align-top 2xl:px-3">
                    <div className="line-clamp-3 font-bold">{order.ecu || "-"}</div>
                    <div className="mt-1 line-clamp-2 text-xs text-zinc-500">{order.read_method || "-"} · {order.gearbox || "-"}</div>
                  </td>
                  <td className="px-2 py-3 align-top 2xl:px-3"><div className="line-clamp-2 font-bold text-zinc-200">{order.service_type || "-"}</div></td>
                  <td className="px-2 py-3 align-top 2xl:px-3"><div className="rounded-lg bg-red-950/30 px-2 py-1.5 text-center font-black text-red-300">{order.credits_required ?? 0}</div></td>
                  <td className="px-2 py-3 align-top 2xl:px-3">
                    <select
                      value={order.status ?? "new_request"}
                      onChange={(event) => updateStatus(order.id, event.target.value)}
                      disabled={updatingId === order.id}
                      aria-label={`Update status for order ${shortId(order.id)}`}
                      className={`w-full rounded-xl border px-3 py-2 text-xs font-black outline-none ${statusClass(order.status)}`}
                    >
                      {editableStatusOptions.map((status) => <option key={status} value={status} className="bg-[#111]">{statusLabel(status)}</option>)}
                    </select>
                  </td>
                  <td className="px-2 py-3 align-top 2xl:px-3">
                    {order.original_file_path ? (
                      <div className="rounded-lg border border-emerald-700/40 bg-emerald-950/25 px-2 py-1.5 text-[11px] font-bold text-emerald-300">Original Ready</div>
                    ) : (
                      <div className="rounded-lg border border-zinc-700/40 bg-zinc-900/40 px-2 py-1.5 text-[11px] font-bold text-zinc-500">No Original</div>
                    )}
                    {order.modified_file_path && <div className="mt-1 rounded-lg border border-blue-700/40 bg-blue-950/25 px-2 py-1.5 text-[11px] font-bold text-blue-300">Modified Ready</div>}
                    <div title={order.uploaded_file_name || "-"} className="mt-1 max-w-full truncate text-xs text-zinc-500">{order.uploaded_file_name || "-"}</div>
                  </td>
                  <td className="px-2 py-4 text-center align-top">
                    <button
                      type="button"
                      onClick={() => setSelectedOrder(order)}
                      aria-label={`Open order ${shortId(order.id)} details`}
                      className="inline-flex h-10 w-full items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] px-2 text-xs font-black text-white transition hover:border-red-700/50 hover:bg-red-950/30"
                    >
                      <Eye className="mr-1.5 h-4 w-4 shrink-0" />
                      Details
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 lg:grid-cols-2 2xl:hidden">
        {statusFilteredGroupedOrders.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-black/30 p-8 text-center text-zinc-500 lg:col-span-2">No orders found.</div>
        ) : (
          visibleOrders.map((order) => {
            const customer = customerById.get(order.customer_id ?? "");
            const customerIdentity = [customer?.customer_id, order.customer_email, customer?.full_name || customer?.company_name].filter(Boolean).join(" · ");
            const vehicleDetail = [order.vehicle_generation, order.vehicle_engine].filter(Boolean).join(" · ");
            const ecuDetail = [order.ecu, order.read_method, order.gearbox].filter(Boolean).join(" · ");

            return (
              <article key={order.id} aria-labelledby={`admin-order-${order.id}`} className="min-w-0 rounded-2xl border border-white/10 bg-black/30 p-3 sm:p-4">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 id={`admin-order-${order.id}`} className="break-words text-base font-black sm:text-lg">{order.vehicle_brand || "-"} {order.vehicle_model || ""}</h3>
                    <div className="mt-1 break-words text-sm text-zinc-500">#{shortId(order.id)} · {formatDate(order.created_at)}</div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${statusClass(order.status)}`}>{statusLabel(order.status)}</span>
                    <span className="rounded-full border border-red-900/40 bg-red-950/25 px-2.5 py-1 text-xs font-black text-red-300">{order.credits_required ?? 0} cr</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <MiniInfo label="Customer" value={customerIdentity} />
                  <MiniInfo label="Vehicle / Engine" value={vehicleDetail} />
                  <MiniInfo label="ECU / Read" value={ecuDetail} />
                  <MiniInfo label="Service" value={order.service_type} />
                </div>
                <div className="mt-3 rounded-xl border border-white/10 bg-black/25 p-2.5">
                  <div className="flex flex-wrap gap-1.5">
                    <span className={`rounded-lg border px-2 py-1 text-[11px] font-bold ${order.original_file_path ? "border-emerald-700/40 bg-emerald-950/25 text-emerald-300" : "border-zinc-700/40 bg-zinc-900/40 text-zinc-500"}`}>
                      {order.original_file_path ? "Original Ready" : "No Original"}
                    </span>
                    {order.modified_file_path && (
                      <span className="rounded-lg border border-blue-700/40 bg-blue-950/25 px-2 py-1 text-[11px] font-bold text-blue-300">Modified Ready</span>
                    )}
                  </div>
                  <div title={order.uploaded_file_name || "-"} className="mt-1.5 truncate text-xs text-zinc-500">{order.uploaded_file_name || "-"}</div>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                  <select
                    value={order.status ?? "new_request"}
                    onChange={(event) => updateStatus(order.id, event.target.value)}
                    disabled={updatingId === order.id}
                    aria-label={`Update status for order ${shortId(order.id)}`}
                    className={`h-11 min-w-0 w-full rounded-xl border px-3 text-xs font-black outline-none ${statusClass(order.status)}`}
                  >
                    {editableStatusOptions.map((status) => <option key={status} value={status} className="bg-[#111]">{statusLabel(status)}</option>)}
                  </select>
                  <button onClick={() => setSelectedOrder(order)} aria-label={`Open order ${shortId(order.id)} details`} className="h-11 rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm font-black text-white transition hover:border-red-700/50 hover:bg-red-950/30">
                    <Eye className="mr-2 inline h-4 w-4" />
                    Details
                  </button>
                </div>
              </article>
            );
          })
        )}
      </div>

      {visibleOrders.length < statusFilteredGroupedOrders.length && (
        <button
          type="button"
          onClick={() => setVisibleCount((current) => current + adminOrdersPageSize)}
          className="mt-5 w-full rounded-xl border border-white/10 bg-white/[0.04] px-5 py-4 text-sm font-black text-white transition hover:border-red-800/60 hover:bg-red-950/25"
        >
          Load {Math.min(adminOrdersPageSize, statusFilteredGroupedOrders.length - visibleOrders.length)} more orders
        </button>
      )}
    </section>
  );
}

function CustomersPanel({
  customers,
  filteredCustomers,
  customerSearch,
  setCustomerSearch,
  creditUpdatingIds,
  openCustomer,
  quickAdjustCredits,
}: {
  customers: Profile[];
  filteredCustomers: Profile[];
  customerSearch: string;
  setCustomerSearch: (value: string) => void;
  creditUpdatingIds: ReadonlySet<string>;
  openCustomer: (customer: Profile) => void;
  quickAdjustCredits: (customer: Profile, amount: number) => void;
}) {
  return (
    <section className="min-w-0 rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4 shadow-2xl shadow-black/20 sm:rounded-[2rem] sm:p-5">
      <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <h2 className="text-2xl font-black">Customers</h2>
          <p className="mt-1 text-sm text-zinc-500">Manage {filteredCustomers.length} of {customers.length} customers, credits and account permissions.</p>
        </div>
        <div className="relative min-w-0">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input
            value={customerSearch}
            onChange={(event) => setCustomerSearch(event.target.value)}
            placeholder="Search customer ID, email, name, company..."
            className="h-12 w-full rounded-xl border border-white/10 bg-black/35 pl-11 pr-4 text-sm font-bold text-white outline-none transition placeholder:text-zinc-600 focus:border-red-700 md:w-[520px]"
          />
        </div>
      </div>

      <div className="hidden overflow-hidden rounded-2xl border border-white/10 xl:block">
        <table className="w-full table-fixed border-collapse text-left text-sm">
          <colgroup>
            <col className="w-[27%]" />
            <col className="w-[13%]" />
            <col className="w-[16%]" />
            <col className="w-[10%]" />
            <col className="w-[20%]" />
            <col className="w-[14%]" />
          </colgroup>
          <thead className="bg-black/50 text-xs uppercase tracking-[0.14em] text-zinc-500">
            <tr>
              <th className="px-4 py-4">Customer</th>
              <th className="px-4 py-4">Customer ID</th>
              <th className="px-4 py-4">Account</th>
              <th className="px-4 py-4">Balance</th>
              <th className="px-4 py-4">Quick Credits</th>
              <th className="px-4 py-4 text-right">Manage</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {filteredCustomers.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-zinc-500">No customers found.</td></tr>
            ) : (
              filteredCustomers.map((customer) => (
                <tr key={customer.id} className="bg-black/20 transition hover:bg-white/[0.04]">
                  <td className="px-4 py-4 align-top">
                    <div className="truncate font-black text-white">{customer.email || "-"}</div>
                    <div className="mt-1 truncate text-xs text-zinc-500">{customer.full_name || customer.company_name || customer.id}</div>
                    {customer.internal_admin_note ? (
                      <div className="mt-2 line-clamp-1 rounded-lg border border-yellow-700/30 bg-yellow-950/15 px-2 py-1 text-xs text-yellow-300">Note: {customer.internal_admin_note}</div>
                    ) : null}
                  </td>
                  <td className="px-4 py-4 align-top">
                    <button onClick={() => customer.customer_id && navigator.clipboard.writeText(customer.customer_id)} className="rounded-xl border border-red-800/40 bg-red-950/25 px-3 py-2 text-xs font-black text-red-300 transition hover:bg-red-900/30">
                      {customer.customer_id || "-"}
                    </button>
                  </td>
                  <td className="px-4 py-4 align-top">
                    <div className="text-sm font-bold text-white">{customer.account_type === "company" ? "Company" : "Private"}</div>
                    <span className={`mt-2 inline-flex rounded-xl border px-3 py-1 text-xs font-black ${accountStatusClass(customer.account_status)}`}>{statusLabel(customer.account_status ?? "active")}</span>
                    {customer.allow_negative_credits ? <div className="mt-2 text-xs font-bold text-orange-300">Negative limit: -{Math.abs(Number(customer.negative_credit_limit ?? 0))}</div> : null}
                    {customer.customer_tags?.length ? (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {customer.customer_tags.map((tag) => (
                          <span key={tag} className={`rounded-lg border px-2 py-1 text-[10px] font-black ${customerTagClass(tag)}`}>
                            {customerTagLabel(tag)}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-4 py-4 align-top"><div className="w-24 rounded-xl bg-red-950/30 px-3 py-2 text-center font-black text-red-300">{Number(customer.credit_balance ?? 0)}</div></td>
                  <td className="px-4 py-4 align-top">
                    <div className="flex flex-wrap gap-2">
                      {[10, 25, 50, 100].map((amount) => (
                        <button key={amount} onClick={() => quickAdjustCredits(customer, amount)} disabled={creditUpdatingIds.has(customer.id)} className="rounded-xl border border-emerald-700/40 bg-emerald-950/30 px-3 py-2 text-xs font-black text-emerald-300 transition hover:bg-emerald-900/40 disabled:opacity-50">+{amount}</button>
                      ))}
                      <button onClick={() => quickAdjustCredits(customer, -10)} disabled={creditUpdatingIds.has(customer.id)} className="rounded-xl border border-red-700/40 bg-red-950/30 px-3 py-2 text-xs font-black text-red-300 transition hover:bg-red-900/40 disabled:opacity-50">-10</button>
                    </div>
                    <div className="mt-2 text-xs text-zinc-500">Custom amount and ledger note are inside Manage.</div>
                  </td>
                  <td className="px-4 py-4 text-right align-top">
                    <button onClick={() => openCustomer(customer)} className="inline-flex h-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] px-4 text-xs font-black text-white transition hover:border-red-700/50 hover:bg-red-950/30">
                      <Settings className="mr-2 h-4 w-4" />Manage
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="space-y-4 xl:hidden">
        {filteredCustomers.length === 0 ? <div className="rounded-2xl border border-white/10 bg-black/30 p-8 text-center text-zinc-500">No customers found.</div> : filteredCustomers.map((customer) => (
          <div key={customer.id} className="min-w-0 rounded-2xl border border-white/10 bg-black/30 p-4 sm:p-5">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="break-words font-black">{customer.email || "-"}</div>
                <div className="mt-1 break-words text-sm text-zinc-500">{customer.customer_id || customer.id}</div>
                <div className="mt-1 break-words text-xs text-zinc-500">{customer.full_name || customer.company_name || "-"}</div>
                {customer.customer_tags?.length ? (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {customer.customer_tags.map((tag) => (
                      <span key={tag} className={`rounded-lg border px-2 py-1 text-[10px] font-black ${customerTagClass(tag)}`}>
                        {customerTagLabel(tag)}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
              <div className="shrink-0 rounded-xl bg-red-950/30 px-3 py-2 text-center font-black text-red-300">{Number(customer.credit_balance ?? 0)}</div>
            </div>
            <div className="mb-4 flex flex-wrap gap-2">
              {[10, 25, 50, 100].map((amount) => <button key={amount} onClick={() => quickAdjustCredits(customer, amount)} disabled={creditUpdatingIds.has(customer.id)} className="rounded-xl border border-emerald-700/40 bg-emerald-950/30 px-3 py-2 text-xs font-black text-emerald-300 disabled:opacity-50">+{amount}</button>)}
              <button onClick={() => quickAdjustCredits(customer, -10)} disabled={creditUpdatingIds.has(customer.id)} className="rounded-xl border border-red-700/40 bg-red-950/30 px-3 py-2 text-xs font-black text-red-300 disabled:opacity-50">-10</button>
            </div>
            <button onClick={() => openCustomer(customer)} className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm font-black text-white"><Settings className="mr-2 inline h-4 w-4" />Manage Customer</button>
          </div>
        ))}
      </div>
    </section>
  );
}

function CustomerDetailModal({ customer, form, setForm, creditInput, setCreditInput, creditNote, setCreditNote, creditUpdating, saving, onClose, onSave, pricingLoadState, pricingError, pricingMessage, pricingUpdatedAt, pricingSaving, pricingWritesEnabled, onReloadPricing, onSavePricing, onQuickAdjust, onCustomAdjust, onCopyValue, canManageSecurity, canManageCredits, canViewCustomerIntelligence, canReplacePassword }: {
  customer: Profile;
  form: CustomerForm;
  setForm: React.Dispatch<React.SetStateAction<CustomerForm | null>>;
  creditInput: string;
  setCreditInput: (value: string) => void;
  creditNote: string;
  setCreditNote: (value: string) => void;
  creditUpdating: boolean;
  saving: boolean;
  onClose: () => void;
  onSave: () => void;
  pricingLoadState: CustomerPricingLoadState;
  pricingError: string;
  pricingMessage: string;
  pricingUpdatedAt: string | null;
  pricingSaving: boolean;
  pricingWritesEnabled: boolean;
  onReloadPricing: () => void;
  onSavePricing: () => void;
  onQuickAdjust: (amount: number) => void;
  onCustomAdjust: () => void;
  onCopyValue: (value: string | null | undefined, label: string) => void;
  canManageSecurity: boolean;
  canManageCredits: boolean;
  canViewCustomerIntelligence: boolean;
  canReplacePassword: boolean;
}) {
  const accountCreatedLabel = customer.created_at
    ? `Account created ${formatDate(customer.created_at)}`
    : "Account creation date unavailable";
  const customerPricingLoading = pricingLoadState === "loading";
  const customerPricingReady = pricingLoadState === "ready";
  const pricingControlsDisabled = customerPricingLoading || pricingSaving || !customerPricingReady || !pricingWritesEnabled;
  const globalCustomerPrice = Number(form.global_custom_unit_price_eur);
  const customOverrideText = form.commercial_custom_unit_price_override_eur.trim();
  const parsedCustomOverride = parseOptionalCustomUnitPrice(customOverrideText);
  const customerCustomPricePreview = !parsedCustomOverride.valid
    ? null
    : parsedCustomOverride.value == null
    ? Number.isFinite(globalCustomerPrice) && globalCustomerPrice >= 0.01
      ? globalCustomerPrice
      : null
    : parsedCustomOverride.value;
  const updateForm = <K extends keyof CustomerForm>(key: K, value: CustomerForm[K]) => setForm((current) => current ? { ...current, [key]: value } : current);
  const updatePackagePriceOverride = (packageId: CreditPackageId, value: string) => {
    setForm((current) => current ? {
      ...current,
      commercial_package_price_overrides_eur: {
        ...current.commercial_package_price_overrides_eur,
        [packageId]: value,
      },
    } : current);
  };
  const toggleCustomerTag = (tag: CustomerTag) => {
    setForm((current) => {
      if (!current) return current;

      const active = current.customer_tags.includes(tag);

      return {
        ...current,
        customer_tags: active
          ? current.customer_tags.filter((item) => item !== tag)
          : [...current.customer_tags, tag],
      };
    });
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/75 p-2 backdrop-blur-sm sm:p-3">
      <div role="dialog" aria-modal="true" aria-labelledby="customer-detail-title" className="max-h-[calc(100dvh-1rem)] w-full max-w-[96rem] overflow-auto rounded-xl border border-white/10 bg-[#090909] shadow-2xl shadow-black sm:max-h-[calc(100dvh-1.5rem)]">
        <div className="sticky top-0 z-20 border-b border-white/10 bg-[#090909]/95 p-3 backdrop-blur-xl sm:p-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-1.5">
                <span className="rounded-full border border-red-800/40 bg-red-950/25 px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-red-300">{customer.customer_id || customer.id}</span>
                <span className={`rounded-full border px-2.5 py-1 text-[11px] font-black ${accountStatusClass(form.account_status)}`}>{statusLabel(form.account_status)}</span>
                {canManageCredits && <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-bold text-zinc-400">Balance: {Number(customer.credit_balance ?? 0)} credits</span>}
                <span className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-bold text-zinc-400" title="Customer account creation date">
                  <CalendarDays className="mr-1.5 h-3.5 w-3.5 text-red-400" />
                  {accountCreatedLabel}
                </span>
                {form.customer_tags.map((tag) => (
                  <span key={tag} className={`rounded-full border px-2.5 py-1 text-[11px] font-black ${customerTagClass(tag)}`}>
                    {customerTagLabel(tag)}
                  </span>
                ))}
              </div>
              <h2 id="customer-detail-title" className="truncate text-2xl font-black md:text-3xl">{customer.full_name || customer.company_name || customer.email || "Customer"}</h2>
              <p className="mt-1 truncate text-sm text-zinc-500">{customer.email}</p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {canViewCustomerIntelligence && <Link href={`/admin/growth/customers/${customer.id}`} className="inline-flex min-h-11 items-center rounded-lg border border-cyan-800/40 bg-cyan-950/20 px-3 text-xs font-black text-cyan-200 transition hover:bg-cyan-950/40 lg:h-9 lg:min-h-0"><HeartHandshake className="mr-1.5 h-4 w-4" />Customer 360</Link>}
              <button onClick={() => onCopyValue(customer.customer_id || customer.id, "Customer ID")} className="min-h-11 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-xs font-black text-white transition hover:bg-white/10 lg:h-9 lg:min-h-0"><Copy className="mr-1.5 inline h-4 w-4" />Copy ID</button>
              <button onClick={onSave} disabled={saving} className="min-h-11 rounded-lg bg-[#b1121b] px-3 text-xs font-black text-white transition hover:bg-[#c91824] disabled:opacity-50 lg:h-9 lg:min-h-0">{saving ? <Loader2 className="mr-1.5 inline h-4 w-4 animate-spin" /> : <Save className="mr-1.5 inline h-4 w-4" />}Save profile</button>
              <button onClick={onClose} className="min-h-11 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-xs font-black text-white transition hover:bg-white/10 lg:h-9 lg:min-h-0"><X className="mr-1.5 inline h-4 w-4" />Close</button>
            </div>
          </div>
        </div>
        <div className="grid gap-4 p-3 sm:p-4 xl:grid-cols-[minmax(0,1fr)_280px]">
          <div className="space-y-4">
            <section className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
              <h3 className="mb-3 text-lg font-black">Customer Profile</h3>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <FormInput label="Full Name" value={form.full_name} onChange={(value) => updateForm("full_name", value)} />
                <FormSelect label="Account Type" value={form.account_type} onChange={(value) => updateForm("account_type", value)} options={["private", "company"]} />
                <FormInput label="Company Name" value={form.company_name} onChange={(value) => updateForm("company_name", value)} />
                <FormInput label="Phone" value={form.phone} onChange={(value) => updateForm("phone", value)} />
                <FormInput label="Street" value={form.street} onChange={(value) => updateForm("street", value)} />
                <FormInput label="Postal Code" value={form.postal_code} onChange={(value) => updateForm("postal_code", value)} />
                <FormInput label="City" value={form.city} onChange={(value) => updateForm("city", value)} />
                <FormInput label="Country" value={form.country} onChange={(value) => updateForm("country", value)} />
                <FormInput label="VAT ID" value={form.vat_id} onChange={(value) => updateForm("vat_id", value)} />
                <FormInput label="Invoice Email" value={form.invoice_email} onChange={(value) => updateForm("invoice_email", value)} />
                <FormInput label="Preferred Contact" value={form.preferred_contact} onChange={(value) => updateForm("preferred_contact", value)} />
                <FormSelect label="Account Status" value={form.account_status} onChange={(value) => updateForm("account_status", value)} options={accountStatusOptions} />
              </div>
            </section>
            <CustomerPasswordSecurityPanel
              customer={customer}
              canManageSecurity={canManageSecurity}
              canReplacePassword={canReplacePassword}
            />
            <section className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
              <div className="mb-3 flex items-center gap-2.5">
                <Tags className="h-5 w-5 text-red-500" />
                <div>
                  <h3 className="text-lg font-black">Customer Tags</h3>
                  <p className="mt-1 text-sm text-zinc-500">
                    Internal labels for workflow priority, pricing and account handling.
                  </p>
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-3 2xl:grid-cols-5">
                {customerTagOptions.map((option) => {
                  const active = form.customer_tags.includes(option.value);

                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => toggleCustomerTag(option.value)}
                      className={`rounded-lg border p-3 text-left transition hover:-translate-y-0.5 ${
                        active
                          ? option.className
                          : "border-white/10 bg-black/30 text-zinc-400 hover:border-red-800/60 hover:text-white"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-black">{option.label}</span>
                        {active ? (
                          <CheckCircle2 className="h-5 w-5" />
                        ) : (
                          <span className="h-5 w-5 rounded-full border border-zinc-700" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
            <section className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
              <h3 className="mb-3 text-lg font-black">Credit Permissions</h3>
              {canManageCredits ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/30 p-3">
                    <div><div className="font-black text-white">Allow Negative Credits</div><div className="mt-1 text-sm text-zinc-500">Customer can submit requests with insufficient balance.</div></div>
                    <input type="checkbox" checked={form.allow_negative_credits} onChange={(event) => updateForm("allow_negative_credits", event.target.checked)} className="h-5 w-5 accent-red-600" />
                  </label>
                  <FormInput label="Negative Credit Limit" type="number" value={form.negative_credit_limit} onChange={(value) => updateForm("negative_credit_limit", value)} />
                </div>
              ) : (
                <p className="rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-zinc-500">Your staff role cannot view or change negative-credit settings.</p>
              )}
              <textarea value={form.internal_admin_note} onChange={(event) => updateForm("internal_admin_note", event.target.value)} placeholder="Internal admin note. Customer cannot see this." className="mt-3 min-h-20 w-full resize-y rounded-lg border border-white/10 bg-black/35 px-3 py-2.5 text-sm font-bold text-white outline-none placeholder:text-zinc-600 focus:border-red-700" />
            </section>
            {canManageCredits && <section className="rounded-xl border border-red-900/40 bg-red-950/10 p-4" aria-labelledby="customer-pricing-title">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 id="customer-pricing-title" className="text-lg font-black">Customer Pricing & Payments</h3>
                  <p className="mt-1 max-w-2xl text-xs leading-5 text-zinc-500">
                    Each blank field inherits its matching global price. Entered values are final payable EUR prices and remain fixed for this customer.
                  </p>
                </div>
                <div className="grid shrink-0 gap-2 sm:grid-cols-2">
                  <div className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-right">
                    <div className="text-xs font-black uppercase text-zinc-500">Global custom</div>
                    <div className="mt-0.5 text-base font-black text-white">
                      {Number.isFinite(globalCustomerPrice) && form.global_custom_unit_price_eur
                        ? `EUR ${formatCreditUnitAmount(globalCustomerPrice)}`
                        : "—"}
                    </div>
                  </div>
                  <div className="rounded-lg border border-emerald-700/40 bg-emerald-950/20 px-3 py-2 text-right">
                    <div className="text-xs font-black uppercase text-emerald-400">Effective custom</div>
                    <div className="mt-0.5 text-base font-black">
                      {customerCustomPricePreview != null
                        ? `EUR ${formatCreditUnitAmount(customerCustomPricePreview)}`
                        : "—"}
                    </div>
                    <div className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-emerald-300/70">EUR / credit</div>
                  </div>
                </div>
              </div>

              {customerPricingLoading && (
                <div role="status" className="mt-3 flex items-center rounded-lg border border-white/10 bg-black/30 p-3 text-sm font-bold text-zinc-300">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin text-red-400" />Loading the current customer pricing policy…
                </div>
              )}
              {pricingError && (
                <div role="alert" className="mt-3 rounded-lg border border-red-700/50 bg-red-950/30 p-3 text-sm text-red-100">
                  <div className="font-black">Customer pricing was not confirmed</div>
                  <p className="mt-1 leading-6 text-red-100/80">{pricingError}</p>
                  {pricingLoadState === "error" && (
                    <button type="button" onClick={onReloadPricing} disabled={customerPricingLoading || pricingSaving} className="mt-3 inline-flex h-10 items-center justify-center rounded-lg border border-red-500/40 px-4 text-xs font-black text-white disabled:opacity-50">
                      <RefreshCcw className={`mr-2 h-4 w-4 ${customerPricingLoading ? "animate-spin" : ""}`} />Reload pricing
                    </button>
                  )}
                </div>
              )}
              {pricingMessage && (
                <div role="status" className="mt-3 rounded-lg border border-emerald-700/40 bg-emerald-950/20 p-3 text-sm font-bold text-emerald-200">{pricingMessage}</div>
              )}

              {customerPricingReady && !pricingWritesEnabled && (
                <div role="status" className="mt-3 rounded-lg border border-amber-700/50 bg-amber-950/20 p-3 text-sm text-amber-100">
                  <div className="font-black">Saving customer prices is temporarily locked</div>
                  <p className="mt-1 leading-6 text-amber-100/80">
                    Existing prices remain active. Reload after the verified v2 rollback bridge is activated.
                  </p>
                  <button type="button" onClick={onReloadPricing} className="mt-2 inline-flex h-10 items-center rounded-lg border border-amber-500/40 px-3 text-xs font-black text-white">
                    <RefreshCcw className="mr-2 h-4 w-4" />Check release gate
                  </button>
                </div>
              )}

              <fieldset disabled={pricingControlsDisabled} className="mt-4 disabled:opacity-60">
                <legend className="text-xs font-black uppercase tracking-[0.14em] text-zinc-500">Exact price overrides</legend>
                <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {creditPackages.map((item) => {
                    const globalPrice = Number(form.global_package_prices_eur[item.id]);
                    const rawOverride = form.commercial_package_price_overrides_eur[item.id].trim();
                    const parsedOverride = parseOptionalPackageTotal(rawOverride, item.credits);
                    const overrideValid = parsedOverride.valid;
                    const effectivePrice = !overrideValid
                      ? null
                      : parsedOverride.value == null
                        ? globalPrice
                        : parsedOverride.value;
                    const helpId = `customer-price-${item.id}-help`;

                    return (
                      <label key={item.id} className="rounded-lg border border-white/10 bg-black/30 p-3">
                        <span className="flex items-center justify-between gap-2 text-xs font-black uppercase text-zinc-300">
                          <span>{item.credits} credits</span>
                          <span className="font-bold normal-case text-zinc-500">
                            Global {Number.isFinite(globalPrice) ? `EUR ${globalPrice.toFixed(2)}` : "—"}
                          </span>
                        </span>
                        <div className={`mt-2 flex min-h-11 overflow-hidden rounded-lg border bg-black/60 transition focus-within:ring-2 focus-within:ring-red-700/70 lg:h-10 lg:min-h-0 ${overrideValid ? "border-white/10" : "border-red-600/80"}`}>
                          <input
                            type="number"
                            inputMode="decimal"
                            min={minimumCreditPackageTotalEuro(item.credits)}
                            max={MAX_CREDIT_PACKAGE_TOTAL_EURO}
                            step="0.01"
                            value={form.commercial_package_price_overrides_eur[item.id]}
                            onChange={(event) => updatePackagePriceOverride(item.id, event.target.value)}
                            aria-label={`Customer override total for ${item.credits} credits`}
                            aria-describedby={helpId}
                            aria-invalid={!overrideValid}
                            placeholder="Inherit global"
                            className="min-w-0 flex-1 bg-transparent px-3 text-sm font-black tabular-nums text-white outline-none placeholder:text-zinc-500"
                          />
                          <span className="flex min-w-12 items-center justify-center border-l border-white/10 px-2 text-[10px] font-black text-zinc-500">EUR</span>
                        </div>
                        <span id={helpId} className={`mt-1.5 block text-xs font-bold ${effectivePrice == null ? "text-red-300" : rawOverride === "" ? "text-zinc-400" : "text-emerald-300"}`}>
                          {effectivePrice == null
                            ? "Enter a valid final total"
                            : rawOverride === ""
                              ? `Inherits EUR ${effectivePrice.toFixed(2)}`
                              : `Customer pays EUR ${effectivePrice.toFixed(2)}`}
                        </span>
                      </label>
                    );
                  })}

                  <label className="rounded-lg border border-red-900/40 bg-red-950/15 p-3">
                    <span className="flex items-center justify-between gap-2 text-xs font-black uppercase text-zinc-300">
                      <span>Custom amount</span>
                      <span className="font-bold normal-case text-zinc-500">
                        Global {Number.isFinite(globalCustomerPrice) ? `EUR ${formatCreditUnitAmount(globalCustomerPrice)}` : "—"}
                      </span>
                    </span>
                    <div className={`mt-2 flex min-h-11 overflow-hidden rounded-lg border bg-black/60 transition focus-within:ring-2 focus-within:ring-red-700/70 lg:h-10 lg:min-h-0 ${parsedCustomOverride.valid ? "border-white/10" : "border-red-600/80"}`}>
                      <input
                        type="number"
                        inputMode="decimal"
                        min="0.01"
                        max={MAX_CUSTOM_CREDIT_UNIT_PRICE_EURO}
                        step="0.0001"
                        value={form.commercial_custom_unit_price_override_eur}
                        onChange={(event) => updateForm("commercial_custom_unit_price_override_eur", event.target.value)}
                        aria-label="Customer custom credit unit price override"
                        aria-describedby="customer-custom-credit-price-help"
                        aria-invalid={!parsedCustomOverride.valid}
                        placeholder="Inherit global"
                        className="min-w-0 flex-1 bg-transparent px-3 text-sm font-black tabular-nums text-white outline-none placeholder:text-zinc-500"
                      />
                      <span className="flex min-w-20 items-center justify-center border-l border-white/10 px-2 text-[10px] font-black text-zinc-500">EUR / credit</span>
                    </div>
                    <span id="customer-custom-credit-price-help" className={`mt-1.5 block text-xs font-bold ${customerCustomPricePreview == null ? "text-red-300" : customOverrideText === "" ? "text-zinc-400" : "text-emerald-300"}`}>
                      {customerCustomPricePreview == null
                        ? "Enter a valid unit price"
                        : customOverrideText === ""
                          ? `Inherits EUR ${formatCreditUnitAmount(customerCustomPricePreview)}`
                          : `Customer pays EUR ${formatCreditUnitAmount(customerCustomPricePreview)} / credit`}
                    </span>
                  </label>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <PaymentPolicySelect label="Stripe" value={form.payment_stripe} onChange={(value) => updateForm("payment_stripe", value)} disabled={pricingControlsDisabled} />
                  <PaymentPolicySelect label="Bank transfer" value={form.payment_bank} onChange={(value) => updateForm("payment_bank", value)} disabled={pricingControlsDisabled} />
                </div>
                <p className="mt-3 text-xs leading-5 text-zinc-500">Payment method “Inherit” follows the global payment setting.</p>
                <textarea value={form.commercial_internal_note} onChange={(event) => updateForm("commercial_internal_note", event.target.value)} disabled={pricingControlsDisabled} maxLength={2000} aria-label="Internal pricing agreement note" placeholder="Internal pricing agreement or approval note. Customer cannot see this." className="mt-3 min-h-16 w-full resize-y rounded-lg border border-white/10 bg-black/35 px-3 py-2.5 text-sm font-bold text-white outline-none placeholder:text-zinc-600 focus:border-red-700 disabled:cursor-not-allowed disabled:opacity-60" />
              </fieldset>

              <div className="mt-4 flex flex-col gap-2 border-t border-white/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-xs leading-5 text-zinc-500">
                  {pricingUpdatedAt ? `Last saved ${formatDate(pricingUpdatedAt)}` : "No customer-specific pricing row is saved yet."}
                </div>
                <button type="button" onClick={onSavePricing} disabled={pricingControlsDisabled} className="inline-flex h-11 items-center justify-center rounded-lg bg-[#b1121b] px-4 text-sm font-black text-white transition hover:bg-[#c91824] disabled:cursor-not-allowed disabled:opacity-50 lg:h-10">
                  {pricingSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  {pricingSaving ? "Saving pricing…" : "Save price overrides"}
                </button>
              </div>
            </section>}
          </div>
          <aside className="min-w-0 self-start space-y-3 xl:sticky xl:top-[7.5rem] xl:h-fit">
            {canManageCredits ? (
              <>
                <section className="rounded-xl border border-red-900/40 bg-red-950/20 p-4">
                  <CreditCard className="mb-2 h-6 w-6 text-red-400" /><div className="text-xs text-zinc-400">Current Balance</div><div className="mt-1 text-3xl font-black">{Number(customer.credit_balance ?? 0)}</div><div className="text-xs text-zinc-500">credits</div>
                </section>
                <section className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
                  <h3 className="mb-3 text-lg font-black">Adjust Credits</h3>
                  <div className="mb-3 grid grid-cols-4 gap-1.5">
                    {[10, 25, 50, 100].map((amount) => <button key={amount} onClick={() => onQuickAdjust(amount)} disabled={creditUpdating} className="min-h-11 rounded-lg border border-emerald-700/40 bg-emerald-950/30 px-1.5 py-2 text-xs font-black text-emerald-300 transition hover:bg-emerald-900/40 disabled:opacity-50 lg:min-h-0">+{amount}</button>)}
                    {[-10, -25, -50, -100].map((amount) => <button key={amount} onClick={() => onQuickAdjust(amount)} disabled={creditUpdating} className="min-h-11 rounded-lg border border-red-700/40 bg-red-950/30 px-1.5 py-2 text-xs font-black text-red-300 transition hover:bg-red-900/40 disabled:opacity-50 lg:min-h-0">{amount}</button>)}
                  </div>
                  <input type="number" value={creditInput} onChange={(event) => setCreditInput(event.target.value)} disabled={creditUpdating} placeholder="+/- custom amount" className="mb-2 h-11 w-full rounded-lg border border-white/10 bg-black/35 px-3 text-sm font-bold text-white outline-none placeholder:text-zinc-600 focus:border-red-700 disabled:cursor-not-allowed disabled:opacity-60 lg:h-10" />
                  <textarea value={creditNote} onChange={(event) => setCreditNote(event.target.value)} disabled={creditUpdating} placeholder="Ledger note" className="mb-2 min-h-16 w-full resize-y rounded-lg border border-white/10 bg-black/35 px-3 py-2.5 text-sm font-bold text-white outline-none placeholder:text-zinc-600 focus:border-red-700 disabled:cursor-not-allowed disabled:opacity-60" />
                  <button onClick={onCustomAdjust} disabled={creditUpdating} className="flex h-11 w-full items-center justify-center rounded-lg bg-[#b1121b] px-3 text-xs font-black text-white transition hover:bg-[#c91824] disabled:opacity-50 lg:h-10">{creditUpdating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MinusCircle className="mr-2 h-4 w-4" />}Apply Credit Adjustment</button>
                </section>
              </>
            ) : (
              <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 text-sm leading-6 text-zinc-500">Financial details require credits.manage.</section>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}

function CustomerPasswordSecurityPanel({
  customer,
  canManageSecurity,
  canReplacePassword,
}: {
  customer: Profile;
  canManageSecurity: boolean;
  canReplacePassword: boolean;
}) {
  const [replacementPassword, setReplacementPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showReplacementPassword, setShowReplacementPassword] = useState(false);
  const [busyAction, setBusyAction] = useState<"reset" | "replace" | null>(null);
  const [securityMessage, setSecurityMessage] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);
  const passwordValidation = useMemo(
    () => validateCustomerReplacementPassword(replacementPassword),
    [replacementPassword]
  );
  const passwordsMatch = replacementPassword === confirmPassword;
  const canSubmitReplacement =
    canReplacePassword &&
    passwordValidation.valid &&
    passwordsMatch &&
    busyAction === null;

  async function runSecurityAction(
    action: "send_reset_email" | "set_replacement_password"
  ) {
    if (!canManageSecurity || busyAction) return;
    if (action === "set_replacement_password" && !canSubmitReplacement) return;

    const confirmed = window.confirm(
      action === "send_reset_email"
        ? `Send a secure password reset link to ${customer.email || "this customer"}?`
        : "Replace this customer's login password now? The previous password cannot be recovered."
    );
    if (!confirmed) return;

    setBusyAction(action === "send_reset_email" ? "reset" : "replace");
    setSecurityMessage(null);
    try {
      const response = await authenticatedFetch(
        `/api/admin/customers/${customer.id}/password`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            action === "send_reset_email"
              ? { action }
              : { action, password: replacementPassword }
          ),
        }
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "Customer security action failed.");
      }
      setSecurityMessage({
        tone: "success",
        text: payload.message || "Customer security action completed.",
      });
      if (action === "set_replacement_password") {
        setReplacementPassword("");
        setConfirmPassword("");
        setShowReplacementPassword(false);
      }
    } catch (error) {
      setSecurityMessage({
        tone: "error",
        text: error instanceof Error ? error.message : "Customer security action failed.",
      });
    } finally {
      setBusyAction(null);
    }
  }

  function generateReplacementPassword() {
    const generated = generateCustomerReplacementPassword();
    setReplacementPassword(generated);
    setConfirmPassword(generated);
    setShowReplacementPassword(true);
    setSecurityMessage(null);
  }

  return (
    <section className="rounded-xl border border-amber-700/30 bg-amber-950/10 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-amber-600/30 bg-amber-500/10 text-amber-300">
              <KeyRound className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-white">Account Security</h3>
              <p className="mt-0.5 text-xs leading-5 text-zinc-500">
                Recovery and credential controls for this customer account.
              </p>
            </div>
          </div>
        </div>
        <span className="inline-flex shrink-0 items-center rounded-full border border-emerald-700/30 bg-emerald-950/20 px-3 py-1.5 text-xs font-black text-emerald-300">
          <ShieldCheck className="mr-2 h-4 w-4" />Server protected
        </span>
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-2">
        <div className="rounded-lg border border-white/10 bg-black/35 p-3">
          <div className="text-xs font-black uppercase tracking-[0.16em] text-zinc-500">
            Current password
          </div>
          <div
            aria-label="Current password is one-way protected and cannot be retrieved"
            className="mt-2 flex min-h-10 items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/45 px-3"
          >
            <span aria-hidden className="select-none font-mono tracking-[0.22em] text-zinc-500 blur-[2px]">
              ••••••••••••••••
            </span>
            <span className="inline-flex items-center text-xs font-black text-zinc-500">
              <EyeOff className="mr-2 h-4 w-4" />Not retrievable
            </span>
          </div>
          <p className="mt-2 text-xs leading-5 text-zinc-500">
            Supabase stores a one-way password hash. No admin, API or database view can reveal the existing password.
          </p>
        </div>

        <div className="rounded-lg border border-sky-800/30 bg-sky-950/10 p-3">
          <div className="text-xs font-black uppercase tracking-[0.16em] text-sky-300">
            Recommended recovery
          </div>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            Send a single-use recovery link to <span className="font-black text-white">{customer.email || "the registered address"}</span>. The customer chooses the new password.
          </p>
          <button
            type="button"
            onClick={() => void runSecurityAction("send_reset_email")}
            disabled={!canManageSecurity || !customer.email || busyAction !== null}
            className="mt-3 inline-flex h-11 w-full items-center justify-center rounded-lg border border-sky-700/40 bg-sky-950/30 px-3 text-sm font-black text-sky-100 transition hover:bg-sky-900/35 disabled:cursor-not-allowed disabled:opacity-50 lg:h-10"
          >
            {busyAction === "reset" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            Send Password Reset Email
          </button>
        </div>
      </div>

      <div className="mt-3 rounded-lg border border-red-900/35 bg-black/35 p-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.16em] text-red-300">
              Owner-only replacement
            </div>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
              Replaces the login password immediately. Prefer the reset email unless direct account recovery is necessary.
            </p>
          </div>
          {!canReplacePassword ? (
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-black text-zinc-500">
              Primary Owner only
            </span>
          ) : null}
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-xs font-black uppercase tracking-[0.14em] text-zinc-500">
              New password
            </span>
            <div className="relative">
              <input
                type={showReplacementPassword ? "text" : "password"}
                value={replacementPassword}
                onChange={(event) => setReplacementPassword(event.target.value)}
                disabled={!canReplacePassword || busyAction !== null}
                autoComplete="new-password"
                spellCheck={false}
                className="h-11 w-full rounded-lg border border-white/10 bg-black/45 px-3 pr-11 text-sm font-bold text-white outline-none transition focus:border-red-700 disabled:opacity-50 lg:h-10"
              />
              <button
                type="button"
                onClick={() => setShowReplacementPassword((current) => !current)}
                disabled={!canReplacePassword}
                aria-label={showReplacementPassword ? "Hide new password" : "Show new password"}
                className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-white/5 hover:text-white disabled:opacity-40"
              >
                {showReplacementPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-black uppercase tracking-[0.14em] text-zinc-500">
              Confirm new password
            </span>
            <input
              type={showReplacementPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              disabled={!canReplacePassword || busyAction !== null}
              autoComplete="new-password"
              spellCheck={false}
              className="h-11 w-full rounded-lg border border-white/10 bg-black/45 px-3 text-sm font-bold text-white outline-none transition focus:border-red-700 disabled:opacity-50 lg:h-10"
            />
          </label>
        </div>

        <div className="mt-3 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div className="text-xs leading-5 text-zinc-500">
            {replacementPassword && !passwordValidation.valid
              ? passwordValidation.errors[0]
              : replacementPassword && !passwordsMatch
                ? "Password confirmation does not match."
                : "At least 12 characters with upper/lowercase, number and symbol."}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={generateReplacementPassword}
              disabled={!canReplacePassword || busyAction !== null}
              className="inline-flex h-11 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] px-3 text-xs font-black text-white transition hover:bg-white/[0.08] disabled:opacity-50 lg:h-10"
            >
              <WandSparkles className="mr-2 h-4 w-4" />Generate Secure Password
            </button>
            <button
              type="button"
              onClick={() => void runSecurityAction("set_replacement_password")}
              disabled={!canSubmitReplacement}
              className="inline-flex h-11 items-center justify-center rounded-lg bg-[#b1121b] px-3 text-xs font-black text-white transition hover:bg-[#c91824] disabled:cursor-not-allowed disabled:opacity-50 lg:h-10"
            >
              {busyAction === "replace" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
              Replace Password
            </button>
          </div>
        </div>
        <p className="mt-3 text-xs leading-5 text-zinc-600">
          Password values are kept only in this form until submission. They are never returned by the API or written to audit logs.
        </p>
      </div>

      {securityMessage ? (
        <div
          role={securityMessage.tone === "error" ? "alert" : "status"}
          className={`mt-4 rounded-xl border px-4 py-3 text-sm font-bold ${
            securityMessage.tone === "error"
              ? "border-red-700/40 bg-red-950/25 text-red-200"
              : "border-emerald-700/40 bg-emerald-950/20 text-emerald-200"
          }`}
        >
          {securityMessage.text}
        </div>
      ) : null}
    </section>
  );
}

function SidebarButton({ active, icon, label, count, onClick }: { active: boolean; icon: ReactNode; label: string; count: number | string; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`flex min-h-11 w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left text-sm font-black transition lg:min-h-0 ${active ? "border-red-700/50 bg-red-950/35 text-white" : "border-white/10 bg-black/25 text-zinc-400 hover:bg-white/[0.04] hover:text-white"}`}>
      <span className="flex items-center gap-2.5"><span className={active ? "text-red-400" : "text-zinc-500"}>{icon}</span>{label}</span>
      <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs">{count}</span>
    </button>
  );
}

function MiniStat({ label, value }: { label: string; value: number | string }) {
  return <div className="rounded-lg bg-black/30 p-2.5"><div className="text-[11px] text-zinc-500">{label}</div><div className="mt-0.5 text-lg font-black">{value}</div></div>;
}

function AdminOperationsOverview({
  stats,
  latestOrders,
  customerById,
  lastSyncAt,
  commandLinks,
  onFilter,
  onOpenOrder,
}: {
  stats: AdminStats;
  latestOrders: Order[];
  customerById: Map<string, Profile>;
  lastSyncAt: Date | null;
  commandLinks: AdminCommandLink[];
  onFilter: (status: string) => void;
  onOpenOrder: (order: Order) => void;
}) {
  const openWork =
    stats.newRequests +
    stats.fileCheck +
    stats.inProgress +
    stats.revisionRequested +
    stats.customerInfoNeeded;
  const attentionCount = stats.customerInfoNeeded + stats.revisionRequested;
  const fileCoverage = stats.total > 0 ? Math.round((stats.withFile / stats.total) * 100) : 0;
  const syncLabel = lastSyncAt
    ? lastSyncAt.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })
    : "Waiting for sync";
  const priority = stats.newRequests > 0
    ? { label: `${stats.newRequests} new request${stats.newRequests === 1 ? "" : "s"}`, status: "new_request" }
    : attentionCount > 0
      ? { label: `${attentionCount} item${attentionCount === 1 ? "" : "s"} need attention`, status: stats.customerInfoNeeded > 0 ? "customer_info_needed" : "revision" }
      : stats.fileCheck > 0
        ? { label: `${stats.fileCheck} file check${stats.fileCheck === 1 ? "" : "s"} waiting`, status: "file_check" }
        : stats.inProgress > 0
          ? { label: `${stats.inProgress} active order${stats.inProgress === 1 ? "" : "s"}`, status: "in_progress" }
          : { label: "Queue under control", status: "all" };
  const queueItems = [
    { label: "New", value: stats.newRequests, status: "new_request", icon: Upload, tone: "text-red-300" },
    { label: "File check", value: stats.fileCheck, status: "file_check", icon: Search, tone: "text-sky-300" },
    { label: "In progress", value: stats.inProgress, status: "in_progress", icon: Wrench, tone: "text-amber-300" },
    { label: "Needs attention", value: attentionCount, status: stats.customerInfoNeeded > 0 ? "customer_info_needed" : "revision", icon: BellRing, tone: "text-purple-300" },
  ];
  const compactStats = [
    { label: "All orders", value: stats.total },
    { label: "Open work", value: openWork },
    { label: "Customers", value: stats.customers },
    { label: "With file", value: stats.withFile },
    { label: "Completed", value: stats.completed },
    { label: "Credits used", value: stats.totalCredits },
  ];

  return (
    <section className="mb-4 min-w-0 overflow-hidden rounded-lg border border-white/10 bg-[#0b0b0c] shadow-2xl shadow-black/25">
      <div className="flex flex-col gap-2 border-b border-white/10 bg-[linear-gradient(90deg,rgba(177,18,27,0.15),transparent_58%)] px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
        <div className="min-w-0">
          <div className="text-[11px] font-black uppercase tracking-[0.18em] text-red-400">Live order desk</div>
          <h2 className="mt-0.5 text-lg font-black text-white sm:text-xl">Latest 5 orders</h2>
          <p className="mt-1 text-xs text-zinc-500">Newest customer work across every status, always shown first.</p>
        </div>
        <button
          type="button"
          onClick={() => onFilter(priority.status)}
          className="inline-flex h-11 shrink-0 items-center justify-center rounded-md border border-red-800/50 bg-red-950/35 px-3 text-xs font-black text-red-100 transition hover:border-red-600 hover:bg-red-950/55 lg:h-9"
        >
          <BellRing className="mr-2 h-4 w-4" />
          {priority.label}
        </button>
      </div>

      <div className="grid xl:grid-cols-[minmax(0,1fr)_260px]">
        <div className="min-w-0 xl:border-r xl:border-white/10">
          <div className="hidden grid-cols-[92px_minmax(0,1fr)_minmax(0,1.15fr)_minmax(90px,0.7fr)_96px] gap-2 border-b border-white/10 bg-black/30 px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-zinc-600 md:grid">
            <span>Order</span><span>Customer</span><span>Vehicle</span><span>Service</span><span>Status</span>
          </div>
          {latestOrders.length === 0 ? (
            <div className="flex min-h-56 items-center justify-center px-5 text-center text-sm text-zinc-500">
              No orders are available yet. New requests will appear here automatically.
            </div>
          ) : (
            <div className="divide-y divide-white/10">
              {latestOrders.map((order) => {
                const customer = customerById.get(order.customer_id ?? "");
                const customerLabel = customer?.customer_id || order.customer_email || "Customer unavailable";
                const customerName = customer?.full_name || customer?.company_name || order.customer_email || "-";
                const vehicle = [order.vehicle_brand, order.vehicle_model].filter(Boolean).join(" ") || "Vehicle not set";
                const vehicleDetail = [order.vehicle_generation, order.vehicle_engine].filter(Boolean).join(" · ");

                return (
                  <button
                    key={order.id}
                    type="button"
                    onClick={() => onOpenOrder(order)}
                    aria-label={`Open order ${shortId(order.id)}`}
                    className="group grid w-full min-w-0 gap-2 px-3 py-2.5 text-left transition hover:bg-white/[0.045] md:grid-cols-[92px_minmax(0,1fr)_minmax(0,1.15fr)_minmax(90px,0.7fr)_96px] md:items-center"
                  >
                    <div className="min-w-0">
                      <div className="truncate font-black text-white">#{shortId(order.id)}</div>
                      <div className="mt-0.5 truncate text-[11px] text-zinc-600">{formatDate(order.created_at)}</div>
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-xs font-black text-red-300">{customerLabel}</div>
                      <div className="mt-0.5 truncate text-xs text-zinc-500" title={customerName}>{customerName}</div>
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-bold text-zinc-100" title={vehicle}>{vehicle}</div>
                      <div className="mt-0.5 truncate text-xs text-zinc-500" title={vehicleDetail || "-"}>{vehicleDetail || "-"}</div>
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-xs font-bold text-zinc-300" title={order.service_type || "-"}>{order.service_type || "-"}</div>
                      <div className="mt-0.5 truncate text-[11px] text-zinc-600">{order.original_file_path ? "Original ready" : "No file yet"}</div>
                    </div>
                    <div className="flex min-w-0 items-center justify-between gap-2 md:justify-end">
                      <span className={`truncate rounded-full border px-2.5 py-1 text-[10px] font-black ${statusClass(order.status)}`}>{statusLabel(order.status)}</span>
                      <Eye className="h-4 w-4 shrink-0 text-zinc-600 transition group-hover:text-red-300" />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <aside className="min-w-0 bg-black/20 p-3 sm:p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.16em] text-zinc-500">Queue snapshot</div>
              <div className="mt-1 text-sm font-black text-white">Work requiring attention</div>
            </div>
            <div className="text-right">
              <div className="text-xl font-black text-white">{fileCoverage}%</div>
              <div className="text-[10px] uppercase text-zinc-600">file ready</div>
            </div>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-gradient-to-r from-red-700 via-red-500 to-emerald-400" style={{ width: `${fileCoverage}%` }} />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            {queueItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => onFilter(item.status)}
                  className="min-w-0 rounded-md border border-white/10 bg-white/[0.025] p-2.5 text-left transition hover:border-red-800/50 hover:bg-white/[0.055]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <Icon className={`h-4 w-4 ${item.tone}`} />
                    <span className="text-lg font-black text-white">{item.value}</span>
                  </div>
                  <div className="mt-2 truncate text-[11px] font-bold text-zinc-400">{item.label}</div>
                </button>
              );
            })}
          </div>

          {commandLinks.length > 0 && (
            <div className="mt-4 border-t border-white/10 pt-3">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div className="text-[11px] font-black uppercase tracking-[0.16em] text-zinc-500">Quick controls</div>
                <span className="text-[10px] text-zinc-600">{lastSyncAt ? `Synced ${syncLabel}` : syncLabel}</span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                {commandLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    title={link.detail}
                    className="flex min-h-11 min-w-0 items-center gap-2 rounded-md border border-white/10 bg-black/25 px-2.5 py-2 text-xs font-black text-zinc-300 transition hover:border-red-800/50 hover:text-white lg:min-h-0"
                  >
                    <span className="shrink-0 text-red-300">{link.icon}</span>
                    <span className="min-w-0 flex-1 truncate">{link.label}</span>
                    <span className="text-[9px] uppercase text-zinc-600">{link.badge}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>

      <div className="grid grid-cols-3 border-t border-white/10 bg-black/30 md:grid-cols-6">
        {compactStats.map((item) => (
          <div key={item.label} className="min-w-0 border-b border-r border-white/10 px-3 py-2.5 last:border-r-0 md:border-b-0">
            <div className="truncate text-[10px] font-black uppercase tracking-[0.12em] text-zinc-600">{item.label}</div>
            <div className="mt-1 text-lg font-black text-white">{item.value}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function MiniInfo({ label, value }: { label: string; value: string | number | null | undefined }) {
  return <div className="min-w-0 rounded-xl bg-white/[0.04] p-3"><div className="text-xs uppercase tracking-[0.12em] text-zinc-500">{label}</div><div title={String(value || "-")} className="mt-1 line-clamp-2 break-words font-bold text-white">{value || "-"}</div></div>;
}

function FormInput({ label, value, onChange, type = "text", min, max, step, inputMode, disabled = false }: { label: string; value: string; onChange: (value: string) => void; type?: string; min?: string; max?: string; step?: string; inputMode?: "decimal" | "numeric"; disabled?: boolean }) {
  return (
    <label>
      <div className="mb-1.5 text-[11px] font-black uppercase tracking-[0.12em] text-zinc-500">{label}</div>
      <input type={type} min={min} max={max} step={step} inputMode={inputMode} value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} className="h-11 w-full rounded-lg border border-white/10 bg-black/35 px-3 text-sm font-bold text-white outline-none placeholder:text-zinc-600 focus:border-red-700 disabled:cursor-not-allowed disabled:opacity-60 lg:h-10" />
    </label>
  );
}

function FormSelect({ label, value, onChange, options, disabled = false }: { label: string; value: string; onChange: (value: string) => void; options: string[]; disabled?: boolean }) {
  return (
    <label>
      <div className="mb-1.5 text-[11px] font-black uppercase tracking-[0.12em] text-zinc-500">{label}</div>
      <select value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} className="h-11 w-full rounded-lg border border-white/10 bg-black/35 px-3 text-sm font-bold text-white outline-none focus:border-red-700 disabled:cursor-not-allowed disabled:opacity-60 lg:h-10">
        {options.map((option) => <option key={option} value={option} className="bg-[#111]">{statusLabel(option)}</option>)}
      </select>
    </label>
  );
}

function PaymentPolicySelect({ label, value, onChange, disabled = false }: { label: string; value: PaymentOverride; onChange: (value: PaymentOverride) => void; disabled?: boolean }) {
  return <label className="text-[11px] font-black uppercase tracking-[0.12em] text-zinc-500">{label}<select value={value} onChange={(event) => onChange(event.target.value as PaymentOverride)} disabled={disabled} className="mt-1.5 h-11 w-full rounded-lg border border-white/10 bg-black/35 px-3 text-sm font-black normal-case text-white outline-none focus:border-red-700 disabled:cursor-not-allowed disabled:opacity-60 lg:h-10"><option value="inherit">Inherit global</option><option value="enabled">Enabled</option><option value="disabled">Disabled</option></select></label>;
}

function Detail({ icon, label, value }: { icon: ReactNode; label: string; value: string | number | null | undefined }) {
  return (
    <div className="flex gap-2.5 rounded-lg bg-white/[0.04] p-3">
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-red-950/40 text-red-400">{icon}</div>
      <div className="min-w-0"><div className="text-[11px] uppercase tracking-[0.12em] text-zinc-500">{label}</div><div title={String(value || "-")} className="mt-0.5 line-clamp-2 break-all text-sm font-bold text-white">{value || "-"}</div></div>
    </div>
  );
}

function OrderDetailModal({ order, customer, onClose, onDownload, onCopy, onCopyValue, onStatusChange, onDeliveryUpdate, onUploadModified, onDownloadModified, onCustomerUploadPermission, canManageOrders, canDownloadFiles, canUploadFiles, canManageMessages, updating, uploadingModified }: {
  order: Order;
  customer: Profile | null;
  onClose: () => void;
  onDownload: () => void;
  onCopy: () => void;
  onCopyValue: (value: string | null | undefined, label: string) => void;
  onStatusChange: (status: string) => void;
  onDeliveryUpdate: (estimate: DeliveryEstimate, note: string) => void;
  onUploadModified: (file: File | null, label: string) => void;
  onDownloadModified: (filePath: string) => void;
  onCustomerUploadPermission: (enabled: boolean) => void;
  canManageOrders: boolean;
  canDownloadFiles: boolean;
  canUploadFiles: boolean;
  canManageMessages: boolean;
  updating: boolean;
  uploadingModified: boolean;
}) {
  const serviceItems = splitServiceItems(order.service_type);
  const workflowStep = getWorkflowStep(order);
  const modifiedVersions = getModifiedFileVersions(order);
  const [modifiedFileLabelMode, setModifiedFileLabelMode] =
    useState<"v1" | "revision" | "final" | "custom">("v1");
  const [customModifiedFileLabel, setCustomModifiedFileLabel] = useState("");
  const modifiedFileLabel = normalizeFileVersionLabel(
    modifiedFileLabelMode === "custom"
      ? customModifiedFileLabel
      : modifiedFileLabelMode
  );
  const customLabelInvalid =
    modifiedFileLabelMode === "custom" &&
    customModifiedFileLabel.length > 0 &&
    !modifiedFileLabel;
  const [deliveryEstimate, setDeliveryEstimate] = useState<DeliveryEstimateSelection>(
    order.estimated_delivery_label ?? ""
  );
  const [deliveryNote, setDeliveryNote] = useState(
    order.estimated_delivery_label ? order.estimated_delivery_note ?? "" : ""
  );
  const hasExplicitDeliveryEstimate = deliveryEstimate !== "";
  const canSaveDeliveryEstimate =
    hasExplicitDeliveryEstimate && canManageOrders && !updating;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-x-hidden bg-black/75 p-2 backdrop-blur-sm sm:p-3">
      <div role="dialog" aria-modal="true" aria-labelledby="order-detail-title" className="max-h-[calc(100dvh-1rem)] w-full max-w-[96rem] overflow-x-hidden overflow-y-auto rounded-xl border border-white/10 bg-[#090909] shadow-2xl shadow-black sm:max-h-[calc(100dvh-1.5rem)]">
        <div className="sticky top-0 z-20 border-b border-white/10 bg-[#090909]/95 p-3 backdrop-blur-xl sm:p-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-1.5"><span className="rounded-full border border-red-800/40 bg-red-950/25 px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-red-300">Work Order #{shortId(order.id)}</span><span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${statusClass(order.status)}`}>{statusLabel(order.status)}</span><span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-bold text-zinc-400">{formatDate(order.created_at)}</span></div>
              <h2 id="order-detail-title" className="line-clamp-2 break-words text-2xl font-black md:text-3xl">{order.vehicle_brand || "-"} {order.vehicle_model || ""} <span className="text-red-500">{order.vehicle_engine || ""}</span></h2>
              <p className="mt-1 break-words text-xs text-zinc-500">{customer?.customer_id || order.customer_id || "-"} · {customer?.full_name || customer?.company_name || order.customer_email || "-"}</p>
            </div>
            <div className="grid grid-cols-2 gap-1.5 sm:flex sm:flex-wrap">
              <Link href={`/admin/requests/${order.id}`} className="inline-flex min-h-11 items-center justify-center rounded-lg border border-blue-700/35 bg-blue-950/20 px-3 text-xs font-black text-blue-200 transition hover:bg-blue-900/30 lg:h-9 lg:min-h-0"><FileDown className="mr-1.5 h-4 w-4" />Open file activity</Link>
              <button onClick={onCopy} className="min-h-11 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-xs font-black text-white transition hover:bg-white/10 lg:h-9 lg:min-h-0"><Copy className="mr-1.5 inline h-4 w-4" />Copy Order ID</button>
              <button onClick={onDownload} disabled={!order.original_file_path || !canDownloadFiles} className="min-h-11 rounded-lg bg-[#b1121b] px-3 text-xs font-black text-white transition hover:bg-[#c91824] disabled:opacity-40 lg:h-9 lg:min-h-0"><Download className="mr-1.5 inline h-4 w-4" />Download Original</button>
              {canUploadFiles && <label aria-disabled={uploadingModified || !modifiedFileLabel} className={`inline-flex min-h-11 items-center justify-center rounded-lg border border-emerald-700/40 bg-emerald-950/30 px-3 text-xs font-black text-emerald-300 transition lg:h-9 lg:min-h-0 ${uploadingModified || !modifiedFileLabel ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-emerald-900/40"}`}>{uploadingModified ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Uploading Modified</> : <><Upload className="mr-1.5 h-4 w-4" />Upload Modified</>}<input type="file" className="hidden" disabled={uploadingModified || !modifiedFileLabel} onChange={(event) => { const file = event.target.files?.[0] ?? null; if (modifiedFileLabel) onUploadModified(file, modifiedFileLabel); event.target.value = ""; }} /></label>}
              <button onClick={onClose} className="min-h-11 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-xs font-black text-white transition hover:bg-white/10 lg:h-9 lg:min-h-0"><X className="mr-1.5 inline h-4 w-4" />Close</button>
            </div>
          </div>
        </div>
        <div className="grid min-w-0 gap-4 p-3 sm:p-4 xl:grid-cols-[minmax(0,1fr)_310px]">
          <div className="min-w-0 space-y-4">
            <section className="rounded-xl border border-red-900/40 bg-red-950/20 p-4"><div className="mb-3 flex items-center justify-between gap-3"><div><div className="text-xs font-black uppercase tracking-[0.18em] text-red-400">Work Order Overview</div><h3 className="mt-0.5 text-lg font-black">Main job information</h3></div><div className="rounded-lg bg-black/30 px-3 py-2 text-right"><div className="text-[11px] text-zinc-500">Credits</div><div className="text-lg font-black text-red-400">{order.credits_required ?? 0}</div></div></div><div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4"><WorkInfo label="Customer ID" value={customer?.customer_id || order.customer_id} /><WorkInfo label="Vehicle" value={`${order.vehicle_brand || "-"} ${order.vehicle_model || ""}`} /><WorkInfo label="ECU / TCU" value={order.ecu || order.gearbox} /><WorkInfo label="Read Method" value={order.read_method} /></div></section>
            <section className="rounded-xl border border-white/10 bg-white/[0.04] p-4"><div className="mb-3 flex items-center gap-2.5"><Car className="h-5 w-5 text-red-500" /><div><h3 className="text-lg font-black">Vehicle Information</h3><p className="mt-0.5 text-xs text-zinc-500">Vehicle and identification details for this work order.</p></div></div><div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3"><Detail icon={<Car />} label="Brand" value={order.vehicle_brand} /><Detail icon={<Car />} label="Model" value={order.vehicle_model} /><Detail icon={<FileCode2 />} label="Generation" value={order.vehicle_generation} /><Detail icon={<Gauge />} label="Engine" value={order.vehicle_engine} /><Detail icon={<CalendarDays />} label="Year" value={order.vehicle_year} /><Detail icon={<Clipboard />} label="License Plate" value={order.license_plate} /></div></section>
            <section className="rounded-xl border border-white/10 bg-white/[0.04] p-4"><div className="mb-3 flex items-center gap-2.5"><Database className="h-5 w-5 text-red-500" /><div><h3 className="text-lg font-black">ECU / File Technical Data</h3><p className="mt-0.5 text-xs text-zinc-500">Technical identifiers needed for file service processing.</p></div></div><div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3"><Detail icon={<Wrench />} label="ECU / TCU" value={order.ecu} /><Detail icon={<Wrench />} label="Gearbox" value={order.gearbox} /><Detail icon={<FileCode2 />} label="Read Method" value={order.read_method} /><Detail icon={<Database />} label="HW / SW" value={order.hw_sw} /><Detail icon={<PackageCheck />} label="Master / Slave" value={order.master_slave} /><Detail icon={<FileDown />} label="Uploaded File" value={order.uploaded_file_name} /></div></section>
            <section className="rounded-xl border border-white/10 bg-white/[0.04] p-4"><div className="mb-3 flex items-center justify-between gap-3"><div><h3 className="text-lg font-black">Service Breakdown</h3><p className="mt-0.5 text-xs text-zinc-500">Requested services for this file.</p></div><div className="rounded-lg border border-red-900/40 bg-red-950/25 px-3 py-2 text-xs font-black text-red-300">{order.credits_required ?? 0} Credits</div></div>{serviceItems.length > 0 ? <div className="grid gap-2 md:grid-cols-2">{serviceItems.map((service) => <div key={service} className="flex items-center gap-2.5 rounded-lg border border-emerald-700/30 bg-emerald-950/15 p-3"><CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" /><span className="text-sm font-black text-white">{service}</span></div>)}</div> : <div className="rounded-lg bg-black/30 p-3 text-sm leading-6 text-zinc-300">{order.service_type || "-"}</div>}</section>
            <section className="rounded-xl border border-white/10 bg-white/[0.04] p-4"><h3 className="mb-3 text-lg font-black">Customer Notes</h3><div className="min-h-20 whitespace-pre-wrap rounded-lg bg-black/30 p-3 text-sm leading-6 text-zinc-300">{order.notes || "-"}</div></section>
            {canManageMessages ? <RequestChat requestId={order.id} senderRole="admin" /> : <section className="rounded-xl border border-white/10 bg-white/[0.04] p-4 text-sm text-zinc-500">Your staff role does not include customer messaging.</section>}
          </div>
          <aside className="min-w-0 self-start space-y-3 xl:sticky xl:top-[8.25rem] xl:h-fit">
            <section className="rounded-xl border border-white/10 bg-white/[0.04] p-4"><h3 className="mb-3 text-lg font-black">Status Workflow</h3><div className="mb-3 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-red-800 via-red-600 to-emerald-500 transition-all duration-700" style={{ width: `${((workflowStep + 1) / 5) * 100}%` }} /></div><div className="space-y-2">{[0, 1, 2, 3, 4].map((index) => <div key={index} className={`flex items-center gap-2.5 rounded-lg border p-2.5 ${index <= workflowStep ? "border-emerald-700/30 bg-emerald-950/10" : "border-white/10 bg-black/30"}`}><div className={`flex h-7 w-7 items-center justify-center rounded-full ${index <= workflowStep ? "bg-emerald-500/15 text-emerald-400" : "bg-white/5 text-zinc-500"}`}>{index <= workflowStep ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Clock3 className="h-3.5 w-3.5" />}</div><div className="text-sm font-black">{workflowLabel(index)}</div></div>)}</div><div className="mt-3"><select value={order.status ?? "new_request"} onChange={(event) => onStatusChange(event.target.value)} disabled={updating || !canManageOrders} className={`h-11 w-full rounded-lg border px-3 text-sm font-black outline-none disabled:opacity-60 lg:h-10 ${statusClass(order.status)}`}>{editableStatusOptions.map((status) => <option key={status} value={status} className="bg-[#111]">{statusLabel(status)}</option>)}</select>{updating && <div className="mt-2 flex items-center gap-2 text-xs text-zinc-500"><Loader2 className="h-3 w-3 animate-spin" />Updating status...</div>}</div></section>
            <section className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
              <h3 className="mb-3 text-lg font-black">Estimated Delivery</h3>
              <div
                className={`rounded-lg border p-3 ${
                  hasExplicitDeliveryEstimate
                    ? "border-red-900/40 bg-red-950/20"
                    : "border-white/10 bg-black/30"
                }`}
              >
                <div
                  className={`text-xs font-black uppercase tracking-[0.16em] ${
                    hasExplicitDeliveryEstimate ? "text-red-300" : "text-zinc-500"
                  }`}
                >
                  Customer visible SLA
                </div>
                <div className="mt-1 break-words text-base font-black text-white">
                  {formatDeliveryEstimate(deliveryEstimate)}
                </div>
              </div>
              {!hasExplicitDeliveryEstimate && (
                <p className="mt-2 text-xs font-bold leading-5 text-zinc-400">
                  Select an explicit estimate before saving. No customer-visible time estimate is saved yet.
                </p>
              )}
              <select
                value={deliveryEstimate}
                onChange={(event) => {
                  const nextEstimate = event.target.value as DeliveryEstimateSelection;
                  setDeliveryEstimate(nextEstimate);
                  if (nextEstimate === "") {
                    setDeliveryNote("");
                  }
                }}
                className="mt-3 h-11 w-full rounded-lg border border-white/10 bg-black/35 px-3 text-sm font-black text-white outline-none focus:border-red-700 lg:h-10"
              >
                <option value="" disabled className="bg-[#111]">
                  Estimate not set - choose one
                </option>
                {deliveryEstimateOptions.map((option) => (
                  <option key={option.value} value={option.value} className="bg-[#111]">
                    {option.label}
                  </option>
                ))}
              </select>
              <textarea
                value={deliveryNote}
                onChange={(event) => setDeliveryNote(event.target.value)}
                disabled={!hasExplicitDeliveryEstimate}
                placeholder={
                  hasExplicitDeliveryEstimate
                    ? "Optional note: Depends on file complexity, logs or extra checks."
                    : "Select an estimate before adding a delivery note."
                }
                className="mt-2 min-h-20 w-full resize-y rounded-lg border border-white/10 bg-black/35 px-3 py-2.5 text-sm font-bold text-white outline-none placeholder:text-zinc-600 focus:border-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              />
              <button
                onClick={() => {
                  if (!deliveryEstimate) {
                    return;
                  }
                  onDeliveryUpdate(deliveryEstimate, deliveryNote);
                }}
                disabled={!canSaveDeliveryEstimate}
                className="mt-2 flex h-11 w-full items-center justify-center rounded-lg bg-[#b1121b] px-3 text-sm font-black text-white transition hover:bg-[#c91824] disabled:opacity-50 lg:h-10"
              >
                {updating ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Clock3 className="mr-2 h-4 w-4" />
                )}
                Save Delivery Estimate
              </button>
            </section>
            <section className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
              <h3 className="mb-3 text-lg font-black">File Workflow</h3>
              <div className="grid gap-2">
                <FileStateCard title="Original File" ready={Boolean(order.original_file_path)} description={order.uploaded_file_name || order.original_file_path || "No original file uploaded."} />
                <FileStateCard title="Modified Versions" ready={modifiedVersions.length > 0} description={modifiedVersions.length > 0 ? `${modifiedVersions.length} modified file version${modifiedVersions.length === 1 ? "" : "s"} uploaded.` : "No modified file uploaded yet."} />
              </div>
              <button onClick={onDownload} disabled={!order.original_file_path || !canDownloadFiles} className="mt-3 flex h-11 w-full items-center justify-center rounded-lg bg-[#b1121b] px-3 text-sm font-black text-white transition hover:bg-[#c91824] disabled:opacity-40 lg:h-10"><Download className="mr-2 h-4 w-4" />Download Original</button>

              <div className="mt-3 rounded-lg border border-white/10 bg-black/30 p-3">
                <div className="mb-2 text-xs font-black uppercase tracking-[0.14em] text-zinc-500">Upload Version</div>
                <select aria-label="Modified file version label" value={modifiedFileLabelMode} onChange={(event) => setModifiedFileLabelMode(event.target.value as "v1" | "revision" | "final" | "custom")} className="h-11 w-full rounded-lg border border-white/10 bg-black/35 px-3 text-sm font-black text-white outline-none focus:border-red-700 lg:h-10">
                  <option value="v1" className="bg-[#111]">V1</option>
                  <option value="revision" className="bg-[#111]">Revision</option>
                  <option value="final" className="bg-[#111]">Final</option>
                  <option value="custom" className="bg-[#111]">Custom label...</option>
                </select>
                {modifiedFileLabelMode === "custom" && (
                  <div className="mt-3">
                    <div className="flex items-center justify-between gap-3">
                      <label htmlFor={`custom-version-${order.id}`} className="text-xs font-black text-zinc-300">Custom customer-visible label</label>
                      <span className="text-[11px] text-zinc-600">{customModifiedFileLabel.length}/{FILE_VERSION_LABEL_MAX_LENGTH}</span>
                    </div>
                    <input id={`custom-version-${order.id}`} aria-label="Custom version label" value={customModifiedFileLabel} onChange={(event) => setCustomModifiedFileLabel(event.target.value)} maxLength={FILE_VERSION_LABEL_MAX_LENGTH} placeholder="e.g. V15 or Final 2" autoComplete="off" className={`mt-2 h-11 w-full rounded-lg border bg-black/35 px-3 text-sm font-black text-white outline-none placeholder:text-zinc-600 lg:h-10 ${customLabelInvalid ? "border-red-600 focus:border-red-500" : "border-white/10 focus:border-red-700"}`} />
                    <p className={`mt-2 text-xs leading-5 ${customLabelInvalid ? "text-red-300" : "text-zinc-500"}`}>{customLabelInvalid ? "Use letters, numbers, spaces, dots, underscores or hyphens only." : "This label appears in the delivery history. Examples: V15, Dyno Fix, Final 2."}</p>
                  </div>
                )}
                {canUploadFiles ? <label aria-disabled={uploadingModified || !modifiedFileLabel} className={`mt-3 flex min-h-11 w-full items-center justify-center rounded-lg border border-emerald-700/40 bg-emerald-950/30 px-3 text-sm font-black text-emerald-300 transition lg:h-10 lg:min-h-0 ${uploadingModified || !modifiedFileLabel ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-emerald-900/40"}`}>{uploadingModified ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Uploading Modified</> : <><Upload className="mr-2 h-4 w-4" />{modifiedFileLabel ? `Upload ${formatFileVersionLabel(modifiedFileLabel)} File` : "Enter Version Label"}</>}<input type="file" className="hidden" disabled={uploadingModified || !modifiedFileLabel} onChange={(event) => { const file = event.target.files?.[0] ?? null; if (modifiedFileLabel) onUploadModified(file, modifiedFileLabel); event.target.value = ""; }} /></label> : <div className="mt-3 text-xs text-zinc-500">Your staff role cannot upload completed files.</div>}
              </div>

              {modifiedVersions.length > 0 && (
                <div className="mt-3 space-y-2">
                  {modifiedVersions.map((version) => (
                    <div key={version.id} className="rounded-lg border border-emerald-700/30 bg-emerald-950/15 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-black text-emerald-300">{formatFileVersionLabel(version.label)}</div>
                          <div title={version.file_name} className="mt-1 break-all text-sm font-bold text-white">{version.file_name}</div>
                          <div className="mt-1 text-xs text-zinc-500">{formatDate(version.uploaded_at)}</div>
                        </div>
                        <button onClick={() => onDownloadModified(version.file_path)} className="min-h-11 shrink-0 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-black text-white transition hover:bg-white/10 lg:min-h-0"><Download className="mr-1 inline h-3 w-3" />Download</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-3 rounded-lg border border-blue-700/30 bg-blue-950/15 p-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm font-black text-blue-200">Customer additional upload</div>
                    <p className="mt-1 text-xs leading-5 text-zinc-400">
                      Grant one-time permission for the customer to attach another file to this request.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onCustomerUploadPermission(!order.customer_upload_enabled)}
                    disabled={updating || !canManageOrders}
                    className={`min-h-11 shrink-0 rounded-lg border px-3 py-2 text-xs font-black transition lg:min-h-0 ${
                      order.customer_upload_enabled
                        ? "border-emerald-600/40 bg-emerald-950/30 text-emerald-300"
                        : "border-white/10 bg-white/[0.04] text-zinc-300"
                    }`}
                  >
                    {order.customer_upload_enabled ? "Enabled" : "Enable"}
                  </button>
                </div>

                {Array.isArray(order.customer_uploads) && order.customer_uploads.length > 0 && (
                  <div className="mt-3 space-y-2 border-t border-white/10 pt-3">
                    {order.customer_uploads.map((file) => (
                      <div key={file.id} className="flex min-w-0 items-center justify-between gap-3 rounded-xl bg-black/25 p-3">
                        <div className="min-w-0">
                          <div className="truncate text-xs font-black text-white">{file.file_name}</div>
                          <div className="mt-1 text-[11px] text-zinc-500">{formatDate(file.uploaded_at)}</div>
                        </div>
                        <button onClick={() => onDownloadModified(file.file_path)} className="min-h-11 shrink-0 rounded-lg border border-white/10 px-3 py-2 text-xs font-black lg:min-h-0">
                          <Download className="mr-1 inline h-3 w-3" />Download
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
            <section className="rounded-xl border border-white/10 bg-white/[0.04] p-4"><h3 className="mb-3 text-lg font-black">Customer Contact</h3><div className="space-y-2"><Detail icon={<User />} label="Customer ID" value={customer?.customer_id || order.customer_id} /><Detail icon={<Mail />} label="Login Email" value={order.customer_email} /><Detail icon={<User />} label="Full Name" value={customer?.full_name} /><Detail icon={<Building2 />} label="Company" value={customer?.company_name} /><Detail icon={<Phone />} label="Phone" value={customer?.phone} /><Detail icon={<MapPin />} label="Address" value={[customer?.street, customer?.postal_code, customer?.city, customer?.country].filter(Boolean).join(", ") || null} /></div><div className="mt-3 grid gap-2"><button onClick={() => onCopyValue(customer?.customer_id || order.customer_id, "Customer ID")} className="h-11 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-xs font-black text-white transition hover:bg-white/10 lg:h-10"><Copy className="mr-2 inline h-4 w-4" />Copy Customer ID</button><button onClick={() => onCopyValue(order.customer_email, "Customer Email")} className="h-11 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-xs font-black text-white transition hover:bg-white/10 lg:h-10"><Mail className="mr-2 inline h-4 w-4" />Copy Email</button><button onClick={() => onCopyValue(customer?.phone, "Phone")} className="h-11 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-xs font-black text-white transition hover:bg-white/10 lg:h-10"><Phone className="mr-2 inline h-4 w-4" />Copy Phone</button>{order.customer_email && <a href={`mailto:${order.customer_email}`} className="flex h-11 w-full items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] px-3 text-xs font-black text-white transition hover:bg-white/10 lg:h-10"><Mail className="mr-2 h-4 w-4" />Email Customer</a>}</div></section>
          </aside>
        </div>
      </div>
    </div>
  );
}

function WorkInfo({ label, value }: { label: string; value: string | number | null | undefined }) {
  return <div className="rounded-lg border border-white/10 bg-black/30 p-3"><div className="text-[11px] font-black uppercase tracking-[0.12em] text-zinc-500">{label}</div><div title={String(value || "-")} className="mt-1 line-clamp-2 break-all text-sm font-black text-white">{value || "-"}</div></div>;
}

function FileStateCard({ title, ready, description }: { title: string; ready: boolean; description: string }) {
  return <div className={`rounded-lg border p-3 ${ready ? "border-emerald-700/30 bg-emerald-950/15" : "border-white/10 bg-black/30"}`}><div className="flex items-center gap-2.5"><div className={`flex h-7 w-7 items-center justify-center rounded-full ${ready ? "bg-emerald-500/15 text-emerald-400" : "bg-white/5 text-zinc-500"}`}>{ready ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Clock3 className="h-3.5 w-3.5" />}</div><div><div className="text-sm font-black">{title}</div><div className="text-[11px] leading-4 text-zinc-500">{ready ? "Ready" : "Waiting"}</div></div></div><div title={description} className="mt-2 line-clamp-2 break-all text-xs leading-5 text-zinc-400">{description}</div></div>;
}
