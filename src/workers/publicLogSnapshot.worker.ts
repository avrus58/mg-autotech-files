import { analyzePublicLogSnapshot } from "@/lib/publicLogSnapshot";

self.onmessage = (event: MessageEvent<{ text: string }>) => {
  try {
    self.postMessage({
      ok: true,
      snapshot: analyzePublicLogSnapshot(event.data.text),
    });
  } catch {
    self.postMessage({ ok: false, error: "The local datalog snapshot could not be completed." });
  }
};

export {};
