import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/apiAuth";
import { captureLearningAuthorization } from "@/lib/ecuIntelligence/learningAuthorization";

const bodySchema = z.object({
  choice: z.enum(["grant", "deny"]),
  termsVersion: z.string().trim().min(1).max(80),
}).strict();

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiUser(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid learning authorization choice." }, { status: 400 });
  }
  const { id } = await context.params;
  try {
    const result = await captureLearningAuthorization({
      requestId: id,
      actorUserId: auth.user.id,
      captureSource: "web",
      choice: parsed.data.choice,
      termsVersion: parsed.data.termsVersion,
    });
    return NextResponse.json({
      status: result.status,
      termsVersion: result.termsVersion,
      capturedAt: result.capturedAt,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Learning authorization could not be captured.";
    const status = /authenticated customer's request|not found/i.test(message) ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
