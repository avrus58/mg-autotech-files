import { NextResponse } from "next/server";
import { addPurchasedCredits } from "@/lib/paymentCredits";

const SUMUP_API_BASE = process.env.SUMUP_API_BASE || "https://api.sumup.com";

export async function POST(request: Request) {
  try {
    const { checkoutId } = (await request.json()) as { checkoutId?: string };

    if (!checkoutId || typeof checkoutId !== "string") {
      return NextResponse.json(
        { error: "SumUp checkout id is missing." },
        { status: 400 }
      );
    }

    const sumupApiKey = process.env.SUMUP_API_KEY;

    if (!sumupApiKey) {
      return NextResponse.json(
        { error: "SumUp API key is missing." },
        { status: 500 }
      );
    }

    const response = await fetch(
      `${SUMUP_API_BASE}/v0.1/checkouts/${checkoutId}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${sumupApiKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.message || "Could not confirm SumUp checkout." },
        { status: 500 }
      );
    }

    if (data.status !== "PAID") {
      return NextResponse.json(
        { error: "SumUp payment is not completed yet.", paymentStatus: data.status },
        { status: 400 }
      );
    }

    const decodedReference = Buffer.from(
      String(data.checkout_reference || ""),
      "base64url"
    ).toString("utf8");
    const parsedMetadata = JSON.parse(decodedReference || "{}") as
      | [1, string, number, "c" | "p", string]
      | [string, number, string, string, string?]
      | {
          u?: string;
          c?: number;
          p?: string;
          t?: string;
        };

    const metadata = Array.isArray(parsedMetadata)
      ? parsedMetadata[0] === 1
        ? {
            u: parsedMetadata[1],
            c: parsedMetadata[2],
            p: undefined,
            t: parsedMetadata[3] === "c" ? "custom" : "package",
          }
        : {
            u: parsedMetadata[0],
            c: parsedMetadata[1],
            p: parsedMetadata[2],
            t: parsedMetadata[3],
          }
      : parsedMetadata;

    if (!metadata.u || !metadata.c) {
      return NextResponse.json(
        { error: "SumUp payment metadata is missing." },
        { status: 400 }
      );
    }

    const transactionId =
      data.transaction_id || data.transaction_code || data.id || checkoutId;

    const result = await addPurchasedCredits({
      userId: metadata.u,
      sourceType: "sumup_checkout",
      sourceId: String(transactionId),
      credits: Number(metadata.c),
      amountTotal: Math.round(Number(data.amount ?? 0) * 100),
      currency: String(data.currency ?? "EUR").toLowerCase(),
      description: `${metadata.c} credits purchased via SumUp.`,
      metadata: {
        sumup_checkout_id: checkoutId,
        sumup_transaction_id: transactionId,
        package_id: metadata.p ?? null,
        purchase_type: metadata.t ?? null,
      },
    });

    return NextResponse.json({
      success: true,
      credits: result.credits,
      alreadyProcessed: result.alreadyProcessed,
      paymentStatus: data.status,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not confirm SumUp checkout.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
