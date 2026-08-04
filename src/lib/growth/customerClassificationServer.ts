import { buildCustomerRevenue } from "@/lib/growth/customerClassification";
import type { GrowthPaymentRow } from "@/lib/growth/metrics";
import type {
  GrowthCustomerClassificationAdminResponse,
  GrowthCustomerClassificationRecord,
} from "@/lib/growth/types";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const missingCodes = new Set(["42P01", "42703", "PGRST204", "PGRST205"]);

export function isGrowthCustomerClassificationMigrationMissing(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: unknown; message?: unknown };
  const code = String(candidate.code ?? "");
  const message = String(candidate.message ?? "").toLowerCase();
  return missingCodes.has(code) ||
    message.includes("growth_customer_classifications") ||
    message.includes("set_growth_customer_classification");
}

export async function loadGrowthCustomerClassificationAdminData(): Promise<GrowthCustomerClassificationAdminResponse> {
  const admin = getSupabaseAdmin();
  const [profilesResult, classificationResult, ordersResult, paymentsResult] = await Promise.all([
    admin.from("profiles")
      .select("id,email,full_name,customer_id,role,created_at")
      .order("created_at", { ascending: false })
      .limit(5_000),
    admin.from("growth_customer_classifications")
      .select("user_id,classification,analytics_excluded,reason,verified_at")
      .limit(5_000),
    admin.from("orders")
      .select("id,customer_id,status,created_at")
      .order("created_at", { ascending: false })
      .limit(25_000),
    admin.from("credit_transactions")
      .select("id,user_id,type,amount_total,currency,created_at")
      .in("type", ["purchase", "refund"])
      .order("created_at", { ascending: false })
      .limit(25_000),
  ]);

  const error = profilesResult.error || classificationResult.error || ordersResult.error || paymentsResult.error;
  if (error) throw error;

  const classifications = new Map<string, GrowthCustomerClassificationRecord>();
  for (const row of classificationResult.data ?? []) {
    const classification = String(row.classification ?? "unreviewed") as GrowthCustomerClassificationRecord["classification"];
    classifications.set(String(row.user_id), {
      userId: String(row.user_id),
      classification,
      analyticsExcluded: row.analytics_excluded === true,
      reason: typeof row.reason === "string" ? row.reason : null,
      verifiedAt: typeof row.verified_at === "string" ? row.verified_at : null,
    });
  }

  const ordersByUser = new Map<string, Array<{ id: string; status: string | null; created_at: string | null }>>();
  for (const row of ordersResult.data ?? []) {
    if (!row.customer_id) continue;
    const key = String(row.customer_id);
    const current = ordersByUser.get(key) ?? [];
    current.push({
      id: String(row.id),
      status: typeof row.status === "string" ? row.status : null,
      created_at: typeof row.created_at === "string" ? row.created_at : null,
    });
    ordersByUser.set(key, current);
  }

  const paymentsByUser = new Map<string, GrowthPaymentRow[]>();
  for (const row of paymentsResult.data ?? []) {
    if (!row.user_id) continue;
    const key = String(row.user_id);
    const current = paymentsByUser.get(key) ?? [];
    current.push({
      id: String(row.id),
      user_id: key,
      type: typeof row.type === "string" ? row.type : null,
      amount_total: typeof row.amount_total === "number" ? row.amount_total : Number(row.amount_total ?? 0),
      currency: typeof row.currency === "string" ? row.currency : null,
      created_at: typeof row.created_at === "string" ? row.created_at : null,
    });
    paymentsByUser.set(key, current);
  }

  const customers = (profilesResult.data ?? [])
    .filter((row) => !["admin", "staff"].includes(String(row.role ?? "customer")))
    .map((profile) => {
      const userId = String(profile.id);
      const classification = classifications.get(userId) ?? {
        userId,
        classification: "unreviewed" as const,
        analyticsExcluded: false,
        reason: null,
        verifiedAt: null,
      };
      const orders = ordersByUser.get(userId) ?? [];
      const sortedOrders = [...orders].sort((left, right) =>
        new Date(left.created_at ?? 0).getTime() - new Date(right.created_at ?? 0).getTime()
      );
      const payments = paymentsByUser.get(userId) ?? [];
      return {
        customerReference: String(profile.customer_id || `Customer ${userId.slice(0, 8).toUpperCase()}`),
        email: typeof profile.email === "string" ? profile.email : null,
        fullName: typeof profile.full_name === "string" ? profile.full_name : null,
        createdAt: typeof profile.created_at === "string" ? profile.created_at : null,
        ...classification,
        orderCount: orders.length,
        completedOrderCount: orders.filter((row) => row.status === "completed").length,
        paymentCount: payments.filter((row) => row.type === "purchase").length,
        revenue: buildCustomerRevenue(payments),
        firstOrderAt: sortedOrders[0]?.created_at ?? null,
        lastOrderAt: sortedOrders.at(-1)?.created_at ?? null,
      };
    })
    .sort((left, right) => {
      if (left.classification === "unreviewed" && right.classification !== "unreviewed") return -1;
      if (right.classification === "unreviewed" && left.classification !== "unreviewed") return 1;
      return new Date(right.createdAt ?? 0).getTime() - new Date(left.createdAt ?? 0).getTime();
    });

  return {
    generatedAt: new Date().toISOString(),
    customers,
    summary: {
      total: customers.length,
      unreviewed: customers.filter((row) => row.classification === "unreviewed").length,
      verifiedReal: customers.filter((row) => row.classification === "real_customer").length,
      internalTest: customers.filter((row) => row.classification === "internal_test").length,
      staffOperated: customers.filter((row) => row.classification === "staff_operated").length,
      excluded: customers.filter((row) => row.analyticsExcluded).length,
    },
  };
}
