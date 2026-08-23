"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getStableSession, notifySessionRequired, signOutIfEmailUnverified, signOutStable } from "@/lib/authGuards";
import { supabase } from "@/lib/supabaseClient";
import {
  Activity,
  ArrowRight,
  AlertTriangle,
  BellRing,
  BrainCircuit,
  CheckCircle2,
  Clipboard,
  Clock3,
  CreditCard,
  Download,
  Eye,
  FileText,
  History,
  LogOut,
  Plus,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Upload,
  User,
  Wrench,
} from "lucide-react";

type Order = {
  id: string;
  vehicle_brand: string | null;
  vehicle_model: string | null;
  vehicle_generation: string | null;
  vehicle_engine: string | null;
  service_type: string | null;
  credits_required: number | string | null;
  status: string | null;
  created_at: string;
};

type CreditTransaction = {
  id: string;
  user_id: string;
  type: string | null;
  credits_delta: number | string;
  balance_after: number | string | null;
  description: string | null;
  created_at: string;
};

type DashboardProfile = {
  credit_balance: number | string | null;
  customer_id: string | null;
  full_name: string | null;
  account_type: string | null;
  company_name: string | null;
  phone: string | null;
  street: string | null;
  postal_code: string | null;
  city: string | null;
  country: string | null;
  invoice_email: string | null;
  preferred_contact: string | null;
};

const DASHBOARD_LOAD_ERROR_MESSAGE =
  "We could not load your dashboard data. Please try again.";

function hasProfileValue(value: string | null | undefined) {
  return Boolean(value?.trim());
}

function getProfileCompletionMissingItems(profile: DashboardProfile) {
  const missing: string[] = [];

  if (!hasProfileValue(profile.full_name)) missing.push("Full name");
  if (!hasProfileValue(profile.phone)) missing.push("Phone / WhatsApp contact");
  if (!hasProfileValue(profile.preferred_contact)) missing.push("Preferred contact method");
  if (!hasProfileValue(profile.invoice_email)) missing.push("Invoice e-mail");
  if (!hasProfileValue(profile.account_type)) missing.push("Account type");

  if (profile.account_type === "company" && !hasProfileValue(profile.company_name)) {
    missing.push("Company / workshop name");
  }

  if (
    !hasProfileValue(profile.street) ||
    !hasProfileValue(profile.postal_code) ||
    !hasProfileValue(profile.city) ||
    !hasProfileValue(profile.country)
  ) {
    missing.push("Billing address");
  }

  return missing;
}

