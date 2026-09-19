/**
 * Supabase's absolute expires_at uses the server clock, while the browser SDK
 * compares it with Date.now(). Rebase only the local refresh schedule from the
 * lifetime in a successful token response. JWTs, authorization and the server's
 * expiry/revocation checks are not modified.
 */
export function createBrowserAuthFetch(
  supabaseUrl: string,
  fetcher: typeof fetch = (...args) => globalThis.fetch(...args),
): typeof fetch {
  const tokenUrl = new URL("auth/v1/token", `${supabaseUrl.replace(/\/$/, "")}/`);

  return async (input, init) => {
    const requestStartedAt = Date.now();
    const response = await fetcher(input, init);
    try {
      const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
      const finalUrl = response.url ? new URL(response.url) : url;
      const method = init?.method ?? (typeof input === "object" && "method" in input ? input.method : "GET");
      if (
        method.toUpperCase() !== "POST" || !response.ok ||
        url.origin !== tokenUrl.origin || url.pathname !== tokenUrl.pathname ||
        finalUrl.origin !== tokenUrl.origin || finalUrl.pathname !== tokenUrl.pathname
      ) return response;

      const body: unknown = await response.clone().json();
      if (!body || typeof body !== "object" || Array.isArray(body)) return response;
      const session = body as Record<string, unknown>;
      if (
        typeof session.access_token !== "string" || !session.access_token ||
        typeof session.refresh_token !== "string" || !session.refresh_token ||
        typeof session.expires_in !== "number" || !Number.isSafeInteger(session.expires_in) ||
        session.expires_in <= 0 || session.expires_in > 86_400 ||
        typeof session.expires_at !== "number" || !Number.isSafeInteger(session.expires_at) ||
        session.expires_at <= 0
      ) return response;

      // Start before the network round trip, never after it: a delayed response
      // must not gain extra lifetime. Small clock differences need no rewrite.
      const localExpiresAt = Math.floor(requestStartedAt / 1_000) + session.expires_in;
      if (Math.abs(localExpiresAt - session.expires_at) <= 60) return response;
      const headers = new Headers(response.headers);
      headers.delete("content-length");
      headers.delete("content-encoding");
      return new Response(JSON.stringify({ ...session, expires_at: localExpiresAt }), {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    } catch {
      // Preserve provider errors/malformed responses for normal SDK handling.
      return response;
    }
  };
}
