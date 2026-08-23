import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

function readProjectFile(...segments: string[]) {
  return readFileSync(resolve(process.cwd(), ...segments), "utf8");
}

test("learning detail uses the central recoverable request path without weakening staff authorization", () => {
  const page = readProjectFile("src", "app", "admin", "ai-training", "[id]", "page.tsx");
  const detailRoute = readProjectFile("src", "app", "api", "admin", "ai-training", "[id]", "route.ts");
  const similarityRoute = readProjectFile("src", "app", "api", "admin", "ai-training", "[id]", "similarity", "route.ts");

  assert.match(page, /import \{ authenticatedFetch \} from "@\/lib\/authGuards"/);
  assert.match(page, /\(url: string, init\?: RequestInit\) => authenticatedFetch\(url, init\)/);
  assert.doesNotMatch(page, /ADMIN_SESSION_RETRY_MESSAGE/);
  assert.doesNotMatch(page, /response\.status === 401/);
  assert.doesNotMatch(page, /window\.location\.href = [`"]\/login/);
  assert.match(page, /messageTone === "success"/);
  assert.match(page, /role=\{messageTone === "error" \? "alert" : "status"\}/);

  assert.match(detailRoute, /requireStaffPermission\(request, "ai_training\.manage"\)/);
  assert.match(similarityRoute, /requireStaffPermission\(request, "ai_training\.manage"\)/);
});

test("authenticated fetch coordinates reads and refreshes before declaring the session unavailable", () => {
  const guard = readProjectFile("src", "lib", "authGuards.ts");

  assert.match(guard, /let sessionResolutionInFlight: Promise<StableSessionResult> \| null = null/);
  assert.match(guard, /let sessionRefreshInFlight: Promise<StableSessionResult> \| null = null/);
  assert.match(guard, /const sessionReadDelays = \[0, 120, 280, 520\] as const/);
  assert.match(guard, /const requestRetryDelays = \[0, 250, 650\] as const/);
  assert.match(
    guard,
    /await withAuthSdkOperationTimeout\(\s*supabase\.auth\.refreshSession\(\)\s*\)/
  );
  assert.doesNotMatch(guard, /refreshSession\(\s*\{/);
  assert.match(guard, /headers\.set\("Authorization", `Bearer \$\{accessToken\}`\)/);
  assert.match(guard, /if \(response\.status !== 401\) return response/);
  assert.match(guard, /if \(finalState\.session\?\.user \|\| finalState\.error\)/);
  assert.match(guard, /notifySessionRequired\(\)/);
});
