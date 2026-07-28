import { createClient, type SupabaseClient } from "@supabase/supabase-js";

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
};

const browserWindow = typeof window === "undefined" ? null : window as SupabaseWindow;

export const supabase = browserWindow?.__mgAutotechSupabase ?? createClient(
  getValidSupabaseUrl(supabaseUrl),
  supabaseAnonKey || "placeholder-anon-key",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);

if (browserWindow) browserWindow.__mgAutotechSupabase = supabase;
