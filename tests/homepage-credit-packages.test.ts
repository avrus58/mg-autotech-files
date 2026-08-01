import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { creditPackages } from "../src/lib/creditPackages";

const homepage = readFileSync(resolve(process.cwd(), "src", "app", "page.tsx"), "utf8");

test("homepage credit cards use every ready package from the shared credit catalog", () => {
  assert.deepEqual(
    creditPackages.map((item) => item.credits),
    [10, 50, 100, 250, 500]
  );
  assert.match(homepage, /const homepageCreditPackages = sharedCreditPackages\.map/);
  assert.doesNotMatch(homepage, /filter\(\(pack\) => pack\.credits <= 250\)/);
  assert.match(homepage, /key=\{pack\.id\}/);
  assert.match(homepage, /\{pack\.name\}/);
  assert.match(homepage, /\{pack\.description\}/);
  assert.match(homepage, /xl:grid-cols-5/);
});

test("homepage credit unit prices retain catalog precision", () => {
  assert.deepEqual(
    creditPackages.map((item) => item.priceEuro / item.credits),
    [3.6, 3.6, 3.2, 2.8, 2.4]
  );
  assert.match(homepage, /function formatCreditUnitEuro/);
  assert.match(homepage, /minimumFractionDigits: 2/);
  assert.match(homepage, /maximumFractionDigits: 2/);
  assert.match(homepage, /formatCreditUnitEuro\(pack\.unitPriceEuro\)/);
});

test("homepage package rail stays compact on mobile and keeps checkout routing accessible", () => {
  assert.match(homepage, /snap-x snap-mandatory/);
  assert.match(homepage, /overflow-x-auto/);
  assert.match(homepage, /href="\/dashboard\/credits"/);
  assert.match(homepage, /aria-label=\{`Select the \$\{pack\.name\} \$\{pack\.credits\} credit package`\}/);
  assert.doesNotMatch(
    homepage,
    /storage_path|signed_url|service_role|SUPABASE_SERVICE_ROLE_KEY|admin_notes|internal_notes/i
  );
});
