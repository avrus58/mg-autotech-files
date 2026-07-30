import { NextResponse } from "next/server";
import { requireStaffPermission } from "@/lib/apiAuth";
import { getDesktopReleaseReadiness } from "@/lib/desktopUpload/releaseReadiness";

const privateNoStoreHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  Vary: "Authorization",
};

export async function GET(request: Request) {
  const auth = await requireStaffPermission(request, "staff.manage");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status, headers: privateNoStoreHeaders });

  return NextResponse.json({
    release: getDesktopReleaseReadiness(),
    environment: {
      DESKTOP_APP_MIN_VERSION: Boolean(process.env.DESKTOP_APP_MIN_VERSION),
      DESKTOP_APP_LATEST_VERSION: Boolean(process.env.DESKTOP_APP_LATEST_VERSION),
      DESKTOP_APP_UPDATE_URL: Boolean(process.env.DESKTOP_APP_UPDATE_URL),
      DESKTOP_APP_RELEASE_NOTES_URL: Boolean(process.env.DESKTOP_APP_RELEASE_NOTES_URL),
      DESKTOP_APP_UPLOAD_ENABLED: Boolean(process.env.DESKTOP_APP_UPLOAD_ENABLED || process.env.DESKTOP_UPLOAD_ENABLED),
      DESKTOP_APP_MAINTENANCE_MODE: Boolean(process.env.DESKTOP_APP_MAINTENANCE_MODE),
    },
  }, { headers: privateNoStoreHeaders });
}
