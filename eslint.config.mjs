import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "apps/customer-uploader/dist/**",
    "apps/customer-uploader/dist-electron/**",
    "apps/customer-uploader/release/**",
    "next-env.d.ts",
    // Intentionally malformed parser-rejection fixture, never executable code.
    "tests/fixtures/customer-workflow-route-closure/invalid.jsx",
  ]),
  {
    // These data fixtures deliberately exercise forbidden imports, untyped
    // catalogs and shadowed translators in the localization source audit.
    files: ["tests/fixtures/customer-workflow-route-closure/**/*.{js,jsx,ts,tsx}"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
]);

export default eslintConfig;
