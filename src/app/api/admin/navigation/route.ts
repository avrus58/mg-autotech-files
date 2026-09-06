import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/apiAuth";
import { isStaffMember } from "@/lib/staffPermissions";
import { availableAdminDestinations } from "@/lib/adminMobileNavigation";

const headers = { "Cache-Control": "private, no-store, max-age=0", Vary: "Authorization" };

// Only the caller's menu, never operational data or another user's access.
// Individual destinations retain their existing, stricter permission gates.
export async function GET(request: Request) {
  const auth = await requireApiUser(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status, headers });
  if (!isStaffMember(auth.access)) {
    return NextResponse.json({ error: "Staff access is required." }, { status: 403, headers });
  }
  return NextResponse.json({ destinations: availableAdminDestinations(auth.access).map((item) => item.href) }, { headers });
}
