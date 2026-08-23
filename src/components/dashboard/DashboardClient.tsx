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
  Braces,
  CheckCircle2,
  Clipboard,
  Clock3,
  CreditCard,
  Download,
  Eye,
  FileText,
  Gauge,
  History,
  Home,
  LayoutDashboard,
  LogOut,
  Plus,
  RefreshCw,
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

export function DashboardClient() {
  const router = useRouter();

  const [email, setEmail] = useState<string | null>(null);
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
          setCredits(Number(dashboardProfile.credit_balance ?? 0));
          setCustomerId(dashboardProfile.customer_id ?? null);
          setProfileMissingItems(getProfileCompletionMissingItems(dashboardProfile));
        } else {
          setCredits(0);
          setCustomerId(null);
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
        tone: "border-orange-700/40 bg-orange-950/20 text-orange-100",
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
    <main className="mg-compact-ui min-h-screen bg-[#050505] text-white">
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_20%_0%,rgba(160,18,28,0.24),transparent_32%),linear-gradient(135deg,#050505,#0d0d0f_48%,#160608)]" />

      <div className="flex min-h-screen">
        <aside className="hidden w-64 shrink-0 border-r border-white/10 bg-black/70 lg:block">
          <div className="sticky top-0 flex h-screen flex-col px-4 py-5">
            <Link href="/" className="mb-8 flex items-center gap-3">
              <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl border border-red-800/50 bg-[#111] shadow-lg shadow-red-950/40">
                <div className="absolute -top-2 h-5 w-10 rounded-t-full border-t-2 border-red-700" />
                <Gauge className="h-7 w-7 text-red-600" />
              </div>

              <div>
                <div className="text-xl font-black tracking-wide">
                  MG <span className="text-red-600">AUTOTECH</span>
                </div>
                <div className="text-xs text-zinc-400">Customer Panel</div>
              </div>
            </Link>

            <nav
              aria-label="Customer Dashboard"
              className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1 text-sm"
            >
              <Link
                href="/dashboard"
                aria-current="page"
                className="flex items-center gap-3 rounded-2xl bg-red-950/35 px-4 py-3 font-bold text-white"
              >
                <LayoutDashboard className="h-5 w-5 text-red-500" />
                Dashboard
              </Link>

              <Link
                href="/new-request"
                className="flex items-center gap-3 rounded-2xl px-4 py-3 font-bold text-zinc-400 transition hover:bg-white/[0.06] hover:text-white"
              >
                <Upload className="h-5 w-5" />
                New File Request
              </Link>

              <Link
                href="/dashboard/file-expert"
                className="flex items-center gap-3 rounded-2xl px-4 py-3 font-bold text-zinc-400 transition hover:bg-white/[0.06] hover:text-white"
              >
                <BrainCircuit className="h-5 w-5" />
                AI File Expert
              </Link>

              <Link
                href="/dashboard/log-analysis"
                className="flex items-center gap-3 rounded-2xl px-4 py-3 font-bold text-zinc-400 transition hover:bg-white/[0.06] hover:text-white"
              >
                <Activity className="h-5 w-5" />
                Datalog Analysis Studio
              </Link>

              <Link
                href="/dashboard/widget"
                className="flex items-center gap-3 rounded-2xl px-4 py-3 font-bold text-zinc-400 transition hover:bg-white/[0.06] hover:text-white"
              >
                <Braces className="h-5 w-5" />
                Vehicle Widget
              </Link>

              <Link
                href="/dashboard/orders"
                className="flex items-center gap-3 rounded-2xl px-4 py-3 font-bold text-zinc-400 transition hover:bg-white/[0.06] hover:text-white"
              >
                <FileText className="h-5 w-5" />
                Active Orders
              </Link>

              <Link
                href="/dashboard/orders?view=needs_response"
                className="flex items-center gap-3 rounded-2xl px-4 py-3 font-bold text-zinc-400 transition hover:bg-white/[0.06] hover:text-white"
              >
                <Clipboard className="h-5 w-5" />
                Needs Response
              </Link>

              <Link
                href="/dashboard/orders?view=completed"
                className="flex items-center gap-3 rounded-2xl px-4 py-3 font-bold text-zinc-400 transition hover:bg-white/[0.06] hover:text-white"
              >
                <History className="h-5 w-5" />
                Order History
              </Link>

              <Link
                href="/dashboard/credits"
                className="flex items-center gap-3 rounded-2xl px-4 py-3 font-bold text-zinc-400 transition hover:bg-white/[0.06] hover:text-white"
              >
                <CreditCard className="h-5 w-5" />
                Buy Credits
              </Link>

              <Link
                href="/dashboard/credits/history"
                className="flex items-center gap-3 rounded-2xl px-4 py-3 font-bold text-zinc-400 transition hover:bg-white/[0.06] hover:text-white"
              >
                <History className="h-5 w-5" />
                Credit History
              </Link>

              <Link
                href="/dashboard/notifications"
                className="flex items-center gap-3 rounded-2xl px-4 py-3 font-bold text-zinc-400 transition hover:bg-white/[0.06] hover:text-white"
              >
                <BellRing className="h-5 w-5" />
                Notifications
              </Link>

              <Link
                href="/dashboard/settings"
                className="flex items-center gap-3 rounded-2xl px-4 py-3 font-bold text-zinc-400 transition hover:bg-white/[0.06] hover:text-white"
              >
                <Settings className="h-5 w-5" />
                Settings
              </Link>

              <a
                href="mailto:info@mgautotech.de"
                className="flex items-center gap-3 rounded-2xl px-4 py-3 font-bold text-zinc-400 transition hover:bg-white/[0.06] hover:text-white"
              >
                <Wrench className="h-5 w-5" />
                Support
              </a>
            </nav>

            <div className="mt-5 shrink-0 rounded-3xl border border-red-900/40 bg-red-950/20 p-5">
              <div className="text-xs font-bold uppercase tracking-[0.2em] text-red-400">
                Current Balance
              </div>
              <div className="mt-2 text-4xl font-black">{credits}</div>
              <div className="mt-1 text-xs text-zinc-400">Available Credits</div>
            </div>
          </div>
        </aside>

        <section className="min-w-0 flex-1">
          <header className="sticky top-0 z-40 border-b border-white/10 bg-black/75 backdrop-blur-xl">
            <div className="flex items-center justify-between gap-4 px-4 py-3 lg:px-6 xl:px-8">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.25em] text-red-600">
                  Customer Dashboard
                </div>
                <h1 className="mt-1 text-2xl font-black md:text-3xl">
                  File Service Panel
                </h1>
              </div>

              <div className="flex items-center gap-3">
                <div className="hidden items-center gap-2 rounded-2xl border border-emerald-700/30 bg-emerald-950/20 px-4 py-3 text-xs font-black text-emerald-300 xl:flex">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  {liveRefreshing ? "Syncing" : "Live sync"}
                </div>

                <div className="hidden rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 xl:block">
                  <div className="text-xs text-zinc-500">Logged in as</div>
                  <div className="max-w-[220px] truncate text-sm font-bold">
                    {email}
                  </div>
                  {customerId && (
                    <div className="mt-1 text-xs font-black text-red-400">
                      {customerId}
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border border-red-900/40 bg-red-950/25 px-4 py-3">
                  <div className="text-xs text-zinc-500">Credits</div>
                  <div className="text-sm font-black text-white">{credits}</div>
                </div>

                <button
                  onClick={handleLogout}
                  className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-bold text-white transition hover:bg-white/10"
                >
                  <LogOut className="mr-2 inline h-4 w-4" />
                  Logout
                </button>
              </div>
            </div>
          </header>

          <nav
            aria-label="Customer Dashboard"
            className="flex gap-2 overflow-x-auto border-b border-white/10 bg-black/45 px-4 py-3 lg:hidden"
          >
            <Link href="/dashboard" aria-current="page" className="shrink-0 rounded-xl border border-red-800/50 bg-red-950/30 px-4 py-2.5 text-xs font-black">
              <Home className="mr-2 inline h-4 w-4" />Dashboard
            </Link>
            <Link href="/new-request" className="shrink-0 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-xs font-black">
              <Upload className="mr-2 inline h-4 w-4" />New Request
            </Link>
            <Link href="/dashboard/log-analysis" className="shrink-0 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-xs font-black">
              <Activity className="mr-2 inline h-4 w-4" />Datalog Studio
            </Link>
            <Link href="/dashboard/orders" className="shrink-0 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-xs font-black">
              <FileText className="mr-2 inline h-4 w-4" />Orders
            </Link>
            <Link href="/dashboard/orders?view=needs_response" className="shrink-0 rounded-xl border border-orange-700/40 bg-orange-950/25 px-4 py-2.5 text-xs font-black text-orange-100">
              <Clipboard className="mr-2 inline h-4 w-4" />Needs Response
            </Link>
            <Link href="/dashboard/credits" className="shrink-0 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-xs font-black">
              <CreditCard className="mr-2 inline h-4 w-4" />Credits
            </Link>
          </nav>

          <div className="px-4 py-5 lg:px-6 xl:px-8">
            {dashboardLoadError && dashboardReady && (
              <div
                role="alert"
                className="mb-6 flex flex-col gap-4 rounded-[2rem] border border-amber-700/40 bg-amber-950/20 p-5 shadow-2xl shadow-black/20 md:flex-row md:items-center md:justify-between"
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

            <div
              data-dashboard-primary="recent-requests"
              className="mb-6 grid gap-5 min-[1180px]:grid-cols-[minmax(0,1fr)_20rem]"
            >
              <section
                aria-labelledby="recent-requests-title"
                className="min-w-0 rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-2xl shadow-black/20 lg:p-5"
              >
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-xs font-black uppercase tracking-[0.2em] text-red-500">
                      Recent Requests
                    </div>
                    <h2 id="recent-requests-title" className="mt-1 text-2xl font-black">
                      Your latest file orders
                    </h2>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Link
                      href="/dashboard/orders"
                      className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-black/25 px-4 py-2.5 text-xs font-black text-white transition hover:bg-white/10"
                    >
                      <History className="mr-2 h-4 w-4" />
                      View All Orders
                    </Link>
                    <Link
                      href="/new-request"
                      className="inline-flex items-center justify-center rounded-xl bg-[#b1121b] px-4 py-2.5 text-xs font-black text-white transition hover:bg-[#c91824]"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      New Request
                    </Link>
                  </div>
                </div>

                {orders.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/15 bg-black/25 p-6 text-center">
                    <Upload className="mx-auto mb-3 h-8 w-8 text-red-500" />
                    <h3 className="text-lg font-black">No file request yet</h3>
                    <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-400">
                      Create your first ECU/TCU file request and it will appear here.
                    </p>
                    <Link
                      href="/new-request"
                      className="mt-4 inline-flex rounded-xl bg-[#b1121b] px-4 py-2.5 text-sm font-black text-white transition hover:bg-[#c91824]"
                    >
                      Create File Request
                    </Link>
                  </div>
                ) : (
                  <div className="min-w-0 overflow-hidden rounded-2xl border border-white/10">
                    <div className="divide-y divide-white/10">
                      {orders.map((order) => {
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
                            className="grid min-w-0 gap-3 bg-black/20 p-4 transition hover:bg-white/[0.04] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                          >
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="break-words font-black">
                                  {order.vehicle_brand || "Vehicle"}{" "}
                                  {order.vehicle_model || "request"}
                                </h3>
                                <span
                                  className={`rounded-full border px-2.5 py-1 text-[11px] font-black ${needsCustomerResponse
                                    ? "border-orange-700/50 bg-orange-950/30 text-orange-200"
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
                              className="inline-flex w-full items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-xs font-black text-white transition hover:border-red-800/60 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 sm:w-auto"
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

              <aside
                aria-label="Customer Dashboard"
                className="space-y-4"
              >
                <div
                  className={`rounded-3xl border p-4 shadow-2xl shadow-black/20 ${dashboardNextAction.tone}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-black/30">
                      <NextActionIcon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="break-words text-[11px] font-black uppercase tracking-[0.18em]">
                        Next best action - {dashboardNextAction.eyebrow}
                      </div>
                      <h2 className="mt-1 break-words text-lg font-black">
                        {dashboardNextAction.title}
                      </h2>
                    </div>
                  </div>

                  <p className="mt-3 text-sm leading-6 opacity-85">
                    {dashboardNextAction.description}
                  </p>

                  {dashboardNextAction.key === "profile" &&
                    profileMissingItems.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {profileMissingItems.map((item) => (
                          <span
                            key={item}
                            className="max-w-full break-words rounded-full border border-amber-600/30 bg-black/25 px-2.5 py-1 text-[11px] font-bold text-amber-100"
                          >
                            {item}
                          </span>
                        ))}
                      </div>
                    )}

                  <Link
                    href={dashboardNextAction.href}
                    className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-white px-4 py-2.5 text-xs font-black text-black transition hover:bg-zinc-100"
                  >
                    {dashboardNextAction.cta}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </div>

                <section
                  aria-label="Customer Dashboard"
                  data-dashboard-priority-summary
                  className="grid grid-cols-2 gap-2 sm:grid-cols-4 min-[1180px]:grid-cols-2"
                >
                  <Link
                    href="/dashboard/orders"
                    className="min-w-0 rounded-2xl border border-blue-800/35 bg-blue-950/15 p-3 transition hover:border-blue-500/60 hover:bg-blue-950/25"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-2xl font-black">{activeCount}</span>
                      <Clock3 className="h-4 w-4 shrink-0 text-blue-400" />
                    </div>
                    <div className="mt-1 break-words text-[11px] font-black uppercase tracking-[0.12em] text-blue-200">
                      Active Orders
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-1 text-[11px] text-zinc-400">
                      <span>
                        {pendingCount} <span>Pending Requests</span>
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>
                        {inProgressCount} <span>In Progress</span>
                      </span>
                    </div>
                  </Link>

                  <Link
                    href="/dashboard/orders?view=needs_response"
                    className="min-w-0 rounded-2xl border border-orange-700/40 bg-orange-950/20 p-3 transition hover:border-orange-500/70 hover:bg-orange-950/30"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-2xl font-black">{needsResponseCount}</span>
                      <Clipboard className="h-4 w-4 shrink-0 text-orange-300" />
                    </div>
                    <div className="mt-1 break-words text-[11px] font-black uppercase tracking-[0.12em] text-orange-100">
                      Needs Response
                    </div>
                    <div className="mt-1 break-words text-[11px] text-orange-200/80">
                      Waiting for your information
                    </div>
                  </Link>

                  <Link
                    href="/dashboard/orders?view=completed"
                    className="min-w-0 rounded-2xl border border-emerald-800/35 bg-emerald-950/15 p-3 transition hover:border-emerald-600/60 hover:bg-emerald-950/25"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-2xl font-black">{completedCount}</span>
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                    </div>
                    <div className="mt-1 break-words text-[11px] font-black uppercase tracking-[0.12em] text-emerald-200">
                      Completed
                    </div>
                  </Link>

                  <Link
                    href="/dashboard/credits"
                    className="min-w-0 rounded-2xl border border-red-900/45 bg-red-950/20 p-3 transition hover:border-red-700/70 hover:bg-red-950/30"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-2xl font-black">{credits}</span>
                      <CreditCard className="h-4 w-4 shrink-0 text-red-400" />
                    </div>
                    <div className="mt-1 break-words text-[11px] font-black uppercase tracking-[0.12em] text-red-200">
                      Credits
                    </div>
                  </Link>
                </section>

                <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[11px] font-black uppercase tracking-[0.18em] text-red-500">
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
                    className="mt-3 inline-flex w-full items-center justify-center rounded-xl border border-white/10 bg-black/25 px-4 py-2.5 text-xs font-black text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:cursor-not-allowed disabled:opacity-50"
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

            <details className="group mb-4 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04]">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-4 marker:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-red-500">
                <span className="min-w-0">
                  <span className="block break-words text-lg font-black">
                    Quick Actions
                  </span>
                </span>
                <ArrowRight className="h-5 w-5 shrink-0 text-zinc-400 transition group-open:rotate-90" />
              </summary>

              <div className="border-t border-white/10 p-4">
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
                <Link
                  href="/dashboard/file-expert"
                  className="flex min-w-0 items-center justify-between rounded-xl border border-white/10 bg-black/25 px-3 py-3 text-sm font-black transition hover:border-red-800/60 hover:bg-white/[0.06]"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <BrainCircuit className="h-4 w-4 shrink-0 text-red-400" />
                    <span className="break-words">AI File Expert</span>
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-zinc-500" />
                </Link>
                <Link
                  href="/dashboard/log-analysis"
                  className="flex min-w-0 items-center justify-between rounded-xl border border-white/10 bg-black/25 px-3 py-3 text-sm font-black transition hover:border-cyan-800/60 hover:bg-white/[0.06]"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <Activity className="h-4 w-4 shrink-0 text-cyan-300" />
                    <span className="break-words">Datalog Studio</span>
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-zinc-500" />
                </Link>
                <Link
                  href="/dashboard/credits"
                  className="flex min-w-0 items-center justify-between rounded-xl border border-white/10 bg-black/25 px-3 py-3 text-sm font-black transition hover:border-red-800/60 hover:bg-white/[0.06]"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <CreditCard className="h-4 w-4 shrink-0 text-red-400" />
                    <span className="break-words">Buy Credits</span>
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-zinc-500" />
                </Link>
                <Link
                  href="/dashboard/settings"
                  className="flex min-w-0 items-center justify-between rounded-xl border border-white/10 bg-black/25 px-3 py-3 text-sm font-black transition hover:border-red-800/60 hover:bg-white/[0.06]"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <Settings className="h-4 w-4 shrink-0 text-red-400" />
                    <span className="break-words">Settings</span>
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-zinc-500" />
                </Link>
                <a
                  href="mailto:info@mgautotech.de"
                  className="flex min-w-0 items-center justify-between rounded-xl border border-white/10 bg-black/25 px-3 py-3 text-sm font-black transition hover:border-red-800/60 hover:bg-white/[0.06]"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <Wrench className="h-4 w-4 shrink-0 text-red-400" />
                    <span className="break-words">Support</span>
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-zinc-500" />
                </a>
                </div>
              </div>
            </details>

            <details className="group mb-4 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04]">
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

              <div className="border-t border-white/10 p-4">
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
                        className="group/step min-w-0 rounded-2xl border border-white/10 bg-black/25 p-3 transition hover:border-red-800/60 hover:bg-white/[0.05]"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <StepIcon className="h-4 w-4 shrink-0 text-red-400" />
                          <span className="text-[11px] font-black text-zinc-500">
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

            <details className="group overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04]">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-4 marker:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-red-500">
                <span className="min-w-0">
                  <span className="block text-xs font-black uppercase tracking-[0.2em] text-red-500">
                    Credit History
                  </span>
                </span>
                <ArrowRight className="h-5 w-5 shrink-0 text-zinc-400 transition group-open:rotate-90" />
              </summary>

              <div className="border-t border-white/10 p-4">
                <div className="mb-4 flex justify-end">
                  <Link
                    href="/dashboard/credits/history"
                    className="rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-xs font-black text-white transition hover:bg-white/10"
                  >
                    View All
                  </Link>
                </div>

                {creditHistory.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-white/15 bg-black/25 p-8 text-center">
                    <CreditCard className="mx-auto mb-4 h-9 w-9 text-red-500" />
                    <h3 className="text-lg font-black text-white">
                      No credit ledger movements yet
                    </h3>
                    <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-zinc-400">
                      Credit purchases, admin top-ups and file usage will appear here
                      once they are recorded in your ledger.
                    </p>
                    <div className="mt-5 flex flex-wrap justify-center gap-3">
                      <Link
                        href="/dashboard/credits"
                        className="rounded-xl bg-[#b1121b] px-4 py-2.5 text-xs font-black text-white transition hover:bg-[#c91824]"
                      >
                        Buy Credits
                      </Link>
                      <Link
                        href="/dashboard/credits/history"
                        className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-xs font-black text-white transition hover:bg-white/10"
                      >
                        Full Ledger
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {creditHistory.map((item) => {
                      const delta = Number(item.credits_delta ?? 0);
                      const isPositive = delta >= 0;
                      const typeLabel = formatCreditTransactionType(item.type);

                      return (
                        <div
                          key={item.id}
                          className="flex flex-col gap-4 rounded-2xl bg-black/30 p-4 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="min-w-0">
                            <div className="break-words font-bold">
                              {item.description || typeLabel}
                            </div>
                            <div className="mt-1 break-words text-xs text-zinc-500">
                              {typeLabel} - {formatDate(item.created_at)}
                            </div>
                          </div>

                          <div className="flex shrink-0 items-center justify-between gap-4 sm:flex-col sm:items-end sm:gap-1">
                            {item.balance_after !== null && item.balance_after !== undefined && (
                              <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-black text-zinc-300">
                                Balance {item.balance_after}
                              </div>
                            )}

                            <div
                              className={`text-xl font-black ${
                                isPositive ? "text-emerald-400" : "text-red-500"
                              }`}
                            >
                              {isPositive ? "+" : ""}
                              {delta}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </details>
          </div>
        </section>
      </div>
    </main>
  );
}
