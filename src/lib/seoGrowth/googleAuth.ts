import { createSign } from "node:crypto";

type FetchLike = typeof fetch;

type TokenCache = {
  key: string;
  accessToken: string;
  expiresAt: number;
};

let tokenCache: TokenCache | null = null;

function base64Url(value: string | Buffer) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function withTimeout(milliseconds: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), milliseconds);
  return { signal: controller.signal, clear: () => clearTimeout(timeout) };
}

export function createGoogleServiceAccountAssertion(input: {
  clientEmail: string;
  privateKey: string;
  scopes: string[];
  nowSeconds?: number;
}) {
  const issuedAt = input.nowSeconds ?? Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64Url(JSON.stringify({
    iss: input.clientEmail,
    scope: [...new Set(input.scopes)].sort().join(" "),
    aud: "https://oauth2.googleapis.com/token",
    iat: issuedAt,
    exp: issuedAt + 3600,
  }));
  const unsigned = `${header}.${claims}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  return `${unsigned}.${base64Url(signer.sign(input.privateKey))}`;
}

export async function getGoogleAccessToken(input: {
  clientEmail: string;
  privateKey: string;
  scopes: string[];
  fetchFn?: FetchLike;
  now?: number;
}) {
  const now = input.now ?? Date.now();
  const cacheKey = `${input.clientEmail}:${[...new Set(input.scopes)].sort().join(",")}`;
  if (tokenCache?.key === cacheKey && tokenCache.expiresAt > now + 60_000) {
    return tokenCache.accessToken;
  }

  const fetchFn = input.fetchFn ?? fetch;
  const request = withTimeout(8_000);
  try {
    const response = await fetchFn("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: createGoogleServiceAccountAssertion({
          clientEmail: input.clientEmail,
          privateKey: input.privateKey,
          scopes: input.scopes,
          nowSeconds: Math.floor(now / 1000),
        }),
      }),
      signal: request.signal,
    });
    if (!response.ok) throw new Error("Google reporting authorization failed.");
    const payload = await response.json() as { access_token?: string; expires_in?: number };
    if (!payload.access_token) throw new Error("Google reporting authorization failed.");
    tokenCache = {
      key: cacheKey,
      accessToken: payload.access_token,
      expiresAt: now + Math.max(300, Number(payload.expires_in ?? 3600)) * 1000,
    };
    return payload.access_token;
  } finally {
    request.clear();
  }
}

export function resetGoogleAccessTokenCacheForTests() {
  tokenCache = null;
}
