const supabaseCookieChunkSize = 3180;
const supabaseCookieMaxAge = 400 * 24 * 60 * 60;

export type SessionCookieWrite = {
  name: string;
  value: string;
};

export function getSupabaseAuthStorageKey(supabaseUrl: string) {
  try {
    const hostname = new URL(supabaseUrl).hostname;
    const projectRef = hostname.split(".")[0];
    return projectRef ? `sb-${projectRef}-auth-token` : null;
  } catch {
    return null;
  }
}

function isLegacySessionPayload(value: string) {
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    return (
      typeof parsed.access_token === "string" &&
      parsed.access_token.length > 0 &&
      typeof parsed.refresh_token === "string" &&
      parsed.refresh_token.length > 0
    );
  } catch {
    return false;
  }
}

function toBase64Url(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";

  for (const byte of bytes) binary += String.fromCharCode(byte);

  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

export function buildLegacySessionCookieWrites(input: {
  supabaseUrl: string;
  legacySession: string | null;
  existingCookieNames: string[];
}) {
  const storageKey = getSupabaseAuthStorageKey(input.supabaseUrl);
  if (!storageKey || !input.legacySession || !isLegacySessionPayload(input.legacySession)) {
    return [];
  }

  if (
    input.existingCookieNames.some(
      (name) => name === storageKey || name.startsWith(`${storageKey}.`)
    )
  ) {
    return [];
  }

  const encoded = `base64-${toBase64Url(input.legacySession)}`;
  if (encoded.length <= supabaseCookieChunkSize) {
    return [{ name: storageKey, value: encoded }];
  }

  const writes: SessionCookieWrite[] = [];
  for (let offset = 0, index = 0; offset < encoded.length; offset += supabaseCookieChunkSize) {
    writes.push({
      name: `${storageKey}.${index}`,
      value: encoded.slice(offset, offset + supabaseCookieChunkSize),
    });
    index += 1;
  }

  return writes;
}

function getBrowserCookieNames() {
  return document.cookie
    .split(";")
    .map((part) => part.trim().split("=", 1)[0])
    .filter(Boolean);
}

export function migrateLegacyBrowserSessionToCookies(supabaseUrl: string) {
  if (typeof window === "undefined") return false;

  const storageKey = getSupabaseAuthStorageKey(supabaseUrl);
  if (!storageKey) return false;

  const writes = buildLegacySessionCookieWrites({
    supabaseUrl,
    legacySession: window.localStorage.getItem(storageKey),
    existingCookieNames: getBrowserCookieNames(),
  });

  if (writes.length === 0) return false;

  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  for (const { name, value } of writes) {
    document.cookie = `${name}=${value}; Path=/; SameSite=Lax; Max-Age=${supabaseCookieMaxAge}${secure}`;
  }

  const writtenNames = new Set(getBrowserCookieNames());
  if (!writes.every(({ name }) => writtenNames.has(name))) return false;

  window.localStorage.removeItem(storageKey);
  return true;
}
