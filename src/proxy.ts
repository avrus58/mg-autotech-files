import { NextResponse, type NextRequest } from "next/server";
import {
  defaultLocale,
  intlLocaleByCode,
  parseSupportedLocale,
  resolveAcceptLanguage,
} from "@/lib/i18nConfig";
import { getFixedPresentationLocale } from "@/lib/fixedPresentationLocale";
import { getInitialLocaleRedirect } from "@/lib/i18nRoutes";
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

  const localizedTarget = getInitialLocaleRedirect(
    request.nextUrl.pathname,
    resolvedLocale,
  );
  const response = localizedTarget
    ? (() => {
        const targetUrl = request.nextUrl.clone();
        targetUrl.pathname = localizedTarget;
        return NextResponse.redirect(targetUrl);
      })()
    : NextResponse.next({
        request: {
          headers: requestHeaders,
        },
      });

  // The embedded customer widget owns its language independently from the
  // surrounding MG AutoTech site and can also use Romanian or Arabic. Its
  // server-rendered boundary assigns the exact resolved document language;
  // omitting this optional header is safer than declaring the site's English.
  if (request.nextUrl.pathname !== "/embed/vehicle-selector") {
    response.headers.set("Content-Language", intlLocaleByCode[resolvedLocale]);
  }

  // Prefixless pages can vary by an explicit preference or the browser's
  // language. Keep intermediary caches from serving one visitor's language to
  // another while localized and fixed-language routes stay cache-friendly.
  if (!pathLocale && !authoredLocale) {
    response.headers.append("Vary", "Cookie, Accept-Language");
  }

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
