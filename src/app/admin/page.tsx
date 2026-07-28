"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { authenticatedFetch, getStableSession, notifySessionRequired, signOutIfEmailUnverified } from "@/lib/authGuards";
import { supabase } from "@/lib/supabaseClient";
import { resolveAdminAccess } from "@/lib/adminAccessClient";
import RequestChat from "@/components/RequestChat";
import {
  hasStaffPermission,
  isPrimaryOwner,
  type StaffAccess,
} from "@/lib/staffPermissions";
import { countCompletedToday } from "@/lib/adminDashboardMetrics";
import {
  ArrowLeft,
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
  FileCode2,
  FileDown,
  Gauge,
  Loader2,
  Lock,
  Mail,
  MapPin,
  MinusCircle,
  PackageCheck,
  Phone,
  RefreshCcw,
  Save,
  Search,
  Settings,
  ShieldCheck,
  Tags,
  Upload,
  User,
  Users,
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
  label: "v1" | "revision" | "final";
  file_name: string;
  file_path: string;
  uploaded_at: string;
};

type CustomerTag = "workshop" | "reseller" | "vip" | "blocked" | "negative_credit";
type PaymentOverride = "inherit" | "enabled" | "disabled";

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
  credit_price_override_eur: string;
  commercial_adjustment_type: "none" | "percentage" | "fixed";
  commercial_adjustment_value: string;
  payment_stripe: PaymentOverride;
  payment_bank: PaymentOverride;
  commercial_internal_note: string;
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

