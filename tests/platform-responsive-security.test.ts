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

  assert.match(adminPage, /aside className="order-2[^"]*xl:order-1/);
  assert.match(adminPage, /div className="order-1 min-w-0 xl:order-2"/);
  assert.match(notificationDock, /fixed bottom-4 left-4[^"]*sm:right-4 sm:top-20/);
});

test("public online status is compact and never intercepts mobile controls", () => {
  const onlineStatus = readProjectFile("src", "components", "OnlineStatus.tsx");

  assert.match(onlineStatus, /pointer-events-none fixed bottom-3 left-3/);
  assert.match(onlineStatus, /hidden font-black sm:block/);
  assert.match(onlineStatus, /max-w-24 truncate/);
});

test("baseline security headers protect private workspaces without blocking widget embedding", () => {
  const nextConfig = readProjectFile("next.config.ts");

  assert.match(nextConfig, /X-Content-Type-Options/);
  assert.match(nextConfig, /strict-origin-when-cross-origin/);
  assert.match(nextConfig, /camera=\(\), microphone=\(\), geolocation=\(\)/);
  assert.match(nextConfig, /X-Frame-Options[\s\S]*DENY/);
  assert.match(nextConfig, /frame-ancestors 'none'/);
  assert.match(nextConfig, /"\/admin\/:path\*", "\/dashboard\/:path\*", "\/new-request", "\/payment\/:path\*"/);
  assert.doesNotMatch(nextConfig, /"\/widget\/:path\*"/);
  assert.doesNotMatch(nextConfig, /"\/embed\/:path\*"/);
});
