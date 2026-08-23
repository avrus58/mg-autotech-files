import { NextResponse } from "next/server";
import { requireStaffPermission } from "@/lib/apiAuth";
import { getDesktopAppCheckPayload, desktopAppCurrentVersion } from "@/lib/desktopUpload/appCheck";
import { getTransactionalEmailProviderStatus } from "@/lib/email/service";
import {
  buildOperationsQueueSummary,
  getCustomerProfileReadiness,
  type OperationsProfile,
} from "@/lib/operationsIntelligence";
import { hasStaffPermission } from "@/lib/staffPermissions";
import { buildAdminRequestAccess } from "@/lib/workOrders/access";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getAdminRequestList } from "@/lib/workOrders/server";
import { getSeoGrowthConfiguration } from "@/lib/seoGrowth/config";

const privateNoStoreHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  Vary: "Authorization",
};

type QueryState<T> = {
  available: boolean;
  data: T;
  warning: string | null;
};

async function loadProfiles(enabled: boolean): Promise<QueryState<OperationsProfile[]>> {
  if (!enabled) return { available: false, data: [], warning: "Customer access is not assigned." };
  try {
    const admin = getSupabaseAdmin();
    const result = await admin
      .from("profiles")
      .select("id,email,customer_id,full_name,account_type,company_name,phone,street,postal_code,city,country,invoice_email,preferred_contact,account_status,created_at")
      .eq("role", "customer")
      .order("created_at", { ascending: false })
      .limit(2000);
    if (result.error) return { available: false, data: [], warning: "Customer profiles could not be summarized." };
    return { available: true, data: (result.data ?? []) as OperationsProfile[], warning: null };
  } catch {
    return { available: false, data: [], warning: "Customer profiles could not be summarized." };
  }
}

