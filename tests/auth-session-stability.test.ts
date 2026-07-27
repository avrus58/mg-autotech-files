import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  buildLegacySessionCookiePlan,
  getSupabaseAuthStorageKey,
  migrateLegacyBrowserSessionToCookies,
} from "../src/lib/authSessionMigration";
import {
  browserAuthCheckRetryLimit,
  checkBrowserAuthUserWithRetry,
  getBrowserAuthCheckRetryDelay,
  resolveBrowserAuthCheck,
} from "../src/lib/authBoundaryState";
import {
  classifyDashboardSyncFailure,
  dashboardSyncRetryLimit,
  dashboardSyncTimeoutMs,
  getDashboardSyncRetryDelay,
  isDefinitiveInvalidSession,
  shouldRevalidateDashboardSession,
} from "../src/lib/dashboardSync";
import { retryCustomerOrdersQueryAfterAuthCheck } from "../src/lib/customerOrdersAuthRecovery";
import {
  createSupabaseAuthTimedFetch,
  supabaseAuthRequestTimeoutMs,
} from "../src/lib/timedFetch";
import { hasSupabasePublicConfig } from "../src/lib/supabaseAuthConfig";
import { getStableSession, getStableUser } from "../src/lib/authGuards";
import { supabase } from "../src/lib/supabaseClient";

function readProjectFile(...segments: string[]) {
  return readFileSync(resolve(process.cwd(), ...segments), "utf8");
}

const testSupabaseUrl = "https://stagingref.supabase.co";
const legacySession = JSON.stringify({
  access_token: "test-access-token",
  refresh_token: "test-refresh-token",
  expires_at: 4_102_444_800,
  user: { id: "00000000-0000-4000-8000-000000000001" },
});

function withMockBrowserStorage<T>(
  input: {
    cookies?: Array<{ name: string; value: string }>;
    legacySession?: string | null;
    acceptCookieWrites?: boolean;
    blockStorage?: boolean;
  },
  run: (state: {
    cookies: Map<string, string>;
    storage: Map<string, string>;
  }) => T
) {
  const storageKey = getSupabaseAuthStorageKey(testSupabaseUrl)!;
  const cookies = new Map(input.cookies?.map(({ name, value }) => [name, value]) ?? []);
  const storage = new Map<string, string>();
  if (input.legacySession !== null && input.legacySession !== undefined) {
    storage.set(storageKey, input.legacySession);
  }

  const fakeLocalStorage = {
    getItem(key: string) {
      if (input.blockStorage) throw new Error("storage blocked");
      return storage.get(key) ?? null;
    },
    removeItem(key: string) {
      if (input.blockStorage) throw new Error("storage blocked");
      storage.delete(key);
    },
  };
  const fakeDocument = {
    get cookie() {
      return [...cookies].map(([name, value]) => `${name}=${value}`).join("; ");
    },
    set cookie(serialized: string) {
      if (input.acceptCookieWrites === false) return;

      const [pair, ...attributes] = serialized.split(";").map((part) => part.trim());
      const separator = pair.indexOf("=");
      const name = pair.slice(0, separator);
      const value = pair.slice(separator + 1);
      const isRemoval = attributes.some((attribute) =>
        /^max-age=0$/i.test(attribute)
      );

      if (isRemoval) {
        cookies.delete(name);
      } else {
        cookies.set(name, value);
      }
    },
  };
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document");

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: fakeLocalStorage,
      location: { protocol: "https:" },
    },
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: fakeDocument,
  });

  try {
    return run({ cookies, storage });
  } finally {
    if (originalWindow) {
      Object.defineProperty(globalThis, "window", originalWindow);
    } else {
      Reflect.deleteProperty(globalThis, "window");
    }
    if (originalDocument) {
      Object.defineProperty(globalThis, "document", originalDocument);
    } else {
      Reflect.deleteProperty(globalThis, "document");
    }
  }
}

