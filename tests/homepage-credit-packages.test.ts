import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const homepage = readFileSync(resolve(process.cwd(), "src", "app", "page.tsx"), "utf8");
const publicQuoteRoute = readFileSync(
  resolve(process.cwd(), "src", "app", "api", "credits", "public-quote", "route.ts"),
  "utf8",
);

test("homepage credit cards render only a validated live public quote", () => {
  assert.match(homepage, /type PublicCreditQuoteState[\s\S]*status: "loading"[\s\S]*status: "ready"[\s\S]*status: "error"/);
  assert.match(homepage, /function parsePublicCreditQuote/);
  assert.match(homepage, /fetch\("\/api\/credits\/public-quote"/);
  assert.match(homepage, /if \(!response\.ok\)/);
  assert.match(homepage, /parsePublicCreditQuote\(payload\?\.quote\)/);
  assert.match(homepage, /publicCreditQuote\.status === "ready"/);
  assert.match(homepage, /publicCreditQuote\.quote\.packages\.map\(\(pack\) =>/);
  assert.match(homepage, /key=\{pack\.id\}/);
  assert.match(homepage, /\{pack\.name\}/);
  assert.match(homepage, /\{pack\.description\}/);
  assert.doesNotMatch(homepage, /const homepageCreditPackages|sharedCreditPackages\.map/);
});

test("public credit pricing exposes only the homepage allowlist", () => {
  assert.match(publicQuoteRoute, /getCommerceSettings\(\)/);
  assert.match(publicQuoteRoute, /emptyCustomerCommercialPolicy\("public-global-pricing"\)/);
  assert.match(
    publicQuoteRoute,
    /packages: quote\.packages\.map\(\(item\) => \(\{[\s\S]*id: item\.id,[\s\S]*name: item\.name,[\s\S]*credits: item\.credits,[\s\S]*priceEuro: item\.priceEuro,[\s\S]*unitPriceEuro: item\.unitPriceEuro,[\s\S]*description: item\.description,[\s\S]*highlight: Boolean\(item\.highlight\)/,
  );
  assert.doesNotMatch(
    publicQuoteRoute,
    /requireApiUser|requireStaffAccess|customer_commercial_policies|customerPolicy|internal_note|updated_by|before_json|after_json|paymentMethods|payment_(?:paypal|bank|stripe)_enabled/i,
  );
  assert.match(publicQuoteRoute, /status: 503/);
});

test("homepage pricing has explicit loading, error and ready presentations", () => {
  assert.match(homepage, /publicCreditQuote\.status === "loading"[\s\S]*role="status"/);
  assert.match(homepage, /aria-label="Loading current credit prices"/);
  assert.match(homepage, /publicCreditQuote\.status === "error"[\s\S]*role="alert"/);
  assert.match(homepage, /No outdated price is being shown\./);
  assert.match(homepage, /onClick=\{\(\) => void loadPublicCreditQuote\(\)\}/);
  assert.match(homepage, /publicCreditQuote\.status === "ready"[\s\S]*publicCreditQuote\.quote\.promotionLabel/);
  assert.match(homepage, /function formatCreditUnitEuro/);
  assert.match(homepage, /minimumFractionDigits: 2/);
  assert.match(homepage, /maximumFractionDigits: 4/);
  assert.match(homepage, /formatCreditUnitEuro\(pack\.unitPriceEuro\)/);
  assert.match(
    homepage,
    /function formatEuro[\s\S]{0,300}maximumFractionDigits: 2/,
    "Package totals must not hide cents introduced by global pricing adjustments",
  );
});

test("homepage package rail stays compact on mobile and keeps checkout routing accessible", () => {
  assert.match(homepage, /snap-x snap-mandatory/);
  assert.match(homepage, /overflow-x-auto/);
  assert.match(homepage, /xl:grid-cols-5/);
  assert.match(homepage, /href="\/dashboard\/credits"/);
  assert.match(homepage, /aria-label=\{`Select the \$\{pack\.name\} \$\{pack\.credits\} credit package`\}/);
  assert.doesNotMatch(
    homepage,
    /storage_path|signed_url|service_role|SUPABASE_SERVICE_ROLE_KEY|admin_notes|internal_notes/i
  );
});
