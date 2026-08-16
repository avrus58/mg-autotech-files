import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/apiAuth";
import { isStaffMember } from "@/lib/staffPermissions";

export const dynamic = "force-dynamic";

const privateNoStoreHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  Vary: "Authorization",
};

export async function GET(request: Request) {
  const auth = await requireApiUser(request);
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.status, headers: privateNoStoreHeaders }
    );
  }

  const staff = isStaffMember(auth.access);
  return NextResponse.json(
    {
      home: staff ? "/admin" : "/dashboard",
      staff,
    },
    { headers: privateNoStoreHeaders }
  );
}
