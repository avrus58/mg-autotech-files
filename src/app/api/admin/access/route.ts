import { NextResponse } from "next/server";
import { requireStaffPermission } from "@/lib/apiAuth";

const privateNoStoreHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  Vary: "Authorization",
};

export async function GET(request: Request) {
  const auth = await requireStaffPermission(request, "orders.view");

  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.status, headers: privateNoStoreHeaders }
    );
  }

  return NextResponse.json(
    {
      access: {
        role: auth.access.role,
        staffRole: auth.access.staffRole,
        permissions: auth.access.permissions,
      },
    },
    { headers: privateNoStoreHeaders }
  );
}
