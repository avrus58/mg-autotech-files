import { NextResponse } from "next/server";
import sitemap from "@/app/sitemap";
import { requireStaffPermission } from "@/lib/apiAuth";
import {
  checkAdaptiveRateLimit,
  rateLimitResponseHeaders,
} from "@/lib/abuseProtection";
import {
  canonicalIndexingUrls,
  submitIndexNowUrls,
} from "@/lib/searchEngineIndexing";

const privateNoStoreHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
  Vary: "Authorization",
};

const limit = 4;
const windowMs = 60 * 60 * 1000;

export async function POST(request: Request) {
  const auth = await requireStaffPermission(request, "orders.manage");
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.status, headers: privateNoStoreHeaders }
    );
  }

  const rateLimit = await checkAdaptiveRateLimit({
    request,
    scope: "admin-search-indexing-indexnow",
    suffix: auth.user.id,
    limit,
    windowMs,
    emitSignals: false,
  });
  const limitHeaders = rateLimitResponseHeaders({
    result: rateLimit,
    limit,
    windowMs,
    blocked: !rateLimit.allowed,
  });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Search engine notification limit reached. Try again later." },
      { status: 429, headers: { ...privateNoStoreHeaders, ...limitHeaders } }
    );
  }

  try {
    const urls = canonicalIndexingUrls(sitemap());
    const result = await submitIndexNowUrls({ urls });
    return NextResponse.json(
      {
        ok: true,
        submittedUrlCount: result.submittedUrlCount,
        batchCount: result.batchCount,
        accepted: result.responseStatuses.every((status) => status === 200 || status === 202),
        submittedAt: new Date().toISOString(),
      },
      { headers: { ...privateNoStoreHeaders, ...limitHeaders } }
    );
  } catch {
    return NextResponse.json(
      { error: "Search engines could not be notified right now. No private URL was submitted." },
      { status: 502, headers: { ...privateNoStoreHeaders, ...limitHeaders } }
    );
  }
}
