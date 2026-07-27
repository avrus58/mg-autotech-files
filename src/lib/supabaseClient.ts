import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { migrateLegacyBrowserSessionToCookies } from "@/lib/authSessionMigration";
import { supabaseAuthCookieOptions } from "@/lib/supabaseAuthConfig";
import {
  createSupabaseAuthTimedFetch,
  supabaseAuthRequestTimeoutMs,
} from "@/lib/timedFetch";

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
const timedSupabaseFetch = createSupabaseAuthTimedFetch(
  supabaseAuthRequestTimeoutMs
);
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
    global: {
      fetch: timedSupabaseFetch,
    },
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);

if (browserWindow) {
  browserWindow.__mgAutotechSupabase = supabase;
  browserWindow.__mgAutotechSupabaseMode = "cookie-ssr";
}