async function loadEmailEvents(): Promise<QueryState<Array<Record<string, unknown>>>> {
  try {
    const admin = getSupabaseAdmin();
    const result = await admin
      .from("email_events")
      .select("id,event_type,status,provider,created_at,sent_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (result.error) return { available: false, data: [], warning: "Email event log is unavailable." };
    return { available: true, data: result.data ?? [], warning: null };
  } catch {
    return { available: false, data: [], warning: "Email event log is unavailable." };
  }
}

async function loadVehicleCache(enabled: boolean): Promise<QueryState<Record<string, unknown> | null>> {
  if (!enabled) return { available: false, data: null, warning: "Vehicle management access is not assigned." };
  try {
    const admin = getSupabaseAdmin();
    const result = await admin
      .from("public_vehicle_catalog_cache")
      .select("id,version,brand_count,model_count,generation_count,engine_count,generated_at,is_active,updated_at")
      .eq("id", "published")
      .maybeSingle();
    if (result.error) return { available: false, data: null, warning: "Public vehicle cache could not be checked." };
    return { available: true, data: result.data, warning: result.data ? null : "Published vehicle cache is missing." };
  } catch {
    return { available: false, data: null, warning: "Public vehicle cache could not be checked." };
  }
}

async function loadNotificationCount(): Promise<QueryState<number>> {
  try {
    const admin = getSupabaseAdmin();
    const result = await admin
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .is("read_at", null);
    if (result.error) return { available: false, data: 0, warning: "Notification queue could not be checked." };
    return { available: true, data: result.count ?? 0, warning: null };
  } catch {
    return { available: false, data: 0, warning: "Notification queue could not be checked." };
  }
}

async function loadSecurityAudit(enabled: boolean): Promise<QueryState<Array<Record<string, unknown>>>> {
  if (!enabled) return { available: false, data: [], warning: "Security audit access is owner-only." };
  try {
    const admin = getSupabaseAdmin();
    const result = await admin
      .from("staff_audit_log")
      .select("id,actor_id,target_user_id,action,created_at")
      .order("created_at", { ascending: false })
      .limit(20);
    if (result.error) return { available: false, data: [], warning: "Staff audit log could not be loaded." };
    return { available: true, data: result.data ?? [], warning: null };
  } catch {
    return { available: false, data: [], warning: "Staff audit log could not be loaded." };
  }
}

export async function GET(request: Request) {
  const auth = await requireStaffPermission(request, "orders.view");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status, headers: privateNoStoreHeaders });
  }

  try {
    const canViewCustomers = hasStaffPermission(auth.access, "customers.view");
    const canManageVehicles = hasStaffPermission(auth.access, "vehicles.manage");
    const canViewSecurityAudit = hasStaffPermission(auth.access, "staff.manage");
    const [requests, profiles, emailEvents, vehicleCache, notifications, securityAudit] = await Promise.all([
      getAdminRequestList(buildAdminRequestAccess(auth.access)),
      loadProfiles(canViewCustomers),
      loadEmailEvents(),
      loadVehicleCache(canManageVehicles),
      loadNotificationCount(),
      loadSecurityAudit(canViewSecurityAudit),
    ]);

    const queue = buildOperationsQueueSummary(requests.items);
    const profileRows = profiles.data.map((profile) => ({
      profile,
      readiness: getCustomerProfileReadiness(profile),
    }));
    const incompleteProfiles = profileRows
      .filter((row) => !row.readiness.complete)
      .sort((left, right) => left.readiness.percent - right.readiness.percent)
      .slice(0, 10)
      .map(({ profile, readiness }) => ({
        id: profile.id,
        customerId: profile.customer_id,
        name: profile.full_name || profile.company_name || profile.email || "Customer",
        email: profile.email,
        accountStatus: profile.account_status || "active",
        readiness,
      }));
    const averageProfileCompletion = profileRows.length
      ? Math.round(profileRows.reduce((sum, row) => sum + row.readiness.percent, 0) / profileRows.length)
      : 0;

    const emailSummary = {
      sent: emailEvents.data.filter((event) => event.status === "sent").length,
      skipped: emailEvents.data.filter((event) => event.status === "skipped").length,
      failed: emailEvents.data.filter((event) => event.status === "failed").length,
      pending: emailEvents.data.filter((event) => event.status === "pending").length,
    };
    const provider = getTransactionalEmailProviderStatus();
    const desktop = getDesktopAppCheckPayload({ appVersion: desktopAppCurrentVersion });
    const seoMeasurement = getSeoGrowthConfiguration();

    const latestOrders = requests.items.slice(0, 5).map((item) => ({
      id: item.order.id,
      reference: `#${item.order.id.slice(0, 8).toUpperCase()}`,
      customer: item.customer?.full_name || item.customer?.company_name || item.order.customer_email || "Customer",
      customerId: item.customer?.customer_id || null,
      vehicle: [item.order.vehicle_brand, item.order.vehicle_model, item.order.vehicle_engine].filter(Boolean).join(" ") || "Vehicle not set",
      service: item.order.service_type || "Service not set",
      status: item.queueProjection.state,
      statusLabel: item.queueProjection.stateLabel,
      priority: item.workOrder?.priority || "normal",
      etaLabel: item.queueProjection.eta.label,
      createdAt: item.order.created_at,
      needsAttention: item.queueProjection.isBlocked || ["expert_review", "quality_check"].includes(item.queueProjection.state),
    }));

    const health = [
      {
        key: "orders",
        label: "Order data",
        status: "healthy",
        detail: `${queue.total} requests loaded from the protected work-order source.`,
      },
      {
        key: "work_orders",
        label: "Work-order schema",
        status: requests.migrationReady ? "healthy" : "warning",
        detail: requests.migrationReady ? "Work-order status, priority and ETA fields are available." : "Legacy fallback is active; work-order migration needs review.",
      },
      {
        key: "email",
        label: "Transactional email",
        status: !emailEvents.available || emailSummary.failed > 0 ? "warning" : "healthy",
        detail: emailEvents.available
          ? `${emailSummary.failed} failed and ${emailSummary.pending} pending in the latest ${emailEvents.data.length} events.`
          : emailEvents.warning,
      },
      {
        key: "vehicle_cache",
        label: "Public vehicle cache",
        status: vehicleCache.data && vehicleCache.data.is_active ? "healthy" : "warning",
        detail: vehicleCache.data
          ? `${Number(vehicleCache.data.brand_count || 0)} brands, generated ${String(vehicleCache.data.generated_at || "unknown")}.`
          : vehicleCache.warning,
      },
      {
        key: "notifications",
        label: "Customer notifications",
        status: notifications.available ? "healthy" : "warning",
        detail: notifications.available ? `${notifications.data} customer notifications are currently unread.` : notifications.warning,
      },
      {
        key: "seo_measurement",
        label: "SEO index and conversion measurement",
        status: seoMeasurement.searchConsoleConfigured && seoMeasurement.analyticsConfigured ? "healthy" : "warning",
        detail: seoMeasurement.searchConsoleConfigured && seoMeasurement.analyticsConfigured
          ? "Search Console query/index signals and aggregate GA4 request conversion reporting are configured."
          : "Search Console or GA4 server reporting still needs configuration review; public consent controls remain active.",
      },
      {
        key: "desktop",
        label: "Desktop beta channel",
        status: desktop.maintenance_mode || !desktop.desktop_upload_enabled || desktop.update_required ? "warning" : "healthy",
        detail: desktop.maintenance_mode
          ? "Maintenance mode is active."
          : desktop.desktop_upload_enabled
            ? `Version ${desktop.latest_version}; customer upload API is enabled.`
            : "Desktop customer upload is disabled.",
      },
    ];

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      access: {
        role: auth.access.role,
        staffRole: auth.access.staffRole,
        permissions: auth.access.permissions,
      },
      health,
      queue,
      latestOrders,
      customers: {
        available: profiles.available,
        warning: profiles.warning,
        total: profileRows.length,
        complete: profileRows.filter((row) => row.readiness.complete).length,
        incomplete: profileRows.filter((row) => !row.readiness.complete).length,
        blocked: profileRows.filter((row) => row.profile.account_status === "blocked").length,
        averageCompletion: averageProfileCompletion,
        incompleteProfiles,
      },
      communications: {
        email: {
          available: emailEvents.available,
          warning: emailEvents.warning,
          provider: provider.provider,
          configured: provider.configured,
          dryRun: provider.dryRun,
          sendingEnabled: provider.sendingEnabled,
          summary: emailSummary,
        },
        notifications: {
          available: notifications.available,
          warning: notifications.warning,
          unread: notifications.data,
        },
      },
      vehicleCache: {
        available: vehicleCache.available,
        warning: vehicleCache.warning,
        snapshot: vehicleCache.data,
      },
      desktop,
      security: {
        available: securityAudit.available,
        warning: securityAudit.warning,
        recentEvents: securityAudit.data,
        accessContext: {
          role: auth.access.role,
          staffRole: auth.access.staffRole,
          permissions: auth.access.permissions,
        },
      },
    }, { headers: privateNoStoreHeaders });
  } catch {
    return NextResponse.json(
      { error: "Operations Intelligence snapshot could not be loaded." },
      { status: 500, headers: privateNoStoreHeaders }
    );
  }
}
