import type { CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type SupabaseCookieUpdate = {
  name: string;
  value: string;
  options: CookieOptions;
};

export function applySupabaseSessionRefresh(input: {
  request: NextRequest;
  requestHeaders: Headers;
  cookiesToSet: SupabaseCookieUpdate[];
  responseHeaders: Record<string, string>;
}) {
  input.cookiesToSet.forEach(({ name, value }) => {
    input.request.cookies.set(name, value);
  });
  input.requestHeaders.set("cookie", input.request.cookies.toString());

  const response = NextResponse.next({
    request: {
      headers: input.requestHeaders,
    },
  });

  input.cookiesToSet.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options);
  });
  Object.entries(input.responseHeaders).forEach(([name, value]) => {
    response.headers.set(name, value);
  });

  return response;
}
