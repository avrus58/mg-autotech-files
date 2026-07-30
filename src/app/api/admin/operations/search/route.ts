import { NextResponse } from "next/server";
import { requireStaffPermission } from "@/lib/apiAuth";
import {
  normalizeOperationsSearchTerm,
  searchOperationsRecords,
  type OperationsProfile,
} from "@/lib/operationsIntelligence";
import { hasStaffPermission } from "@/lib/staffPermissions";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getAdminRequestList } from "@/lib/workOrders/server";

const privateNoStoreHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  Vary: "Authorization",
};

export async function GET(request: Request) {
  const auth = await requireStaffPermission(request, "orders.view");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status, headers: privateNoStoreHeaders });
  }

  const term = normalizeOperationsSearchTerm(new URL(request.url).searchParams.get("q"));
  if (term.length < 2) {
    return NextResponse.json({ query: term, results: [] }, { headers: privateNoStoreHeaders });
  }

  try {
    const requests = await getAdminRequestList();
    let profiles: OperationsProfile[] = [];
    if (hasStaffPermission(auth.access, "customers.view")) {
      const result = await getSupabaseAdmin()
        .from("profiles")
        .select("id,email,customer_id,full_name,account_type,company_name,phone,street,postal_code,city,country,invoice_email,preferred_contact,account_status,created_at")
        .eq("role", "customer")
        .order("created_at", { ascending: false })
        .limit(2000);
      if (!result.error) profiles = (result.data ?? []) as OperationsProfile[];
    }

    return NextResponse.json({
      query: term,
      results: searchOperationsRecords({ items: requests.items, profiles, term }),
    }, { headers: privateNoStoreHeaders });
  } catch {
    return NextResponse.json(
      { error: "Operations search is temporarily unavailable." },
      { status: 500, headers: privateNoStoreHeaders }
    );
  }
}
