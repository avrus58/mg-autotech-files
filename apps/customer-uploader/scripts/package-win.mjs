import { spawnSync } from "node:child_process";

if (process.env.WINDOWS_CERTIFICATE_FILE && !process.env.CSC_LINK) {
  process.env.CSC_LINK = process.env.WINDOWS_CERTIFICATE_FILE;
}

if (process.env.WINDOWS_CERTIFICATE_PASSWORD && !process.env.CSC_KEY_PASSWORD) {
  process.env.CSC_KEY_PASSWORD = process.env.WINDOWS_CERTIFICATE_PASSWORD;
}

const result = spawnSync("npx", ["electron-builder", "--win", "--x64"], {
  stdio: "inherit",
  shell: process.platform === "win32",
});

process.exit(result.status ?? 1);
