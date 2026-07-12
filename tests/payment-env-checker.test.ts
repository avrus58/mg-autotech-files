import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import test from "node:test";

type PaymentEnvChecker = {
  REQUIRED_ENV_GROUPS: Array<{ name: string; keys: string[] }>;
  main(options?: {
    argv?: string[];
    envFilePath?: string;
    fsModule?: {
      existsSync(): boolean;
      readFileSync(): string;
    };
    log?(message?: string): void;
    error?(message?: string): void;
  }): number;
};

const require = createRequire(import.meta.url);
const checker = require("../scripts/check-payment-env.js") as PaymentEnvChecker;

test("payment env checker schema-only reports the contract without reading env files", () => {
  const fsCalls: string[] = [];
  const lines: string[] = [];
  const failingFs = {
    existsSync() {
      fsCalls.push("existsSync");
      throw new Error("schema-only must not check env file existence");
    },
    readFileSync() {
      fsCalls.push("readFileSync");
      throw new Error("schema-only must not read env files");
    },
  };

  const exitCode = checker.main({
    argv: ["--schema-only"],
    envFilePath: ".env.local",
    fsModule: failingFs,
    log: (message = "") => lines.push(message),
  });

  const output = lines.join("\n");
  assert.equal(exitCode, 0);
  assert.deepEqual(fsCalls, []);
  assert.match(output, /Payment environment schema-only contract/);
  assert.match(output, /REQ\s+STRIPE_SECRET_KEY/);
  assert.match(output, /REQ\s+NEXT_PUBLIC_BANK_IBAN/);
  assert.match(output, /No environment files were read/);
});

test("payment env checker default mode keeps OK/MISS reporting without printing values", () => {
  const sentinelSecret = "sk_test_do_not_print";
  const lines: string[] = [];
  const envSource = [
    `STRIPE_SECRET_KEY=${sentinelSecret}`,
    "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_do_not_print",
    "STRIPE_WEBHOOK_SECRET=whsec_do_not_print",
    "NEXT_PUBLIC_BANK_ACCOUNT_NAME=MG AutoTech",
    "NEXT_PUBLIC_BANK_NAME=Example Bank",
    "NEXT_PUBLIC_BANK_IBAN=DE00TEST0000000000",
    "NEXT_PUBLIC_BANK_BIC=TESTDE00",
    "NEXT_PUBLIC_SITE_URL=https://file.mgautotech.de",
  ].join("\n");

  const exitCode = checker.main({
    argv: [],
    fsModule: {
      existsSync: () => true,
      readFileSync: () => envSource,
    },
    log: (message = "") => lines.push(message),
  });

  const output = lines.join("\n");
  assert.equal(exitCode, 0);
  assert.match(output, /OK\s+STRIPE_SECRET_KEY/);
  assert.match(output, /OK\s+NEXT_PUBLIC_SITE_URL/);
  assert.match(output, /Payment environment looks ready/);
  assert.doesNotMatch(output, /sk_test_do_not_print|pk_test_do_not_print|whsec_do_not_print|DE00TEST0000000000/);
});

test("payment env checker schema-only CLI succeeds without requiring .env.local", () => {
  const output = execFileSync(process.execPath, ["scripts/check-payment-env.js", "--schema-only"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.match(output, /Payment environment schema-only contract/);
  assert.match(output, /REQ\s+NEXT_PUBLIC_SITE_URL/);
});
