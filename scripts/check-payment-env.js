/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs");

const envPath = ".env.local";

if (!fs.existsSync(envPath)) {
  console.error(".env.local was not found.");
  process.exit(1);
}

const env = Object.fromEntries(
  fs
    .readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith("#"))
    .map((line) => {
      const index = line.indexOf("=");
      return [line.slice(0, index), line.slice(index + 1)];
    })
);

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
    name: "PayPal",
    keys: ["PAYPAL_CLIENT_ID", "PAYPAL_CLIENT_SECRET"],
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

let missing = 0;

for (const group of groups) {
  console.log(`\n${group.name}`);

  for (const key of group.keys) {
    const value = env[key]?.replace(/^"|"$/g, "");
    const ok = Boolean(value);

    if (!ok) missing += 1;

    console.log(`${ok ? "OK  " : "MISS"} ${key}`);
  }
}

if (missing > 0) {
  console.log(`\n${missing} payment environment value(s) missing.`);
  process.exit(1);
}

console.log("\nPayment environment looks ready.");
