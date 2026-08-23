import {
  buildVpsSecretExportPayload,
  encryptVpsSecretExportPayload,
  verifyVpsSecretExportAuthorization,
} from "@/lib/vpsSecretExport";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

// Release operator patch points. The committed placeholders are intentionally
// impossible/expired, so this route remains fail-closed until a reviewed,
// short-lived Production release replaces both constants at compile time.
const EXPORT_TOKEN_SHA256_HEX =
  "1d254fa9d84b10cdcc15ef752352328c24a186042aad8f0f451354c44afce718";
const EXPORT_EXPIRES_AT_UTC = "2026-08-23T14:52:57.432Z";

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

export function createVpsSecretExportHandler(options: {
  expectedTokenSha256Hex: string;
  expiresAtUtc: string;
  now?: () => Date;
  environment?: Readonly<Record<string, string | undefined>>;
}) {
  return function vpsSecretExportHandler(request: Request) {
    const authorization = verifyVpsSecretExportAuthorization({
      authorization: request.headers.get("authorization"),
      expectedTokenSha256Hex: options.expectedTokenSha256Hex,
      expiresAtUtc: options.expiresAtUtc,
      now: options.now?.(),
    });
    if (authorization === "expired") {
      return jsonResponse({ error: "Gone." }, 410);
    }
    if (authorization === "unavailable") {
      return jsonResponse({ error: "Unavailable." }, 503);
    }
    if (authorization !== "authorized") {
      return jsonResponse({ error: "Unauthorized." }, 401);
    }

    try {
      const payload = buildVpsSecretExportPayload(
        options.environment ?? process.env
      );
      const envelope = encryptVpsSecretExportPayload(payload);
      return jsonResponse(envelope, 200);
    } catch {
      return jsonResponse({ error: "Unavailable." }, 503);
    }
  };
}

export const GET = createVpsSecretExportHandler({
  expectedTokenSha256Hex: EXPORT_TOKEN_SHA256_HEX,
  expiresAtUtc: EXPORT_EXPIRES_AT_UTC,
});
