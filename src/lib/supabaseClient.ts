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

export const supabase = createClient(
  getValidSupabaseUrl(supabaseUrl),
  supabaseAnonKey || "placeholder-anon-key"
);
