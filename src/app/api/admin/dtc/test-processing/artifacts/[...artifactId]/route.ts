import { NextResponse } from "next/server";
import { requireStaffPermission } from "@/lib/apiAuth";
import { defaultDtcPhaseCStore } from "@/lib/dtcActive/phaseCStore";
import { parsePhaseCArtifactId } from "@/lib/dtcActive/localArtifactStore";

export async function GET(
  request: Request,
  context: { params: Promise<{ artifactId: string[] }> }
) {
  const auth = await requireStaffPermission(request, "ai_training.manage");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { artifactId: segments } = await context.params;
  const artifactId = segments.join("/");
  let parsed: ReturnType<typeof parsePhaseCArtifactId>;
  try {
    parsed = parsePhaseCArtifactId(artifactId);
  } catch {
    return NextResponse.json({ error: "Invalid synthetic artifact identifier." }, { status: 400 });
  }

  try {
    const bytes = defaultDtcPhaseCStore.getArtifactBytes(artifactId);
    if (!bytes) {
      return NextResponse.json({ error: "Synthetic artifact not found." }, { status: 404 });
    }
    return new NextResponse(new Uint8Array(bytes), {
      status: 200,
      headers: {
        "content-type": "application/octet-stream",
        "content-disposition": `attachment; filename="MG-AutoTech-INTERNAL-TEST-ONLY-${parsed.role}-${parsed.sha256.slice(0, 12)}.bin"`,
        "cache-control": "no-store",
        "x-dtc-artifact-classification": "INTERNAL_TEST_ONLY",
        "x-dtc-artifact-role": parsed.role,
        "x-dtc-artifact-sha256": parsed.sha256,
        "x-customer-delivery-enabled": "false",
      },
    });
  } catch {
    return NextResponse.json({ error: "Synthetic artifact verification failed." }, { status: 409 });
  }
}