function formatFileVersionLabel(label: ModifiedFileVersion["label"]) {
  if (label === "v1") return "V1";
  if (label === "revision") return "Revision";
  return "Final";
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
    credit_price_override_eur: "",
    commercial_adjustment_type: "none",
    commercial_adjustment_value: "0",
    payment_stripe: "inherit",
    payment_bank: "inherit",
    commercial_internal_note: "",
    effective_custom_unit_price_eur: "",
  };
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
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<AdminTab>("orders");
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Profile[]>([]);
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
  const [creditUpdatingId, setCreditUpdatingId] = useState<string | null>(null);
  const [customerSavingId, setCustomerSavingId] = useState<string | null>(null);
  const [uploadingModifiedId, setUploadingModifiedId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [adminLoadError, setAdminLoadError] = useState("");
  const [adminDataReady, setAdminDataReady] = useState(false);
  const [autoRefreshing, setAutoRefreshing] = useState(false);
  const [newOrderNotice, setNewOrderNotice] = useState("");
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const [adminAccess, setAdminAccess] = useState<StaffAccess | null>(null);
  const [adminAccessDenied, setAdminAccessDenied] = useState(false);

  const knownOrderIdsRef = useRef<Set<string>>(new Set());
  const initialOrdersLoadedRef = useRef(false);
  const hasLoadedAdminDataRef = useRef(false);
  const adminRefreshInFlightRef = useRef(false);

  async function loadAdminData(options?: { silent?: boolean }) {
    const silent = Boolean(options?.silent);
    if (silent) setAutoRefreshing(true);
    else setLoading(true);
    setMessage("");
    setAdminLoadError("");

    const { session } = await getStableSession();
    const user = session?.user;

    if (!user) {
      setLoading(false);
      setAutoRefreshing(false);

      if (silent && hasLoadedAdminDataRef.current) {
        // A background auth refresh can briefly expose no session while the
        // persisted token is being synchronized. Keep the last verified admin
        // view and retry on the next polling cycle without alarming the user.
        return;
      }

      notifySessionRequired();
      return;
    }

    if (await signOutIfEmailUnverified(user)) {
      setLoading(false);
      setAutoRefreshing(false);
      router.replace("/login?verify_email=1");
      return;
    }

    const accessResolution = await resolveAdminAccess(user.id);

    if (accessResolution.state === "unavailable") {
      if (!silent || !hasLoadedAdminDataRef.current) {
        setAdminLoadError(ADMIN_LOAD_ERROR_MESSAGE);
      }
      setLoading(false);
      setAutoRefreshing(false);
      return;
    }

    if (accessResolution.state === "denied") {
      setAdminAccess(null);
      setAdminAccessDenied(true);
      setAdminDataReady(false);
      setAdminLoadError("");
      setLoading(false);
      setAutoRefreshing(false);
      return;
    }

    const access = accessResolution.access;
    setAdminAccess(access);
    setAdminAccessDenied(false);

    const { data, error } = await supabase.from("orders").select("*").order("created_at", { ascending: false });
    if (error) {
      if (!silent || !hasLoadedAdminDataRef.current) setAdminLoadError(ADMIN_LOAD_ERROR_MESSAGE);
      setLoading(false);
      setAutoRefreshing(false);
      return;
    }

    const customerSelect =
      "id, email, customer_id, full_name, role, credit_balance, account_type, company_name, phone, street, postal_code, city, country, vat_id, invoice_email, preferred_contact, allow_negative_credits, negative_credit_limit, account_status, customer_tags, internal_admin_note, created_at";
    const fallbackCustomerSelect =
      "id, email, customer_id, full_name, role, credit_balance, account_type, company_name, phone, street, postal_code, city, country, vat_id, invoice_email, preferred_contact, allow_negative_credits, negative_credit_limit, account_status, internal_admin_note, created_at";

    let profileList: Record<string, unknown>[] | null = [];
    let customerError = null as { code?: string; message: string } | null;

    if (hasStaffPermission(access, "customers.view")) {
      const customerResult = await supabase
        .from("profiles")
        .select(customerSelect)
        .order("created_at", { ascending: false });
      profileList = customerResult.data;
      customerError = customerResult.error;
    }

    if (hasStaffPermission(access, "customers.view") && customerError?.code === "42703") {
      const fallback = await supabase
        .from("profiles")
        .select(fallbackCustomerSelect)
        .order("created_at", { ascending: false });

      profileList = fallback.data
        ? fallback.data.map((customer) => ({
            ...customer,
            customer_tags: [],
          }))
        : null;
      customerError = fallback.error;
    }

    if (customerError) {
      if (!silent || !hasLoadedAdminDataRef.current) setAdminLoadError(ADMIN_LOAD_ERROR_MESSAGE);
      setLoading(false);
      setAutoRefreshing(false);
      return;
    }

    const nextOrders = (data ?? []) as Order[];
    const nextCustomers = (profileList ?? []) as unknown as Profile[];

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
    initialOrdersLoadedRef.current = true;
    hasLoadedAdminDataRef.current = true;

    setOrders(nextOrders);
    setCustomers(nextCustomers);
    setSelectedOrder((current) => (current ? nextOrders.find((order) => order.id === current.id) ?? current : null));
    setSelectedCustomer((current) => {
      if (!current) return null;
      const updated = nextCustomers.find((customer) => customer.id === current.id) ?? current;
      setCustomerForm(makeCustomerForm(updated));
      return updated;
    });
    setAdminLoadError("");
    setAdminDataReady(true);
    setLastSyncAt(new Date());
    setLoading(false);
    setAutoRefreshing(false);
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => { void loadAdminData(); }, 0);
    return () => window.clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const refreshAdminData = () => {
      if (
        !hasLoadedAdminDataRef.current ||
        adminRefreshInFlightRef.current ||
        document.visibilityState !== "visible"
      ) {
        return;
      }

      adminRefreshInFlightRef.current = true;
      void loadAdminData({ silent: true }).finally(() => {
        adminRefreshInFlightRef.current = false;
      });
    };

    const interval = window.setInterval(refreshAdminData, 10000);
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") refreshAdminData();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  async function openCustomer(customer: Profile) {
    setSelectedCustomer(customer);
    setCustomerForm(makeCustomerForm(customer));
    try {
      const response = await authenticatedFetch(`/api/admin/customers/${customer.id}/commercial-policy`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Customer pricing policy could not be loaded.");
      const policy = payload.policy;
      setCustomerForm((current) => current ? {
        ...current,
        credit_price_override_eur: policy.credit_price_override_eur == null ? "" : String(policy.credit_price_override_eur),
        commercial_adjustment_type: policy.adjustment_type || "none",
        commercial_adjustment_value: String(policy.adjustment_value || 0),
        payment_stripe: paymentOverride(policy.payment_stripe_enabled),
        payment_bank: paymentOverride(policy.payment_bank_enabled),
        commercial_internal_note: policy.internal_note || "",
        effective_custom_unit_price_eur: String(payload.effectiveQuote?.customUnitPriceEuro ?? ""),
      } : current);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Customer pricing policy could not be loaded.");
    }
  }

  async function adjustCredits(customer: Profile, amount: number, note?: string) {
    if (!hasStaffPermission(adminAccess, "credits.manage")) {
      setMessage("Your staff role cannot adjust customer credits.");
      return;
    }
    if (!Number.isFinite(amount) || amount === 0) {
      setMessage("Please enter a valid credit amount.");
      return;
    }

    setCreditUpdatingId(customer.id);
    setMessage("");

    const { data, error } = await supabase.rpc("staff_adjust_customer_credits", {
      p_customer_id: customer.id,
      p_amount: amount,
      p_note: note || `Admin credit adjustment for ${customer.email ?? customer.customer_id ?? customer.id}`,
    });

    setCreditUpdatingId(null);
    if (error) {
      setMessage(error.message);
      return;
    }

    const newBalance = Number(data ?? Number(customer.credit_balance ?? 0) + amount);
    setCustomers((current) => current.map((item) => (item.id === customer.id ? { ...item, credit_balance: newBalance } : item)));
    setSelectedCustomer((current) => (current?.id === customer.id ? { ...current, credit_balance: newBalance } : current));
    setCreditInputs((current) => ({ ...current, [customer.id]: "" }));
    setCreditNotes((current) => ({ ...current, [customer.id]: "" }));
    setMessage(`${amount > 0 ? "+" : ""}${amount} credits adjusted for ${customer.customer_id ?? customer.email ?? "customer"}. Ledger entry created.`);
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
    setCustomerSavingId(selectedCustomer.id);
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
      allow_negative_credits: customerForm.allow_negative_credits,
      negative_credit_limit: Number(customerForm.negative_credit_limit || 0),
      account_status: customerForm.account_status,
      customer_tags: customerForm.customer_tags,
      internal_admin_note: customerForm.internal_admin_note.trim() || null,
    };

    let { error } = await supabase.from("profiles").update(updatePayload).eq("id", selectedCustomer.id);
    let tagsSkipped = false;

    if (error?.code === "42703") {
      const payloadWithoutTags: Partial<typeof updatePayload> = {
        ...updatePayload,
      };
      delete payloadWithoutTags.customer_tags;
      const retry = await supabase
        .from("profiles")
        .update(payloadWithoutTags)
        .eq("id", selectedCustomer.id);

      error = retry.error;
      tagsSkipped = true;
    }

    if (error) {
      setCustomerSavingId(null);
      setMessage(error.message);
      return;
    }

    if (hasStaffPermission(adminAccess, "credits.manage")) {
      try {
        const response = await authenticatedFetch(`/api/admin/customers/${selectedCustomer.id}/commercial-policy`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            creditPriceOverrideEuro: customerForm.credit_price_override_eur.trim() ? Number(customerForm.credit_price_override_eur) : null,
            adjustmentType: customerForm.commercial_adjustment_type,
            adjustmentValue: Number(customerForm.commercial_adjustment_value || 0),
            paymentMethods: {
              stripe: paymentOverrideValue(customerForm.payment_stripe),
              bank: paymentOverrideValue(customerForm.payment_bank),
            },
            internalNote: customerForm.commercial_internal_note.trim() || null,
          }),
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Customer commercial policy could not be saved.");
        setCustomerForm((current) => current ? { ...current, effective_custom_unit_price_eur: String(payload.effectiveQuote?.customUnitPriceEuro ?? "") } : current);
      } catch (commercialError) {
        setCustomerSavingId(null);
        setMessage(`Customer profile saved, but pricing policy failed: ${commercialError instanceof Error ? commercialError.message : "Unknown error"}`);
        return;
      }
    }

    setCustomerSavingId(null);

    const updatedCustomer = { ...selectedCustomer, ...updatePayload } as Profile;
    setCustomers((current) => current.map((customer) => (customer.id === selectedCustomer.id ? updatedCustomer : customer)));
    setSelectedCustomer(updatedCustomer);
    setMessage(
      tagsSkipped
        ? `${selectedCustomer.customer_id ?? selectedCustomer.email ?? "Customer"} updated. Customer tags need the Supabase SQL column before they can be saved.`
        : `${selectedCustomer.customer_id ?? selectedCustomer.email ?? "Customer"} updated.`
    );
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

    const { error } = await supabase
      .from("orders")
      .update({
        estimated_delivery_label: estimate,
        estimated_delivery_note: note.trim() || null,
      })
      .eq("id", orderId);

    setUpdatingId(null);

    if (error?.code === "42703") {
      setMessage(
        "Estimated delivery needs the Supabase SQL column before it can be saved."
      );
      return;
    }

    if (error) {
      setMessage(error.message);
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
    label: ModifiedFileVersion["label"]
  ) {
    if (!hasStaffPermission(adminAccess, "files.upload")) {
      setMessage("Your staff role cannot upload completed files.");
      return;
    }
    if (!file) return;
    setUploadingModifiedId(order.id);
    setMessage("");
    const safeFileName = file.name.replaceAll(" ", "_").replace(/[^a-zA-Z0-9._-]/g, "");
    const customerFolder = order.customer_id ?? "unknown-customer";
    const timestamp = Date.now();
    const filePath = `${customerFolder}/modified/${order.id}/${label}/${timestamp}-${safeFileName}`;
    const { error: uploadError } = await supabase.storage.from("customer-files").upload(filePath, file, { cacheControl: "3600", upsert: false });
    if (uploadError) {
      setUploadingModifiedId(null);
      setMessage(uploadError.message);
      return;
    }

    const version: ModifiedFileVersion = {
      id: `${label}-${timestamp}`,
      label,
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
        label,
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
    setMessage(`${formatFileVersionLabel(label)} modified file uploaded and the order was completed.`);
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
        <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-6 py-5">
          <Loader2 className="h-5 w-5 animate-spin text-red-500" />
          Loading admin panel...
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
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-3 px-4 py-4 sm:py-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-red-800/50 bg-[#111] shadow-lg shadow-red-950/40 sm:h-12 sm:w-12">
              <ShieldCheck className="h-6 w-6 text-red-600 sm:h-7 sm:w-7" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-lg font-black tracking-wide sm:text-xl">MG <span className="text-red-600">AUTOTECH</span></div>
              <div className="truncate text-xs text-zinc-400">File Service Admin Operations</div>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <div className="hidden rounded-xl border border-emerald-700/30 bg-emerald-950/20 px-4 py-3 text-xs font-black text-emerald-300 lg:block">
              {autoRefreshing ? "Syncing..." : lastSyncAt ? `Synced ${lastSyncAt.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}` : "Live Sync"}
            </div>
            <button onClick={() => loadAdminData()} className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3 text-sm font-bold text-white transition hover:bg-white/10 sm:px-4">
              <RefreshCcw className={`mr-2 inline h-4 w-4 ${autoRefreshing ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <Link href="/dashboard" className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3 text-sm font-bold text-white transition hover:bg-white/10 sm:px-4">
              <ArrowLeft className="mr-2 inline h-4 w-4" />
              <span className="hidden sm:inline">Dashboard</span>
            </Link>
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-[1600px] min-w-0 gap-5 px-3 py-6 sm:px-4 sm:py-8 xl:grid-cols-[260px_1fr]">
        <aside className="h-fit min-w-0 rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4 shadow-2xl shadow-black/20 sm:rounded-[2rem] xl:sticky xl:top-28">
          <div className="mb-4 px-3">
            <div className="text-xs font-black uppercase tracking-[0.22em] text-zinc-500">Admin Workspace</div>
            <div className="mt-1 text-lg font-black text-white">Operations</div>
          </div>
          <nav className="space-y-2">
            <SidebarButton active={activeTab === "orders"} icon={<FileCode2 />} label="Orders" count={stats.total} onClick={() => setActiveTab("orders")} />
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
              <SidebarButton active={activeTab === "customers"} icon={<Users />} label="Customers" count={stats.customers} onClick={() => setActiveTab("customers")} />
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
          <div className="mt-5 rounded-2xl border border-red-900/40 bg-red-950/20 p-4">
            <div className="text-xs font-black uppercase tracking-[0.18em] text-red-300">Open Work</div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-center">
              <MiniStat label="New" value={stats.newRequests} />
              <MiniStat label="Progress" value={stats.inProgress} />
            </div>
          </div>
        </aside>

        <div className="min-w-0">
          <div className="mb-5">
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-red-800/50 bg-red-950/25 px-4 py-2 text-sm font-semibold text-red-100">
              <Database className="h-4 w-4 text-red-500" />
              Live management
            </div>
            <h1 className="text-3xl font-black md:text-4xl">Admin <span className="text-red-600">Control Panel</span></h1>
            <p className="mt-2 max-w-3xl text-sm text-zinc-400">Live orders, queue priorities and operational controls in one workspace.</p>
          </div>

          <AdminOperationsOverview
            stats={stats}
            latestOrders={latestOrders}
            customerById={customerById}
            lastSyncAt={lastSyncAt}
            commandLinks={adminCommandLinks}
            onFilter={focusOrderQueue}
            onOpenOrder={setSelectedOrder}
          />

          {newOrderNotice && (
            <div className="mb-6 flex items-center gap-3 rounded-2xl border border-emerald-700/40 bg-emerald-950/30 p-4 text-sm font-black text-emerald-200 shadow-xl shadow-emerald-950/20">
              <BellRing className="h-5 w-5 text-emerald-300" />
              {newOrderNotice}
            </div>
          )}

          {message && (
            <div className="mb-6 rounded-2xl border border-red-800/50 bg-red-950/30 p-4 text-sm text-red-200">{message}</div>
          )}

          {showInitialAdminLoadError ? (
            <AdminLoadErrorState
              message={adminLoadError}
              retrying={loading || autoRefreshing}
              onRetry={() => loadAdminData()}
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
              creditUpdatingId={creditUpdatingId}
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
          setCreditInput={(value) => setCreditInputs((current) => ({ ...current, [selectedCustomer.id]: value }))}
          creditNote={creditNotes[selectedCustomer.id] ?? ""}
          setCreditNote={(value) => setCreditNotes((current) => ({ ...current, [selectedCustomer.id]: value }))}
          creditUpdating={creditUpdatingId === selectedCustomer.id}
          saving={customerSavingId === selectedCustomer.id}
          onClose={() => {
            setSelectedCustomer(null);
            setCustomerForm(null);
          }}
          onSave={saveCustomerSettings}
          onQuickAdjust={(amount) => quickAdjustCredits(selectedCustomer, amount)}
          onCustomAdjust={() => handleCustomCreditAdjust(selectedCustomer)}
          onCopyValue={copyValue}
        />
      )}
    </main>
  );
}

function AdminLoadErrorState({ message, retrying, onRetry }: { message: string; retrying: boolean; onRetry: () => void }) {
  return (
    <section role="alert" className="rounded-[2rem] border border-red-800/50 bg-red-950/20 p-6 text-red-100 sm:p-8">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-red-700/40 bg-red-950/40 text-red-200">
            <Database className="h-6 w-6" />
          </div>
          <h2 className="break-words text-2xl font-black text-white">Admin data sync failed</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-red-100/80">{message}</p>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">
            The queue is not shown until orders and customers load successfully, so this screen cannot be mistaken for an empty operation list.
          </p>
        </div>
        <button
          type="button"
          onClick={onRetry}
          disabled={retrying}
          className="inline-flex h-11 shrink-0 items-center justify-center rounded-xl border border-red-500/40 bg-red-600 px-4 text-sm font-black text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCcw className={`mr-2 h-4 w-4 ${retrying ? "animate-spin" : ""}`} />
          Try again
        </button>
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
    <section id="admin-order-list" className="min-w-0 scroll-mt-28 rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4 shadow-2xl shadow-black/20 sm:rounded-[2rem] sm:p-5">
      <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <h2 className="text-2xl font-black">Orders</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Showing {visibleOrders.length} of {statusFilteredGroupedOrders.length} in this view.
          </p>
        </div>

        <div className="flex min-w-0 flex-col gap-3 md:flex-row md:items-center">
          <div className="relative min-w-0">
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

      <div className="mb-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
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
              className={`min-w-0 rounded-2xl border p-4 text-left transition ${
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
              <div className="mt-2 text-xs leading-5 text-zinc-500">
                {group.description}
              </div>
            </button>
          );
        })}
      </div>

      <div className="mb-5 flex min-w-0 flex-wrap gap-2 pb-1">
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
              className={`rounded-xl border px-3 py-3 text-sm font-black transition sm:px-4 ${
                active ? "border-red-700 bg-red-950/40 text-white" : "border-white/10 bg-black/30 text-zinc-400 hover:text-white"
              }`}
            >
              {status === "all" ? "All" : statusLabel(status)}
              <span className="ml-2 rounded-full bg-white/10 px-2 py-0.5 text-xs">{count}</span>
            </button>
          );
        })}
      </div>

      <div className="hidden overflow-hidden rounded-2xl border border-white/10 xl:block">
        <table className="w-full table-fixed border-collapse text-left text-sm">
          <colgroup>
            <col className="w-[8%]" />
            <col className="w-[15%]" />
            <col className="w-[12%]" />
            <col className="w-[13%]" />
            <col className="w-[11%]" />
            <col className="w-[7%]" />
            <col className="w-[14%]" />
            <col className="w-[12%]" />
            <col className="w-[8%]" />
          </colgroup>
          <thead className="bg-black/50 text-xs uppercase tracking-[0.14em] text-zinc-500">
            <tr>
              <th className="px-3 py-4">Order</th>
              <th className="px-3 py-4">Customer</th>
              <th className="px-3 py-4">Vehicle</th>
              <th className="px-3 py-4">ECU / Read</th>
              <th className="px-3 py-4">Service</th>
              <th className="px-3 py-4">Credits</th>
              <th className="px-3 py-4">Status</th>
              <th className="px-3 py-4">File</th>
              <th className="px-3 py-4 text-center">Actions</th>
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
                  <td className="px-3 py-4 align-top">
                    <div className="truncate font-black text-white">#{shortId(order.id)}</div>
                    <div className="mt-1 flex items-center gap-1 text-xs text-zinc-500">
                      <CalendarDays className="h-3 w-3" />
                      {formatDate(order.created_at)}
                    </div>
                  </td>
                  <td className="px-3 py-4 align-top">
                    <div className="truncate font-bold text-white">{order.customer_email || "-"}</div>
                    <div className="mt-1 text-xs font-black text-red-400">
                      {customerById.get(order.customer_id ?? "")?.customer_id || (order.customer_id ? order.customer_id.slice(0, 8) : "-")}
                    </div>
                    <div className="mt-1 max-w-[180px] truncate text-xs text-zinc-500">
                      {customerById.get(order.customer_id ?? "")?.full_name || customerById.get(order.customer_id ?? "")?.company_name || "-"}
                    </div>
                  </td>
                  <td className="px-3 py-4 align-top">
                    <div className="line-clamp-2 font-black">{order.vehicle_brand || "-"} {order.vehicle_model || ""}</div>
                    <div className="mt-1 line-clamp-2 text-xs text-zinc-500">{order.vehicle_generation || "-"} · {order.vehicle_engine || "-"}</div>
                  </td>
                  <td className="px-3 py-4 align-top">
                    <div className="line-clamp-3 font-bold">{order.ecu || "-"}</div>
                    <div className="mt-1 line-clamp-2 text-xs text-zinc-500">{order.read_method || "-"} · {order.gearbox || "-"}</div>
                  </td>
                  <td className="px-3 py-4 align-top"><div className="line-clamp-2 font-bold text-zinc-200">{order.service_type || "-"}</div></td>
                  <td className="px-3 py-4 align-top"><div className="rounded-xl bg-red-950/30 px-3 py-2 text-center font-black text-red-300">{order.credits_required ?? 0}</div></td>
                  <td className="px-3 py-4 align-top">
                    <select
                      value={order.status ?? "new_request"}
                      onChange={(event) => updateStatus(order.id, event.target.value)}
                      disabled={updatingId === order.id}
                      className={`w-full rounded-xl border px-3 py-2 text-xs font-black outline-none ${statusClass(order.status)}`}
                    >
                      {editableStatusOptions.map((status) => <option key={status} value={status} className="bg-[#111]">{statusLabel(status)}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-4 align-top">
                    {order.original_file_path ? (
                      <div className="rounded-xl border border-emerald-700/40 bg-emerald-950/25 px-3 py-2 text-xs font-bold text-emerald-300">Original Ready</div>
                    ) : (
                      <div className="rounded-xl border border-zinc-700/40 bg-zinc-900/40 px-3 py-2 text-xs font-bold text-zinc-500">No Original</div>
                    )}
                    {order.modified_file_path && <div className="mt-1 rounded-xl border border-blue-700/40 bg-blue-950/25 px-3 py-2 text-xs font-bold text-blue-300">Modified Ready</div>}
                    <div title={order.uploaded_file_name || "-"} className="mt-1 max-w-full truncate text-xs text-zinc-500">{order.uploaded_file_name || "-"}</div>
                  </td>
                  <td className="px-3 py-4 text-center align-top">
                    <button
                      type="button"
                      onClick={() => setSelectedOrder(order)}
                      className="inline-flex h-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] px-4 text-xs font-black text-white transition hover:border-red-700/50 hover:bg-red-950/30"
                    >
                      <Eye className="mr-2 h-4 w-4" />
                      Details
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="space-y-4 xl:hidden">
        {statusFilteredGroupedOrders.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-black/30 p-8 text-center text-zinc-500">No orders found.</div>
        ) : (
          visibleOrders.map((order) => (
            <div key={order.id} className="min-w-0 rounded-2xl border border-white/10 bg-black/30 p-4 sm:p-5">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="break-words text-lg font-black">{order.vehicle_brand || "-"} {order.vehicle_model || ""}</div>
                  <div className="mt-1 break-words text-sm text-zinc-500">#{shortId(order.id)} · {formatDate(order.created_at)}</div>
                </div>
                <span className={`shrink-0 rounded-full border px-3 py-1 text-xs font-bold ${statusClass(order.status)}`}>{statusLabel(order.status)}</span>
              </div>
              <div className="grid gap-3 text-sm md:grid-cols-2">
                <MiniInfo label="Customer" value={customerById.get(order.customer_id ?? "")?.customer_id || order.customer_email} />
                <MiniInfo label="Engine" value={order.vehicle_engine} />
                <MiniInfo label="ECU" value={order.ecu} />
                <MiniInfo label="Service" value={order.service_type} />
              </div>
              <div className="mt-4 grid gap-2 md:grid-cols-[1fr_auto]">
                <select
                  value={order.status ?? "new_request"}
                  onChange={(event) => updateStatus(order.id, event.target.value)}
                  disabled={updatingId === order.id}
                  className={`h-11 rounded-xl border px-3 text-xs font-black outline-none ${statusClass(order.status)}`}
                >
                  {editableStatusOptions.map((status) => <option key={status} value={status} className="bg-[#111]">{statusLabel(status)}</option>)}
                </select>
                <button onClick={() => setSelectedOrder(order)} className="h-11 rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm font-black text-white transition hover:border-red-700/50 hover:bg-red-950/30">
                  <Eye className="mr-2 inline h-4 w-4" />
                  Details
                </button>
              </div>
            </div>
          ))
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
  creditUpdatingId,
  openCustomer,
  quickAdjustCredits,
}: {
  customers: Profile[];
  filteredCustomers: Profile[];
  customerSearch: string;
  setCustomerSearch: (value: string) => void;
  creditUpdatingId: string | null;
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
                        <button key={amount} onClick={() => quickAdjustCredits(customer, amount)} disabled={creditUpdatingId === customer.id} className="rounded-xl border border-emerald-700/40 bg-emerald-950/30 px-3 py-2 text-xs font-black text-emerald-300 transition hover:bg-emerald-900/40 disabled:opacity-50">+{amount}</button>
                      ))}
                      <button onClick={() => quickAdjustCredits(customer, -10)} disabled={creditUpdatingId === customer.id} className="rounded-xl border border-red-700/40 bg-red-950/30 px-3 py-2 text-xs font-black text-red-300 transition hover:bg-red-900/40 disabled:opacity-50">-10</button>
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
              {[10, 25, 50, 100].map((amount) => <button key={amount} onClick={() => quickAdjustCredits(customer, amount)} disabled={creditUpdatingId === customer.id} className="rounded-xl border border-emerald-700/40 bg-emerald-950/30 px-3 py-2 text-xs font-black text-emerald-300 disabled:opacity-50">+{amount}</button>)}
              <button onClick={() => quickAdjustCredits(customer, -10)} disabled={creditUpdatingId === customer.id} className="rounded-xl border border-red-700/40 bg-red-950/30 px-3 py-2 text-xs font-black text-red-300 disabled:opacity-50">-10</button>
            </div>
            <button onClick={() => openCustomer(customer)} className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm font-black text-white"><Settings className="mr-2 inline h-4 w-4" />Manage Customer</button>
          </div>
        ))}
      </div>
    </section>
  );
}

