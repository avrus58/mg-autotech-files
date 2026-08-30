import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/apiAuth";
import { getCreditQuoteForUser } from "@/lib/commercialPolicy";
import { creditPurchaseErrorCodes } from "@/lib/creditPurchaseErrorCodes";

const privateNoStoreHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  Vary: "Authorization",
};

export async function GET(request: Request) {
  const auth = await requireApiUser(request);
  if (!auth.ok) {
    return NextResponse.json(
      { code: creditPurchaseErrorCodes.authRequired },
      { status: auth.status, headers: privateNoStoreHeaders },
    );
  }

  try {
    const context = await getCreditQuoteForUser(auth.user.id);
    return NextResponse.json(
      { quote: context.quote, migrationReady: true },
      { headers: privateNoStoreHeaders },
    );
  } catch {
    return NextResponse.json(
      {
        code: creditPurchaseErrorCodes.pricingUnavailable,
      },
      { status: 503, headers: privateNoStoreHeaders },
    );
  }
}
