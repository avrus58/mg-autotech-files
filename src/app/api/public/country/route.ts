import {
  getTrustedCountryCode,
  type RequestNetworkEnvironment,
} from "@/lib/requestNetwork";

export const dynamic = "force-dynamic";

const responseHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
};

function countryResponse(
  request: Request,
  environment: RequestNetworkEnvironment = process.env
) {
  const countryCode = getTrustedCountryCode(request, environment);

  return Response.json(
    { countryCode },
    {
      headers: responseHeaders,
    }
  );
}

export function GET(request: Request) {
  return countryResponse(request);
}
