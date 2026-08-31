import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  auditDynamicVisibleExpressions,
  reviewedDynamicVisibleExpressions,
  type DynamicVisibleExpression,
} from "../scripts/lib/i18n-dynamic-guard";
import { findUnclassifiedComponentFiles } from "../scripts/lib/i18n-component-inventory";
import {
  auditFrozenSource,
  normalizedSourceFingerprint,
} from "../scripts/lib/i18n-frozen-source";

const frozenFileServiceFingerprint =
  "0d6d6dc6aa22ed637aa92ce58911c4e3ce5a76740b76d8b207ca2f43b67c603f";

test("the component inventory rejects every new unclassified shared component", () => {
  assert.deepEqual(
    findUnclassifiedComponentFiles({
      files: [
        "src/components/dashboard/KnownCustomerCard.tsx",
        "src/components/admin/InternalCard.tsx",
        "src/components/LanguageSwitcher.tsx",
        "src/components/FutureCustomerCard.tsx",
      ],
      auditedRoots: [
        "src/components/dashboard",
        "src/components/LanguageSwitcher.tsx",
      ],
      intentionallyAuthoredRoots: ["src/components/admin"],
    }),
    ["src/components/FutureCustomerCard.tsx"]
  );
});

test("the legacy file-service surface is frozen until it joins the shared locale architecture", () => {
  const source = readFileSync("src/app/file-service/page.tsx", "utf8");
  const checker = readFileSync("scripts/check-customer-i18n.ts", "utf8");

  assert.equal(normalizedSourceFingerprint(source), frozenFileServiceFingerprint);
  assert.equal(
    auditFrozenSource(source, frozenFileServiceFingerprint).matches,
    true,
  );
  assert.equal(
    auditFrozenSource(`${source}\n{/* unlocalized change */}`, frozenFileServiceFingerprint)
      .matches,
    false,
  );
  assert.equal(
    normalizedSourceFingerprint(
      source.replace(/\r\n?/gu, "\n").replace(/\n/gu, "\r\n"),
    ),
    frozenFileServiceFingerprint,
  );
  assert.match(checker, /const frozenLegacyCustomerFiles = new Map/u);
  assert.match(checker, /src\/app\/file-service\/page\.tsx/u);
  assert.match(checker, new RegExp(frozenFileServiceFingerprint, "u"));
});

test("the checker has no generic component or app-segment localization bypass", () => {
  const checker = readFileSync("scripts/check-customer-i18n.ts", "utf8");
  const componentInventory = readFileSync(
    "scripts/lib/i18n-component-inventory.ts",
    "utf8",
  );
  const source = `${checker}\n${componentInventory}`;

  assert.doesNotMatch(source, /separatelyAuditedComponentFiles/u);
  assert.doesNotMatch(source, /separatelyAuditedAppSegments/u);
  assert.doesNotMatch(source, /separatelyAuditedFiles/u);
});

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
      "export function UnreviewedCopy({ count, isOpen }: { count: number; isOpen: boolean }) {",
      "  return isOpen && <p aria-label={`${count} HP`}>{count}</p>;",
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
