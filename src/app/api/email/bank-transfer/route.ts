import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/apiAuth";
import { sendBankTransferInstructionsEmail } from "@/lib/email/events";
import {
  checkAdaptiveRateLimit,
  rateLimitResponseHeaders,
} from "@/lib/abuseProtection";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const bankTransferEmailSchema = z.object({
  credits: z.number().int().positive().max(100000).nullable().optional(),
  amountEuro: z.number().positive().max(1000000).nullable().optional(),
}).strict();

export async function POST(request: Request) {
  const auth = await requireApiUser(request);
  if (!auth.ok) return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });

  const limit = await checkAdaptiveRateLimit({
    request,
    scope: "bank-transfer-email",
    suffix: auth.user.id,
    limit: 4,
    windowMs: 60 * 60 * 1000,
  });
  if (!limit.allowed) {
    return NextResponse.json(
      { success: false, error: "Too many bank transfer email requests. Please try again later." },
      {
        status: 429,
        headers: rateLimitResponseHeaders({
          result: limit,
          limit: 4,
          windowMs: 60 * 60 * 1000,
          blocked: true,
        }),
      }
    );
  }

  const parsed = bankTransferEmailSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Invalid bank transfer email request." }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const profile = await admin
    .from("profiles")
    .select("customer_id,email")
    .eq("id", auth.user.id)
    .maybeSingle();
  if (profile.error || !profile.data?.customer_id) {
    return NextResponse.json({ success: false, error: "Customer ID could not be loaded." }, { status: 404 });
  }

  const amountLabel =
    typeof parsed.data.amountEuro === "number"
      ? `${parsed.data.amountEuro.toFixed(2)} EUR`
      : null;

  await sendBankTransferInstructionsEmail({
    userId: auth.user.id,
    customerEmail: profile.data.email || auth.user.email || "",
    customerId: profile.data.customer_id,
    credits: parsed.data.credits ?? null,
    amountLabel,
  });

  return NextResponse.json({ success: true });
}
