/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs");

const envPath = ".env.local";
const schemaOnlyFlag = "--schema-only";

const groups = [
  {
    name: "Stripe",
    keys: [
      "STRIPE_SECRET_KEY",
      "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
      "STRIPE_WEBHOOK_SECRET",
    ],
  },
  {
    name: "Bank Transfer",
    keys: [
      "NEXT_PUBLIC_BANK_ACCOUNT_NAME",
      "NEXT_PUBLIC_BANK_NAME",
      "NEXT_PUBLIC_BANK_IBAN",
      "NEXT_PUBLIC_BANK_BIC",
    ],
  },
  {
    name: "Site",
    keys: ["NEXT_PUBLIC_SITE_URL"],
  },
];

function parseEnvSource(source) {
  return Object.fromEntries(
    source
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((line) => !line.startsWith("#"))
      .map((line) => {
        const index = line.indexOf("=");
        return [line.slice(0, index), line.slice(index + 1)];
      })
  );
}

function printSchemaOnlyReport(log = console.log) {
  log("Payment environment schema-only contract");

  for (const group of groups) {
    log(`\n${group.name}`);

    for (const key of group.keys) {
      log(`REQ  ${key}`);
    }
  }

  log("\nSchema-only check passed. No environment files were read.");
}

function printEnvReport(env, log = console.log) {
  let missing = 0;

  for (const group of groups) {
    log(`\n${group.name}`);

    for (const key of group.keys) {
      const value = env[key]?.replace(/^"|"$/g, "");
      const ok = Boolean(value);

      if (!ok) missing += 1;

      log(`${ok ? "OK  " : "MISS"} ${key}`);
    }
  }

  if (missing > 0) {
    log(`\n${missing} payment environment value(s) missing.`);
    return missing;
  }

  log("\nPayment environment looks ready.");
  return 0;
}

function main({
  argv = process.argv.slice(2),
  envFilePath = envPath,
  fsModule = fs,
  log = console.log,
  error = console.error,
} = {}) {
  if (argv.includes(schemaOnlyFlag)) {
    printSchemaOnlyReport(log);
    return 0;
  }

  if (!fsModule.existsSync(envFilePath)) {
    error(`${envFilePath} was not found.`);
    return 1;
  }

  const env = parseEnvSource(fsModule.readFileSync(envFilePath, "utf8"));
  return printEnvReport(env, log) > 0 ? 1 : 0;
}

if (require.main === module) {
  const exitCode = main();

  if (exitCode > 0) {
    process.exit(exitCode);
  }
}

module.exports = {
  REQUIRED_ENV_GROUPS: groups,
  main,
  parseEnvSource,
  printEnvReport,
  printSchemaOnlyReport,
};
