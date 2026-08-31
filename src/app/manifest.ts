import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MG AutoTech",
    short_name: "MG AutoTech",
    description: "ECU · TCU · Stage 1 · DPF · EGR · AdBlue · DTC",
    start_url: "/",
    display: "standalone",
    background_color: "#050505",
    theme_color: "#b1121b",
    icons: [
      {
        src: "/mg-autotech-logo.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
