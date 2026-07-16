import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/apiAuth";
import { requireDesktopAppAllowed } from "@/lib/desktopUpload/appCheck";
import {
  customerSafeDesktopOrderSelect,
  desktopExtraServiceCategories,
  desktopPrimaryServices,
} from "@/lib/desktopUpload/contracts";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getLearningAuthorizationPublicConfig } from "@/lib/ecuIntelligence/learningConfig";

export async function GET(request: Request) {
  const auth = await requireApiUser(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const app = requireDesktopAppAllowed(request);
  if (!app.ok) return app.response;

  const admin = getSupabaseAdmin();
  const [profileResult, ordersResult] = await Promise.all([
    admin
      .from("profiles")
      .select("id,email,customer_id,full_name,company_name,phone,credit_balance,account_status")
      .eq("id", auth.user.id)
      .maybeSingle(),
    admin
      .from("orders")
      .select(customerSafeDesktopOrderSelect())
      .eq("customer_id", auth.user.id)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  if (profileResult.error) {
    return NextResponse.json({ error: profileResult.error.message }, { status: 500 });
  }
  if (ordersResult.error) {
    return NextResponse.json({ error: ordersResult.error.message }, { status: 500 });
  }
  const accountStatus = profileResult.data?.account_status ?? "active";
  if (accountStatus !== "active") {
    return NextResponse.json({ error: "Customer account is not active." }, { status: 403 });
  }

  return NextResponse.json({
    profile: profileResult.data ?? {
      id: auth.user.id,
      email: auth.user.email ?? null,
      customer_id: null,
      full_name: null,
      company_name: null,
      phone: null,
      credit_balance: 0,
      account_status: null,
    },
    requests: ordersResult.data ?? [],
    services: {
      primary: desktopPrimaryServices,
      extraCategories: desktopExtraServiceCategories,
    },
    limits: {
      maxFileSize: 32 * 1024 * 1024,
      allowedExtensions: [".bin", ".ori", ".mod", ".frf", ".hex", ".zip", ".sgo"],
    },
    learningAuthorization: getLearningAuthorizationPublicConfig(),
    app: app.app,
  });
}
