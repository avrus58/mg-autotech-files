"use client";

import { useEffect } from "react";
import { reportPlatformFailure } from "@/components/PlatformReliabilityMonitor";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    reportPlatformFailure("fatal_render", error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#050505", color: "white", fontFamily: "Arial, sans-serif" }}>
        <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
          <section style={{ width: "100%", maxWidth: 520, borderTop: "1px solid #27272a", borderBottom: "1px solid #27272a", padding: "40px 0", textAlign: "center" }}>
            <p style={{ color: "#f87171", fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: 2 }}>MG AutoTech recovery</p>
            <h1 style={{ fontSize: 28, margin: "12px 0" }}>The application needs to reload this view</h1>
            <p style={{ color: "#a1a1aa", lineHeight: 1.6 }}>No customer file or request was changed. Please retry.</p>
            <button type="button" onClick={reset} style={{ marginTop: 20, border: 0, borderRadius: 8, background: "#b1121b", color: "white", padding: "14px 20px", fontWeight: 800, cursor: "pointer" }}>
              Retry application
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
