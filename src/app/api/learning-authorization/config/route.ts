import { NextResponse } from "next/server";
import { getLearningAuthorizationPublicConfig } from "@/lib/ecuIntelligence/learningConfig";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(getLearningAuthorizationPublicConfig());
}
