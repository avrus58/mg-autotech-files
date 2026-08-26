import { createClient } from "@supabase/supabase-js";

const packageCatalog = [
  { id: "credits_10", credits: 10, catalogUnitPrice: 4.5, column: "credit_package_10_total_eur", overrideColumn: "credit_package_10_total_override_eur" },
  { id: "credits_50", credits: 50, catalogUnitPrice: 4.5, column: "credit_package_50_total_eur", overrideColumn: "credit_package_50_total_override_eur" },
  { id: "credits_100", credits: 100, catalogUnitPrice: 4, column: "credit_package_100_total_eur", overrideColumn: "credit_package_100_total_override_eur" },
  { id: "credits_250", credits: 250, catalogUnitPrice: 3.5, column: "credit_package_250_total_eur", overrideColumn: "credit_package_250_total_override_eur" },
  { id: "credits_500", credits: 500, catalogUnitPrice: 3, column: "credit_package_500_total_eur", overrideColumn: "credit_package_500_total_override_eur" },
];

function applyUnitAdjustment(unitPrice, type, value) {
  const safeUnit = Math.max(0.01, Number(unitPrice));
  if (type === "percentage") return Math.max(0.01, safeUnit * (1 - Number(value) / 100));
  if (type === "fixed") return Math.max(0.01, safeUnit - Number(value));
  if (type === "none") return safeUnit;
  throw new Error("invalid_legacy_policy");
}

function effectiveLegacyUnit(catalogUnitPrice, settings, policy) {
  if (policy?.credit_price_override_eur != null) {
    return Number(Math.max(0.01, Number(policy.credit_price_override_eur)).toFixed(4));
  }
  const afterGlobal = applyUnitAdjustment(
    catalogUnitPrice,
    settings.global_adjustment_type,
    settings.global_adjustment_value,
  );
  return Number(applyUnitAdjustment(
    afterGlobal,
    policy?.adjustment_type ?? "none",
    policy?.adjustment_value ?? 0,
  ).toFixed(4));
}

function creditTotal(credits, unitPrice) {
  const unitTenThousandths = Math.round(unitPrice * 10_000);
  return Math.round((credits * unitTenThousandths) / 100) / 100;
}

function sameAmount(actual, expected, scale) {
  const multiplier = 10 ** scale;
  return Number.isFinite(Number(actual)) &&
    Math.round(Number(actual) * multiplier) === Math.round(expected * multiplier);
}

async function readAllCustomerPolicies(client) {
  const pageSize = 1000;
  const rows = [];
  for (let offset = 0; ; offset += pageSize) {
    const result = await client
      .from("customer_commercial_policies")
      .select([
        "pricing_model_version",
        "credit_price_override_eur",
        "adjustment_type",
        "adjustment_value",
        "credit_package_10_total_override_eur",
        "credit_package_50_total_override_eur",
        "credit_package_100_total_override_eur",
        "credit_package_250_total_override_eur",
        "credit_package_500_total_override_eur",
        "custom_credit_unit_price_override_eur",
      ].join(","))
      .order("user_id", { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (result.error) throw new Error("customer_policy_read_failed");
    rows.push(...(result.data ?? []));
    if ((result.data?.length ?? 0) < pageSize) return rows;
  }
}

async function verify() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error("verification_environment_missing");

  const client = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const globalResult = await client
    .from("commerce_settings")
    .select([
      "pricing_model_version",
      "explicit_pricing_writes_enabled",
      "explicit_pricing_bridge_release",
      "default_custom_credit_price_eur",
      "global_adjustment_type",
      "global_adjustment_value",
      "credit_package_10_total_eur",
      "credit_package_50_total_eur",
      "credit_package_100_total_eur",
      "credit_package_250_total_eur",
      "credit_package_500_total_eur",
      "custom_credit_unit_price_eur",
    ].join(","))
    .eq("id", "default")
    .maybeSingle();
  if (globalResult.error || !globalResult.data) throw new Error("global_policy_read_failed");

  const settings = globalResult.data;
  let mismatchCount = 0;
  if (
    settings.pricing_model_version !== 2 ||
    settings.explicit_pricing_writes_enabled !== false ||
    settings.explicit_pricing_bridge_release != null
  ) {
    mismatchCount += 1;
  }

  for (const item of packageCatalog) {
    const expectedUnit = effectiveLegacyUnit(item.catalogUnitPrice, settings, null);
    if (!sameAmount(settings[item.column], creditTotal(item.credits, expectedUnit), 2)) {
      mismatchCount += 1;
    }
  }
  const globalCustomUnit = effectiveLegacyUnit(
    Number(settings.default_custom_credit_price_eur),
    settings,
    null,
  );
  if (!sameAmount(settings.custom_credit_unit_price_eur, globalCustomUnit, 4)) mismatchCount += 1;

  const policies = await readAllCustomerPolicies(client);
  let specialPolicyCount = 0;
  for (const policy of policies) {
    if (policy.pricing_model_version !== 2) mismatchCount += 1;
    const isSpecial = policy.credit_price_override_eur != null || policy.adjustment_type !== "none";
    if (isSpecial) specialPolicyCount += 1;

    for (const item of packageCatalog) {
      const actual = policy[item.overrideColumn];
      if (!isSpecial) {
        if (actual != null) mismatchCount += 1;
        continue;
      }
      const expectedUnit = effectiveLegacyUnit(item.catalogUnitPrice, settings, policy);
      if (!sameAmount(actual, creditTotal(item.credits, expectedUnit), 2)) mismatchCount += 1;
    }

    const actualCustom = policy.custom_credit_unit_price_override_eur;
    if (!isSpecial) {
      if (actualCustom != null) mismatchCount += 1;
    } else {
      const expectedCustom = effectiveLegacyUnit(
        Number(settings.default_custom_credit_price_eur),
        settings,
        policy,
      );
      if (!sameAmount(actualCustom, expectedCustom, 4)) mismatchCount += 1;
    }
  }

  const summary = {
    ok: mismatchCount === 0,
    globalRowsChecked: 1,
    customerPoliciesChecked: policies.length,
    specialPoliciesChecked: specialPolicyCount,
    mismatchCount,
  };
  process.stdout.write(`${JSON.stringify(summary)}\n`);
  if (!summary.ok) process.exitCode = 1;
}

verify().catch(() => {
  process.stderr.write("Explicit pricing continuity verification failed safely.\n");
  process.exitCode = 1;
});
