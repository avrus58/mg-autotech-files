import { NextResponse, type NextRequest } from "next/server";
import {
  defaultLocale,
  parseSupportedLocale,
  resolveAcceptLanguage,
} from "@/lib/i18nConfig";
import { getFixedPresentationLocale } from "@/lib/fixedPresentationLocale";
import { isSeoLocale } from "@/lib/seo";

const localeCookie = "mg_locale";

export function proxy(request: NextRequest) {
  const firstPathSegment = request.nextUrl.pathname.split("/").filter(Boolean)[0];
  const existingLocale = request.cookies.get(localeCookie)?.value;
  const pathLocale = firstPathSegment && isSeoLocale(firstPathSegment)
    ? firstPathSegment
    : null;
  const authoredLocale = getFixedPresentationLocale(request.nextUrl.pathname);
  const resolvedLocale =
    pathLocale ??
    authoredLocale ??
    parseSupportedLocale(existingLocale) ??
    resolveAcceptLanguage(
      request.headers.get("accept-language") ?? defaultLocale
    );
  const requestHeaders = new Headers(request.headers);

  requestHeaders.set("x-mg-locale", resolvedLocale);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  // Authored legal/system documents have a fixed presentation language, but
  // visiting one must never replace the visitor's site-wide preference.
  if (!authoredLocale && existingLocale !== resolvedLocale) {
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
    "/((?!api|_next/static|_next/image|favicon.ico|og-image.svg|opengraph-image|robots.txt|sitemap.xml|feed.xml|llms.txt|53478ab4be7faddc91a14935b2b35013051e4dfc9bb31c4a.txt).*)",
  ],
};
