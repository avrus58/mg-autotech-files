import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  auditDynamicVisibleExpressions,
  reviewedDynamicVisibleExpressions,
  type DynamicVisibleExpression,
} from "../scripts/lib/i18n-dynamic-guard";

test("the dynamic i18n inventory rejects every unreviewed visible composition", () => {
  const reviewed = reviewedDynamicVisibleExpressions.map(
    (expression, index): DynamicVisibleExpression => ({
      ...expression,
      line: index + 1,
    })
  );
  const novelComposition: DynamicVisibleExpression = {
    file: "src/components/dashboard/Example.tsx",
    kind: "template",
    line: 42,
    source: "`${count} pending orders`",
  };

  const audit = auditDynamicVisibleExpressions([
    ...reviewed,
    novelComposition,
  ]);

  assert.deepEqual(audit.unclassified, [novelComposition]);
  assert.deepEqual(audit.staleReviewed, []);
  assert.equal(audit.classificationFor(novelComposition), undefined);
});

test("the dynamic i18n inventory reports stale reviewed bypasses", () => {
  const [removed, ...detected] = reviewedDynamicVisibleExpressions;
  assert.ok(removed);

  const audit = auditDynamicVisibleExpressions(
    detected.map(
      (expression, index): DynamicVisibleExpression => ({
        ...expression,
        line: index + 1,
      })
    )
  );

  assert.deepEqual(audit.unclassified, []);
  assert.deepEqual(audit.staleReviewed, [removed]);
});

test("the repository checker fails on a new composed visible string without a report flag", () => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), "mg-i18n-dynamic-"));
  const fixture = join(fixtureRoot, "UnreviewedCopy.tsx");
  writeFileSync(
    fixture,
    [
      "export function UnreviewedCopy({ count }: { count: number }) {",
      "  return <p>{`${count} HP`}</p>;",
      "}",
    ].join("\n"),
    "utf8"
  );

  try {
    const result = spawnSync(
      process.execPath,
      ["node_modules/tsx/dist/cli.mjs", "scripts/check-customer-i18n.ts"],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          I18N_AUDIT_EXTRA_ROOT: fixture,
        },
      }
    );

    assert.equal(result.status, 1, result.stdout);
    assert.match(
      result.stderr,
      /unclassified customer-visible dynamic\/composed expression/u
    );
    assert.match(result.stderr, /UnreviewedCopy\.tsx/u);
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});
