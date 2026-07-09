import type { VehicleControlRecord, VehicleValidationIssue } from "@/lib/vehicleControl/types";

export const vehiclePerformanceLimits = {
  maxStockHp: 2500,
  maxTunedHp: 2500,
  maxStockNm: 6000,
  maxTunedNm: 7000,
  maxTunedHpMultiplier: 2.4,
  maxTunedNmMultiplier: 2.6,
  lowTunedHpMultiplier: 0.75,
  lowTunedNmMultiplier: 0.75,
} as const;

function add(
  issues: VehicleValidationIssue[],
  issue: VehicleValidationIssue
) {
  issues.push({ entityType: "vehicle_engine", ...issue });
}

function text(value: string | null | undefined) {
  return (value ?? "").trim();
}

export function validateVehicleRecord(record: VehicleControlRecord): VehicleValidationIssue[] {
  const issues: VehicleValidationIssue[] = [];
  const vehicleKey = record.vehicleKey;

  if (!text(record.brand)) add(issues, { severity: "error", code: "missing_brand", message: "Brand is required.", vehicleKey, metadata: { suggestedFix: "Set a brand before publishing or importing this row." } });
  if (!text(record.model)) add(issues, { severity: "error", code: "missing_model", message: "Model is required.", vehicleKey, metadata: { suggestedFix: "Set a model name for this vehicle record." } });
  if (!text(record.generation)) add(issues, { severity: "error", code: "missing_generation", message: "Generation is required.", vehicleKey, metadata: { suggestedFix: "Set a generation/facelift label." } });
  if (!text(record.engine)) add(issues, { severity: "error", code: "missing_engine", message: "Engine is required.", vehicleKey, metadata: { suggestedFix: "Set an engine label before publishing." } });
  if (!vehicleKey) add(issues, { severity: "error", code: "missing_vehicle_key", message: "Stable vehicle key could not be generated.", vehicleKey });

  for (const [field, value, max] of [
    ["stock_hp", record.stockHp, vehiclePerformanceLimits.maxStockHp],
    ["stock_nm", record.stockNm, vehiclePerformanceLimits.maxStockNm],
    ["tuned_hp", record.tunedHp, vehiclePerformanceLimits.maxTunedHp],
    ["tuned_nm", record.tunedNm, vehiclePerformanceLimits.maxTunedNm],
  ] as const) {
    if (value != null && (!Number.isFinite(value) || value <= 0 || value > max)) {
      add(issues, {
        severity: "error",
        code: "invalid_power_value",
        message: `${field} has an invalid value.`,
        vehicleKey,
        metadata: { field, value, max, suggestedFix: "Use realistic positive horsepower/torque values or leave the field empty until verified." },
      });
    }
  }

  if (record.stockHp != null && record.tunedHp != null && record.tunedHp > record.stockHp * vehiclePerformanceLimits.maxTunedHpMultiplier) {
    add(issues, {
      severity: "error",
      code: "unrealistic_tuned_hp_gain",
      message: "Tuned horsepower is unrealistically high compared with stock horsepower.",
      vehicleKey,
      metadata: {
        stockHp: record.stockHp,
        tunedHp: record.tunedHp,
        maxMultiplier: vehiclePerformanceLimits.maxTunedHpMultiplier,
        suggestedFix: "Verify the tuned horsepower or keep this row out of real import.",
      },
    });
  }
  if (record.stockNm != null && record.tunedNm != null && record.tunedNm > record.stockNm * vehiclePerformanceLimits.maxTunedNmMultiplier) {
    add(issues, {
      severity: "error",
      code: "unrealistic_tuned_nm_gain",
      message: "Tuned torque is unrealistically high compared with stock torque.",
      vehicleKey,
      metadata: {
        stockNm: record.stockNm,
        tunedNm: record.tunedNm,
        maxMultiplier: vehiclePerformanceLimits.maxTunedNmMultiplier,
        suggestedFix: "Verify the tuned torque or keep this row out of real import.",
      },
    });
  }
  if (record.stockHp != null && record.tunedHp != null && record.tunedHp < record.stockHp * vehiclePerformanceLimits.lowTunedHpMultiplier) {
    add(issues, {
      severity: "warning",
      code: "tuned_hp_below_stock",
      message: "Tuned horsepower is much lower than stock horsepower.",
      vehicleKey,
      metadata: { stockHp: record.stockHp, tunedHp: record.tunedHp, suggestedFix: "Verify whether the tuned horsepower value is incomplete or belongs to another stage." },
    });
  }
  if (record.stockNm != null && record.tunedNm != null && record.tunedNm < record.stockNm * vehiclePerformanceLimits.lowTunedNmMultiplier) {
    add(issues, {
      severity: "warning",
      code: "tuned_nm_below_stock",
      message: "Tuned torque is much lower than stock torque.",
      vehicleKey,
      metadata: { stockNm: record.stockNm, tunedNm: record.tunedNm, suggestedFix: "Verify whether the tuned torque value is incomplete or belongs to another stage." },
    });
  }

  if (record.yearFrom != null && (record.yearFrom < 1950 || record.yearFrom > 2050)) {
    add(issues, { severity: "warning", code: "suspicious_year_from", message: "Generation start year looks suspicious.", vehicleKey, metadata: { suggestedFix: "Verify the generation start year." } });
  }
  if (record.yearTo != null && (record.yearTo < 1950 || record.yearTo > 2050)) {
    add(issues, { severity: "warning", code: "suspicious_year_to", message: "Generation end year looks suspicious.", vehicleKey, metadata: { suggestedFix: "Verify the generation end year." } });
  }
  if (record.yearFrom != null && record.yearTo != null && record.yearFrom > record.yearTo) {
    add(issues, { severity: "error", code: "invalid_year_range", message: "Generation start year is after end year.", vehicleKey, metadata: { suggestedFix: "Swap or correct the year range." } });
  }

  if (!record.ecuType) {
    add(issues, { severity: "warning", code: "missing_ecu_info", message: "ECU type is missing.", vehicleKey, metadata: { suggestedFix: "Add ECU type/family before marking this record verified." } });
  }
  if (!record.stockHp && !record.stockNm) {
    add(issues, { severity: "warning", code: "missing_stock_performance", message: "Stock power or torque is missing.", vehicleKey, metadata: { suggestedFix: "Add stock HP/NM if known, or keep as draft until verified." } });
  }
  if (record.services.includes("stage1") && !record.tunedHp && !record.tunedNm) {
    add(issues, { severity: "warning", code: "missing_tuned_performance", message: "Stage 1 is available but tuned power or torque is missing.", vehicleKey, metadata: { suggestedFix: "Add Stage 1 HP/NM or remove Stage 1 availability until known." } });
  }
  if (record.published && issues.some((issue) => issue.severity === "error")) {
    add(issues, { severity: "error", code: "published_incomplete", message: "Published vehicle has blocking validation errors.", vehicleKey, metadata: { suggestedFix: "Resolve error-level issues or unpublish this record." } });
  }
  if (record.confidenceScore < 40 && record.published) {
    add(issues, { severity: "warning", code: "published_low_confidence", message: "Published vehicle has low confidence score.", vehicleKey, metadata: { suggestedFix: "Verify the row or keep it unpublished until confidence improves." } });
  }
  return issues;
}

