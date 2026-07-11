import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/apiAuth";
import { requireDesktopAppAllowed } from "@/lib/desktopUpload/appCheck";
import { customerSafeDesktopOrderSelect } from "@/lib/desktopUpload/contracts";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(request: Request) {
  const auth = await requireApiUser(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const app = requireDesktopAppAllowed(request);
  if (!app.ok) return app.response;

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("orders")
    .select(customerSafeDesktopOrderSelect())
    .eq("customer_id", auth.user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ requests: data ?? [] });
}
