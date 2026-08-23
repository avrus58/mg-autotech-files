import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaffPermission } from "@/lib/apiAuth";
import { hasStaffPermission } from "@/lib/staffPermissions";
import { buildAdminRequestAccess } from "@/lib/workOrders/access";
import {
  getAdminRequestDetail,
  updateAdminWorkOrder,
  updateRequestMessageVisibility,
  type WorkOrderPatch,
} from "@/lib/workOrders/server";
import {
  adminWorkOrderStatuses,
  deliveryMethods,
  deliveryStatuses,
  finalFileStatuses,
  paymentReviewStatuses,
  qualityCheckStatuses,
  tunerStatuses,
  workOrderPriorities,
} from "@/lib/workOrders/types";

const patchSchema = z.object({
  priority: z.enum(workOrderPriorities).optional(),
  admin_status: z.enum(adminWorkOrderStatuses).optional(),
  tuner_status: z.enum(tunerStatuses).optional(),
  payment_review_status: z.enum(paymentReviewStatuses).optional(),
  delivery_status: z.enum(deliveryStatuses).optional(),
  assigned_admin_id: z.string().uuid().nullable().optional(),
  assigned_tuner_id: z.string().uuid().nullable().optional(),
  internal_notes: z.string().trim().max(8000).nullable().optional(),
  customer_visible_notes: z.string().trim().max(4000).nullable().optional(),
  estimated_turnaround_minutes: z.number().int().min(0).max(100000).nullable().optional(),
  eta_note: z.string().trim().max(1000).nullable().optional(),
  risk_flags: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
  quality_check_status: z.enum(qualityCheckStatuses).optional(),
  quality_check_json: z.record(z.string(), z.unknown()).optional(),
  final_file_status: z.enum(finalFileStatuses).optional(),
  delivery_method: z.enum(deliveryMethods).optional(),
  message_visibility: z.object({
    message_id: z.string().uuid(),
    action: z.enum(["hide", "restore"]),
    reason: z.string().trim().max(500).optional().default(""),
  }).optional(),
}).strict();

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireStaffPermission(request, "orders.view");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id } = await context.params;

  try {
    const result = await getAdminRequestDetail(
      id,
      buildAdminRequestAccess(auth.access)
    );
    return NextResponse.json(result);
  } catch (error) {
    const notFound = error instanceof Error && error.message === "Request not found.";
    return NextResponse.json(
      { error: notFound ? "Request not found." : "Admin request could not be loaded." },
      { status: notFound ? 404 : 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireStaffPermission(request, "orders.manage");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid work order update.", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json(
      { error: "Work order update is empty." },
      { status: 400 }
    );
  }

  if (
    parsed.data.payment_review_status !== undefined &&
    !hasStaffPermission(auth.access, "credits.manage")
  ) {
    return NextResponse.json(
      { error: "Credit management permission is required for payment review updates." },
      { status: 403 }
    );
  }
  if (
    (parsed.data.final_file_status !== undefined || parsed.data.delivery_method !== undefined) &&
    !hasStaffPermission(auth.access, "files.upload")
  ) {
    return NextResponse.json(
      { error: "File upload permission is required for delivery file updates." },
      { status: 403 }
    );
  }
  if (
    (parsed.data.customer_visible_notes !== undefined || parsed.data.message_visibility !== undefined) &&
    !hasStaffPermission(auth.access, "messages.manage")
  ) {
    return NextResponse.json(
      { error: "Message management permission is required for customer-visible updates." },
      { status: 403 }
    );
  }

  const { id } = await context.params;
  try {
    const { message_visibility: messageVisibility, ...workOrderPatch } = parsed.data;
    if (messageVisibility) {
      if (Object.keys(workOrderPatch).length > 0) {
        return NextResponse.json(
          { error: "Message visibility updates must be submitted separately." },
          { status: 400 }
        );
      }
      const message = await updateRequestMessageVisibility({
        requestId: id,
        messageId: messageVisibility.message_id,
        actorUserId: auth.user.id,
        action: messageVisibility.action,
        reason: messageVisibility.reason,
      });
      return NextResponse.json({ message });
    }

    const workOrder = await updateAdminWorkOrder(id, auth.user.id, workOrderPatch as WorkOrderPatch);
    return NextResponse.json({ workOrder });
  } catch (error) {
    if (error instanceof Error && error.message === "Request message not found.") {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return NextResponse.json(
      { error: "Work order could not be updated." },
      { status: 500 }
    );
  }
}
