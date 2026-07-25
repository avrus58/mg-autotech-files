import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { defaultLocale, normalizeLocale } from "@/lib/i18n";
import { isSeoLocale } from "@/lib/seo";
import {
  hasSupabasePublicConfig,
  supabaseAuthCookieOptions,
} from "@/lib/supabaseAuthConfig";

const localeCookie = "mg_locale";

export async function proxy(request: NextRequest) {
  const firstPathSegment = request.nextUrl.pathname.split("/").filter(Boolean)[0];
  const existingLocale = request.cookies.get(localeCookie)?.value;
  const pathLocale = firstPathSegment && isSeoLocale(firstPathSegment)
    ? firstPathSegment
    : null;
  const resolvedLocale =
    pathLocale ??
    normalizeLocale(
      existingLocale ??
        request.headers.get("accept-language") ??
        defaultLocale
    );
  const requestHeaders = new Headers(request.headers);

  requestHeaders.set("x-mg-locale", resolvedLocale);

  let response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const hasAuthCookie = request.cookies
    .getAll()
    .some(({ name }) => name.startsWith("sb-") && name.includes("-auth-token"));

  if (hasAuthCookie && hasSupabasePublicConfig(supabaseUrl, supabaseAnonKey)) {
    const supabase = createServerClient(supabaseUrl!, supabaseAnonKey!, {
      cookieOptions: supabaseAuthCookieOptions,
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, responseHeaders) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          requestHeaders.set("cookie", request.cookies.toString());

          response = NextResponse.next({
            request: {
              headers: requestHeaders,
            },
          });

          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
          Object.entries(responseHeaders).forEach(([name, value]) => {
            response.headers.set(name, value);
          });
        },
      },
    });

    try {
      await supabase.auth.getClaims();
    } catch {
      // A transient Auth service/network failure must not turn navigation into logout.
    }
  }

  if (existingLocale !== resolvedLocale) {
    response.cookies.set(localeCookie, resolvedLocale, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|og-image.svg|opengraph-image|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
