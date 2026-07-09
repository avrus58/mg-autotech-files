import { NextResponse } from "next/server";
import { z } from "zod";
import { sendNewCustomerNotificationEmail } from "@/lib/email";
import { checkRateLimit, rateLimitKey } from "@/lib/rateLimit";

const customerNotificationSchema = z.object({
  customerEmail: z.string().trim().email().max(250),
  fullName: z.string().trim().max(160).optional().default(""),
  accountType: z.string().trim().max(80).optional().default(""),
  companyName: z.string().trim().max(160).optional().default(""),
  phone: z.string().trim().max(60).optional().default(""),
  source: z.string().trim().max(80).optional().default("email"),
});

export async function POST(request: Request) {
  try {
    const ipLimit = checkRateLimit({
      key: rateLimitKey(request, "new-customer-email"),
      limit: 8,
      windowMs: 60 * 60 * 1000,
    });

    if (!ipLimit.allowed) {
      return NextResponse.json(
        { success: false, error: "Too many registration notifications. Please try again later." },
        { status: 429, headers: { "Retry-After": String(ipLimit.retryAfterSeconds) } }
      );
    }

    const parsed = customerNotificationSchema.safeParse(await request.json().catch(() => null));

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Valid customer details are required." },
        { status: 400 }
      );
    }

    const emailLimit = checkRateLimit({
      key: rateLimitKey(request, "new-customer-email-address", parsed.data.customerEmail),
      limit: 3,
      windowMs: 60 * 60 * 1000,
    });

    if (!emailLimit.allowed) {
      return NextResponse.json(
        { success: false, error: "This registration notification was already sent recently." },
        { status: 429, headers: { "Retry-After": String(emailLimit.retryAfterSeconds) } }
      );
    }

    await sendNewCustomerNotificationEmail({
      customerEmail: parsed.data.customerEmail,
      fullName: parsed.data.fullName,
      accountType: parsed.data.accountType,
      companyName: parsed.data.companyName,
      phone: parsed.data.phone,
      source: parsed.data.source,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Customer notification could not be sent",
      },
      { status: 500 }
    );
  }
}
