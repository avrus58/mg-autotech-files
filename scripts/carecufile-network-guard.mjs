export const CAREECU_NETWORK_OVERRIDE_ENV = "ALLOW_CAREECU_NETWORK";
export const CAREECU_NETWORK_OVERRIDE_FLAG = "--allow-network";

const OVERRIDE_ENABLED_PATTERN = /^(1|true|yes)$/i;

export function isCareEcuNetworkAllowed({
  argv = process.argv.slice(2),
  env = process.env,
} = {}) {
  return (
    argv.includes(CAREECU_NETWORK_OVERRIDE_FLAG) ||
    OVERRIDE_ENABLED_PATTERN.test(env[CAREECU_NETWORK_OVERRIDE_ENV] || "")
  );
}

export function requireCareEcuNetworkPermission({
  argv = process.argv.slice(2),
  env = process.env,
  scriptName = "CareEcuFile scraper",
} = {}) {
  if (isCareEcuNetworkAllowed({ argv, env })) return;

  throw new Error(
    `${scriptName}: refusing external CareEcuFile network access. ` +
      `Re-run with ${CAREECU_NETWORK_OVERRIDE_FLAG} or ${CAREECU_NETWORK_OVERRIDE_ENV}=1 ` +
      "only when intentionally scraping CareEcuFile."
  );
}
