import {
  analyzeLogStudio,
  type LogStudioAnalysis,
} from "@/lib/logAnalysisStudio";

type LogAnalysisWorkerResponse =
  | { ok: true; analysis: LogStudioAnalysis }
  | { ok: false; error: string };

const logAnalysisTimeoutMs = 15_000;

export function analyzeLogStudioInBrowser(text: string, signal?: AbortSignal) {
  if (signal?.aborted) {
    return Promise.reject(new DOMException("Datalog analysis was cancelled.", "AbortError"));
  }
  if (typeof Worker === "undefined") {
    return Promise.resolve(analyzeLogStudio(text));
  }

  return new Promise<LogStudioAnalysis>((resolve, reject) => {
    const worker = new Worker(
      new URL("../workers/logAnalysis.worker.ts", import.meta.url),
      { type: "module", name: "mg-datalog-analysis" }
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
    const abort = () => settle(() => reject(new DOMException("Datalog analysis was cancelled.", "AbortError")));
    const timeoutId = setTimeout(
      () => settle(() => reject(new Error("The local datalog analysis timed out."))),
      logAnalysisTimeoutMs
    );

    worker.onmessage = (event: MessageEvent<LogAnalysisWorkerResponse>) => {
      if (event.data.ok) {
        const { analysis } = event.data;
        settle(() => resolve(analysis));
      } else {
        const { error } = event.data;
        settle(() => reject(new Error(error)));
      }
    };
    worker.onerror = () => {
      settle(() => reject(new Error("The local datalog worker stopped unexpectedly.")));
    };
    signal?.addEventListener("abort", abort, { once: true });
    worker.postMessage({ text });
  });
}
