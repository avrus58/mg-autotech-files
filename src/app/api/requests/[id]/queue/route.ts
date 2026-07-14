import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/apiAuth";
import { getCustomerRequestQueueProjection } from "@/lib/workOrders/server";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiUser(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await context.params;

  try {
    const queue = await getCustomerRequestQueueProjection(id, auth.user.id);
    return NextResponse.json({ queue });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Queue state could not be loaded." },
      { status: 404 }
    );
  }
}
