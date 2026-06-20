import { NextResponse, type NextRequest } from "next/server";
import { defaultLocale, normalizeLocale } from "@/lib/i18n";

const localeCookie = "mg_locale";

export function proxy(request: NextRequest) {
  const response = NextResponse.next();
  const existingLocale = request.cookies.get(localeCookie)?.value;

  if (!existingLocale) {
    const browserLocale = normalizeLocale(
      request.headers.get("accept-language") ?? defaultLocale
    );

    response.cookies.set(localeCookie, browserLocale, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
  }

  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|og-image.svg).*)"],
};
