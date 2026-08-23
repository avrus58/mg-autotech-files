const readinessHeaders = {
  "Cache-Control": "no-store, max-age=0",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
};

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET() {
  return Response.json(
    { status: "ok" },
    {
      status: 200,
      headers: readinessHeaders,
    }
  );
}
export function HEAD() {
  return new Response(null, {
    status: 204,
    headers: readinessHeaders,
  });
}
