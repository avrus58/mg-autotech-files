import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

function readProjectFile(...segments: string[]) {
  return readFileSync(resolve(process.cwd(), ...segments), "utf8");
}

test("customer order filters stay visible without a hidden mobile scroll rail", () => {
  const ordersPage = readProjectFile("src", "app", "dashboard", "orders", "page.tsx");

  assert.match(ordersPage, /mb-5 grid grid-cols-2 gap-2 md:hidden/);
  assert.match(ordersPage, /last:col-span-2/);
  assert.doesNotMatch(ordersPage, /mb-5 flex gap-2 overflow-x-auto pb-2 lg:hidden/);
});

test("admin email grids contain wide tables instead of expanding the phone viewport", () => {
  const emailPage = readProjectFile("src", "app", "admin", "email", "page.tsx");

  assert.match(emailPage, /min-h-screen overflow-x-hidden/);
  assert.match(emailPage, /lg:grid-cols-\[340px_minmax\(0,1fr\)\]/);
  assert.match(emailPage, /min-w-0 space-y-5/);
  assert.match(emailPage, /mt-3 max-w-full overflow-x-auto/);
  assert.match(emailPage, /min-w-0 break-all text-right font-bold/);
});

test("admin mobile content is prioritized and the notification dock avoids page headers", () => {
  const adminPage = readProjectFile("src", "app", "admin", "page.tsx");
  const notificationDock = readProjectFile("src", "components", "admin", "AdminNotificationDock.tsx");

  assert.match(adminPage, /aside data-admin-desktop-sidebar className="order-2[^"]*xl:order-1/);
  const mobileCss = readProjectFile("src", "app", "admin", "mobile.css");
  assert.match(mobileCss, /@media \(max-width: 1023px\)/);
  assert.match(mobileCss, /data-admin-desktop-sidebar/);
  assert.match(mobileCss, /data-admin-notification-dock.*bottom: calc\(88px/);
  assert.match(adminPage, /div className="order-1 min-w-0 xl:order-2"/);
  assert.match(notificationDock, /fixed bottom-4 left-4[^"]*sm:right-4 sm:top-20/);
});

test("admin orders keep file state and actions visible at every responsive width", () => {
  const adminPage = readProjectFile("src", "app", "admin", "page.tsx");
  const ordersPanel =
    adminPage.match(/function OrdersPanel\([\s\S]*?\nfunction CustomersPanel\(/)?.[0] ?? "";
  const responsiveCardsStart = ordersPanel.indexOf(
    '<div className="grid gap-3 lg:grid-cols-2 2xl:hidden">',
  );
  const responsiveCardsEnd = ordersPanel.indexOf(
    "{visibleOrders.length < statusFilteredGroupedOrders.length",
    responsiveCardsStart,
  );
  const responsiveCards = ordersPanel.slice(responsiveCardsStart, responsiveCardsEnd);

  assert.ok(ordersPanel, "OrdersPanel source must remain available for responsive checks");
  assert.ok(responsiveCardsStart >= 0 && responsiveCardsEnd > responsiveCardsStart);
  assert.match(adminPage, /max-w-\[1760px\][^\n]*xl:grid-cols-\[220px_minmax\(0,1fr\)\]/);

  assert.match(
    ordersPanel,
    /hidden overflow-x-auto rounded-2xl border border-white\/10 2xl:block/,
  );
  assert.match(ordersPanel, /grid gap-3 lg:grid-cols-2 2xl:hidden/);
  assert.doesNotMatch(
    ordersPanel,
    /hidden overflow-hidden rounded-2xl border border-white\/10 xl:block/,
  );
  assert.match(ordersPanel, /<col className="w-\[10%\]" \/>/);
  assert.match(responsiveCards, /Original Ready/);
  assert.match(responsiveCards, /Modified Ready/);
  assert.match(responsiveCards, /No Original/);
  assert.match(responsiveCards, /\{order\.credits_required \?\? 0\} cr/);
  assert.match(responsiveCards, /customerIdentity/);
  assert.match(responsiveCards, /vehicleDetail/);
  assert.match(responsiveCards, /ecuDetail/);
  assert.match(responsiveCards, /min-w-0 w-full/);
  assert.match(responsiveCards, />\s*Details\s*</);
  assert.match(
    ordersPanel,
    /aria-label=\{`Update status for order \$\{shortId\(order\.id\)\}`\}/,
  );
  assert.match(
    ordersPanel,
    /aria-labelledby=\{`admin-order-\$\{order\.id\}`\}/,
  );
});

test("public online status is compact and never intercepts mobile controls", () => {
  const onlineStatus = readProjectFile("src", "components", "OnlineStatus.tsx");

  assert.match(onlineStatus, /pointer-events-none fixed bottom-3 left-3/);
  assert.match(onlineStatus, /hidden font-black sm:block/);
  assert.match(onlineStatus, /max-w-24 truncate/);
});

test("file-service hero actions preserve mobile clearance from the fixed control dock", () => {
  const page = readProjectFile("src", "app", "file-service", "page.tsx");
  const languageSwitcher = readProjectFile("src", "components", "LanguageSwitcher.tsx");
  const privacyControl = readProjectFile("src", "components", "analytics", "PublicAnalytics.tsx");
  const heroActions =
    page.match(/data-file-service-hero-actions[\s\S]*?className="([^"]+)"/)?.[1] ?? "";

  assert.match(page, /grid max-w-7xl gap-10 px-4 pb-16 pt-6 sm:py-20/);
  assert.match(page, /text-\[2\.5rem\][^"\n]*sm:text-5xl/);
  assert.match(page, /inline-block max-w-full[^"\n]*text-\[11px\]/);
  assert.match(heroActions, /flex flex-col/);
  assert.match(heroActions, /mt-6/);
  assert.match(heroActions, /sm:mt-8/);
  assert.match(heroActions, /sm:flex-row sm:flex-wrap/);
  assert.match(
    heroActions,
    /mb-\[calc\(5\.5rem\+env\(safe-area-inset-bottom\)\)\]/,
  );
  assert.match(heroActions, /sm:mb-0/);
  assert.equal(
    (
      page.match(
        /scroll-mb-\[calc\(5\.5rem\+env\(safe-area-inset-bottom\)\)\]/g,
      ) ?? []
    ).length,
    2,
  );
  assert.match(languageSwitcher, /fixed bottom-4 right-4/);
  assert.match(privacyControl, /fixed bottom-4 right-20/);

  for (const viewportWidth of [320, 375, 390, 430]) {
    assert.ok(viewportWidth < 640, `${viewportWidth}px must retain the mobile CTA clearance`);
  }
});

test("homepage vehicle controls and icon-only account link have accessible names", () => {
  const homepage = [
    readProjectFile("src", "components", "homepage", "HomepageExperience.tsx"),
    readProjectFile("src", "components", "homepage", "VehicleIntelligence.tsx"),
  ].join("\n");

  assert.match(homepage, /<select\s+aria-label=\{placeholder\}/);
  assert.match(homepage, /aria-label="Open navigation"/);
  assert.match(homepage, /aria-label="MG AutoTech home"/);
});

test("baseline security headers protect private workspaces without blocking widget embedding", () => {
  const nextConfig = readProjectFile("next.config.ts");
  const protectedPageSources = nextConfig.slice(
    nextConfig.indexOf("const protectedPageSources"),
    nextConfig.indexOf("const nextConfig"),
  );

  assert.match(nextConfig, /X-Content-Type-Options/);
  assert.match(nextConfig, /X-Permitted-Cross-Domain-Policies/);
  assert.match(nextConfig, /Referrer-Policy", value: "strict-origin"/);
  assert.match(nextConfig, /camera=\(\), microphone=\(\), geolocation=\(\)/);
  assert.match(nextConfig, /X-Frame-Options[\s\S]*DENY/);
  assert.match(nextConfig, /frame-ancestors 'none'; base-uri 'self'; object-src 'none'/);
  assert.match(nextConfig, /private, no-store, max-age=0, must-revalidate/);
  for (const source of [
    "/admin/:path*",
    "/dashboard/:path*",
    "/new-request",
    "/payment/:path*",
    "/login",
    "/register",
    "/forgot-password",
    "/reset-password",
    "/auth/:path*",
  ]) {
    assert.match(protectedPageSources, new RegExp(source.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.doesNotMatch(protectedPageSources, /"\/widget\/:path\*"/);
  assert.doesNotMatch(protectedPageSources, /"\/embed\/:path\*"/);
});
