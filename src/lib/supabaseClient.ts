import { createClient } from "@supabase/supabase-js";

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

// The ES module cache is the singleton boundary. Do not publish an authenticated
// client on window, where unrelated browser scripts could discover it.
export const supabase = createClient(
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
