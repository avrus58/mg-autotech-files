import { NextResponse } from "next/server";
import { requireStaffPermission } from "@/lib/apiAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(request: Request) {
  const auth = await requireStaffPermission(request, "widget.manage");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const admin = getSupabaseAdmin();
  const clients = await admin.from("widget_clients").select("*").order("created_at", { ascending: false }).limit(500);
  if (clients.error) {
    const setupRequired = clients.error.code === "42P01" || clients.error.message.includes("schema cache");
    return NextResponse.json({ error: setupRequired ? "Run scripts/add-vehicle-widget-saas.sql first." : clients.error.message, setupRequired }, { status: setupRequired ? 503 : 500 });
  }
  const clientRows = clients.data ?? [];
  const clientIds = clientRows.map((client) => client.id);
  const pendingRequestsByClient = new Map<string, { count: number; latest: string | null }>();
  if (clientIds.length > 0) {
    const pendingRequests = await admin
      .from("widget_domain_change_requests")
      .select("client_id, requested_domain, created_at")
      .in("client_id", clientIds)
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    if (pendingRequests.error) {
      const setupRequired = pendingRequests.error.code === "42P01" || pendingRequests.error.message.includes("schema cache");
      return NextResponse.json({ error: setupRequired ? "Run scripts/add-vehicle-widget-saas.sql first." : pendingRequests.error.message, setupRequired }, { status: setupRequired ? 503 : 500 });
    }
    for (const request of pendingRequests.data ?? []) {
      const current = pendingRequestsByClient.get(request.client_id) ?? { count: 0, latest: null };
      current.count += 1;
      current.latest ??= request.requested_domain;
      pendingRequestsByClient.set(request.client_id, current);
    }
  }
  const start = new Date(); start.setUTCDate(1); start.setUTCHours(0, 0, 0, 0);
  const enriched = await Promise.all(clientRows.map(async (client) => {
    const [allowed, blocked, key] = await Promise.all([
      admin.from("widget_access_logs").select("id", { count: "exact", head: true }).eq("client_id", client.id).eq("status", "allowed").in("path", ["/api/widget/config", "/embed/vehicle-selector"]).gte("created_at", start.toISOString()),
      admin.from("widget_access_logs").select("id", { count: "exact", head: true }).eq("client_id", client.id).eq("status", "blocked").gte("created_at", start.toISOString()),
      admin.from("widget_api_keys").select("public_key").eq("client_id", client.id).eq("is_active", true).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    const pendingDomainRequests = pendingRequestsByClient.get(client.id);
    return { ...client, public_key: key.data?.public_key ?? null, usage_this_month: allowed.count ?? 0, blocked_this_month: blocked.count ?? 0, pending_domain_request_count: pendingDomainRequests?.count ?? 0, latest_requested_domain: pendingDomainRequests?.latest ?? null };
  }));
  return NextResponse.json({ clients: enriched });
}
