export type DynamicVisibleExpression = {
  file: string;
  kind: "concatenation" | "template";
  line: number;
  source: string;
};

export type ReviewedDynamicVisibleExpression = Omit<
  DynamicVisibleExpression,
  "line"
> & {
  classification:
    | "localized-copy"
    | "numeric-unit"
    | "raw-technical-data"
    | "raw-vehicle-data-with-translated-fallback";
};

// Dynamic customer-visible compositions are intentionally fail-closed. Each
// signature below was reviewed as either translated copy or data that must stay
// literal. A new composition has to be classified here before the i18n gate can
// pass; line numbers are deliberately excluded so formatting alone is harmless.
export const reviewedDynamicVisibleExpressions = [
  {
    file: "src/app/dashboard/orders/page.tsx",
    kind: "template",
    source:
      '`${order.vehicle_brand || customerWorkflowT(locale, "thisVehicle", {})} ${order.vehicle_model || ""}`',
    classification: "raw-vehicle-data-with-translated-fallback",
  },
  {
    file: "src/components/dashboard/DashboardClient.tsx",
    kind: "template",
    source:
      '`${order.vehicle_brand || customerWorkflowT(locale, "fallbackVehicle")} ${order.vehicle_model || customerWorkflowT(locale, "fallbackRequest")}`',
    classification: "raw-vehicle-data-with-translated-fallback",
  },
  {
    file: "src/components/tools/PublicLogSnapshot.tsx",
    kind: "template",
    source: "`${value} ${unit}`",
    classification: "numeric-unit",
  },
  {
    file: "src/components/widget/PublicVehicleSelector.tsx",
    kind: "template",
    source: "`+${gain}`",
    classification: "numeric-unit",
  },
  {
    file: "src/components/widget/PublicVehicleSelector.tsx",
    kind: "template",
    source: "` · ${item.fuelType}`",
    classification: "raw-technical-data",
  },
  {
    file: "src/components/analytics/PublicAnalytics.tsx",
    kind: "template",
    source:
      "`${consentCopy.privacyInformation} (${consentCopy.opensInNewTab})`",
    classification: "localized-copy",
  },
  {
    file: "src/components/OnlineStatus.tsx",
    kind: "template",
    source: "`${status.timePrefix} ${status.time}.`",
    classification: "localized-copy",
  },
  {
    file: "src/app/dashboard/file-expert/[id]/page.tsx",
    kind: "template",
    source: "`${result.comparison.changed_percent}%`",
    classification: "numeric-unit",
  },
  {
    file: "src/components/dashboard/LogAnalysisStudio.tsx",
    kind: "template",
    source:
      "`${formatValue(peakPower.kw, 1, locale)} kW · ${formatValue(peakPower.rpm, 0, locale)} rpm`",
    classification: "numeric-unit",
  },
  {
    file: "src/components/dashboard/LogAnalysisStudio.tsx",
    kind: "template",
    source:
      "`${peakContext(analysis, torqueSummary, performanceSource?.rpmChannelId, locale)} · ${performanceSource?.torqueLabel}`",
    classification: "raw-technical-data",
  },
  {
    file: "src/components/dashboard/LogAnalysisStudio.tsx",
    kind: "template",
    source:
      "`${formatValue(rpmSummary.min.value, 0, locale)}–${formatValue(rpmSummary.max.value, 0, locale)}`",
    classification: "numeric-unit",
  },
  {
    file: "src/components/widget/SubscriptionSummaryPanel.tsx",
    kind: "template",
    source:
      "`${dayLabel(summary?.days_until_next_payment ?? null, locale)} · ${formatCurrency(summary?.next_payment_amount_cents ?? null, summary?.currency ?? null, locale)}`",
    classification: "localized-copy",
  },
] as const satisfies readonly ReviewedDynamicVisibleExpression[];

function normalizeSource(source: string) {
  return source.replace(/\s+/gu, " ").trim();
}

function fingerprint(
  expression: Pick<DynamicVisibleExpression, "file" | "kind" | "source">
) {
  return [
    expression.file.replaceAll("\\", "/"),
    expression.kind,
    normalizeSource(expression.source),
  ].join("\u0000");
}

export function auditDynamicVisibleExpressions(
  expressions: readonly DynamicVisibleExpression[]
) {
  const reviewedByFingerprint = new Map(
    reviewedDynamicVisibleExpressions.map((expression) => [
      fingerprint(expression),
      expression,
    ])
  );
  const detectedFingerprints = new Set(
    expressions.map((expression) => fingerprint(expression))
  );

  return {
    unclassified: expressions.filter(
      (expression) => !reviewedByFingerprint.has(fingerprint(expression))
    ),
    staleReviewed: reviewedDynamicVisibleExpressions.filter(
      (expression) => !detectedFingerprints.has(fingerprint(expression))
    ),
    classificationFor(expression: DynamicVisibleExpression) {
      return reviewedByFingerprint.get(fingerprint(expression))?.classification;
    },
  };
}