function CustomerDetailModal({ customer, form, setForm, creditInput, setCreditInput, creditNote, setCreditNote, creditUpdating, saving, onClose, onSave, onQuickAdjust, onCustomAdjust, onCopyValue }: {
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
  onQuickAdjust: (amount: number) => void;
  onCustomAdjust: () => void;
  onCopyValue: (value: string | null | undefined, label: string) => void;
}) {
  const accountCreatedLabel = customer.created_at
    ? `Account created ${formatDate(customer.created_at)}`
    : "Account creation date unavailable";
  const updateForm = <K extends keyof CustomerForm>(key: K, value: CustomerForm[K]) => setForm((current) => current ? { ...current, [key]: value } : current);
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
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/75 px-4 py-6 backdrop-blur-sm">
      <div className="max-h-[94vh] w-full max-w-6xl overflow-auto rounded-[2rem] border border-white/10 bg-[#090909] shadow-2xl shadow-black">
        <div className="sticky top-0 z-10 border-b border-white/10 bg-[#090909]/95 p-5 backdrop-blur-xl">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-red-800/40 bg-red-950/25 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-red-300">{customer.customer_id || customer.id}</span>
                <span className={`rounded-full border px-3 py-1 text-xs font-black ${accountStatusClass(form.account_status)}`}>{statusLabel(form.account_status)}</span>
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-bold text-zinc-400">Balance: {Number(customer.credit_balance ?? 0)} credits</span>
                <span className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-bold text-zinc-400" title="Customer account creation date">
                  <CalendarDays className="mr-1.5 h-3.5 w-3.5 text-red-400" />
                  {accountCreatedLabel}
                </span>
                {form.customer_tags.map((tag) => (
                  <span key={tag} className={`rounded-full border px-3 py-1 text-xs font-black ${customerTagClass(tag)}`}>
                    {customerTagLabel(tag)}
                  </span>
                ))}
              </div>
              <h2 className="text-3xl font-black md:text-4xl">{customer.full_name || customer.company_name || customer.email || "Customer"}</h2>
              <p className="mt-2 text-sm text-zinc-500">{customer.email}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => onCopyValue(customer.customer_id || customer.id, "Customer ID")} className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-black text-white transition hover:bg-white/10"><Copy className="mr-2 inline h-4 w-4" />Copy ID</button>
              <button onClick={onSave} disabled={saving} className="rounded-xl bg-[#b1121b] px-4 py-3 text-sm font-black text-white transition hover:bg-[#c91824] disabled:opacity-50">{saving ? <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> : <Save className="mr-2 inline h-4 w-4" />}Save Customer</button>
              <button onClick={onClose} className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-black text-white transition hover:bg-white/10"><X className="mr-2 inline h-4 w-4" />Close</button>
            </div>
          </div>
        </div>
        <div className="grid gap-6 p-5 xl:grid-cols-[1fr_360px]">
          <div className="space-y-6">
            <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
              <h3 className="mb-5 text-2xl font-black">Customer Profile</h3>
              <div className="grid gap-4 md:grid-cols-2">
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
            <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
              <div className="mb-5 flex items-center gap-3">
                <Tags className="h-6 w-6 text-red-500" />
                <div>
                  <h3 className="text-2xl font-black">Customer Tags</h3>
                  <p className="mt-1 text-sm text-zinc-500">
                    Internal labels for workflow priority, pricing and account handling.
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {customerTagOptions.map((option) => {
                  const active = form.customer_tags.includes(option.value);

                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => toggleCustomerTag(option.value)}
                      className={`rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 ${
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
            <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
              <h3 className="mb-5 text-2xl font-black">Credit Permissions</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-black/30 p-4">
                  <div><div className="font-black text-white">Allow Negative Credits</div><div className="mt-1 text-sm text-zinc-500">Customer can submit requests with insufficient balance.</div></div>
                  <input type="checkbox" checked={form.allow_negative_credits} onChange={(event) => updateForm("allow_negative_credits", event.target.checked)} className="h-5 w-5 accent-red-600" />
                </label>
                <FormInput label="Negative Credit Limit" type="number" value={form.negative_credit_limit} onChange={(value) => updateForm("negative_credit_limit", value)} />
              </div>
              <textarea value={form.internal_admin_note} onChange={(event) => updateForm("internal_admin_note", event.target.value)} placeholder="Internal admin note. Customer cannot see this." className="mt-4 min-h-32 w-full resize-none rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm font-bold text-white outline-none placeholder:text-zinc-600 focus:border-red-700" />
            </section>
            <section className="rounded-[2rem] border border-red-900/40 bg-red-950/10 p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div><h3 className="text-2xl font-black">Customer Pricing & Payments</h3><p className="mt-1 text-sm leading-6 text-zinc-500">A base-price override replaces the global result. The customer adjustment is applied after it.</p></div>
                {form.effective_custom_unit_price_eur && <div className="rounded-xl border border-emerald-700/40 bg-emerald-950/20 px-4 py-3 text-right"><div className="text-xs font-black uppercase text-emerald-400">Effective custom credit</div><div className="mt-1 text-2xl font-black">EUR {Number(form.effective_custom_unit_price_eur).toFixed(2)}</div></div>}
              </div>
              <div className="mt-5 grid gap-4 md:grid-cols-3">
                <FormInput label="Base Price Override (EUR)" type="number" value={form.credit_price_override_eur} onChange={(value) => updateForm("credit_price_override_eur", value)} />
                <FormSelect label="Customer Adjustment" value={form.commercial_adjustment_type} onChange={(value) => updateForm("commercial_adjustment_type", value as CustomerForm["commercial_adjustment_type"])} options={["none", "percentage", "fixed"]} />
                <FormInput label={form.commercial_adjustment_type === "percentage" ? "Adjustment (%)" : "Adjustment (EUR / credit)"} type="number" value={form.commercial_adjustment_value} onChange={(value) => updateForm("commercial_adjustment_value", value)} />
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <PaymentPolicySelect label="Stripe" value={form.payment_stripe} onChange={(value) => updateForm("payment_stripe", value)} />
                <PaymentPolicySelect label="Bank transfer" value={form.payment_bank} onChange={(value) => updateForm("payment_bank", value)} />
              </div>
              <p className="mt-4 text-xs leading-5 text-zinc-500">Positive adjustment values reduce the per-credit price; negative values increase it. “Inherit” follows the global payment setting.</p>
              <textarea value={form.commercial_internal_note} onChange={(event) => updateForm("commercial_internal_note", event.target.value)} placeholder="Internal pricing agreement or approval note. Customer cannot see this." className="mt-4 min-h-24 w-full resize-none rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm font-bold text-white outline-none placeholder:text-zinc-600 focus:border-red-700" />
            </section>
          </div>
          <aside className="min-w-0 space-y-5 sm:space-y-6">
            <section className="rounded-[2rem] border border-red-900/40 bg-red-950/20 p-5">
              <CreditCard className="mb-4 h-8 w-8 text-red-400" /><div className="text-sm text-zinc-400">Current Balance</div><div className="mt-2 text-5xl font-black">{Number(customer.credit_balance ?? 0)}</div><div className="mt-1 text-sm text-zinc-500">credits</div>
            </section>
            <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
              <h3 className="mb-5 text-2xl font-black">Adjust Credits</h3>
              <div className="mb-4 grid grid-cols-2 gap-2">
                {[10, 25, 50, 100].map((amount) => <button key={amount} onClick={() => onQuickAdjust(amount)} disabled={creditUpdating} className="rounded-xl border border-emerald-700/40 bg-emerald-950/30 px-3 py-3 text-sm font-black text-emerald-300 transition hover:bg-emerald-900/40 disabled:opacity-50">+{amount}</button>)}
                {[-10, -25, -50, -100].map((amount) => <button key={amount} onClick={() => onQuickAdjust(amount)} disabled={creditUpdating} className="rounded-xl border border-red-700/40 bg-red-950/30 px-3 py-3 text-sm font-black text-red-300 transition hover:bg-red-900/40 disabled:opacity-50">{amount}</button>)}
              </div>
              <input type="number" value={creditInput} onChange={(event) => setCreditInput(event.target.value)} placeholder="+/- custom amount" className="mb-3 h-12 w-full rounded-xl border border-white/10 bg-black/35 px-4 text-sm font-bold text-white outline-none placeholder:text-zinc-600 focus:border-red-700" />
              <textarea value={creditNote} onChange={(event) => setCreditNote(event.target.value)} placeholder="Ledger note" className="mb-3 min-h-24 w-full resize-none rounded-xl border border-white/10 bg-black/35 px-4 py-3 text-sm font-bold text-white outline-none placeholder:text-zinc-600 focus:border-red-700" />
              <button onClick={onCustomAdjust} disabled={creditUpdating} className="flex h-12 w-full items-center justify-center rounded-xl bg-[#b1121b] px-4 text-sm font-black text-white transition hover:bg-[#c91824] disabled:opacity-50">{creditUpdating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MinusCircle className="mr-2 h-4 w-4" />}Apply Credit Adjustment</button>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}

function SidebarButton({ active, icon, label, count, onClick }: { active: boolean; icon: ReactNode; label: string; count: number; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm font-black transition ${active ? "border-red-700/50 bg-red-950/35 text-white" : "border-white/10 bg-black/25 text-zinc-400 hover:bg-white/[0.04] hover:text-white"}`}>
      <span className="flex items-center gap-3"><span className={active ? "text-red-400" : "text-zinc-500"}>{icon}</span>{label}</span>
      <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs">{count}</span>
    </button>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return <div className="rounded-xl bg-black/30 p-3"><div className="text-xs text-zinc-500">{label}</div><div className="mt-1 text-xl font-black">{value}</div></div>;
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
    <section className="mb-6 overflow-hidden rounded-lg border border-white/10 bg-[#0b0b0c] shadow-2xl shadow-black/25">
      <div className="flex flex-col gap-3 border-b border-white/10 bg-[linear-gradient(90deg,rgba(177,18,27,0.15),transparent_58%)] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="min-w-0">
          <div className="text-[11px] font-black uppercase tracking-[0.18em] text-red-400">Live order desk</div>
          <h2 className="mt-1 text-xl font-black text-white sm:text-2xl">Latest 5 orders</h2>
          <p className="mt-1 text-xs text-zinc-500">Newest customer work across every status, always shown first.</p>
        </div>
        <button
          type="button"
          onClick={() => onFilter(priority.status)}
          className="inline-flex h-10 shrink-0 items-center justify-center rounded-md border border-red-800/50 bg-red-950/35 px-4 text-xs font-black text-red-100 transition hover:border-red-600 hover:bg-red-950/55"
        >
          <BellRing className="mr-2 h-4 w-4" />
          {priority.label}
        </button>
      </div>

      <div className="grid xl:grid-cols-[minmax(0,1.65fr)_minmax(300px,0.75fr)]">
        <div className="min-w-0 xl:border-r xl:border-white/10">
          <div className="hidden grid-cols-[110px_minmax(0,1fr)_minmax(0,1.25fr)_minmax(120px,0.8fr)_120px] gap-3 border-b border-white/10 bg-black/30 px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.14em] text-zinc-600 md:grid">
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
                    className="group grid w-full min-w-0 gap-3 px-4 py-3 text-left transition hover:bg-white/[0.045] md:grid-cols-[110px_minmax(0,1fr)_minmax(0,1.25fr)_minmax(120px,0.8fr)_120px] md:items-center"
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

        <aside className="min-w-0 bg-black/20 p-4 sm:p-5">
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
                  className="min-w-0 rounded-md border border-white/10 bg-white/[0.025] p-3 text-left transition hover:border-red-800/50 hover:bg-white/[0.055]"
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
            <div className="mt-5 border-t border-white/10 pt-4">
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
                    className="flex min-w-0 items-center gap-2 rounded-md border border-white/10 bg-black/25 px-3 py-2.5 text-xs font-black text-zinc-300 transition hover:border-red-800/50 hover:text-white"
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
          <div key={item.label} className="min-w-0 border-b border-r border-white/10 px-3 py-3 last:border-r-0 md:border-b-0">
            <div className="truncate text-[10px] font-black uppercase tracking-[0.12em] text-zinc-600">{item.label}</div>
            <div className="mt-1 text-lg font-black text-white">{item.value}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function MiniInfo({ label, value }: { label: string; value: string | number | null | undefined }) {
  return <div className="min-w-0 rounded-xl bg-white/[0.04] p-3"><div className="text-xs uppercase tracking-[0.12em] text-zinc-500">{label}</div><div className="mt-1 break-words font-bold text-white">{value || "-"}</div></div>;
}

function FormInput({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <label>
      <div className="mb-2 text-xs font-black uppercase tracking-[0.14em] text-zinc-500">{label}</div>
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="h-12 w-full rounded-xl border border-white/10 bg-black/35 px-4 text-sm font-bold text-white outline-none placeholder:text-zinc-600 focus:border-red-700" />
    </label>
  );
}

function FormSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[] }) {
  return (
    <label>
      <div className="mb-2 text-xs font-black uppercase tracking-[0.14em] text-zinc-500">{label}</div>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="h-12 w-full rounded-xl border border-white/10 bg-black/35 px-4 text-sm font-bold text-white outline-none focus:border-red-700">
        {options.map((option) => <option key={option} value={option} className="bg-[#111]">{statusLabel(option)}</option>)}
      </select>
    </label>
  );
}

