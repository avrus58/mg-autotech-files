import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { defineConfig, loadEnv, type ConfigEnv } from "vite";

export default defineConfig(({ mode }: ConfigEnv) => {
  const appEnv = loadEnv(mode, process.cwd(), "");
  const rootEnv = loadEnv(mode, resolve(process.cwd(), "../.."), "");

  const desktopEnv = {
    VITE_SUPABASE_URL: appEnv.VITE_SUPABASE_URL || rootEnv.VITE_SUPABASE_URL || rootEnv.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    VITE_SUPABASE_ANON_KEY: appEnv.VITE_SUPABASE_ANON_KEY || rootEnv.VITE_SUPABASE_ANON_KEY || rootEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
    VITE_API_BASE_URL: appEnv.VITE_API_BASE_URL || rootEnv.VITE_API_BASE_URL || process.env.VITE_API_BASE_URL || "https://file.mgautotech.de",
    VITE_APP_VERSION: appEnv.VITE_APP_VERSION || process.env.VITE_APP_VERSION || "0.2.1",
    VITE_APP_BUILD_CHANNEL: appEnv.VITE_APP_BUILD_CHANNEL || process.env.VITE_APP_BUILD_CHANNEL || "stable",
    VITE_AUTH_CAPTCHA_MODE: appEnv.VITE_AUTH_CAPTCHA_MODE || rootEnv.VITE_AUTH_CAPTCHA_MODE || rootEnv.NEXT_PUBLIC_AUTH_CAPTCHA_MODE || process.env.VITE_AUTH_CAPTCHA_MODE || process.env.NEXT_PUBLIC_AUTH_CAPTCHA_MODE || "off",
    VITE_AUTH_CAPTCHA_CHALLENGE_URL: appEnv.VITE_AUTH_CAPTCHA_CHALLENGE_URL || rootEnv.VITE_AUTH_CAPTCHA_CHALLENGE_URL || process.env.VITE_AUTH_CAPTCHA_CHALLENGE_URL || "https://file.mgautotech.de/desktop-auth/turnstile",
  };

  return {
    plugins: [react()],
    base: "./",
    define: Object.fromEntries(
      Object.entries(desktopEnv).map(([key, value]) => [`import.meta.env.${key}`, JSON.stringify(value)]),
    ),
    server: {
      port: 5174,
      strictPort: true,
    },
    build: {
      outDir: "dist",
      emptyOutDir: true,
    },
  };
});
