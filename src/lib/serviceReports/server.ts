import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { hasStaffPermission, type StaffAccess } from "@/lib/staffPermissions";
import { splitServiceLabels } from "@/lib/workOrders/types";
import {
  emptyServiceReportDetails, serviceReportDetailsSchema, serviceReportSnapshotSchema, ServiceReportError,
  type ServiceReportDetails, type ServiceReportEditorState, type ServiceReportSnapshot,
} from "@/lib/serviceReports/model";

type ReportDatabase = Pick<ReturnType<typeof getSupabaseAdmin>, "from" | "rpc">;

function validId(id: string) {
  if (!z.string().uuid().safeParse(id).success) throw new ServiceReportError("REPORT_NOT_FOUND", 404);
}

function databaseError(error: { code?: string } | null): never {
  if (error?.code === "SR404") throw new ServiceReportError("REPORT_NOT_FOUND", 404);
  if (error?.code === "SR409") throw new ServiceReportError("REPORT_NOT_COMPLETED", 409);
  if (error?.code === "SR412") throw new ServiceReportError("REPORT_CONFLICT", 409);
  throw new ServiceReportError("REPORT_UNAVAILABLE", 503);
}

/** The service-role RPC rechecks ownership and completed status under the order row lock. */
export async function getOrCreateServiceReport(orderId: string, actorId: string, access: StaffAccess, database: ReportDatabase = getSupabaseAdmin()): Promise<ServiceReportSnapshot> {
  validId(orderId);
  validId(actorId);
  const { data, error } = await database.rpc("get_or_create_service_report", {
    p_order_id: orderId, p_actor_id: actorId, p_allow_staff: hasStaffPermission(access, "files.download"),
  });
  if (error) databaseError(error);
  const parsed = serviceReportSnapshotSchema.safeParse(data);
  if (!parsed.success || parsed.data.orderId !== orderId || (parsed.data.customerId !== actorId && !hasStaffPermission(access, "files.download"))) {
    throw new ServiceReportError("REPORT_UNAVAILABLE", 503);
  }
  return parsed.data;
}

/** Recheck after PDF rendering: reopening or reassignment must not return a stale report. */
export async function assertOrderReportStillAccessible(orderId: string, customerId: string, actorId: string, access: StaffAccess, database: ReportDatabase = getSupabaseAdmin()): Promise<void> {
  validId(orderId);
  const { data, error } = await database.from("orders").select("id,customer_id,status").eq("id", orderId).maybeSingle();
  if (error) databaseError(error);
  if (!data || data.customer_id !== customerId || (data.customer_id !== actorId && !hasStaffPermission(access, "files.download"))) throw new ServiceReportError("REPORT_NOT_FOUND", 404);
  if (data.status !== "completed") throw new ServiceReportError("REPORT_NOT_COMPLETED", 409);
}

export async function getAdminServiceReportDetails(orderId: string, database: ReportDatabase = getSupabaseAdmin()): Promise<ServiceReportEditorState> {
  validId(orderId);
  const order = await database.from("orders").select("id,status,service_type").eq("id", orderId).maybeSingle();
  if (order.error) databaseError(order.error);
  if (!order.data) throw new ServiceReportError("REPORT_NOT_FOUND", 404);
  const result = await database.from("service_report_details").select("revision,details").eq("order_id", orderId).order("revision", { ascending: false }).limit(1).maybeSingle();
  if (result.error) databaseError(result.error);
  const parsed = serviceReportDetailsSchema.safeParse(result.data?.details ?? emptyServiceReportDetails());
  if (!parsed.success) throw new ServiceReportError("REPORT_UNAVAILABLE", 503);
  return { revision: result.data?.revision ?? 0, details: parsed.data, requestedServices: splitServiceLabels(order.data.service_type), orderStatus: String(order.data.status) };
}

export async function saveAdminServiceReportDetails(orderId: string, actorId: string, expectedRevision: number, input: ServiceReportDetails, database: ReportDatabase = getSupabaseAdmin()): Promise<{ revision: number; details: ServiceReportDetails }> {
  validId(orderId);
  validId(actorId);
  const details = serviceReportDetailsSchema.parse(input);
  const { data, error } = await database.rpc("save_service_report_details", { p_order_id: orderId, p_actor_id: actorId, p_expected_revision: expectedRevision, p_details: details });
  if (error) databaseError(error);
  const parsed = z.object({ revision: z.number().int().positive(), details: serviceReportDetailsSchema }).strict().safeParse(data);
  if (!parsed.success) throw new ServiceReportError("REPORT_UNAVAILABLE", 503);
  return parsed.data;
}
