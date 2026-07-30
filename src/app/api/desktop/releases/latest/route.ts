import { NextResponse } from "next/server";
import { projectPublicDesktopRelease } from "@/lib/desktopUpload/releaseReadiness";

export async function GET(request: Request) {
  const appVersion = new URL(request.url).searchParams.get("app_version")?.trim() || "";
  return NextResponse.json(projectPublicDesktopRelease(appVersion), {
    headers: {
      "Cache-Control": "public, max-age=300, stale-while-revalidate=1800",
    },
  });
}