export function validateVehicleCollection(records: VehicleControlRecord[]) {
  const issues = records.flatMap(validateVehicleRecord);
  const byKey = new Map<string, number>();
  for (const record of records) {
    byKey.set(record.vehicleKey, (byKey.get(record.vehicleKey) ?? 0) + 1);
  }
  for (const [vehicleKey, count] of byKey.entries()) {
    if (count > 1) {
      issues.push({
        severity: "error",
        code: "duplicate_vehicle_key",
        message: `Vehicle key appears ${count} times.`,
        vehicleKey,
        entityType: "vehicle_engine",
        metadata: { count },
      });
    }
  }

  const generations = new Map<string, Array<{ from: number | null; to: number | null; key: string }>>();
  for (const record of records) {
    const groupKey = `${record.brand}|${record.model}`;
    generations.set(groupKey, [...(generations.get(groupKey) ?? []), {
      from: record.yearFrom,
      to: record.yearTo,
      key: record.vehicleKey,
    }]);
  }
  for (const entries of generations.values()) {
    for (let left = 0; left < entries.length; left += 1) {
      for (let right = left + 1; right < entries.length; right += 1) {
        const a = entries[left];
        const b = entries[right];
        if (a.from == null || b.from == null || a.to == null || b.to == null) continue;
        if (a.from <= b.to && b.from <= a.to) {
          issues.push({
            severity: "info",
            code: "overlapping_generation_range",
            message: "Generation year ranges overlap for the same brand/model. Human review may be useful.",
            vehicleKey: a.key,
            entityType: "vehicle_generation",
            metadata: { otherVehicleKey: b.key },
          });
        }
      }
    }
  }
  return issues;
}

export function dataHealthScore(records: VehicleControlRecord[], issues: VehicleValidationIssue[]) {
  if (records.length === 0) return 0;
  const errors = issues.filter((issue) => issue.severity === "error").length;
  const warnings = issues.filter((issue) => issue.severity === "warning").length;
  const verified = records.filter((record) => record.verificationStatus === "verified").length;
  const published = records.filter((record) => record.published && record.active).length;
  const base = 70 + Math.min(15, (verified / records.length) * 30) + Math.min(10, (published / records.length) * 10);
  return Math.max(0, Math.min(100, Math.round(base - errors * 2 - warnings * 0.5)));
}