function formatMissingProfileItems(items: string[]) {
  if (items.length <= 2) return items.join(" and ");

  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

function formatStatus(status: string | null) {
  if (!status) return "New Request";

  return status
    .replaceAll("_", " ")
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatCreditTransactionType(type: string | null) {
  if (!type) return "Credit movement";

  return type
    .replaceAll("_", " ")
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function getStatusStyle(status: string | null) {
  const value = status?.toLowerCase() ?? "new_request";

  if (value.includes("completed")) {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  }

  if (value.includes("progress")) {
    return "border-blue-500/30 bg-blue-500/10 text-blue-300";
  }

  if (value.includes("file_check")) {
    return "border-amber-500/30 bg-amber-500/10 text-amber-300";
  }

  if (value.includes("cancel")) {
    return "border-zinc-500/30 bg-zinc-500/10 text-zinc-300";
  }

  return "border-red-700/40 bg-red-950/30 text-red-300";
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

function formatCustomerReference(customerId: string | null) {
  if (!customerId) return null;

  const cleanId = customerId.trim().toUpperCase();
  if (/^MGA-\d{5,}$/.test(cleanId)) return cleanId;
  if (/^\d+$/.test(cleanId)) return `MGA-${cleanId.padStart(5, "0")}`;
  return null;
}

function LocalTime() {
  const [localTime, setLocalTime] = useState("--:--:--");

  useEffect(() => {
    const updateLocalTime = () => {
      setLocalTime(
        new Intl.DateTimeFormat(undefined, {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }).format(new Date())
      );
    };

    updateLocalTime();
    const interval = window.setInterval(updateLocalTime, 1000);
    return () => window.clearInterval(interval);
  }, []);

  return <>{localTime}</>;
}

export function DashboardClient() {
  const router = useRouter();

  const [email, setEmail] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState("Customer");
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [credits, setCredits] = useState<number>(0);
  const [orders, setOrders] = useState<Order[]>([]);
  const [creditTransactions, setCreditTransactions] = useState<CreditTransaction[]>([]);
  const [completedCount, setCompletedCount] = useState<number>(0);
  const [activeCount, setActiveCount] = useState<number>(0);
  const [needsResponseCount, setNeedsResponseCount] = useState<number>(0);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [inProgressCount, setInProgressCount] = useState<number>(0);
  const [profileMissingItems, setProfileMissingItems] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [liveRefreshing, setLiveRefreshing] = useState(false);
  const [dashboardLoadError, setDashboardLoadError] = useState<string | null>(null);
  const [dashboardReady, setDashboardReady] = useState(false);
  const [dashboardRefreshKey, setDashboardRefreshKey] = useState(0);
  const [copiedReference, setCopiedReference] = useState(false);
  const [requestSearch, setRequestSearch] = useState("");
  const hasLoadedDashboardRef = useRef(false);
  const dashboardRefreshInFlightRef = useRef(false);

  useEffect(() => {
    let currentUserId: string | null = null;

    const loadDashboard = async (options?: { silent?: boolean }) => {
      const silent = Boolean(options?.silent);
      let keepLoadingForRedirect = false;

      if (dashboardRefreshInFlightRef.current) return;
      dashboardRefreshInFlightRef.current = true;

      if (silent) {
        setLiveRefreshing(true);
      } else {
        setLoading(true);
        setDashboardLoadError(null);
      }

      try {
        if (!currentUserId) {
          const { session } = await getStableSession();
          if (!session?.user) {
            if (!silent) {
              notifySessionRequired();
            }
            return;
          }

          const user = session.user;
          currentUserId = user.id;

          if (await signOutIfEmailUnverified(user)) {
            keepLoadingForRedirect = true;
            router.replace("/login?verify_email=1");
            return;
          }

          setEmail(user.email ?? null);
        }

        const userId = currentUserId;
        if (!userId) return;

        const [
          { data: profile, error: profileError },
          { data: recentOrders, error: recentOrdersError },
          { data: transactionRows, error: transactionRowsError },
          { count: allOrders, error: allOrdersError },
          { count: completedOrders, error: completedOrdersError },
          { count: pendingOrders, error: pendingOrdersError },
          { count: needsResponseOrders, error: needsResponseOrdersError },
          { count: progressOrders, error: progressOrdersError },
          { count: cancelledOrders, error: cancelledOrdersError },
        ] = await Promise.all([
          supabase
            .from("profiles")
            .select(
              "credit_balance, customer_id, full_name, account_type, company_name, phone, street, postal_code, city, country, invoice_email, preferred_contact"
            )
            .eq("id", userId)
            .single(),
          supabase
            .from("orders")
            .select(
              "id, vehicle_brand, vehicle_model, vehicle_generation, vehicle_engine, service_type, credits_required, status, created_at"
            )
            .eq("customer_id", userId)
            .order("created_at", { ascending: false })
            .limit(5),
          supabase
            .from("credit_transactions")
            .select("id, user_id, type, credits_delta, balance_after, description, created_at")
            .eq("user_id", userId)
            .order("created_at", { ascending: false })
            .limit(6),
          supabase.from("orders").select("id", { count: "exact", head: true }).eq("customer_id", userId),
          supabase.from("orders").select("id", { count: "exact", head: true }).eq("customer_id", userId).eq("status", "completed"),
          supabase.from("orders").select("id", { count: "exact", head: true }).eq("customer_id", userId).in("status", ["new_request", "file_check"]),
          supabase.from("orders").select("id", { count: "exact", head: true }).eq("customer_id", userId).eq("status", "customer_info_needed"),
          supabase.from("orders").select("id", { count: "exact", head: true }).eq("customer_id", userId).eq("status", "in_progress"),
          supabase.from("orders").select("id", { count: "exact", head: true }).eq("customer_id", userId).eq("status", "cancelled"),
        ]);

        const queryFailed =
          profileError ||
          recentOrdersError ||
          transactionRowsError ||
          allOrdersError ||
          completedOrdersError ||
          pendingOrdersError ||
          needsResponseOrdersError ||
          progressOrdersError ||
          cancelledOrdersError;

        if (queryFailed) {
          if (!silent || !hasLoadedDashboardRef.current) {
            setDashboardLoadError(DASHBOARD_LOAD_ERROR_MESSAGE);
          }
          return;
        }

        if (profile) {
          const dashboardProfile = profile as DashboardProfile;
          const nextCreditBalance = Number(dashboardProfile.credit_balance ?? 0);
          setCredits(Number.isFinite(nextCreditBalance) ? nextCreditBalance : 0);
          setCustomerId(dashboardProfile.customer_id ?? null);
          setCustomerName(
            dashboardProfile.full_name?.trim() ||
              dashboardProfile.company_name?.trim() ||
              "Customer"
          );
          setProfileMissingItems(getProfileCompletionMissingItems(dashboardProfile));
        } else {
          setCredits(0);
          setCustomerId(null);
          setCustomerName("Customer");
          setProfileMissingItems([]);
        }

        setOrders((recentOrders ?? []) as Order[]);
        setCreditTransactions((transactionRows ?? []) as CreditTransaction[]);
        setCompletedCount(completedOrders ?? 0);
        setPendingCount(pendingOrders ?? 0);
        setNeedsResponseCount(needsResponseOrders ?? 0);
        setInProgressCount(progressOrders ?? 0);

        const active =
          (allOrders ?? 0) - (completedOrders ?? 0) - (cancelledOrders ?? 0);

        setActiveCount(active < 0 ? 0 : active);
        setDashboardLoadError(null);
        setDashboardReady(true);
        hasLoadedDashboardRef.current = true;
      } catch {
        if (!silent || !hasLoadedDashboardRef.current) {
          setDashboardLoadError(DASHBOARD_LOAD_ERROR_MESSAGE);
        }
      } finally {
        dashboardRefreshInFlightRef.current = false;
        if (silent) {
          setLiveRefreshing(false);
        } else if (!keepLoadingForRedirect) {
          setLoading(false);
        }
      }
    };

    loadDashboard();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        currentUserId = session.user.id;
        setEmail(session.user.email ?? null);
      } else if (event === "SIGNED_OUT") {
        window.setTimeout(() => {
          void getStableSession().then(({ session: recovered }) => {
            if (recovered?.user) {
              currentUserId = recovered.user.id;
              setEmail(recovered.user.email ?? null);
            } else {
              currentUserId = null;
              notifySessionRequired();
            }
          });
        }, 0);
      }
    });

    const refreshVisibleDashboard = () => {
      if (document.visibilityState === "visible") {
        void loadDashboard({ silent: true });
      }
    };
    const interval = window.setInterval(refreshVisibleDashboard, 30000);
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") refreshVisibleDashboard();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    const channel = supabase
      .channel("customer-dashboard-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        (payload) => {
          const row = (payload.new || payload.old) as
            | { customer_id?: string }
            | undefined;

          if (!currentUserId || row?.customer_id !== currentUserId) return;

          loadDashboard({ silent: true });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles" },
        (payload) => {
          const row = (payload.new || payload.old) as { id?: string } | undefined;

          if (!currentUserId || row?.id !== currentUserId) return;

          loadDashboard({ silent: true });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "credit_transactions" },
        (payload) => {
          const row = (payload.new || payload.old) as
            | { user_id?: string }
            | undefined;

          if (!currentUserId || row?.user_id !== currentUserId) return;

          loadDashboard({ silent: true });
        }
      )
      .subscribe();

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      authListener.subscription.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, [router, dashboardRefreshKey]);

  const creditHistory = useMemo(() => {
    return creditTransactions.slice(0, 6);
  }, [creditTransactions]);

  const filteredOrders = useMemo(() => {
    const query = requestSearch.trim().toLowerCase();
    if (!query) return orders;

    return orders.filter((order) =>
      [
        order.vehicle_brand,
        order.vehicle_model,
        order.vehicle_generation,
        order.vehicle_engine,
        order.service_type,
        formatStatus(order.status),
      ].some((value) => value?.toLowerCase().includes(query))
    );
  }, [orders, requestSearch]);

  const customerReference = formatCustomerReference(customerId);
  const profileCompletionSummary = formatMissingProfileItems(profileMissingItems);

  const dashboardNextAction = useMemo(() => {
    if (needsResponseCount > 0) {
      return {
        key: "response",
        eyebrow: "Action required",
        title: "Respond to requested order information",
        description: `${needsResponseCount} request${needsResponseCount === 1 ? "" : "s"} need your input before the file service can continue.`,
        href: "/dashboard/orders?view=needs_response",
        cta: "Review Requests",
        tone: "border-red-800/50 bg-red-950/30 text-red-100",
      };
    }

    if (profileMissingItems.length > 0) {
      return {
        key: "profile",
        eyebrow: "Account setup",
        title: "Complete your customer profile",
        description: `Add ${profileCompletionSummary} so support, billing and bank-transfer handling have the correct account details.`,
        href: "/dashboard/settings",
        cta: "Update Settings",
        tone: "border-amber-700/40 bg-amber-950/20 text-amber-100",
      };
    }

    if (credits <= 0) {
      return {
        key: "credits",
        eyebrow: "Credits",
        title: "Add credits before your next file request",
        description: "Your current balance is 0 credits. Top up first so your next request can move without payment delay.",
        href: "/dashboard/credits",
        cta: "Buy Credits",
        tone: "border-red-800/45 bg-red-950/25 text-red-100",
      };
    }

    if (activeCount > 0) {
      return {
        key: "orders",
        eyebrow: "Live work",
        title: "Track your active file requests",
        description: `${activeCount} active request${activeCount === 1 ? "" : "s"} are still moving through the MG AutoTech workflow.`,
        href: "/dashboard/orders",
        cta: "Open Orders",
        tone: "border-blue-700/35 bg-blue-950/20 text-blue-100",
      };
    }

    return {
      key: "new-request",
      eyebrow: "Ready",
      title: "Create a new file request",
      description: "Your dashboard is ready. Start a new ECU/TCU file request when you have an original file prepared.",
      href: "/new-request",
      cta: "New Request",
      tone: "border-emerald-700/35 bg-emerald-950/20 text-emerald-100",
    };
  }, [activeCount, credits, needsResponseCount, profileCompletionSummary, profileMissingItems.length]);

  const customerWorkflowSteps = useMemo(
    () => [
      {
        title: "Prepare file",
        detail: "Check file type, size and request notes before starting a paid workflow.",
        href: "/tools/file-readiness-check",
        metric: "Browser-only check",
        icon: ShieldCheck,
      },
      {
        title: "Build request brief",
        detail: "Create a clean copy-ready service brief for your ECU/TCU request.",
        href: "/tools/request-brief-builder",
        metric: "No upload required",
        icon: Clipboard,
      },
      {
        title: "Submit secure request",
        detail: "Start the private upload flow after your vehicle, service and file are ready.",
        href: "/new-request",
        metric: `${credits} credits available`,
        icon: Upload,
      },
      {
        title: "Track live work",
        detail: "Follow active requests and respond quickly if MG AutoTech needs more details.",
        href: needsResponseCount > 0 ? "/dashboard/orders?view=needs_response" : "/dashboard/orders",
        metric:
          needsResponseCount > 0
            ? `${needsResponseCount} response needed`
            : `${activeCount} active request${activeCount === 1 ? "" : "s"}`,
        icon: FileText,
      },
      {
        title: "Review delivery",
        detail: "Open completed requests and download delivered files from your private dashboard.",
        href: "/dashboard/orders?view=completed",
        metric: `${completedCount} completed`,
        icon: Download,
      },
    ],
    [activeCount, completedCount, credits, needsResponseCount]
  );

  const NextActionIcon =
    dashboardNextAction.key === "profile"
      ? Settings
      : dashboardNextAction.key === "response"
        ? Clipboard
        : dashboardNextAction.key === "credits"
          ? CreditCard
          : dashboardNextAction.key === "orders"
            ? FileText
            : Upload;

  const copyReference = async () => {
    if (!customerReference) return;

    try {
      await navigator.clipboard.writeText(customerReference);
      setCopiedReference(true);

      window.setTimeout(() => {
        setCopiedReference(false);
      }, 1600);
    } catch {
      setCopiedReference(false);
    }
  };

  const handleLogout = async () => {
    await signOutStable();
    router.push("/login");
  };

  const retryDashboardLoad = () => {
    setDashboardRefreshKey((current) => current + 1);
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#050505] text-white">
        <div className="text-center">
          <div className="mx-auto mb-5 h-12 w-12 animate-spin rounded-full border-4 border-white/10 border-t-red-600" />
          <p className="text-sm text-zinc-400">Loading customer dashboard...</p>
        </div>
      </main>
    );
  }

  if (dashboardLoadError && !dashboardReady) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#050505] px-4 text-white">
        <div className="max-w-lg rounded-[2rem] border border-red-900/50 bg-red-950/20 p-7 text-center shadow-2xl shadow-black/30">
          <AlertTriangle className="mx-auto mb-5 h-10 w-10 text-red-400" />
          <div className="text-xs font-black uppercase tracking-[0.24em] text-red-300">
            Dashboard sync failed
          </div>
          <h1 className="mt-3 text-3xl font-black">Your dashboard could not be loaded</h1>
          <p role="alert" className="mt-4 text-sm leading-6 text-zinc-300">
            {dashboardLoadError}
          </p>
          <button
            type="button"
            onClick={retryDashboardLoad}
            className="mt-6 inline-flex items-center justify-center rounded-xl bg-[#b1121b] px-5 py-3 text-sm font-black text-white transition hover:bg-[#c91824]"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Try again
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="mg-compact-ui min-h-screen bg-[#15181e] text-white lg:h-screen lg:overflow-hidden">
      <div className="flex min-h-screen lg:h-screen lg:overflow-hidden">
        <section className="min-w-0 flex-1 lg:flex lg:h-screen lg:flex-col lg:overflow-hidden">
          <header className="sticky top-0 z-40 shrink-0 border-b border-[#2b2b2b] bg-[#12151b]/95 backdrop-blur-xl lg:static">
            <div className="border-b border-red-950/40 bg-[#b1121b] px-4 py-2.5 text-white lg:px-5 xl:px-6">
              <div className="flex items-center justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/45">
                    <NextActionIcon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-xs font-black uppercase tracking-[0.12em] sm:text-sm">
                      Next best action - {dashboardNextAction.eyebrow}: {dashboardNextAction.title}
                    </div>
                    <p className="hidden truncate text-xs text-white/80 xl:block">
                      {dashboardNextAction.description}
                    </p>
                  </div>
                </div>
                <Link
                  href={dashboardNextAction.href}
                  className="shrink-0 rounded-lg border border-white/40 bg-black/10 px-3 py-2 text-xs font-black transition hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  {dashboardNextAction.cta}
                  <ArrowRight className="ml-2 inline h-4 w-4" />
                </Link>
              </div>
            </div>

            <div className="flex min-h-[72px] items-center gap-2 px-4 py-2.5 lg:px-5 xl:px-6">
              <Link
                href="/dashboard/credits"
                aria-label="Buy Credits"
                className="hidden min-w-[144px] items-center justify-between rounded-xl border border-[#b1121b] bg-[#171a20] px-3 py-2.5 transition hover:bg-[#20242b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 md:flex"
              >
                <span>
                  <span className="block text-[10px] font-bold text-zinc-400">Current Balance</span>
                  <span className="block text-sm font-black tabular-nums">{credits} Credits</span>
                </span>
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#b1121b] text-white">
                  <Plus className="h-4 w-4" />
                </span>
              </Link>

              <div className="hidden min-w-[126px] rounded-xl border border-[#b1121b] bg-[#171a20] px-3 py-2.5 xl:block">
                <div className="text-[10px] font-bold text-zinc-400">Local Time</div>
                <div className="mt-0.5 flex items-center gap-2 text-sm font-black tabular-nums">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)]" />
                  <LocalTime />
                </div>
              </div>

              <label className="relative min-w-0 flex-1">
                <span className="sr-only">Search recent requests</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                <input
                  type="search"
                  value={requestSearch}
                  onChange={(event) => setRequestSearch(event.target.value)}
                  placeholder="Search recent requests..."
                  className="h-11 w-full rounded-xl border border-[#303640] bg-[#1c2028] pl-10 pr-3 text-sm text-white outline-none transition placeholder:text-zinc-400 focus:border-[#b1121b] focus:ring-2 focus:ring-red-500/20"
                />
              </label>

              <Link
                href="/dashboard/notifications"
                aria-label={
                  needsResponseCount > 0
                    ? `Notifications - ${needsResponseCount} requests. Waiting for your information`
                    : "Notifications"
                }
                className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#303640] bg-[#171a20] text-zinc-300 transition hover:border-zinc-500 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
              >
                <BellRing className="h-4 w-4" />
                {needsResponseCount > 0 && (
                  <span className="absolute -right-1.5 -top-1.5 min-w-5 rounded-full bg-[#b1121b] px-1.5 py-0.5 text-center text-[10px] font-black text-white">
                    {needsResponseCount}
                  </span>
                )}
              </Link>

              <a
                href="mailto:info@mgautotech.de"
                className="hidden h-11 shrink-0 items-center justify-center rounded-xl border border-[#303640] bg-[#171a20] px-4 text-xs font-black text-white transition hover:border-zinc-500 hover:bg-[#20242b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 2xl:inline-flex"
              >
                <Wrench className="mr-2 h-4 w-4" />
                Support
              </a>

              <div className="hidden min-w-0 items-center gap-2 rounded-xl border border-[#303640] bg-[#171a20] px-3 py-2 2xl:flex">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-red-950/35 text-red-400">
                  <User className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="max-w-[155px] truncate text-xs font-black">{customerName}</div>
                  <div className="max-w-[155px] truncate text-[10px] text-zinc-400">{email}</div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleLogout}
                aria-label="Log out"
                className="flex h-11 shrink-0 items-center justify-center rounded-xl border border-[#303640] bg-[#171a20] px-3 text-xs font-bold text-white transition hover:border-zinc-500 hover:bg-[#20242b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
              >
                <LogOut className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          </header>

          <div
            role="region"
            aria-label="Dashboard content"
            tabIndex={0}
            className="mg-dense-scroll overscroll-contain px-4 py-4 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-red-400 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:px-5 xl:px-6"
          >
            {dashboardLoadError && dashboardReady && (
              <div
                role="alert"
                className="mb-4 flex flex-col gap-4 rounded-xl border border-amber-700/40 bg-amber-950/15 p-4 md:flex-row md:items-center md:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-amber-200">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    Sync needs retry
                  </div>
                  <p className="mt-2 break-words text-sm leading-6 text-amber-100/90">
                    {dashboardLoadError}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={retryDashboardLoad}
                  className="inline-flex shrink-0 items-center justify-center rounded-xl border border-amber-500/40 bg-black/25 px-5 py-3 text-sm font-black text-amber-100 transition hover:bg-amber-900/30"
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Try again
                </button>
              </div>
            )}

            <section
              data-dashboard-welcome
              aria-labelledby="dashboard-welcome-title"
              className="mb-3 rounded-xl border border-red-900/60 bg-[linear-gradient(100deg,rgba(177,18,27,0.22),rgba(20,22,27,0.96)_55%)] px-4 py-4 lg:px-5"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <h1 id="dashboard-welcome-title" className="break-words text-xl font-black sm:text-2xl">
                    Welcome, {customerName}
                  </h1>
                  <p className="mt-1 text-sm text-zinc-400">
                    {liveRefreshing
                      ? "Refreshing your latest file-service activity..."
                      : "Your requests, deliveries and credit activity in one place."}
                  </p>
                </div>
                <Link
                  href="/new-request"
                  className="inline-flex shrink-0 items-center justify-center rounded-xl bg-[#b1121b] px-5 py-3 text-sm font-black text-white transition hover:bg-[#c91824] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Create Request
                </Link>
              </div>

              {dashboardNextAction.key === "profile" && profileMissingItems.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {profileMissingItems.map((item) => (
                    <span
                      key={item}
                      className="max-w-full break-words rounded-full border border-amber-500/30 bg-black/25 px-2.5 py-1 text-[11px] font-bold text-amber-100"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              )}
            </section>

            <section
              data-dashboard-priority-summary
              aria-label="Request and credit summary"
              className="mb-3 grid grid-cols-2 gap-3 min-[1180px]:grid-cols-4"
            >
              <Link
                href="/dashboard/orders"
                className="group min-w-0 rounded-xl border border-[#303640] bg-[#20242c] p-4 transition hover:border-blue-500/40 hover:bg-[#252a33] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400">
                    <Clock3 className="h-6 w-6" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-xs font-bold text-zinc-400">Pending Requests</span>
                    <span className="mt-0.5 block text-3xl font-black tabular-nums text-blue-400">{pendingCount}</span>
                  </span>
                </div>
              </Link>

              <Link
                href="/dashboard/orders"
                className="group min-w-0 rounded-xl border border-[#303640] bg-[#20242c] p-4 transition hover:border-amber-500/40 hover:bg-[#252a33] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400">
                    <RefreshCw className="h-6 w-6" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-xs font-bold text-zinc-400">In Progress</span>
                    <span className="mt-0.5 block text-3xl font-black tabular-nums text-amber-400">{inProgressCount}</span>
                  </span>
                </div>
              </Link>

              <Link
                href="/dashboard/orders?view=completed"
                className="group min-w-0 rounded-xl border border-[#303640] bg-[#20242c] p-4 transition hover:border-emerald-500/40 hover:bg-[#252a33] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
                    <CheckCircle2 className="h-6 w-6" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-xs font-bold text-zinc-400">Completed</span>
                    <span className="mt-0.5 block text-3xl font-black tabular-nums text-emerald-400">{completedCount}</span>
                  </span>
                </div>
              </Link>

              <Link
                href="/dashboard/credits"
                className="group min-w-0 rounded-xl border border-[#303640] bg-[#20242c] p-4 transition hover:border-red-500/40 hover:bg-[#252a33] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-500/10 text-red-400">
                    <CreditCard className="h-6 w-6" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-xs font-bold text-zinc-400">Balance</span>
                    <span className="mt-0.5 block break-words text-2xl font-black tabular-nums text-red-400">{credits} Credits</span>
                  </span>
                </div>
              </Link>
            </section>

            <div
              data-dashboard-primary="recent-requests"
              className="mb-3 grid gap-3 min-[1180px]:grid-cols-[minmax(0,1.55fr)_minmax(20rem,0.85fr)]"
            >
              <section
                aria-labelledby="recent-requests-title"
                className="min-w-0 overflow-hidden rounded-xl border border-[#303640] bg-[#20242c]"
              >
                <div className="flex flex-col gap-3 border-b border-[#303640] px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 id="recent-requests-title" className="flex items-center gap-2 text-base font-black">
                      <FileText className="h-5 w-5 text-red-400" />
                      My Recent Requests
                    </h2>
                    <p className="mt-1 text-xs text-zinc-400">Your latest file orders and their current status</p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Link
                      href="/dashboard/orders"
                      className="inline-flex items-center justify-center rounded-lg border border-[#303030] bg-[#111] px-3 py-2 text-xs font-black text-white transition hover:border-zinc-500 hover:bg-[#181818] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                    >
                      <History className="mr-2 h-4 w-4" />
                      View All Orders
                    </Link>
                    <Link
                      href="/new-request"
                      className="inline-flex items-center justify-center rounded-lg bg-[#b1121b] px-3 py-2 text-xs font-black text-white transition hover:bg-[#c91824] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      New Request
                    </Link>
                  </div>
                </div>

                {orders.length === 0 ? (
                  <div className="m-4 rounded-lg border border-dashed border-[#3b414b] bg-[#171a20] p-6 text-center">
                    <Upload className="mx-auto mb-3 h-8 w-8 text-red-400" />
                    <h3 className="text-lg font-black">No file request yet</h3>
                    <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-400">
                      Create your first ECU/TCU file request and it will appear here.
                    </p>
                    <Link
                      href="/new-request"
                      className="mt-4 inline-flex rounded-lg bg-[#b1121b] px-4 py-2.5 text-sm font-black text-white transition hover:bg-[#c91824] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
                    >
                      Create File Request
                    </Link>
                  </div>
                ) : filteredOrders.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-[#303640] bg-[#171a20] p-6 text-center">
                    <Search className="mx-auto mb-3 h-8 w-8 text-red-400" />
                    <h3 className="text-lg font-black">No matching recent request</h3>
                    <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-400">
                      Try a vehicle, engine, service or status name. Full order history remains available.
                    </p>
                    <button
                      type="button"
                      onClick={() => setRequestSearch("")}
                      className="mt-4 rounded-lg border border-[#3b414b] bg-[#20242c] px-4 py-2.5 text-sm font-black text-white transition hover:border-red-500/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                    >
                      Clear search
                    </button>
                  </div>
                ) : (
                  <div className="min-w-0 overflow-hidden">
                    <div className="divide-y divide-[#303640]">
                      {filteredOrders.map((order) => {
                        const isCompleted = order.status === "completed";
                        const needsCustomerResponse =
                          order.status === "customer_info_needed";
                        const isRevision = order.status === "revision";
                        const OrderActionIcon = isCompleted
                          ? Download
                          : needsCustomerResponse
                            ? Clipboard
                            : Eye;

                        return (
                          <article
                            key={order.id}
                            className="grid min-w-0 gap-3 bg-[#20242c] p-3.5 transition hover:bg-[#252a33] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                          >
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="break-words font-black">
                                  {order.vehicle_brand || "Vehicle"}{" "}
                                  {order.vehicle_model || "request"}
                                </h3>
                                <span
                                  className={`rounded-full border px-2.5 py-1 text-[11px] font-black ${needsCustomerResponse
                                    ? "border-red-800/50 bg-red-950/30 text-red-200"
                                    : isRevision
                                      ? "border-purple-700/50 bg-purple-950/30 text-purple-200"
                                      : getStatusStyle(order.status)}`}
                                >
                                  {needsCustomerResponse
                                    ? "Needs your response"
                                    : isRevision
                                      ? "Revision review in progress"
                                      : formatStatus(order.status)}
                                </span>
                              </div>

                              <p className="mt-1 break-words text-sm text-zinc-400">
                                {order.vehicle_generation || "Generation not set"} ·{" "}
                                {order.vehicle_engine || "Engine not set"}
                              </p>
                              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                                <span className="font-bold text-red-300">
                                  {order.service_type || "Service not set"}
                                </span>
                                <time
                                  dateTime={order.created_at}
                                  className="text-zinc-400"
                                >
                                  {formatDate(order.created_at)}
                                </time>
                                <span className="text-zinc-400">
                                  {Number(order.credits_required ?? 0)} credits
                                </span>
                              </div>
                            </div>

                            <Link
                              href={`/dashboard/orders/${order.id}`}
                              aria-label={`${isCompleted ? "Open delivery" : needsCustomerResponse ? "Respond to" : "View"} ${order.vehicle_brand || "vehicle"} ${order.vehicle_model || "request"}`}
                              className="inline-flex w-full items-center justify-center rounded-lg border border-[#3b414b] bg-[#171a20] px-3 py-2 text-xs font-black text-white transition hover:border-red-500/60 hover:bg-[#292f39] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 sm:w-auto"
                            >
                              <OrderActionIcon className="mr-2 h-4 w-4" />
                              {isCompleted
                                ? "Open Delivery"
                                : needsCustomerResponse
                                  ? "Needs Response"
                                  : "Details"}
                            </Link>
                          </article>
                        );
                      })}
                    </div>
                  </div>
                )}
              </section>

              <aside aria-label="Credit activity and customer reference" className="space-y-3">
                <section
                  aria-labelledby="credit-history-title"
                  className="overflow-hidden rounded-xl border border-[#303640] bg-[#20242c]"
                >
                  <div className="flex items-center justify-between gap-3 border-b border-[#303640] px-4 py-3.5">
                    <div className="flex min-w-0 items-center gap-3">
                      <CreditCard className="h-5 w-5 shrink-0 text-red-400" />
                      <h2 id="credit-history-title" className="text-base font-black">Credit History</h2>
                    </div>
                    <Link
                      href="/dashboard/credits/history"
                      className="shrink-0 text-xs font-black text-red-400 transition hover:text-red-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                    >
                      View All
                    </Link>
                  </div>

                  {creditHistory.length === 0 ? (
                    <div className="p-6 text-center">
                      <CreditCard className="mx-auto mb-3 h-8 w-8 text-red-400" />
                      <h3 className="text-sm font-black text-white">No credit ledger movements yet</h3>
                      <p className="mt-2 text-xs leading-5 text-zinc-400">
                        Purchases, top-ups and file usage will appear here.
                      </p>
                      <Link
                        href="/dashboard/credits"
                        className="mt-4 inline-flex rounded-lg bg-[#b1121b] px-4 py-2 text-xs font-black text-white transition hover:bg-[#c91824] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
                      >
                        Buy Credits
                      </Link>
                    </div>
                  ) : (
                    <div className="divide-y divide-[#303640]">
                      {creditHistory.map((item) => {
                        const delta = Number(item.credits_delta ?? 0);
                        const isPositive = delta >= 0;
                        const typeLabel = formatCreditTransactionType(item.type);

                        return (
                          <div key={item.id} className="flex min-w-0 items-center gap-3 px-4 py-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-950/40 text-red-400">
                              <CreditCard className="h-4 w-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-bold">{item.description || typeLabel}</div>
                              <div className="mt-1 truncate text-[11px] text-zinc-400">
                                {typeLabel} · {formatDate(item.created_at)}
                              </div>
                            </div>
                            <div className="shrink-0 text-right">
                              <div
                                className={`text-sm font-black ${
                                  isPositive ? "text-emerald-400" : "text-red-500"
                                }`}
                              >
                                {isPositive ? "+" : ""}{delta} Credits
                              </div>
                              {item.balance_after !== null && item.balance_after !== undefined && (
                                <div className="mt-1 text-[10px] text-zinc-400">Balance {item.balance_after}</div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>

                <div className="rounded-xl border border-[#303640] bg-[#20242c] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[11px] font-black uppercase tracking-[0.18em] text-red-400">
                        Customer ID
                      </div>
                      <div className="mt-1 break-words font-black">
                        {customerReference ?? "Not available"}
                      </div>
                    </div>
                    <User className="h-5 w-5 shrink-0 text-red-400" />
                  </div>

                  <button
                    type="button"
                    onClick={copyReference}
                    disabled={!customerReference}
                    className="mt-3 inline-flex w-full items-center justify-center rounded-lg border border-[#3b414b] bg-[#171a20] px-4 py-2.5 text-xs font-black text-white transition hover:border-red-500/50 hover:bg-[#242932] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Clipboard className="mr-2 h-4 w-4" />
                    <span aria-live="polite">
                      {copiedReference ? "Copied" : "Copy Reference"}
                    </span>
                  </button>
                  <p className="mt-3 text-xs leading-5 text-zinc-400">
                    Use this Customer ID as payment reference for bank transfer
                    top-ups and support messages.
                  </p>
                </div>
              </aside>
            </div>

            <details className="group mb-3 overflow-hidden rounded-xl border border-[#292929] bg-[#0b0b0b]">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-4 marker:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-red-500">
                <span className="min-w-0">
                  <span className="block break-words text-lg font-black">
                    Quick Actions
                  </span>
                </span>
                <ArrowRight className="h-5 w-5 shrink-0 text-zinc-400 transition group-open:rotate-90" />
              </summary>

              <div className="border-t border-[#292929] p-4">
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
                  <Link
                    href="/dashboard/file-expert"
                    className="flex min-w-0 items-center justify-between rounded-lg border border-[#292929] bg-[#090909] px-3 py-3 text-sm font-black transition hover:border-red-800/60 hover:bg-[#121212] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <BrainCircuit className="h-4 w-4 shrink-0 text-red-400" />
                      <span className="break-words">AI File Expert</span>
                    </span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-zinc-400" />
                  </Link>
                  <Link
                    href="/dashboard/log-analysis"
                    className="flex min-w-0 items-center justify-between rounded-lg border border-[#292929] bg-[#090909] px-3 py-3 text-sm font-black transition hover:border-cyan-800/60 hover:bg-[#121212] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <Activity className="h-4 w-4 shrink-0 text-cyan-300" />
                      <span className="break-words">Datalog Studio</span>
                    </span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-zinc-400" />
                  </Link>
                  <Link
                    href="/dashboard/credits"
                    className="flex min-w-0 items-center justify-between rounded-lg border border-[#292929] bg-[#090909] px-3 py-3 text-sm font-black transition hover:border-red-800/60 hover:bg-[#121212] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <CreditCard className="h-4 w-4 shrink-0 text-red-400" />
                      <span className="break-words">Buy Credits</span>
                    </span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-zinc-400" />
                  </Link>
                  <Link
                    href="/dashboard/settings"
                    className="flex min-w-0 items-center justify-between rounded-lg border border-[#292929] bg-[#090909] px-3 py-3 text-sm font-black transition hover:border-red-800/60 hover:bg-[#121212] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <Settings className="h-4 w-4 shrink-0 text-red-400" />
                      <span className="break-words">Settings</span>
                    </span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-zinc-400" />
                  </Link>
                  <a
                    href="mailto:info@mgautotech.de"
                    className="flex min-w-0 items-center justify-between rounded-lg border border-[#292929] bg-[#090909] px-3 py-3 text-sm font-black transition hover:border-red-800/60 hover:bg-[#121212] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <Wrench className="h-4 w-4 shrink-0 text-red-400" />
                      <span className="break-words">Support</span>
                    </span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-zinc-400" />
                  </a>
                </div>
              </div>
            </details>

            <details className="group mb-3 overflow-hidden rounded-xl border border-[#292929] bg-[#0b0b0b]">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-4 marker:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-red-500">
                <span className="min-w-0">
                  <span className="block text-xs font-black uppercase tracking-[0.2em] text-red-500">
                    Customer Workflow Map
                  </span>
                  <span className="mt-1 block break-words text-lg font-black">
                    From preparation to delivery
                  </span>
                </span>
                <ArrowRight className="h-5 w-5 shrink-0 text-zinc-400 transition group-open:rotate-90" />
              </summary>

              <div className="border-t border-[#292929] p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="max-w-3xl text-sm leading-6 text-zinc-400">
                    Use the safe preparation tools first, submit through the secure
                    upload flow, then track every request from your private dashboard.
                  </p>
                  <span className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs font-black text-emerald-200">
                    No raw file is handled by these prep tools
                  </span>
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
                  {customerWorkflowSteps.map((step, index) => {
                    const StepIcon = step.icon;

                    return (
                      <Link
                        key={step.title}
                        href={step.href}
                        className="group/step min-w-0 rounded-lg border border-[#292929] bg-[#090909] p-3 transition hover:border-red-800/60 hover:bg-[#121212] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <StepIcon className="h-4 w-4 shrink-0 text-red-400" />
                          <span className="text-[11px] font-black text-zinc-400">
                            {String(index + 1).padStart(2, "0")}
                          </span>
                        </div>
                        <h3 className="mt-3 break-words text-sm font-black">
                          {step.title}
                        </h3>
                        <p className="mt-1 break-words text-xs leading-5 text-zinc-400">
                          {step.detail}
                        </p>
                        <div className="mt-3 break-words text-[11px] font-black uppercase tracking-[0.12em] text-red-300">
                          {step.metric}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            </details>

          </div>
        </section>
      </div>
    </main>
  );
}
