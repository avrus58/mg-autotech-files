import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaffPermission } from "@/lib/apiAuth";
import { buildCreditQuote } from "@/lib/commercialPricing";
import {
  getCommerceSettings,
  getCustomerCommercialPolicy,
  normalizeCustomerCommercialPolicy,
} from "@/lib/commercialPolicy";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const schema = z.object({
  creditPriceOverrideEuro: z.number().min(0.01).max(1000).nullable(),
  adjustmentType: z.enum(["none", "percentage", "fixed"]),
  adjustmentValue: z.number().min(-1000).max(1000),
  paymentMethods: z.object({
    stripe: z.boolean().nullable(),
    bank: z.boolean().nullable(),
  }),
  internalNote: z.string().trim().max(2000).nullable(),
  expectedUpdatedAt: z.string().datetime({ offset: true }).nullable(),
}).strict().superRefine((value, context) => {
  if (value.adjustmentType === "percentage" && Math.abs(value.adjustmentValue) > 100) {
    context.addIssue({
      code: "custom",
      path: ["adjustmentValue"],
      message: "Percentage adjustment must be between -100 and 100.",
    });
  }
  if (value.adjustmentType === "none" && value.adjustmentValue !== 0) {
    context.addIssue({
      code: "custom",
      path: ["adjustmentValue"],
      message: "Adjustment value must be zero when no adjustment is selected.",
    });
  }
  if (value.creditPriceOverrideEuro != null && value.adjustmentType !== "none") {
    context.addIssue({
      code: "custom",
      path: ["creditPriceOverrideEuro"],
      message: "Choose either a fixed customer price or an adjustment to the global price.",
    });
  }
});

const privateNoStoreHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  Vary: "Authorization",
};

const selectedColumns = "user_id,credit_price_override_eur,adjustment_type,adjustment_value,payment_bank_enabled,payment_stripe_enabled,internal_note,updated_at";

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: privateNoStoreHeaders });
}

async function customerExists(id: string) {
  const admin = getSupabaseAdmin();
  const customer = await admin
    .from("profiles")
    .select("id,role")
    .eq("id", id)
    .eq("role", "customer")
    .maybeSingle();
  return customer.error ? "error" as const : customer.data ? "yes" as const : "no" as const;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireStaffPermission(request, "credits.manage");
  if (!auth.ok) return json({ error: auth.error }, auth.status);
  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success) {
    return json({ error: "Invalid customer identifier." }, 400);
  }

  const existence = await customerExists(id);
  if (existence === "error") return json({ error: "Customer pricing could not be loaded." }, 503);
  if (existence === "no") return json({ error: "Customer not found." }, 404);

  try {
    const [settings, customerPolicy] = await Promise.all([
      getCommerceSettings(),
      getCustomerCommercialPolicy(id),
    ]);
    return json({
      policy: customerPolicy,
      effectiveQuote: buildCreditQuote(settings, customerPolicy),
      migrationReady: true,
    });
  } catch {
    return json(
      { error: "Customer pricing is temporarily unavailable. Retry before making changes." },
      503,
    );
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireStaffPermission(request, "credits.manage");
  if (!auth.ok) return json({ error: auth.error }, auth.status);
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return json(
      { error: parsed.error.issues[0]?.message || "Invalid customer commercial policy." },
      400,
    );
  }

  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success) {
    return json({ error: "Invalid customer identifier." }, 400);
  }

  const existence = await customerExists(id);
  if (existence === "error") return json({ error: "Customer pricing could not be saved." }, 503);
  if (existence === "no") return json({ error: "Customer not found." }, 404);

  let settings;
  try {
    settings = await getCommerceSettings();
  } catch {
    return json(
      { error: "Global pricing is temporarily unavailable. Nothing was changed." },
      503,
    );
  }

  const admin = getSupabaseAdmin();
  const current = await admin
    .from("customer_commercial_policies")
    .select(selectedColumns)
    .eq("user_id", id)
    .maybeSingle();
  if (current.error) {
    return json({ error: "Customer pricing could not be saved. Nothing was changed." }, 503);
  }

  const currentUpdatedAt = typeof current.data?.updated_at === "string"
    ? current.data.updated_at
    : null;
  if (parsed.data.expectedUpdatedAt !== currentUpdatedAt) {
    return json(
      {
        error: "This customer pricing policy changed in another session. Reload it before saving.",
        code: "customer_commercial_policy_conflict",
      },
      409,
    );
  }

  const payload = {
    user_id: id,
    credit_price_override_eur: parsed.data.creditPriceOverrideEuro,
    adjustment_type: parsed.data.creditPriceOverrideEuro != null
      ? "none"
      : parsed.data.adjustmentType,
    adjustment_value: parsed.data.creditPriceOverrideEuro != null || parsed.data.adjustmentType === "none"
      ? 0
      : parsed.data.adjustmentValue,
    payment_stripe_enabled: parsed.data.paymentMethods.stripe,
    payment_paypal_enabled: false,
    payment_bank_enabled: parsed.data.paymentMethods.bank,
    internal_note: parsed.data.internalNote || null,
    updated_by: auth.user.id,
  };

  let saved;
  if (current.data) {
    const updated = await admin
      .from("customer_commercial_policies")
      .update(payload)
      .eq("user_id", id)
      .eq("updated_at", currentUpdatedAt as string)
      .select(selectedColumns)
      .maybeSingle();
    saved = updated;
  } else {
    const inserted = await admin
      .from("customer_commercial_policies")
      .insert(payload)
      .select(selectedColumns)
      .single();
    saved = inserted;
  }

  if (saved.error) {
    if (saved.error.code === "23505") {
      return json(
        {
          error: "This customer pricing policy changed in another session. Reload it before saving.",
          code: "customer_commercial_policy_conflict",
        },
        409,
      );
    }
    return json({ error: "Customer pricing could not be saved. Nothing was confirmed." }, 503);
  }
  if (!saved.data) {
    return json(
      {
        error: "This customer pricing policy changed in another session. Reload it before saving.",
        code: "customer_commercial_policy_conflict",
      },
      409,
    );
  }

  const audit = await admin.from("commerce_policy_events").insert({
    scope: "customer",
    customer_id: id,
    actor_user_id: auth.user.id,
    event_type: "customer_commercial_policy_updated",
    before_json: current.data,
    after_json: saved.data,
  });
  const policy = normalizeCustomerCommercialPolicy(
    id,
    saved.data as Record<string, unknown>,
  );

  return json({
    policy,
    effectiveQuote: buildCreditQuote(settings, policy),
    auditRecorded: !audit.error,
  });
}
