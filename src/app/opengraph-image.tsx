import { ImageResponse } from "next/og";
import { publicBrandImageAlt } from "@/lib/structuredDataI18n";

export const alt = publicBrandImageAlt;
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background:
            "radial-gradient(circle at 82% 10%, rgba(177,18,27,0.42), transparent 32%), linear-gradient(135deg, #050505 0%, #08090d 50%, #170609 100%)",
          color: "white",
          fontFamily: "Arial, sans-serif",
          padding: 56,
        }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            border: "2px solid rgba(255,255,255,0.12)",
            borderRadius: 44,
            background: "rgba(5,5,5,0.72)",
            padding: 54,
            boxShadow: "0 30px 80px rgba(0,0,0,0.45)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <div
              style={{
                width: 74,
                height: 74,
                borderRadius: 22,
                border: "2px solid rgba(239,68,68,0.65)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#ff2a38",
                fontSize: 42,
                fontWeight: 900,
              }}
            >
              M
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div
                style={{
                  color: "#ff2a38",
                  fontSize: 28,
                  fontWeight: 900,
                  letterSpacing: 8,
                  textTransform: "uppercase",
                }}
              >
                MG AutoTech
              </div>
              <div style={{ color: "#a1a1aa", fontSize: 22, marginTop: 8 }}>
                ECU · TCU
              </div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                fontSize: 78,
                lineHeight: 0.95,
                fontWeight: 900,
                maxWidth: 900,
                letterSpacing: -1,
              }}
            >
              ECU · TCU
            </div>
            <div
              style={{
                marginTop: 28,
                color: "#d4d4d8",
                fontSize: 30,
                lineHeight: 1.35,
                maxWidth: 880,
              }}
            >
              STAGE 1 · DPF · EGR · ADBLUE · DTC
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            {["OBD", "BENCH", "BOOT"].map((item) => (
              <div
                key={item}
                style={{
                  border: "1px solid rgba(255,255,255,0.14)",
                  borderRadius: 18,
                  padding: "16px 22px",
                  background: "rgba(255,255,255,0.06)",
                  fontSize: 22,
                  fontWeight: 800,
                }}
              >
                {item}
              </div>
            ))}
            <div
              style={{
                marginLeft: "auto",
                color: "#a1a1aa",
                fontSize: 22,
                fontWeight: 800,
              }}
            >
              file.mgautotech.de
            </div>
          </div>
        </div>
      </div>
    ),
    size
  );
}