test("legacy local-storage sessions are encoded into SSR cookie chunks without changing token content", () => {
  const storageKey = getSupabaseAuthStorageKey(testSupabaseUrl);
  const plan = buildLegacySessionCookiePlan({
    supabaseUrl: testSupabaseUrl,
    legacySession,
    existingCookies: [],
  });
  const { writes } = plan;

  assert.equal(storageKey, "sb-stagingref-auth-token");
  assert.equal(plan.legacyStorageAction, "remove-after-write");
  assert.deepEqual(plan.removals, []);
  assert.ok(writes.length > 0);
  assert.ok(writes.every(({ name, value }) => name.startsWith(storageKey!) && value.length <= 3180));

  const encoded = writes.map(({ value }) => value).join("");
  assert.match(encoded, /^base64-/);
  const decoded = Buffer.from(encoded.slice("base64-".length), "base64url").toString("utf8");
  assert.deepEqual(JSON.parse(decoded), JSON.parse(legacySession));
});

test("session cookie migration preserves UTF-8 user metadata", () => {
  const unicodeSession = JSON.stringify({
    ...JSON.parse(legacySession),
    user: { id: "test-user", user_metadata: { city: "München", label: "İşletme" } },
  });
  const writes = buildLegacySessionCookiePlan({
    supabaseUrl: testSupabaseUrl,
    legacySession: unicodeSession,
    existingCookies: [],
  }).writes;
  const existingPlan = buildLegacySessionCookiePlan({
    supabaseUrl: testSupabaseUrl,
    legacySession,
    existingCookies: writes,
  });

  assert.deepEqual(existingPlan.writes, []);
  assert.equal(existingPlan.legacyStorageAction, "remove");
});

test("partial or corrupt auth cookies are replaced instead of stranding a valid legacy session", () => {
  const storageKey = getSupabaseAuthStorageKey(testSupabaseUrl)!;
  const plan = buildLegacySessionCookiePlan({
    supabaseUrl: testSupabaseUrl,
    legacySession,
    existingCookies: [
      {
        name: `${storageKey}.0`,
        value: "base64-eyJhY2Nlc3NfdG9rZW4iOiJ0cnVuY2F0ZWQ",
      },
    ],
  });

  assert.ok(plan.writes.length > 0);
  assert.deepEqual(plan.removals, [`${storageKey}.0`]);
  assert.equal(plan.legacyStorageAction, "remove-after-write");
});

test("cookie sessions missing Supabase expiry metadata cannot replace a valid fallback", () => {
  const storageKey = getSupabaseAuthStorageKey(testSupabaseUrl)!;
  const plan = buildLegacySessionCookiePlan({
    supabaseUrl: testSupabaseUrl,
    legacySession,
    existingCookies: [
      {
        name: storageKey,
        value: JSON.stringify({
          access_token: "stale-access-token",
          refresh_token: "stale-refresh-token",
        }),
      },
    ],
  });

  assert.ok(plan.writes.length > 0);
  assert.deepEqual(plan.removals, [storageKey]);
  assert.equal(plan.legacyStorageAction, "remove-after-write");
});

test("a valid cookie session stays authoritative and stale chunks/local storage are removed", () => {
  const storageKey = getSupabaseAuthStorageKey(testSupabaseUrl)!;
  const canonical = buildLegacySessionCookiePlan({
    supabaseUrl: testSupabaseUrl,
    legacySession,
    existingCookies: [],
  }).writes;
  const plan = buildLegacySessionCookiePlan({
    supabaseUrl: testSupabaseUrl,
    legacySession,
    existingCookies: [
      ...canonical,
      { name: `${storageKey}.99`, value: "stale-cookie-chunk" },
    ],
  });

  assert.deepEqual(plan.writes, []);
  assert.deepEqual(plan.removals, [`${storageKey}.99`]);
  assert.equal(plan.legacyStorageAction, "remove-after-cleanup");
});

test("valid contiguous cookie chunks are preserved while noncontiguous extras are cleared", () => {
  const storageKey = getSupabaseAuthStorageKey(testSupabaseUrl)!;
  const largeSession = JSON.stringify({
    ...JSON.parse(legacySession),
    user: { id: "test-user", user_metadata: { padding: "x".repeat(7_000) } },
  });
  const chunks = buildLegacySessionCookiePlan({
    supabaseUrl: testSupabaseUrl,
    legacySession: largeSession,
    existingCookies: [],
  }).writes;
  const plan = buildLegacySessionCookiePlan({
    supabaseUrl: testSupabaseUrl,
    legacySession,
    existingCookies: [
      ...chunks,
      { name: `${storageKey}.99`, value: "stale-cookie-chunk" },
    ],
  });

  assert.ok(chunks.length > 1);
  assert.deepEqual(plan.writes, []);
  assert.deepEqual(plan.removals, [`${storageKey}.99`]);
  assert.equal(plan.legacyStorageAction, "remove-after-cleanup");
});

