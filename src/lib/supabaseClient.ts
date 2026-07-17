import { navigatorLock } from "@supabase/auth-js";
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { migrateLegacyBrowserSessionToCookies } from "@/lib/authSessionMigration";
import { supabaseAuthCookieOptions } from "@/lib/supabaseAuthConfig";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function getValidSupabaseUrl(value: string | undefined) {
  if (!value) return "https://placeholder.supabase.co";

  try {
    return new URL(value).toString().replace(/\/$/, "");
  } catch {
    return "https://placeholder.supabase.co";
  }
}

type SupabaseWindow = Window & typeof globalThis & {
  __mgAutotechSupabase?: SupabaseClient;
  __mgAutotechSupabaseMode?: "cookie-ssr";
};

const browserWindow = typeof window === "undefined" ? null : window as SupabaseWindow;
const validSupabaseUrl = getValidSupabaseUrl(supabaseUrl);
const existingCookieClient = browserWindow?.__mgAutotechSupabaseMode === "cookie-ssr"
  ? browserWindow.__mgAutotechSupabase
  : undefined;

if (browserWindow && !existingCookieClient) {
  migrateLegacyBrowserSessionToCookies(validSupabaseUrl);
  if (browserWindow.__mgAutotechSupabase) {
    void browserWindow.__mgAutotechSupabase.auth.stopAutoRefresh();
  }
}

export const supabase = existingCookieClient ?? createBrowserClient(
  validSupabaseUrl,
  supabaseAnonKey || "placeholder-anon-key",
  {
    cookieOptions: supabaseAuthCookieOptions,
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      // Supabase v2 still supports this lock and it prevents cross-tab refresh races.
      lock: typeof navigator !== "undefined" && navigator.locks ? navigatorLock : undefined,
      lockAcquireTimeout: 10_000,
    },
  }
);

if (browserWindow) {
  browserWindow.__mgAutotechSupabase = supabase;
  browserWindow.__mgAutotechSupabaseMode = "cookie-ssr";
}
