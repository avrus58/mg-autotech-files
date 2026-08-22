import { normalizeCountryCode } from "@/lib/countries";

export const dynamic = "force-dynamic";

const responseHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
};

export function GET(request: Request) {
  const countryCode = normalizeCountryCode(
    request.headers.get("x-vercel-ip-country")
  );

  return Response.json(
    { countryCode },
    {
      headers: responseHeaders,
    }
  );
}