test("invalid exact cookies cannot mask a valid current chunked session", () => {
  const storageKey = getSupabaseAuthStorageKey(testSupabaseUrl)!;
  const currentSession = JSON.stringify({
    ...JSON.parse(legacySession),
    access_token: "current-access-token",
    user: { id: "current-user", user_metadata: { padding: "x".repeat(7_000) } },
  });
  const currentChunks = buildLegacySessionCookiePlan({
    supabaseUrl: testSupabaseUrl,
    legacySession: currentSession,
    existingCookies: [],
  }).writes;
  const plan = buildLegacySessionCookiePlan({
    supabaseUrl: testSupabaseUrl,
    legacySession,
    existingCookies: [
      { name: storageKey, value: "base64-invalid" },
      ...currentChunks,
    ],
  });

  assert.ok(currentChunks.length > 1);
  assert.deepEqual(plan.writes, []);
  assert.deepEqual(plan.removals, [storageKey]);
  assert.equal(plan.legacyStorageAction, "remove-after-cleanup");
});

test("a valid chunk prefix survives a contiguous stale tail from an older write", () => {
  const storageKey = getSupabaseAuthStorageKey(testSupabaseUrl)!;
  const currentSession = JSON.stringify({
    ...JSON.parse(legacySession),
    user: { id: "current-user", user_metadata: { padding: "x".repeat(7_000) } },
  });
  const currentChunks = buildLegacySessionCookiePlan({
    supabaseUrl: testSupabaseUrl,
    legacySession: currentSession,
    existingCookies: [],
  }).writes;
  const staleTailName = `${storageKey}.${currentChunks.length}`;
  const plan = buildLegacySessionCookiePlan({
    supabaseUrl: testSupabaseUrl,
    legacySession,
    existingCookies: [
      ...currentChunks,
      { name: staleTailName, value: "stale-contiguous-tail" },
    ],
  });

  assert.ok(currentChunks.length > 1);
  assert.deepEqual(plan.writes, []);
  assert.deepEqual(plan.removals, [staleTailName]);
  assert.equal(plan.legacyStorageAction, "remove-after-cleanup");
});

test("malformed legacy storage is discarded without creating auth cookies", () => {
  const plan = buildLegacySessionCookiePlan({
    supabaseUrl: testSupabaseUrl,
    legacySession: "not-json",
    existingCookies: [],
  });

  assert.deepEqual(plan.writes, []);
  assert.deepEqual(plan.removals, []);
  assert.equal(plan.legacyStorageAction, "remove");
});

test("browser migration clears legacy storage only after the exact cookie payload is verified", () => {
  const storageKey = getSupabaseAuthStorageKey(testSupabaseUrl)!;
  const expectedWrites = buildLegacySessionCookiePlan({
    supabaseUrl: testSupabaseUrl,
    legacySession,
    existingCookies: [],
  }).writes;

  withMockBrowserStorage(
    {
      cookies: [{ name: `${storageKey}.0`, value: "base64-truncated" }],
      legacySession,
    },
    ({ cookies, storage }) => {
      assert.equal(migrateLegacyBrowserSessionToCookies(testSupabaseUrl), true);
      assert.equal(storage.has(storageKey), false);
      assert.deepEqual(
        [...cookies].map(([name, value]) => ({ name, value })),
        expectedWrites
      );
    }
  );

  withMockBrowserStorage(
    {
      cookies: [{ name: `${storageKey}.0`, value: "base64-truncated" }],
      legacySession,
      acceptCookieWrites: false,
    },
    ({ storage }) => {
      assert.equal(migrateLegacyBrowserSessionToCookies(testSupabaseUrl), false);
      assert.equal(storage.get(storageKey), legacySession);
    }
  );
});

