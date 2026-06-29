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
  const start = new Date(); start.setUTCDate(1); start.setUTCHours(0, 0, 0, 0);
  const enriched = await Promise.all((clients.data ?? []).map(async (client) => {
    const [allowed, blocked, key] = await Promise.all([
      admin.from("widget_access_logs").select("id", { count: "exact", head: true }).eq("client_id", client.id).eq("status", "allowed").in("path", ["/api/widget/config", "/embed/vehicle-selector"]).gte("created_at", start.toISOString()),
      admin.from("widget_access_logs").select("id", { count: "exact", head: true }).eq("client_id", client.id).eq("status", "blocked").gte("created_at", start.toISOString()),
      admin.from("widget_api_keys").select("public_key").eq("client_id", client.id).eq("is_active", true).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    return { ...client, public_key: key.data?.public_key ?? null, usage_this_month: allowed.count ?? 0, blocked_this_month: blocked.count ?? 0 };
  }));
  return NextResponse.json({ clients: enriched });
}