function PaymentPolicySelect({ label, value, onChange }: { label: string; value: PaymentOverride; onChange: (value: PaymentOverride) => void }) {
  return <label className="text-xs font-black uppercase tracking-[0.12em] text-zinc-500">{label}<select value={value} onChange={(event) => onChange(event.target.value as PaymentOverride)} className="mt-2 h-12 w-full rounded-xl border border-white/10 bg-black/35 px-4 text-sm font-black normal-case text-white outline-none focus:border-red-700"><option value="inherit">Inherit global</option><option value="enabled">Enabled</option><option value="disabled">Disabled</option></select></label>;
}

function Detail({ icon, label, value }: { icon: ReactNode; label: string; value: string | number | null | undefined }) {
  return (
    <div className="flex gap-3 rounded-2xl bg-white/[0.04] p-4">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-red-950/40 text-red-400">{icon}</div>
      <div className="min-w-0"><div className="text-xs uppercase tracking-[0.14em] text-zinc-500">{label}</div><div title={String(value || "-")} className="mt-1 line-clamp-2 break-all font-bold text-white">{value || "-"}</div></div>
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
  onUploadModified: (file: File | null, label: ModifiedFileVersion["label"]) => void;
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
  const [modifiedFileLabel, setModifiedFileLabel] =
    useState<ModifiedFileVersion["label"]>("v1");
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-x-hidden bg-black/75 px-2 py-4 backdrop-blur-sm sm:px-4 sm:py-6">
      <div className="max-h-[94vh] w-full max-w-7xl overflow-x-hidden overflow-y-auto rounded-[1.5rem] border border-white/10 bg-[#090909] shadow-2xl shadow-black sm:rounded-[2rem]">
        <div className="sticky top-0 z-10 border-b border-white/10 bg-[#090909]/95 p-4 backdrop-blur-xl sm:p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0">
              <div className="mb-3 flex flex-wrap items-center gap-2"><span className="rounded-full border border-red-800/40 bg-red-950/25 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-red-300">Work Order #{shortId(order.id)}</span><span className={`rounded-full border px-3 py-1 text-xs font-bold ${statusClass(order.status)}`}>{statusLabel(order.status)}</span><span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-bold text-zinc-400">{formatDate(order.created_at)}</span></div>
              <h2 className="break-words text-2xl font-black md:text-4xl">{order.vehicle_brand || "-"} {order.vehicle_model || ""} <span className="text-red-500">{order.vehicle_engine || ""}</span></h2>
              <p className="mt-2 break-words text-sm text-zinc-500">{customer?.customer_id || order.customer_id || "-"} · {customer?.full_name || customer?.company_name || order.customer_email || "-"}</p>
            </div>
            <div className="grid gap-2 sm:flex sm:flex-wrap">
              <button onClick={onCopy} className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-black text-white transition hover:bg-white/10"><Copy className="mr-2 inline h-4 w-4" />Copy Order ID</button>
              <button onClick={onDownload} disabled={!order.original_file_path || !canDownloadFiles} className="rounded-xl bg-[#b1121b] px-4 py-3 text-sm font-black text-white transition hover:bg-[#c91824] disabled:opacity-40"><Download className="mr-2 inline h-4 w-4" />Download Original</button>
              {canUploadFiles && <label className="cursor-pointer rounded-xl border border-emerald-700/40 bg-emerald-950/30 px-4 py-3 text-sm font-black text-emerald-300 transition hover:bg-emerald-900/40">{uploadingModified ? <><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Uploading Modified</> : <><Upload className="mr-2 inline h-4 w-4" />Upload Modified</>}<input type="file" className="hidden" disabled={uploadingModified} onChange={(event) => { const file = event.target.files?.[0] ?? null; onUploadModified(file, modifiedFileLabel); event.target.value = ""; }} /></label>}
              <button onClick={onClose} className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-black text-white transition hover:bg-white/10"><X className="mr-2 inline h-4 w-4" />Close</button>
            </div>
          </div>
        </div>
        <div className="grid min-w-0 gap-5 p-3 sm:p-5 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="min-w-0 space-y-5 sm:space-y-6">
            <section className="rounded-[2rem] border border-red-900/40 bg-red-950/20 p-5"><div className="mb-5 flex items-center justify-between gap-4"><div><div className="text-sm font-black uppercase tracking-[0.22em] text-red-400">Work Order Overview</div><h3 className="mt-1 text-2xl font-black">Main job information</h3></div><div className="rounded-2xl bg-black/30 px-4 py-3 text-right"><div className="text-xs text-zinc-500">Credits</div><div className="text-2xl font-black text-red-400">{order.credits_required ?? 0}</div></div></div><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4"><WorkInfo label="Customer ID" value={customer?.customer_id || order.customer_id} /><WorkInfo label="Vehicle" value={`${order.vehicle_brand || "-"} ${order.vehicle_model || ""}`} /><WorkInfo label="ECU / TCU" value={order.ecu || order.gearbox} /><WorkInfo label="Read Method" value={order.read_method} /></div></section>
            <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5"><div className="mb-5 flex items-center gap-3"><Car className="h-7 w-7 text-red-500" /><div><h3 className="text-2xl font-black">Vehicle Information</h3><p className="mt-1 text-sm text-zinc-500">Vehicle and identification details for this work order.</p></div></div><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3"><Detail icon={<Car />} label="Brand" value={order.vehicle_brand} /><Detail icon={<Car />} label="Model" value={order.vehicle_model} /><Detail icon={<FileCode2 />} label="Generation" value={order.vehicle_generation} /><Detail icon={<Gauge />} label="Engine" value={order.vehicle_engine} /><Detail icon={<CalendarDays />} label="Year" value={order.vehicle_year} /><Detail icon={<Clipboard />} label="License Plate" value={order.license_plate} /></div></section>
            <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5"><div className="mb-5 flex items-center gap-3"><Database className="h-7 w-7 text-red-500" /><div><h3 className="text-2xl font-black">ECU / File Technical Data</h3><p className="mt-1 text-sm text-zinc-500">Technical identifiers needed for file service processing.</p></div></div><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3"><Detail icon={<Wrench />} label="ECU / TCU" value={order.ecu} /><Detail icon={<Wrench />} label="Gearbox" value={order.gearbox} /><Detail icon={<FileCode2 />} label="Read Method" value={order.read_method} /><Detail icon={<Database />} label="HW / SW" value={order.hw_sw} /><Detail icon={<PackageCheck />} label="Master / Slave" value={order.master_slave} /><Detail icon={<FileDown />} label="Uploaded File" value={order.uploaded_file_name} /></div></section>
            <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5"><div className="mb-5 flex items-center justify-between gap-4"><div><h3 className="text-2xl font-black">Service Breakdown</h3><p className="mt-1 text-sm text-zinc-500">Requested services for this file.</p></div><div className="rounded-2xl border border-red-900/40 bg-red-950/25 px-4 py-3 text-sm font-black text-red-300">{order.credits_required ?? 0} Credits</div></div>{serviceItems.length > 0 ? <div className="grid gap-3 md:grid-cols-2">{serviceItems.map((service) => <div key={service} className="flex items-center gap-3 rounded-2xl border border-emerald-700/30 bg-emerald-950/15 p-4"><CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" /><span className="font-black text-white">{service}</span></div>)}</div> : <div className="rounded-2xl bg-black/30 p-5 text-sm leading-7 text-zinc-300">{order.service_type || "-"}</div>}</section>
            <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5"><h3 className="mb-4 text-2xl font-black">Customer Notes</h3><div className="min-h-32 whitespace-pre-wrap rounded-2xl bg-black/30 p-5 text-sm leading-7 text-zinc-300">{order.notes || "-"}</div></section>
            {canManageMessages ? <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5"><RequestChat requestId={order.id} senderRole="admin" /></section> : <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 text-sm text-zinc-500">Your staff role does not include customer messaging.</section>}
          </div>
          <aside className="min-w-0 space-y-5 sm:space-y-6">
            <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5"><h3 className="mb-5 text-2xl font-black">Status Workflow</h3><div className="mb-5 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-red-800 via-red-600 to-emerald-500 transition-all duration-700" style={{ width: `${((workflowStep + 1) / 5) * 100}%` }} /></div><div className="space-y-3">{[0, 1, 2, 3, 4].map((index) => <div key={index} className={`flex items-center gap-3 rounded-2xl border p-4 ${index <= workflowStep ? "border-emerald-700/30 bg-emerald-950/10" : "border-white/10 bg-black/30"}`}><div className={`flex h-9 w-9 items-center justify-center rounded-full ${index <= workflowStep ? "bg-emerald-500/15 text-emerald-400" : "bg-white/5 text-zinc-500"}`}>{index <= workflowStep ? <CheckCircle2 className="h-4 w-4" /> : <Clock3 className="h-4 w-4" />}</div><div className="font-black">{workflowLabel(index)}</div></div>)}</div><div className="mt-5"><select value={order.status ?? "new_request"} onChange={(event) => onStatusChange(event.target.value)} disabled={updating || !canManageOrders} className={`h-12 w-full rounded-xl border px-4 text-sm font-black outline-none disabled:opacity-60 ${statusClass(order.status)}`}>{editableStatusOptions.map((status) => <option key={status} value={status} className="bg-[#111]">{statusLabel(status)}</option>)}</select>{updating && <div className="mt-3 flex items-center gap-2 text-xs text-zinc-500"><Loader2 className="h-3 w-3 animate-spin" />Updating status...</div>}</div></section>
            <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
              <h3 className="mb-5 text-2xl font-black">Estimated Delivery</h3>
              <div
                className={`rounded-2xl border p-4 ${
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
                <div className="mt-2 break-words text-xl font-black text-white">
                  {formatDeliveryEstimate(deliveryEstimate)}
                </div>
              </div>
              {!hasExplicitDeliveryEstimate && (
                <p className="mt-3 text-sm font-bold leading-6 text-zinc-400">
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
                className="mt-4 h-12 w-full rounded-xl border border-white/10 bg-black/35 px-4 text-sm font-black text-white outline-none focus:border-red-700"
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
                className="mt-3 min-h-24 w-full resize-none rounded-xl border border-white/10 bg-black/35 px-4 py-3 text-sm font-bold text-white outline-none placeholder:text-zinc-600 focus:border-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              />
              <button
                onClick={() => {
                  if (!deliveryEstimate) {
                    return;
                  }
                  onDeliveryUpdate(deliveryEstimate, deliveryNote);
                }}
                disabled={!canSaveDeliveryEstimate}
                className="mt-3 flex h-12 w-full items-center justify-center rounded-xl bg-[#b1121b] px-4 text-sm font-black text-white transition hover:bg-[#c91824] disabled:opacity-50"
              >
                {updating ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Clock3 className="mr-2 h-4 w-4" />
                )}
                Save Delivery Estimate
              </button>
            </section>
            <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
              <h3 className="mb-5 text-2xl font-black">File Workflow</h3>
              <div className="grid gap-3">
                <FileStateCard title="Original File" ready={Boolean(order.original_file_path)} description={order.uploaded_file_name || order.original_file_path || "No original file uploaded."} />
                <FileStateCard title="Modified Versions" ready={modifiedVersions.length > 0} description={modifiedVersions.length > 0 ? `${modifiedVersions.length} modified file version${modifiedVersions.length === 1 ? "" : "s"} uploaded.` : "No modified file uploaded yet."} />
              </div>
              <button onClick={onDownload} disabled={!order.original_file_path || !canDownloadFiles} className="mt-4 flex w-full items-center justify-center rounded-xl bg-[#b1121b] px-4 py-3 text-sm font-black text-white transition hover:bg-[#c91824] disabled:opacity-40"><Download className="mr-2 h-4 w-4" />Download Original</button>

              <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4">
                <div className="mb-3 text-xs font-black uppercase tracking-[0.14em] text-zinc-500">Upload Version</div>
                <select value={modifiedFileLabel} onChange={(event) => setModifiedFileLabel(event.target.value as ModifiedFileVersion["label"])} className="mb-3 h-11 w-full rounded-xl border border-white/10 bg-black/35 px-3 text-sm font-black text-white outline-none focus:border-red-700">
                  <option value="v1" className="bg-[#111]">V1</option>
                  <option value="revision" className="bg-[#111]">Revision</option>
                  <option value="final" className="bg-[#111]">Final</option>
                </select>
                {canUploadFiles ? <label className="flex w-full cursor-pointer items-center justify-center rounded-xl border border-emerald-700/40 bg-emerald-950/30 px-4 py-3 text-sm font-black text-emerald-300 transition hover:bg-emerald-900/40">{uploadingModified ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Uploading Modified</> : <><Upload className="mr-2 h-4 w-4" />Upload {formatFileVersionLabel(modifiedFileLabel)} File</>}<input type="file" className="hidden" disabled={uploadingModified} onChange={(event) => { const file = event.target.files?.[0] ?? null; onUploadModified(file, modifiedFileLabel); event.target.value = ""; }} /></label> : <div className="text-xs text-zinc-500">Your staff role cannot upload completed files.</div>}
              </div>

              {modifiedVersions.length > 0 && (
                <div className="mt-4 space-y-3">
                  {modifiedVersions.map((version) => (
                    <div key={version.id} className="rounded-2xl border border-emerald-700/30 bg-emerald-950/15 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-black text-emerald-300">{formatFileVersionLabel(version.label)}</div>
                          <div title={version.file_name} className="mt-1 break-all text-sm font-bold text-white">{version.file_name}</div>
                          <div className="mt-1 text-xs text-zinc-500">{formatDate(version.uploaded_at)}</div>
                        </div>
                        <button onClick={() => onDownloadModified(version.file_path)} className="shrink-0 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-black text-white transition hover:bg-white/10"><Download className="mr-1 inline h-3 w-3" />Download</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-4 rounded-2xl border border-blue-700/30 bg-blue-950/15 p-4">
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
                    className={`shrink-0 rounded-xl border px-3 py-2 text-xs font-black transition ${
                      order.customer_upload_enabled
                        ? "border-emerald-600/40 bg-emerald-950/30 text-emerald-300"
                        : "border-white/10 bg-white/[0.04] text-zinc-300"
                    }`}
                  >
                    {order.customer_upload_enabled ? "Enabled" : "Enable"}
                  </button>
                </div>

                {Array.isArray(order.customer_uploads) && order.customer_uploads.length > 0 && (
                  <div className="mt-4 space-y-2 border-t border-white/10 pt-4">
                    {order.customer_uploads.map((file) => (
                      <div key={file.id} className="flex min-w-0 items-center justify-between gap-3 rounded-xl bg-black/25 p-3">
                        <div className="min-w-0">
                          <div className="truncate text-xs font-black text-white">{file.file_name}</div>
                          <div className="mt-1 text-[11px] text-zinc-500">{formatDate(file.uploaded_at)}</div>
                        </div>
                        <button onClick={() => onDownloadModified(file.file_path)} className="shrink-0 rounded-lg border border-white/10 px-3 py-2 text-xs font-black">
                          <Download className="mr-1 inline h-3 w-3" />Download
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
            <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5"><h3 className="mb-5 text-2xl font-black">Customer Contact</h3><div className="space-y-3"><Detail icon={<User />} label="Customer ID" value={customer?.customer_id || order.customer_id} /><Detail icon={<Mail />} label="Login Email" value={order.customer_email} /><Detail icon={<User />} label="Full Name" value={customer?.full_name} /><Detail icon={<Building2 />} label="Company" value={customer?.company_name} /><Detail icon={<Phone />} label="Phone" value={customer?.phone} /><Detail icon={<MapPin />} label="Address" value={[customer?.street, customer?.postal_code, customer?.city, customer?.country].filter(Boolean).join(", ") || null} /></div><div className="mt-4 grid gap-2"><button onClick={() => onCopyValue(customer?.customer_id || order.customer_id, "Customer ID")} className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-black text-white transition hover:bg-white/10"><Copy className="mr-2 inline h-4 w-4" />Copy Customer ID</button><button onClick={() => onCopyValue(order.customer_email, "Customer Email")} className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-black text-white transition hover:bg-white/10"><Mail className="mr-2 inline h-4 w-4" />Copy Email</button><button onClick={() => onCopyValue(customer?.phone, "Phone")} className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-black text-white transition hover:bg-white/10"><Phone className="mr-2 inline h-4 w-4" />Copy Phone</button>{order.customer_email && <a href={`mailto:${order.customer_email}`} className="flex w-full items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-black text-white transition hover:bg-white/10"><Mail className="mr-2 h-4 w-4" />Email Customer</a>}</div></section>
          </aside>
        </div>
      </div>
    </div>
  );
}

function WorkInfo({ label, value }: { label: string; value: string | number | null | undefined }) {
  return <div className="rounded-2xl border border-white/10 bg-black/30 p-4"><div className="text-xs font-black uppercase tracking-[0.16em] text-zinc-500">{label}</div><div title={String(value || "-")} className="mt-2 line-clamp-2 break-all text-lg font-black text-white">{value || "-"}</div></div>;
}

function FileStateCard({ title, ready, description }: { title: string; ready: boolean; description: string }) {
  return <div className={`rounded-2xl border p-4 ${ready ? "border-emerald-700/30 bg-emerald-950/15" : "border-white/10 bg-black/30"}`}><div className="flex items-center gap-3"><div className={`flex h-9 w-9 items-center justify-center rounded-full ${ready ? "bg-emerald-500/15 text-emerald-400" : "bg-white/5 text-zinc-500"}`}>{ready ? <CheckCircle2 className="h-4 w-4" /> : <Clock3 className="h-4 w-4" />}</div><div><div className="font-black">{title}</div><div className="mt-1 text-xs leading-5 text-zinc-500">{ready ? "Ready" : "Waiting"}</div></div></div><div title={description} className="mt-3 line-clamp-2 break-all text-xs leading-5 text-zinc-400">{description}</div></div>;
}
