import { NextResponse } from "next/server";
import { sendNewOrderEmailToAdmin } from "@/lib/email";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    await sendNewOrderEmailToAdmin({
      orderId: String(body.orderId || ""),
      customerEmail: String(body.customerEmail || ""),
      vehicle: String(body.vehicle || ""),
      service: String(body.service || ""),
      credits: Number(body.credits || 0),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Email could not be sent",
      },
      { status: 500 }
    );
  }
}