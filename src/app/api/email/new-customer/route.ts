import { NextResponse } from "next/server";
import { sendNewCustomerNotificationEmail } from "@/lib/email";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const customerEmail = String(body.customerEmail || "").trim();

    if (!customerEmail) {
      return NextResponse.json(
        { success: false, error: "Customer email is required." },
        { status: 400 }
      );
    }

    await sendNewCustomerNotificationEmail({
      customerEmail,
      fullName: String(body.fullName || ""),
      accountType: String(body.accountType || ""),
      companyName: String(body.companyName || ""),
      phone: String(body.phone || ""),
      source: String(body.source || "email"),
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
