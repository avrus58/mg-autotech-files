import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/apiAuth";
import { buildCreditQuote, getCommercialContext } from "@/lib/commercialPolicy";

export async function GET(request: Request) {
  const auth = await requireApiUser(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const context = await getCommercialContext(auth.user.id);
    return NextResponse.json({
      quote: buildCreditQuote(context.settings, context.customerPolicy),
      migrationReady: context.migrationReady,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Credit pricing could not be loaded." },
      { status: 500 }
    );
  }
}
