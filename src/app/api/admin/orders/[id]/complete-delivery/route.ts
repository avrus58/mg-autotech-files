import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaffPermission } from "@/lib/apiAuth";
import { maybeCreateTrainingSampleForRequest } from "@/lib/ecuIntelligence/learning";
import { sendDeliveryCompletedEmail } from "@/lib/email/events";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { recordWorkOrderEvent } from "@/lib/workOrders/server";

export const maxDuration = 60;

const bodySchema = z.object({
  filePath: z.string().min(1).max(1200),
  fileName: z.string().min(1).max(255),
  label: z.enum(["v1", "revision", "final"]),
  versionId: z.string().min(1).max(100),
  uploadedAt: z.string().datetime(),
});

type StoredVersion = {
  id: string;
  label: "v1" | "revision" | "final";
  file_name: string;
  file_path: string;
  uploaded_at: string;
};

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireStaffPermission(request, "files.upload");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid delivery data." },
      { status: 400 }
    );
  }

  const { id } = await context.params;
  const admin = getSupabaseAdmin();
  const orderResult = await admin
    .from("orders")
    .select("id, customer_id, modified_files")
    .eq("id", id)
    .single();
  if (orderResult.error || !orderResult.data) {
    return NextResponse.json(
      { error: orderResult.error?.message || "Order not found." },
      { status: 404 }
    );
  }

  const customerFolder = orderResult.data.customer_id || "unknown-customer";
  const expectedPrefix = `${customerFolder}/modified/${id}/`;
  if (!parsed.data.filePath.startsWith(expectedPrefix) || parsed.data.filePath.includes("..")) {
    return NextResponse.json({ error: "Invalid completed-file path." }, { status: 400 });
  }

  const slash = parsed.data.filePath.lastIndexOf("/");
  const folder = parsed.data.filePath.slice(0, slash);
  const objectName = parsed.data.filePath.slice(slash + 1);
  const object = await admin.storage.from("customer-files").list(folder, {
    search: objectName,
    limit: 10,
  });
  if (object.error || !object.data?.some((entry) => entry.name === objectName)) {
    return NextResponse.json({ error: "Uploaded completed file was not found." }, { status: 400 });
  }

  const existing = Array.isArray(orderResult.data.modified_files)
    ? (orderResult.data.modified_files as StoredVersion[])
    : [];
  const version: StoredVersion = {
    id: parsed.data.versionId,
    label: parsed.data.label,
    file_name: parsed.data.fileName,
    file_path: parsed.data.filePath,
    uploaded_at: parsed.data.uploadedAt,
  };
  const versions = existing.some((item) => item.file_path === version.file_path)
    ? existing
    : [...existing, version];

  const updated = await admin
    .from("orders")
    .update({
      modified_file_path: version.file_path,
      modified_files: versions,
      status: "completed",
    })
    .eq("id", id)
    .select("id, modified_file_path, modified_files, status")
    .single();
  if (updated.error || !updated.data) {
    return NextResponse.json(
      { error: updated.error?.message || "Order delivery could not be saved." },
      { status: 500 }
    );
  }

  await recordWorkOrderEvent({
    requestId: id,
    actorUserId: auth.user.id,
    eventType: "final_file_delivery_saved",
    message: `Admin saved ${parsed.data.label} delivery file ${parsed.data.fileName}.`,
    customerVisible: true,
    newValue: {
      label: parsed.data.label,
      file_name: parsed.data.fileName,
      version_id: parsed.data.versionId,
      status: "completed",
    },
    mode: "best_effort",
  });
  await sendDeliveryCompletedEmail({
    requestId: id,
    fileName: parsed.data.fileName,
  });

  let training: Awaited<ReturnType<typeof maybeCreateTrainingSampleForRequest>> | null = null;
  let trainingWarning: string | null = null;
  try {
    training = await maybeCreateTrainingSampleForRequest(id, {
      modFilePath: version.file_path,
      modFileName: version.file_name,
      revisionLabel: version.label,
      actorUserId: auth.user.id,
      provider: "internal",
    });
  } catch (error) {
    trainingWarning = error instanceof Error ? error.message : "Training capture failed.";
  }

  return NextResponse.json({ order: updated.data, training, trainingWarning });
}
