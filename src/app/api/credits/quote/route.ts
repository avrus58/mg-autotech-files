import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/apiAuth";
import { getCreditQuoteForUser } from "@/lib/commercialPolicy";

const privateNoStoreHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  Vary: "Authorization",
};

export async function GET(request: Request) {
  const auth = await requireApiUser(request);
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.error },
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
        error: "Credit pricing is temporarily unavailable. Please retry before starting a payment.",
        code: "commercial_pricing_unavailable",
      },
      { status: 503, headers: privateNoStoreHeaders },
    );
  }
}
