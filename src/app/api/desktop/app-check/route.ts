import { NextResponse } from "next/server";
import { getDesktopAppCheckPayload, readDesktopClientInfo } from "@/lib/desktopUpload/appCheck";

export async function GET(request: Request) {
  const info = readDesktopClientInfo(request);
  const payload = getDesktopAppCheckPayload(info);

  return NextResponse.json({
    ...payload,
    received: {
      app_version: info.appVersion || null,
      platform: info.platform || null,
      build_channel: info.buildChannel || null,
      session_status: info.sessionStatus || null,
      installation_id_present: info.installationId.length >= 12,
    },
  });
}
