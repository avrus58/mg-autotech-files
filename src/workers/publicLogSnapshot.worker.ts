import { analyzeLogStudio } from "@/lib/logAnalysisStudio";
import { performanceFromStudioAnalysis } from "@/lib/performanceReport";

self.onmessage = (event: MessageEvent<{ text: string }>) => {
  try {
    const analysis = analyzeLogStudio(event.data.text, { profile: "performance" });
    const performance = performanceFromStudioAnalysis(analysis);
    self.postMessage({
      ok: true,
      snapshot: {
        compatible: Boolean(performance),
        peakTorqueNm: performance?.source.loggedPeakTorqueNm ?? null,
        peakPowerHp: performance?.analysis.peakPower?.hp ?? null,
        truncated: analysis.truncated.rows || analysis.truncated.characters,
      },
    });
  } catch {
    self.postMessage({ ok: false, error: "The local datalog snapshot could not be completed." });
  }
};

export {};
