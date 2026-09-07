import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/apiAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { parseCustomerGuideDismissal, saveCustomerGuideDismissal } from "@/lib/customerOnboarding";

const headers = { "Cache-Control": "private, no-store, max-age=0", Vary: "Authorization" };

export async function POST(request: Request) {
  const auth = await requireApiUser(request);
  if (!auth.ok) {
    return NextResponse.json({ errorCode: auth.code ?? "auth_required" }, { status: auth.status, headers });
  }
  const input = parseCustomerGuideDismissal(await request.json().catch(() => null));
  if (!input) return NextResponse.json({ errorCode: "invalid_request" }, { status: 400, headers });
  try {
    const result = await saveCustomerGuideDismissal({
      user: auth.user,
      ...input,
      write: async (id, metadata) => {
        const { data, error } = await getSupabaseAdmin().auth.admin.updateUserById(id, { app_metadata: metadata });
        return error ? null : data.user;
      },
    });
    return "errorCode" in result
      ? NextResponse.json({ errorCode: result.errorCode }, { status: result.statusCode, headers })
      : NextResponse.json(result, { headers });
  } catch {
    return NextResponse.json({ errorCode: "guide_save_failed" }, { status: 503, headers });
  }
}
