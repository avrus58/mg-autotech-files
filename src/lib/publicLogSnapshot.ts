import { analyzeLogStudio } from "@/lib/logAnalysisStudio";
import { performanceFromStudioAnalysis } from "@/lib/performanceReport";

export const publicLogSnapshotMinimumPairedRows = 5;
export const publicLogSnapshotMinimumRpmSpan = 1_000;
export const publicLogSnapshotMinimumRpm = 400;
export const publicLogSnapshotMaximumRpm = 12_000;
export const publicLogSnapshotMinimumTorqueNm = 1;
export const publicLogSnapshotMaximumTorqueNm = 5_000;
export const publicLogSnapshotMinimumEstimatedPowerHp = 1;
export const publicLogSnapshotMaximumEstimatedPowerHp = 5_000;

type PublicLogSnapshotBase = {
  truncated: boolean;
};

export type PublicLogSnapshotReady = PublicLogSnapshotBase & {
  status: "ready";
  peakTorqueNm: number;
  peakPowerHp: number;
};

export type PublicLogSnapshotUnavailable = PublicLogSnapshotBase & {
  status: "incompatible" | "insufficient_data" | "unsupported_range";
  peakTorqueNm: null;
  peakPowerHp: null;
};

export type PublicLogSnapshotAnalysis =
  | PublicLogSnapshotReady
  | PublicLogSnapshotUnavailable;

function unavailableSnapshot(
  status: PublicLogSnapshotUnavailable["status"],
  truncated: boolean
): PublicLogSnapshotUnavailable {
  return {
    status,
    peakTorqueNm: null,
    peakPowerHp: null,
    truncated,
  };
}

function within(value: number, minimum: number, maximum: number) {
  return Number.isFinite(value) && value >= minimum && value <= maximum;
}

export function analyzePublicLogSnapshot(text: string): PublicLogSnapshotAnalysis {
  const analysis = analyzeLogStudio(text, { profile: "performance" });
  const performance = performanceFromStudioAnalysis(analysis);
  const truncated = analysis.truncated.rows || analysis.truncated.characters;

  if (
    !performance ||
    performance.source.loggedPeakTorqueNm === null ||
    performance.analysis.peakPower === null
  ) {
    return unavailableSnapshot("incompatible", truncated);
  }

  const { points } = performance.parsed;
  const peakTorqueNm = performance.source.loggedPeakTorqueNm;
  const peakPowerHp = performance.analysis.peakPower.hp;
  const outsideSupportedRange =
    points.some((point) =>
      !within(point.rpm, publicLogSnapshotMinimumRpm, publicLogSnapshotMaximumRpm) ||
      !within(
        point.torque,
        publicLogSnapshotMinimumTorqueNm,
        publicLogSnapshotMaximumTorqueNm
      )
    ) ||
    !within(
      peakTorqueNm,
      publicLogSnapshotMinimumTorqueNm,
      publicLogSnapshotMaximumTorqueNm
    ) ||
    !within(
      peakPowerHp,
      publicLogSnapshotMinimumEstimatedPowerHp,
      publicLogSnapshotMaximumEstimatedPowerHp
    );

  if (outsideSupportedRange) {
    return unavailableSnapshot("unsupported_range", truncated);
  }

  if (
    points.length < publicLogSnapshotMinimumPairedRows ||
    performance.analysis.rpmSpan < publicLogSnapshotMinimumRpmSpan ||
    analysis.quality.label === "limited" ||
    performance.analysis.quality === "limited"
  ) {
    return unavailableSnapshot("insufficient_data", truncated);
  }

  return {
    status: "ready",
    peakTorqueNm,
    peakPowerHp,
    truncated,
  };
}