test("browser migration retains its fallback until recovered-cookie cleanup is verified", () => {
  const storageKey = getSupabaseAuthStorageKey(testSupabaseUrl)!;
  const currentSession = JSON.stringify({
    ...JSON.parse(legacySession),
    access_token: "current-access-token",
    user: { id: "current-user", user_metadata: { padding: "x".repeat(7_000) } },
  });
  const currentChunks = buildLegacySessionCookiePlan({
    supabaseUrl: testSupabaseUrl,
    legacySession: currentSession,
    existingCookies: [],
  }).writes;
  const cookies = [
    { name: storageKey, value: "base64-invalid" },
    ...currentChunks,
  ];

  withMockBrowserStorage(
    { cookies, legacySession, acceptCookieWrites: false },
    ({ storage }) => {
      assert.equal(migrateLegacyBrowserSessionToCookies(testSupabaseUrl), false);
      assert.equal(storage.get(storageKey), legacySession);
    }
  );

  withMockBrowserStorage(
    { cookies, legacySession },
    ({ storage }) => {
      assert.equal(migrateLegacyBrowserSessionToCookies(testSupabaseUrl), true);
      assert.equal(storage.has(storageKey), false);
    }
  );
});

test("browser migration is best-effort when privacy settings block storage access", () => {
  withMockBrowserStorage(
    { legacySession, blockStorage: true },
    () => {
      assert.equal(migrateLegacyBrowserSessionToCookies(testSupabaseUrl), false);
    }
  );
});

test("dashboard retry policy is bounded exponential backoff with deterministic jitter bounds", () => {
  assert.equal(dashboardSyncRetryLimit, 4);
  assert.equal(dashboardSyncTimeoutMs, 15_000);
  assert.equal(getDashboardSyncRetryDelay(0, () => 0), 800);
  assert.equal(getDashboardSyncRetryDelay(0, () => 0.5), 1000);
  assert.equal(getDashboardSyncRetryDelay(1, () => 0.5), 2000);
  assert.equal(getDashboardSyncRetryDelay(2, () => 1), 4800);
  assert.equal(getDashboardSyncRetryDelay(99, () => 1), 9600);
});

test("dashboard sync failures preserve auth, authorization, rate, server, network and abort semantics", () => {
  assert.equal(classifyDashboardSyncFailure({ status: 401 }), "authentication");
  assert.equal(classifyDashboardSyncFailure({ code: "PGRST301" }), "authentication");
  assert.equal(classifyDashboardSyncFailure({ status: 403 }), "authorization");
  assert.equal(classifyDashboardSyncFailure({ code: "42501" }), "authorization");
  assert.equal(classifyDashboardSyncFailure({ status: 429 }), "rate_limit");
  assert.equal(classifyDashboardSyncFailure({ status: 503 }), "server");
  assert.equal(classifyDashboardSyncFailure(new TypeError("offline")), "network");
  assert.equal(classifyDashboardSyncFailure({ name: "AbortError" }), "aborted");
});

test("only authentication failures revalidate and only explicit invalid-session evidence signs out", () => {
  assert.equal(shouldRevalidateDashboardSession({ status: 401 }), true);
  assert.equal(shouldRevalidateDashboardSession({ code: "PGRST301" }), true);
  assert.equal(shouldRevalidateDashboardSession({ status: 403 }), false);
  assert.equal(shouldRevalidateDashboardSession({ status: 429 }), false);
  assert.equal(shouldRevalidateDashboardSession({ status: 503 }), false);
  assert.equal(shouldRevalidateDashboardSession({ name: "AbortError" }), false);

  assert.equal(
    isDefinitiveInvalidSession({ hasUser: true, error: { code: "session_not_found" } }),
    false
  );
  assert.equal(
    isDefinitiveInvalidSession({ hasUser: false, error: null }),
    true
  );
  assert.equal(
    isDefinitiveInvalidSession({
      hasUser: false,
      error: { name: "AuthSessionMissingError" },
    }),
    true
  );
  assert.equal(
    isDefinitiveInvalidSession({
      hasUser: false,
      error: { code: "session_not_found" },
    }),
    true
  );
  assert.equal(
    isDefinitiveInvalidSession({
      hasUser: false,
      error: { status: 401, name: "AuthApiError" },
    }),
    false
  );
  assert.equal(
    isDefinitiveInvalidSession({
      hasUser: false,
      error: { status: 503, name: "AuthRetryableFetchError" },
    }),
    false
  );
});

