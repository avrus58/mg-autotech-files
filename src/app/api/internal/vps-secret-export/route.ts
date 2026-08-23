import {
  buildVpsSecretExportPayload,
  encryptVpsSecretExportPayload,
  isAuthorizedVpsSecretExport,
} from "@/lib/vpsSecretExport";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const responseHeaders = {
  "Cache-Control": "private, no-store, max-age=0, must-revalidate",
  "CDN-Cache-Control": "no-store",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
  Expires: "0",
  Pragma: "no-cache",
  "Referrer-Policy": "no-referrer",
  "Vercel-CDN-Cache-Control": "no-store",
  Vary: "Authorization",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
};

function jsonResponse(body: Record<string, unknown>, status: number) {
  return Response.json(body, { status, headers: responseHeaders });
}

export function GET(request: Request) {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return jsonResponse({ error: "Unavailable." }, 503);
  }

  if (
    !isAuthorizedVpsSecretExport(
      request.headers.get("authorization"),
      serviceRoleKey
    )
  ) {
    return jsonResponse({ error: "Unauthorized." }, 401);
  }

  try {
    const payload = buildVpsSecretExportPayload(process.env);
    const envelope = encryptVpsSecretExportPayload(payload);
    return jsonResponse(envelope, 200);
  } catch {
    return jsonResponse({ error: "Unavailable." }, 503);
  }
}
