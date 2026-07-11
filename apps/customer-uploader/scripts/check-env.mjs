import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(appRoot, "../..");

function parseEnvFile(path) {
  if (!existsSync(path)) return {};
  const output = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    let value = match[2] ?? "";
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    output[match[1]] = value;
  }
  return output;
}

const env = {
  ...parseEnvFile(resolve(repoRoot, ".env")),
  ...parseEnvFile(resolve(repoRoot, ".env.local")),
  ...parseEnvFile(resolve(appRoot, ".env")),
  ...parseEnvFile(resolve(appRoot, ".env.local")),
  ...process.env,
};

const resolved = {
  VITE_SUPABASE_URL: env.VITE_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || "",
  VITE_SUPABASE_ANON_KEY: env.VITE_SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
  VITE_API_BASE_URL: env.VITE_API_BASE_URL || "https://file.mgautotech.de",
};

const missing = Object.entries(resolved).filter(([, value]) => !String(value || "").trim()).map(([key]) => key);

if (missing.length > 0) {
  console.error("Missing desktop app environment variables. Create apps/customer-uploader/.env.local based on .env.example.");
  console.error(`Missing: ${missing.join(", ")}`);
  console.error("Use only the public Supabase anon key. Never put the service-role key into the desktop app.");
  process.exit(1);
}

console.log("Desktop app environment looks ready.");
