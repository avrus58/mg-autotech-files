import { createClient } from "@supabase/supabase-js";
import { AuthClient, AuthSessionMissingError, type UserResponse } from "@supabase/auth-js";

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

// User verification must not mutate the browser's sign-in session. The Auth
// SDK removes its stored session on session_not_found, even when that response
// belongs to a request started before a newer login. Isolate these reads from
// the persistent client, including its storage and cross-tab auth broadcasts.
const userVerificationClient = new AuthClient({
  url: `${getValidSupabaseUrl(supabaseUrl)}/auth/v1`,
  headers: { apikey: supabaseAnonKey || "placeholder-anon-key" },
  storageKey: "mg-autotech-user-verification-readonly",
  persistSession: false,
  autoRefreshToken: false,
  detectSessionInUrl: false,
});

export async function verifyBrowserAccessToken(accessToken: string): Promise<UserResponse> {
  if (!accessToken.trim()) {
    return { data: { user: null }, error: new AuthSessionMissingError() };
  }
  return userVerificationClient.getUser(accessToken);
}