test("browser auth checks retry transient failures without converting them into logout", () => {
  assert.equal(browserAuthCheckRetryLimit, 3);
  assert.equal(getBrowserAuthCheckRetryDelay(1), 1_000);
  assert.equal(getBrowserAuthCheckRetryDelay(2), 3_000);
  assert.equal(resolveBrowserAuthCheck({ hasUser: true, error: new Error("stale") }), "authenticated");
  assert.equal(resolveBrowserAuthCheck({ hasUser: false, error: null }), "unauthenticated");
  assert.equal(
    resolveBrowserAuthCheck({
      hasUser: false,
      error: { code: "session_not_found" },
    }),
    "unauthenticated"
  );
  assert.equal(
    resolveBrowserAuthCheck({
      hasUser: false,
      error: { status: 401, name: "AuthApiError" },
    }),
    "retry"
  );
  assert.equal(resolveBrowserAuthCheck({ hasUser: false, error: new TypeError("offline") }), "retry");
});

test("browser user checks recover transient failures with bounded retries", async () => {
  const delays: number[] = [];
  let attempts = 0;
  const recovered = await checkBrowserAuthUserWithRetry(
    async () => {
      attempts += 1;
      if (attempts < 3) {
        return { user: null, error: new TypeError("temporary auth outage") };
      }
      return { user: { id: "user-1" }, error: null };
    },
    async (delayMs) => {
      delays.push(delayMs);
    }
  );

  assert.deepEqual(recovered, {
    state: "authenticated",
    user: { id: "user-1" },
    error: null,
  });
  assert.equal(attempts, 3);
  assert.deepEqual(delays, [1_000, 3_000]);

  attempts = 0;
  const missing = await checkBrowserAuthUserWithRetry(
    async () => {
      attempts += 1;
      return { user: null, error: null };
    },
    async () => {
      throw new Error("definitive logout must not retry");
    }
  );

  assert.equal(missing.state, "unauthenticated");
  assert.equal(attempts, 1);

  attempts = 0;
  const unavailable = await checkBrowserAuthUserWithRetry(
    async () => {
      attempts += 1;
      throw new TypeError("temporary auth outage");
    },
    async () => undefined
  );

  assert.equal(unavailable.state, "unavailable");
  assert.equal(attempts, browserAuthCheckRetryLimit);
});

test("customer order auth recovery retries one read only after valid revalidation", async () => {
  let queryAttempts = 0;
  const recovered = await retryCustomerOrdersQueryAfterAuthCheck(
    async () => ({
      state: "authenticated" as const,
      user: { id: "user-1" },
      error: null,
    }),
    async () => {
      queryAttempts += 1;
      return { data: [{ id: "order-1" }], error: null, count: 1 };
    }
  );

  assert.equal(recovered.authCheck.state, "authenticated");
  assert.deepEqual(recovered.queryResult, {
    data: [{ id: "order-1" }],
    error: null,
    count: 1,
  });
  assert.equal(queryAttempts, 1);

  const invalid = await retryCustomerOrdersQueryAfterAuthCheck(
    async () => ({
      state: "unauthenticated" as const,
      user: null,
      error: { code: "session_not_found" },
    }),
    async () => {
      queryAttempts += 1;
      return { data: [], error: null, count: 0 };
    }
  );

  assert.equal(invalid.authCheck.state, "unauthenticated");
  assert.equal(invalid.queryResult, null);
  assert.equal(queryAttempts, 1);

  const stale = await retryCustomerOrdersQueryAfterAuthCheck(
    async () => ({
      state: "authenticated" as const,
      user: { id: "user-2" },
      error: null,
    }),
    async () => {
      queryAttempts += 1;
      return { data: [], error: null, count: 0 };
    },
    () => false
  );

  assert.equal(stale.queryResult, null);
  assert.equal(queryAttempts, 1);
});

test("thrown Auth lock failures are normalized into retryable session results", async () => {
  const lockError = new Error("simulated Auth lock contention");
  lockError.name = "NavigatorLockAcquireTimeoutError";
  const originalGetSession = supabase.auth.getSession;
  const originalGetUser = supabase.auth.getUser;

  try {
    Reflect.set(supabase.auth, "getSession", async () => {
      throw lockError;
    });
    Reflect.set(supabase.auth, "getUser", async () => {
      throw lockError;
    });

    const sessionResult = await getStableSession({ maxAttempts: 1 });
    const userResult = await getStableUser();

    assert.equal(sessionResult.session, null);
    assert.equal(sessionResult.error, lockError);
    assert.equal(userResult.user, null);
    assert.equal(userResult.error, lockError);
    assert.equal(
      resolveBrowserAuthCheck({
        hasUser: false,
        error: sessionResult.error,
      }),
      "retry"
    );
  } finally {
    Reflect.set(supabase.auth, "getSession", originalGetSession);
    Reflect.set(supabase.auth, "getUser", originalGetUser);
  }
});

