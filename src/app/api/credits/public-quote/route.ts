import { NextResponse } from "next/server";
import { buildCreditQuote, emptyCustomerCommercialPolicy } from "@/lib/commercialPricing";
import { getCommerceSettings } from "@/lib/commercialPolicy";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const publicQuoteHeaders = {
  // Public does not mean cacheable here: an admin price change must not leave
  // a stale amount on the marketing page while checkout already uses a newer one.
  "Cache-Control": "no-store, max-age=0",
};

export async function GET() {
  try {
    const settings = await getCommerceSettings();
    const quote = buildCreditQuote(
      settings,
      emptyCustomerCommercialPolicy("public-global-pricing"),
    );

    return NextResponse.json(
      {
        quote: {
          currency: quote.currency,
          promotionLabel: quote.promotionLabel,
          customUnitPriceEuro: quote.customUnitPriceEuro,
          packages: quote.packages.map((item) => ({
            id: item.id,
            name: item.name,
            credits: item.credits,
            priceEuro: item.priceEuro,
            unitPriceEuro: item.unitPriceEuro,
            description: item.description,
            highlight: Boolean(item.highlight),
          })),
        },
      },
      { headers: publicQuoteHeaders },
    );
  } catch {
    return NextResponse.json(
      {
        error: "Live credit pricing is temporarily unavailable.",
        code: "commercial_pricing_unavailable",
      },
      { status: 503, headers: publicQuoteHeaders },
    );
  }
}
