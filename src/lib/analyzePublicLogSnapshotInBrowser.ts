import { analyzeLogStudio } from "@/lib/logAnalysisStudio";
import { performanceFromStudioAnalysis } from "@/lib/performanceReport";

export type PublicLogSnapshotAnalysis = {
  compatible: boolean;
  peakTorqueNm: number | null;
  peakPowerHp: number | null;
  truncated: boolean;
};

type PublicLogSnapshotWorkerResponse =
  | { ok: true; snapshot: PublicLogSnapshotAnalysis }
  | { ok: false; error: string };

const publicSnapshotTimeoutMs = 15_000;

export function analyzePublicLogSnapshotInBrowser(text: string, signal?: AbortSignal) {
  if (signal?.aborted) {
    return Promise.reject(new DOMException("Datalog snapshot was cancelled.", "AbortError"));
  }
  if (typeof Worker === "undefined") {
    const analysis = analyzeLogStudio(text, { profile: "performance" });
    const performance = performanceFromStudioAnalysis(analysis);
    return Promise.resolve<PublicLogSnapshotAnalysis>({
      compatible: Boolean(performance),
      peakTorqueNm: performance?.source.loggedPeakTorqueNm ?? null,
      peakPowerHp: performance?.analysis.peakPower?.hp ?? null,
      truncated: analysis.truncated.rows || analysis.truncated.characters,
    });
  }

  return new Promise<PublicLogSnapshotAnalysis>((resolve, reject) => {
    const worker = new Worker(
      new URL("../workers/publicLogSnapshot.worker.ts", import.meta.url),
      { type: "module", name: "mg-public-datalog-snapshot" }
    );
    let settled = false;
    const finish = () => {
      worker.terminate();
      clearTimeout(timeoutId);
      signal?.removeEventListener("abort", abort);
    };
    const settle = (callback: () => void) => {
      if (settled) return;
      settled = true;
      finish();
      callback();
    };
    const abort = () => settle(() => reject(new DOMException("Datalog snapshot was cancelled.", "AbortError")));
    const timeoutId = setTimeout(
      () => settle(() => reject(new Error("The local datalog snapshot timed out."))),
      publicSnapshotTimeoutMs
    );

    worker.onmessage = (event: MessageEvent<PublicLogSnapshotWorkerResponse>) => {
      if (event.data.ok) {
        const { snapshot } = event.data;
        settle(() => resolve(snapshot));
      } else {
        const { error } = event.data;
        settle(() => reject(new Error(error)));
      }
    };
    worker.onerror = () => {
      settle(() => reject(new Error("The local datalog snapshot worker stopped unexpectedly.")));
    };
    signal?.addEventListener("abort", abort, { once: true });
    worker.postMessage({ text });
  });
}