test("Supabase public auth config accepts secure custom API domains only", () => {
  assert.equal(
    hasSupabasePublicConfig("https://stagingref.supabase.co", "publishable-key"),
    true
  );
  assert.equal(
    hasSupabasePublicConfig("https://auth.example.test", "publishable-key"),
    true
  );
  assert.equal(
    hasSupabasePublicConfig("http://auth.example.test", "publishable-key"),
    false
  );
  assert.equal(
    hasSupabasePublicConfig("https://user:password@auth.example.test", "publishable-key"),
    false
  );
  assert.equal(hasSupabasePublicConfig("not-a-url", "publishable-key"), false);
});

test("Supabase Auth fetches are bounded without timing out Storage transfers", async () => {
  let observedAbort = false;
  const hangingFetch: typeof fetch = async (_input, init) =>
    new Promise<Response>((_resolve, reject) => {
      const rejectForAbort = () => {
        observedAbort = true;
        reject(new DOMException("request aborted", "AbortError"));
      };

      if (init?.signal?.aborted) {
        rejectForAbort();
      } else {
        init?.signal?.addEventListener("abort", rejectForAbort, { once: true });
      }
    });
  const timedFetch = createSupabaseAuthTimedFetch(5, hangingFetch);

  await assert.rejects(
    timedFetch("https://stagingref.supabase.co/auth/v1/user"),
    (error: unknown) => error instanceof DOMException && error.name === "AbortError"
  );
  assert.equal(observedAbort, true);
  assert.equal(supabaseAuthRequestTimeoutMs, 15_000);

  const callerController = new AbortController();
  let storageSignal: AbortSignal | null | undefined;
  const storageFetch: typeof fetch = async (_input, init) => {
    storageSignal = init?.signal;
    return new Response(null, { status: 204 });
  };
  const authOnlyTimedFetch = createSupabaseAuthTimedFetch(5, storageFetch);
  await authOnlyTimedFetch(
    "https://stagingref.supabase.co/storage/v1/object/customer/test.bin",
    { signal: callerController.signal }
  );
  assert.equal(storageSignal, callerController.signal);
});

