import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  customerAuthFeedbackT,
  type CustomerAuthFeedback,
} from "../src/lib/i18n/customer-auth-feedback";
import {
  customerPasswordErrorT,
  customerWorkflowExactT,
} from "../src/lib/i18n/customer-workflow-auth-translations";

test("password validation feedback follows the current locale without mutating its source", () => {
  const feedback: CustomerAuthFeedback = {
    kind: "password-validation",
    source: "Use at least 12 characters.",
  };

  assert.equal(
    customerAuthFeedbackT("tr", feedback),
    customerPasswordErrorT("tr", feedback.source),
  );
  assert.equal(
    customerAuthFeedbackT("de", feedback),
    customerPasswordErrorT("de", feedback.source),
  );
  assert.notEqual(
    customerAuthFeedbackT("tr", feedback),
    customerAuthFeedbackT("de", feedback),
  );
  assert.deepEqual(feedback, {
    kind: "password-validation",
    source: "Use at least 12 characters.",
  });
});

test("non-password feedback retains exact localization and explicitly safe raw text", () => {
  const exact: CustomerAuthFeedback = {
    kind: "exact",
    source: "Passwords do not match.",
  };
  const safeRaw: CustomerAuthFeedback = {
    kind: "safe-raw",
    text: "Reference AUTH-42",
  };

  assert.equal(
    customerAuthFeedbackT("tr", exact),
    customerWorkflowExactT("tr", exact.source),
  );
  assert.equal(
    customerAuthFeedbackT("de", exact),
    customerWorkflowExactT("de", exact.source),
  );
  assert.equal(customerAuthFeedbackT("tr", safeRaw), safeRaw.text);
  assert.equal(customerAuthFeedbackT("de", safeRaw), safeRaw.text);
  assert.equal(customerAuthFeedbackT("de", null), "");
});

test("register and reset pages store password error semantics instead of localized prose", () => {
  for (const path of [
    "src/app/register/page.tsx",
    "src/app/reset-password/page.tsx",
  ]) {
    const source = readFileSync(path, "utf8");

    assert.match(
      source,
      /useState<CustomerAuthFeedback \| null>\(null\)/u,
      path,
    );
    assert.match(source, /kind: "password-validation",\s*source:/u, path);
    assert.match(source, /customerAuthFeedbackT\(locale, message\)/u, path);
    assert.doesNotMatch(
      source,
      /setMessage\(\s*customerPasswordErrorT\(/u,
      path,
    );
  }
});
