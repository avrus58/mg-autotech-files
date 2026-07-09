import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "This payment method is disabled." },
    { status: 410 }
  );
}
