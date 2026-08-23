import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaffPermissions } from "@/lib/apiAuth";
import { growthReminderPermissions } from "@/lib/growth/access";
import { sendGrowthAbandonedRequestReminder } from "@/lib/growth/reminders";

const schema = z.object({ sourceEventId: z.string().uuid() }).strict();
const headers = {
  "Cache-Control": "private, no-store, max-age=0",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
  Vary: "Authorization",
};

export async function POST(request: Request) {
  const auth = await requireStaffPermissions(request, growthReminderPermissions);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status, headers });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400, headers });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid reminder action." }, { status: 400, headers });

  try {
    const result = await sendGrowthAbandonedRequestReminder({
      sourceEventId: parsed.data.sourceEventId,
      actorUserId: auth.user.id,
    });
    return NextResponse.json(result, { status: result.ok ? 200 : 409, headers });
  } catch {
    return NextResponse.json({ error: "Reminder action is temporarily unavailable." }, { status: 503, headers });
  }
}
