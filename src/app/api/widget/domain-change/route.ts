import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/apiAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { normalizeDomainInput } from "@/lib/widget/domain";

const schema = z.object({ domain: z.string().trim().min(3).max(253) });

export async function POST(request: Request) {
  const auth = await requireApiUser(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid domain." }, { status: 400 });
  const domain = normalizeDomainInput(parsed.data.domain);
  if (!domain || !domain.includes(".") || domain === "localhost") return NextResponse.json({ error: "Enter a valid public hostname." }, { status: 400 });
  const admin = getSupabaseAdmin();
  const client = await admin.from("widget_clients").select("id, allowed_domain").eq("user_id", auth.user.id).limit(1).maybeSingle();
  if (!client.data) return NextResponse.json({ error: "Widget subscription not found." }, { status: 404 });
  const existing = await admin.from("widget_domain_change_requests").select("id").eq("client_id", client.data.id).eq("status", "pending").maybeSingle();
  if (existing.data) return NextResponse.json({ error: "A domain change request is already pending." }, { status: 409 });
  const created = await admin.from("widget_domain_change_requests").insert({ client_id: client.data.id, old_domain: client.data.allowed_domain, requested_domain: domain }).select("*").single();
  if (created.error) return NextResponse.json({ error: created.error.message }, { status: 500 });
  await admin.from("widget_audit_logs").insert({ actor_user_id: auth.user.id, client_id: client.data.id, action: "customer.domain_change_requested", details: { old_domain: client.data.allowed_domain, requested_domain: domain } });
  return NextResponse.json({ request: created.data });
}
