import { analyzeLogStudio } from "@/lib/logAnalysisStudio";

type LogAnalysisWorkerRequest = {
  text: string;
};

self.onmessage = (event: MessageEvent<LogAnalysisWorkerRequest>) => {
  try {
    self.postMessage({ ok: true, analysis: analyzeLogStudio(event.data.text) });
  } catch {
    self.postMessage({ ok: false, error: "The local datalog analysis could not be completed." });
  }
};

export {};
