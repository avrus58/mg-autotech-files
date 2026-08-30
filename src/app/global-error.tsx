"use client";

import { useEffect } from "react";
import { reportPlatformFailure } from "@/components/PlatformReliabilityMonitor";
import { recoveryTranslations, useRecoveryLocale } from "@/lib/i18n/recovery-translations";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const locale = useRecoveryLocale();
  const copy = locale ? recoveryTranslations[locale] : null;
  useEffect(() => {
    reportPlatformFailure("fatal_render", error);
  }, [error]);

  if (!locale || !copy) {
    return (
      <html lang="und">
        <body style={{ margin: 0, background: "#050505", color: "white", fontFamily: "Arial, sans-serif" }}>
          <main aria-busy="true" style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
            <span style={{ fontSize: 14, fontWeight: 800, letterSpacing: 2 }}>MG AUTOTECH</span>
          </main>
        </body>
      </html>
    );
  }

  return (
    <html lang={locale}>
      <body style={{ margin: 0, background: "#050505", color: "white", fontFamily: "Arial, sans-serif" }}>
        <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
          <section style={{ width: "100%", maxWidth: 520, borderTop: "1px solid #27272a", borderBottom: "1px solid #27272a", padding: "40px 0", textAlign: "center" }}>
            <p style={{ color: "#f87171", fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: 2 }}>{copy.eyebrow}</p>
            <h1 style={{ fontSize: 28, margin: "12px 0" }}>{copy.title}</h1>
            <p style={{ color: "#a1a1aa", lineHeight: 1.6 }}>{copy.description}</p>
            <button type="button" onClick={reset} style={{ marginTop: 20, border: 0, borderRadius: 8, background: "#b1121b", color: "white", padding: "14px 20px", fontWeight: 800, cursor: "pointer" }}>
              {copy.retry}
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
