import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

function readProjectFile(...segments: string[]) {
  return readFileSync(resolve(process.cwd(), ...segments), "utf8");
}

test("learning detail retries the stable authenticated request path without weakening staff authorization", () => {
  const page = readProjectFile("src", "app", "admin", "ai-training", "[id]", "page.tsx");
  const detailRoute = readProjectFile("src", "app", "api", "admin", "ai-training", "[id]", "route.ts");
  const similarityRoute = readProjectFile("src", "app", "api", "admin", "ai-training", "[id]", "similarity", "route.ts");

  assert.match(page, /import \{ authenticatedFetch \} from "@\/lib\/authGuards"/);
  assert.match(page, /const ADMIN_SESSION_RETRY_MESSAGE =/);
  assert.match(page, /Your secure admin session is reconnecting/);
  assert.match(page, /if \(response\.status !== 401\) return response/);
  assert.match(page, /window\.setTimeout\(resolve, 450\)/);
  assert.match(page, /return authenticatedFetch\(url, init\)/);
  assert.match(page, /if \(response\.status === 401\) throw new Error\(ADMIN_SESSION_RETRY_MESSAGE\)/);
  assert.match(page, /messageTone === "success"/);
  assert.match(page, /role=\{messageTone === "error" \? "alert" : "status"\}/);
  assert.doesNotMatch(page, /throw new Error\(payload\.error \|\| "Verification could not be saved\."\)[\s\S]*?setMessage\(error instanceof Error \? error\.message/);

  assert.match(detailRoute, /requireStaffPermission\(request, "ai_training\.manage"\)/);
  assert.match(similarityRoute, /requireStaffPermission\(request, "ai_training\.manage"\)/);
});

test("authenticated fetch recovers a persisted session before returning an authorization failure", () => {
  const guard = readProjectFile("src", "lib", "authGuards.ts");

  assert.match(guard, /const \{ data, error \} = await supabase\.auth\.refreshSession\(\)/);
  assert.match(guard, /if \(data\.session\) \{[\s\S]*?setCachedSession\(data\.session\)/);
  assert.match(guard, /if \(!refreshedSession\?\.access_token\) \{[\s\S]*?const recovered = await getStableSession\(\)/);
  assert.match(guard, /return send\(refreshedSession\.access_token\)/);
  assert.match(guard, /headers\.set\("Authorization", `Bearer \$\{accessToken\}`\)/);
});
