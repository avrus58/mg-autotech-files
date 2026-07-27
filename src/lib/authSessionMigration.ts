const supabaseCookieChunkSize = 3180;
const supabaseCookieMaxAge = 400 * 24 * 60 * 60;

export type SessionCookieWrite = {
  name: string;
  value: string;
};

export type LegacySessionCookiePlan = {
  writes: SessionCookieWrite[];
  removals: string[];
  legacyStorageAction:
    | "keep"
    | "remove"
    | "remove-after-cleanup"
    | "remove-after-write";
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

function isSessionPayload(value: string) {
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    return (
      typeof parsed.access_token === "string" &&
      parsed.access_token.length > 0 &&
      typeof parsed.refresh_token === "string" &&
      parsed.refresh_token.length > 0 &&
      typeof parsed.expires_at === "number" &&
      Number.isFinite(parsed.expires_at)
    );
  } catch {
    return false;
  }
}

function fromBase64Url(value: string) {
  try {
    const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
    const padded = `${base64}${"=".repeat((4 - (base64.length % 4)) % 4)}`;
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
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

function decodeSessionCookie(value: string) {
  const decoded = value.startsWith("base64-")
    ? fromBase64Url(value.slice("base64-".length))
    : value;

  return decoded && isSessionPayload(decoded) ? decoded : null;
}

function isSessionCookieName(name: string, storageKey: string) {
  if (name === storageKey) return true;
  if (!name.startsWith(`${storageKey}.`)) return false;

  return /^(0|[1-9]\d*)$/.test(name.slice(storageKey.length + 1));
}

function getValidSessionCookie(
  storageKey: string,
  cookies: SessionCookieWrite[]
) {
  const cookiesByName = new Map<string, string>();
  for (const { name, value } of cookies) {
    if (!cookiesByName.has(name)) cookiesByName.set(name, value);
  }

  if (cookiesByName.has(storageKey)) {
    const value = cookiesByName.get(storageKey) ?? "";
    const session = decodeSessionCookie(value);
    if (session) return { names: [storageKey], session };
  }

  const chunkNames: string[] = [];
  const chunkValues: string[] = [];

  for (let index = 0; ; index += 1) {
    const name = `${storageKey}.${index}`;
    if (!cookiesByName.has(name)) break;

    chunkNames.push(name);
    chunkValues.push(cookiesByName.get(name) ?? "");

    const session = decodeSessionCookie(chunkValues.join(""));
    if (session) return { names: [...chunkNames], session };
  }

  return null;
}

function createSessionCookieWrites(storageKey: string, session: string) {
  const encoded = `base64-${toBase64Url(session)}`;
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

export function buildLegacySessionCookiePlan(input: {
  supabaseUrl: string;
  legacySession: string | null;
  existingCookies: SessionCookieWrite[];
}): LegacySessionCookiePlan {
  const storageKey = getSupabaseAuthStorageKey(input.supabaseUrl);
  if (!storageKey) {
    return { writes: [], removals: [], legacyStorageAction: "keep" };
  }

  const matchingCookieNames = [
    ...new Set(
      input.existingCookies
        .map(({ name }) => name)
        .filter((name) => isSessionCookieName(name, storageKey))
    ),
  ];
  const validCookie = getValidSessionCookie(storageKey, input.existingCookies);
  const validCookieNames = new Set(validCookie?.names ?? []);
  const removals = matchingCookieNames.filter((name) => !validCookieNames.has(name));

  if (validCookieNames.size > 0) {
    return {
      writes: [],
      removals,
      legacyStorageAction:
        input.legacySession === null
          ? "keep"
          : removals.length > 0
            ? "remove-after-cleanup"
            : "remove",
    };
  }

  if (input.legacySession === null) {
    return { writes: [], removals, legacyStorageAction: "keep" };
  }

  if (!isSessionPayload(input.legacySession)) {
    return { writes: [], removals, legacyStorageAction: "remove" };
  }

  return {
    writes: createSessionCookieWrites(storageKey, input.legacySession),
    removals: matchingCookieNames,
    legacyStorageAction: "remove-after-write",
  };
}

function decodeCookiePart(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function getBrowserCookies() {
  return document.cookie
    .split(";")
    .map((part) => {
      const cookie = part.trim();
      const separator = cookie.indexOf("=");

      return {
        name: decodeCookiePart(separator >= 0 ? cookie.slice(0, separator) : cookie),
        value: decodeCookiePart(separator >= 0 ? cookie.slice(separator + 1) : ""),
      };
    })
    .filter(({ name }) => Boolean(name));
}

function hasAppliedSessionCookiePlan(input: {
  storageKey: string;
  expectedSession: string;
  expectedWrites: SessionCookieWrite[];
  actualCookies: SessionCookieWrite[];
}) {
  const actualCookiesByName = new Map<string, string>();
  for (const { name, value } of input.actualCookies) {
    if (!actualCookiesByName.has(name)) actualCookiesByName.set(name, value);
  }

  const expectedNames = new Set(input.expectedWrites.map(({ name }) => name));
  const actualNames = [
    ...new Set(
      input.actualCookies
        .map(({ name }) => name)
        .filter((name) => isSessionCookieName(name, input.storageKey))
    ),
  ];

  if (
    actualNames.length !== expectedNames.size ||
    actualNames.some((name) => !expectedNames.has(name))
  ) {
    return false;
  }

  if (
    input.expectedWrites.some(
      ({ name, value }) => actualCookiesByName.get(name) !== value
    )
  ) {
    return false;
  }

  const validCookie = getValidSessionCookie(
    input.storageKey,
    input.actualCookies
  );
  return validCookie?.session === input.expectedSession;
}

function migrateLegacyBrowserSessionToCookiesUnsafe(supabaseUrl: string) {
  const storageKey = getSupabaseAuthStorageKey(supabaseUrl);
  if (!storageKey) return false;

  const legacySession = window.localStorage.getItem(storageKey);
  const existingCookies = getBrowserCookies();
  const existingValidCookie = getValidSessionCookie(storageKey, existingCookies);
  const plan = buildLegacySessionCookiePlan({
    supabaseUrl,
    legacySession,
    existingCookies,
  });

  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  for (const name of plan.removals) {
    document.cookie = `${name}=; Path=/; SameSite=Lax; Max-Age=0${secure}`;
  }

  if (plan.legacyStorageAction === "remove") {
    window.localStorage.removeItem(storageKey);
  }

  if (plan.writes.length === 0) {
    if (plan.legacyStorageAction === "remove-after-cleanup") {
      if (!existingValidCookie) return false;

      const cookiesByName = new Map<string, string>();
      for (const { name, value } of existingCookies) {
        if (!cookiesByName.has(name)) cookiesByName.set(name, value);
      }
      const expectedWrites = existingValidCookie.names.map((name) => ({
        name,
        value: cookiesByName.get(name) ?? "",
      }));
      if (
        !hasAppliedSessionCookiePlan({
          storageKey,
          expectedSession: existingValidCookie.session,
          expectedWrites,
          actualCookies: getBrowserCookies(),
        })
      ) {
        return false;
      }

      window.localStorage.removeItem(storageKey);
      return true;
    }

    return plan.removals.length > 0 || plan.legacyStorageAction === "remove";
  }

  for (const { name, value } of plan.writes) {
    document.cookie = `${name}=${value}; Path=/; SameSite=Lax; Max-Age=${supabaseCookieMaxAge}${secure}`;
  }

  if (
    !legacySession ||
    !hasAppliedSessionCookiePlan({
      storageKey,
      expectedSession: legacySession,
      expectedWrites: plan.writes,
      actualCookies: getBrowserCookies(),
    })
  ) {
    return false;
  }

  if (plan.legacyStorageAction === "remove-after-write") {
    window.localStorage.removeItem(storageKey);
  }
  return true;
}

export function migrateLegacyBrowserSessionToCookies(supabaseUrl: string) {
  if (typeof window === "undefined") return false;

  try {
    return migrateLegacyBrowserSessionToCookiesUnsafe(supabaseUrl);
  } catch {
    // Cookie/localStorage access can be blocked in sandboxed or privacy-restricted contexts.
    return false;
  }
}
