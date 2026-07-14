import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { requireStaffPermission } from "@/lib/apiAuth";
import {
  generateSyntheticDtcTestOutput,
  phaseCAuthorizationStatement,
} from "@/lib/dtcActive/syntheticProcessingEngine";

export async function POST(request: Request) {
  const auth = await requireStaffPermission(request, "ai_training.manage");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let payload: {
    requestedCodes?: unknown;
    idempotencyKey?: unknown;
    authorizationStatement?: unknown;
  };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const requestedCodes = Array.isArray(payload.requestedCodes)
    ? payload.requestedCodes.filter((code): code is string => typeof code === "string")
    : ["P0100", "P0300"];
  const idempotencyKey = typeof payload.idempotencyKey === "string" && payload.idempotencyKey.trim()
    ? payload.idempotencyKey.trim()
    : randomUUID();
  const authorizationStatement = typeof payload.authorizationStatement === "string"
    ? payload.authorizationStatement
    : "";

  const report = generateSyntheticDtcTestOutput({
    requestedCodes,
    idempotencyKey,
    authorizationStatement,
    actorId: auth.user.id,
  });

  return NextResponse.json({
    report,
    requiredAuthorizationStatement: phaseCAuthorizationStatement,
  }, { status: report.success ? 200 : 409 });
}
