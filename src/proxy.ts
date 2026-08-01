import { NextResponse, type NextRequest } from "next/server";
import { defaultLocale, normalizeLocale } from "@/lib/i18nConfig";
import { isSeoLocale } from "@/lib/seo";

const localeCookie = "mg_locale";

export function proxy(request: NextRequest) {
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

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

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
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|og-image.svg|opengraph-image).*)"],
};
