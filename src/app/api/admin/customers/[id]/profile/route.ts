import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaffPermission } from "@/lib/apiAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { hasStaffPermission } from "@/lib/staffPermissions";

const nullableText = (max: number) => z.string().trim().max(max).nullable();

const customerProfileSchema = z.object({
  full_name: nullableText(200),
  account_type: z.enum(["private", "company"]),
  company_name: nullableText(240),
  phone: nullableText(80),
  street: nullableText(240),
  postal_code: nullableText(40),
  city: nullableText(120),
  country: nullableText(120),
  vat_id: nullableText(80),
  invoice_email: z.string().trim().email().max(254).nullable(),
  preferred_contact: nullableText(80),
  allow_negative_credits: z.boolean().optional(),
  negative_credit_limit: z.number().int().min(0).max(100000).optional(),
  account_status: z.enum(["active", "suspended", "blocked"]),
  customer_tags: z.array(
    z.enum(["workshop", "reseller", "vip", "blocked", "negative_credit"])
  ).max(5),
  internal_admin_note: nullableText(2000),
}).strict();

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireStaffPermission(request, "customers.manage");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const parsed = customerProfileSchema.safeParse(
    await request.json().catch(() => null)
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid customer profile." },
      { status: 400 }
    );
  }

  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "Invalid customer identifier." }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const current = await admin
    .from("profiles")
    .select("id,role")
    .eq("id", id)
    .maybeSingle();
  if (current.error) {
    return NextResponse.json({ error: current.error.message }, { status: 500 });
  }
  if (!current.data || current.data.role !== "customer") {
    return NextResponse.json({ error: "Customer not found." }, { status: 404 });
  }

  const canManageCredits = hasStaffPermission(auth.access, "credits.manage");
  const hasNegativeCreditInput = parsed.data.allow_negative_credits !== undefined
    || parsed.data.negative_credit_limit !== undefined;
  if (
    hasNegativeCreditInput
    && (
      parsed.data.allow_negative_credits === undefined
      || parsed.data.negative_credit_limit === undefined
    )
  ) {
    return NextResponse.json(
      { error: "Both negative-credit settings are required together." },
      { status: 400 }
    );
  }
  if (!canManageCredits && hasNegativeCreditInput) {
    return NextResponse.json(
      { error: "Credit management permission is required for financial settings." },
      { status: 403 }
    );
  }

  const {
    allow_negative_credits,
    negative_credit_limit,
    ...customerFields
  } = parsed.data;
  const updatePayload = canManageCredits && hasNegativeCreditInput
    ? { ...customerFields, allow_negative_credits, negative_credit_limit }
    : customerFields;
  const returnedColumns = canManageCredits
    ? "id,full_name,account_type,company_name,phone,street,postal_code,city,country,vat_id,invoice_email,preferred_contact,allow_negative_credits,negative_credit_limit,account_status,customer_tags,internal_admin_note"
    : "id,full_name,account_type,company_name,phone,street,postal_code,city,country,vat_id,invoice_email,preferred_contact,account_status,customer_tags,internal_admin_note";

  const updated = await admin
    .from("profiles")
    .update(updatePayload)
    .eq("id", id)
    .eq("role", "customer")
    .select(returnedColumns)
    .maybeSingle();
  if (updated.error) {
    return NextResponse.json({ error: updated.error.message }, { status: 500 });
  }
  if (!updated.data) {
    return NextResponse.json({ error: "Customer not found." }, { status: 404 });
  }

  return NextResponse.json({ customer: updated.data });
}