test("Supabase browser auth uses the lockless stable client while server cookies propagate safely", () => {
  const browserClient = readProjectFile("src", "lib", "supabaseClient.ts");
  const serverClient = readProjectFile("src", "lib", "supabaseServer.ts");
  const proxy = readProjectFile("src", "proxy.ts");
  const proxySession = readProjectFile("src", "lib", "supabaseProxySession.ts");

  assert.match(browserClient, /createClient\s*\(/);
  assert.match(browserClient, /persistSession:\s*true/);
  assert.match(browserClient, /autoRefreshToken:\s*true/);
  assert.match(browserClient, /__mgAutotechSupabase/);
  assert.doesNotMatch(browserClient, /createBrowserClient/);
  assert.doesNotMatch(browserClient, /migrateLegacyBrowserSessionToCookies/);
  assert.doesNotMatch(browserClient, /__mgAutotechSupabaseMode/);
  assert.doesNotMatch(browserClient, /navigatorLock|lockAcquireTimeout/);
  assert.doesNotMatch(browserClient, /createSupabaseAuthTimedFetch/);
  assert.match(serverClient, /createServerClient/);
  assert.match(serverClient, /getAll\(\)/);
  assert.match(serverClient, /setAll\(cookiesToSet\)/);

  assert.match(proxy, /createServerClient/);
  assert.match(proxy, /await supabase\.auth\.getClaims\(\)/);
  assert.match(proxy, /applySupabaseSessionRefresh/);
  assert.match(proxySession, /request\.cookies\.set\(name, value\)/);
  assert.match(proxySession, /response\.cookies\.set\(name, value, options\)/);
  assert.match(proxySession, /Object\.entries\(input\.responseHeaders\)/);
  assert.doesNotMatch(proxy, /signOut|NextResponse\.redirect/);
});

test("publishable and secret API keys stay opaque and privileged auth remains server-only", async () => {
  for (const label of ["publishable", "secret"] as const) {
    const key = `sb_${label}_test_${"x".repeat(32)}`;
    let capturedApiKey: string | null = null;
    const client = createClient(testSupabaseUrl, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: {
        fetch: async (_input, init) => {
          capturedApiKey = new Headers(init?.headers).get("apikey");
          return new Response("[]", {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        },
      },
    });

    const { error } = await client.from("compatibility_probe").select("id").limit(1);
    assert.equal(error, null, `${label} key should be accepted as an opaque client key`);
    assert.equal(capturedApiKey, key);
  }

  const browserClient = readProjectFile("src", "lib", "supabaseClient.ts");
  const serverClient = readProjectFile("src", "lib", "supabaseServer.ts");
  const adminClient = readProjectFile("src", "lib", "supabaseAdmin.ts");
  const compatibilitySources = `${browserClient}\n${serverClient}\n${adminClient}`;

  assert.match(browserClient, /NEXT_PUBLIC_SUPABASE_ANON_KEY/);
  assert.doesNotMatch(browserClient, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.doesNotMatch(serverClient, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(adminClient, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(adminClient, /persistSession:\s*false/);
  assert.match(adminClient, /autoRefreshToken:\s*false/);
  assert.match(adminClient, /detectSessionInUrl:\s*false/);
  assert.doesNotMatch(adminClient, /createServerClient|cookies\s*\(/);
  assert.doesNotMatch(
    compatibilitySources,
    /jwtDecode|jwt-decode|(?:supabaseAnonKey|serviceRoleKey|supabaseKey)\.split\s*\(\s*["']\.["']/
  );
});

test("auth listeners do not start nested refreshes and stale sessions cannot mask a real sign-out", () => {
  const authGuards = readProjectFile("src", "lib", "authGuards.ts");
  const boundary = readProjectFile("src", "components", "auth", "BrowserAuthBoundary.tsx");
  const dashboard = readProjectFile("src", "components", "dashboard", "DashboardClient.tsx");

  assert.match(authGuards, /event === "SIGNED_OUT"[\s\S]*setCachedSession\(null\)/);
  assert.doesNotMatch(authGuards, /auth\.refreshSession/);
  assert.match(authGuards, /auth\.getUser\(\)/);
  assert.match(authGuards, /catch \(error\) \{[\s\S]*return \{ user: null, error \}/);
  assert.match(authGuards, /if \(result\.error\) \{[\s\S]*throw result\.error/);

  const boundaryListener = boundary.match(/onAuthStateChange[\s\S]*?\n    \}\);/)?.[0] ?? "";
  assert.match(boundaryListener, /event === "SIGNED_OUT"[\s\S]*resolveAuthState\("unauthenticated"\)/);
  assert.doesNotMatch(boundaryListener, /getStableSession|refreshSession/);
  assert.match(boundary, /authEventRevision/);
  assert.match(boundary, /resolveAuthState\("unavailable"\)/);
  assert.doesNotMatch(boundary, /setTimeout\(checkSession,\s*8000\)/);

  const dashboardListener = dashboard.match(/onAuthStateChange[\s\S]*?\n    \}\);/)?.[0] ?? "";
  assert.match(dashboardListener, /event === "SIGNED_OUT"[\s\S]*router\.replace\("\/login"\)/);
  assert.doesNotMatch(dashboardListener, /getStableSession|refreshSession/);
});

test("dashboard sync is serialized, bounded and signs out only after invalid-session proof", () => {
  const dashboard = readProjectFile("src", "components", "dashboard", "DashboardClient.tsx");
  const loadEffect = dashboard.match(/useEffect\(\(\) => \{[\s\S]*?\}, \[router, dashboardRefreshKey\]\);/)?.[0] ?? "";

  assert.match(loadEffect, /let loadInFlight: Promise<void> \| null = null/);
  assert.match(loadEffect, /retryAttempt >= dashboardSyncRetryLimit/);
  assert.match(loadEffect, /getDashboardSyncRetryDelay\(retryAttempt\)/);
  assert.match(loadEffect, /if \(loadInFlight\) return loadInFlight/);
  assert.match(loadEffect, /clearScheduledRetry\(\)/);
  assert.match(loadEffect, /setDashboardLoadError/);
  assert.match(loadEffect, /shouldRevalidateDashboardSession\(queryFailure\)/);
  assert.match(loadEffect, /getStableUser\(\)/);
  assert.match(loadEffect, /isDefinitiveInvalidSession/);
  assert.match(loadEffect, /dashboardSyncTimeoutMs/);
  assert.match(loadEffect, /getStableSession\(\{\s*maxAttempts: 1/);
  assert.match(loadEffect, /queryTimedOut/);
  assert.match(loadEffect, /currentUserId !== expectedUserId/);
  assert.match(loadEffect, /loadedDashboardUserIdRef/);
  assert.match(
    loadEffect,
    /const authUser = currentAuthUser[\s\S]*!isEmailVerified\(authUser\)/
  );
  assert.match(loadEffect, /currentAuthUser = session\.user/);
  assert.match(
    loadEffect,
    /sessionError &&[\s\S]*!isDefinitiveInvalidSession\([\s\S]*scheduleRetry\(sessionError\)/
  );
  assert.equal(loadEffect.match(/\.abortSignal\(queryController\.signal\)/g)?.length, 9);
  assert.equal(loadEffect.match(/\.retry\(false\)/g)?.length, 9);
  assert.match(loadEffect, /silent: hasLoadedDashboardRef\.current/);
});

test("admin and required customer routes preserve sessions on transient Auth failures", () => {
  const admin = readProjectFile("src", "app", "admin", "page.tsx");
  const orders = readProjectFile("src", "app", "dashboard", "orders", "page.tsx");
  const credits = readProjectFile("src", "app", "dashboard", "credits", "page.tsx");
  const settings = readProjectFile("src", "app", "dashboard", "settings", "page.tsx");
  const dashboard = readProjectFile("src", "components", "dashboard", "DashboardClient.tsx");

  for (const source of [admin, credits, settings]) {
    assert.match(source, /resolveBrowserAuthCheck/);
    assert.match(source, /getStableUser/);
  }

  assert.match(orders, /getStableUser/);

  assert.match(admin, /function clearPrivilegedAdminState\(\)/);
  assert.match(admin, /adminAuthRevisionRef/);
  assert.match(admin, /adminLoadInFlightRef/);
  assert.match(admin, /adminLoadQueuedRef/);
  assert.match(admin, /performAdminDataLoad/);
  assert.match(
    admin,
    /if \(profileError\) \{[\s\S]*setAdminLoadError[\s\S]*return;/
  );
  assert.match(
    admin,
    /if \(!isStaffMember\(access\)[\s\S]*clearPrivilegedAdminState\(\)/
  );
  assert.match(
    admin,
    /event === "SIGNED_OUT"[\s\S]*clearPrivilegedAdminState\(\)[\s\S]*router\.replace\("\/login"\)/
  );
  assert.match(orders, /const initializeAuth = useCallback[\s\S]*checkBrowserAuthUserWithRetry/);
  assert.match(orders, /shouldRevalidateDashboardSession\(queryResult\.error\)/);
  assert.match(orders, /retryCustomerOrdersQueryAfterAuthCheck/);
  assert.match(orders, /event === "SIGNED_OUT"[\s\S]*clearOrdersForLogout\(\)[\s\S]*router\.replace\("\/login"\)/);
  assert.match(orders, /currentUserId && currentUserId !== session\.user\.id[\s\S]*clearOrdersForLogout\(\)[\s\S]*initializeAuth\(\)/);
  assert.match(orders, /ordersLoadRevisionRef\.current !== expectedLoadRevision/);
  assert.match(orders, /authRevisionRef\.current !== expectedAuthRevision/);
  assert.doesNotMatch(orders, /refreshSession|runCustomerOrdersSync/);
  assert.match(credits, /getStableSession\(\{[\s\S]*maxAttempts: 1/);
  assert.match(settings, /resolveBrowserAuthCheck[\s\S]*SETTINGS_LOAD_ERROR_MESSAGE/);
  assert.match(dashboard, /catch \{[\s\S]*setLogoutError\(LOGOUT_ERROR_MESSAGE\)/);
});
