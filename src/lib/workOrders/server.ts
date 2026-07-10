import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import {
  normalizeRequestMessageVisibility,
  projectAdminRequestMessage,
  type RequestMessageVisibilityStatus,
  type RequestMessageVisibilityRow,
} from "@/lib/workOrders/messageVisibility";
import {
  adminWorkOrderStatuses,
  deliveryStatuses,
  finalFileStatuses,
  mapLegacyOrderStatus,
  paymentReviewStatuses,
  qualityCheckStatuses,
  splitServiceLabels,
  tunerStatuses,
  workOrderNoteTypes,
  workOrderPriorities,
  type AdminWorkOrderStatus,
  type DeliveryStatus,
  type FinalFileStatus,
  type PaymentReviewStatus,
  type QualityCheckStatus,
  type TunerStatus,
  type WorkOrderNoteType,
  type WorkOrderPriority,
} from "@/lib/workOrders/types";

type DbError = { code?: string; message?: string } | null | undefined;

const missingRelationCodes = new Set(["42P01", "42703"]);

export function isWorkOrderMigrationMissing(error: DbError) {
  return Boolean(error?.code && missingRelationCodes.has(error.code));
}

function numberOrNull(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function cleanArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(String).map((item) => item.trim()).filter(Boolean).slice(0, 20);
}

function enumOrDefault<T extends readonly string[]>(value: unknown, allowed: T, fallback: T[number]): T[number] {
  return typeof value === "string" && allowed.includes(value) ? value : fallback;
}

function safeDate(value: unknown) {
  return typeof value === "string" ? value : null;
}

function nowIso() {
  return new Date().toISOString();
}

export type OrderRow = {
  id: string;
  customer_id: string | null;
  customer_email: string | null;
  vehicle_brand: string | null;
  vehicle_model: string | null;
  vehicle_generation: string | null;
  vehicle_engine: string | null;
  service_type: string | null;
  credits_required: number | string | null;
  status: string | null;
  notes: string | null;
  ecu: string | null;
  gearbox: string | null;
  vehicle_year: string | null;
  read_method: string | null;
  license_plate: string | null;
  hw_sw: string | null;
  master_slave: string | null;
  uploaded_file_name: string | null;
  original_file_path: string | null;
  modified_file_path: string | null;
  modified_files: unknown;
  estimated_delivery_label: string | null;
  estimated_delivery_note: string | null;
  customer_upload_enabled?: boolean | null;
  customer_uploads?: unknown;
  created_at: string | null;
  updated_at?: string | null;
};

export type ProfileSummary = {
  id: string;
  email: string | null;
  customer_id: string | null;
  full_name: string | null;
  company_name: string | null;
  phone: string | null;
  account_status: string | null;
  customer_tags: string[];
  internal_admin_note: string | null;
  credit_balance: number | string | null;
  created_at: string | null;
};

export type WorkOrderRow = {
  id: string;
  request_id: string;
  priority: WorkOrderPriority;
  admin_status: AdminWorkOrderStatus;
  tuner_status: TunerStatus;
  payment_review_status: PaymentReviewStatus;
  delivery_status: DeliveryStatus;
  assigned_admin_id: string | null;
  assigned_tuner_id: string | null;
  internal_notes: string | null;
  customer_visible_notes: string | null;
  estimated_turnaround_minutes: number | null;
  eta_note: string | null;
  risk_flags: string[];
  quality_check_status: QualityCheckStatus;
  quality_check_json: Record<string, unknown>;
  final_file_status: FinalFileStatus;
  delivery_method: "portal" | "manual" | "external";
  last_admin_activity_at: string | null;
  last_customer_activity_at: string | null;
  created_at: string;
  updated_at: string;
};

export type WorkOrderEvent = {
  id: string;
  request_id: string;
  work_order_id: string | null;
  actor_user_id: string | null;
  event_type: string;
  old_value: unknown;
  new_value: unknown;
  customer_visible: boolean;
  message: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type WorkOrderNote = {
  id: string;
  request_id: string;
  work_order_id: string | null;
  author_user_id: string | null;
  note_type: WorkOrderNoteType;
  body: string;
  pinned: boolean;
  customer_visible: boolean;
  visibility_status: "visible" | "hidden" | "archived";
  hidden_at: string | null;
  hidden_by: string | null;
  hidden_reason: string | null;
  restored_at: string | null;
  restored_by: string | null;
  linked_request_message_id: string | null;
  created_at: string;
  updated_at: string;
};

export type AdminRequestListItem = {
  order: OrderRow;
  customer: ProfileSummary | null;
  workOrder: WorkOrderRow | null;
  requestedServices: string[];
  indicators: {
    hasOriginalFile: boolean;
    hasDeliveredFile: boolean;
    hasCustomerUpload: boolean;
    trainingSampleCount: number;
    hasAiEvidence: boolean;
  };
};

export type AdminRequestDetail = AdminRequestListItem & {
  migrationReady: boolean;
  requestMessages: Array<ReturnType<typeof projectAdminRequestMessage>>;
  notes: WorkOrderNote[];
  events: WorkOrderEvent[];
  fileExpert: {
    linked: boolean;
    job: Record<string, unknown> | null;
    warning: string | null;
  };
  aiEvidence: {
    trainingSamples: Array<Record<string, unknown>>;
    similarity: { count: number; maxScore: number | null };
    clusters: Array<Record<string, unknown>>;
    warnings: string[];
  };
  vehicleDb: {
    found: boolean;
    vehicleId: string | null;
    vehicleKey: string | null;
    warning: string | null;
    serviceCapabilityWarnings: string[];
  };
  payment: {
    creditTransactions: Array<Record<string, unknown>>;
    paymentRecords: Array<Record<string, unknown>>;
    summary: {
      creditsRequired: number;
      customerBalance: number | null;
      paymentStatus: string;
    };
  };
  qualityChecklist: Array<{ key: string; label: string; ok: boolean; detail: string }>;
};

function normalizeWorkOrder(row: Record<string, unknown> | null | undefined): WorkOrderRow | null {
  if (!row) return null;
  return {
    id: String(row.id),
    request_id: String(row.request_id),
    priority: enumOrDefault(row.priority, workOrderPriorities, "normal"),
    admin_status: enumOrDefault(row.admin_status, adminWorkOrderStatuses, "new"),
    tuner_status: enumOrDefault(row.tuner_status, tunerStatuses, "unassigned"),
    payment_review_status: enumOrDefault(row.payment_review_status, paymentReviewStatuses, "not_checked"),
    delivery_status: enumOrDefault(row.delivery_status, deliveryStatuses, "not_ready"),
    assigned_admin_id: typeof row.assigned_admin_id === "string" ? row.assigned_admin_id : null,
    assigned_tuner_id: typeof row.assigned_tuner_id === "string" ? row.assigned_tuner_id : null,
    internal_notes: typeof row.internal_notes === "string" ? row.internal_notes : null,
    customer_visible_notes: typeof row.customer_visible_notes === "string" ? row.customer_visible_notes : null,
    estimated_turnaround_minutes: numberOrNull(row.estimated_turnaround_minutes),
    eta_note: typeof row.eta_note === "string" ? row.eta_note : null,
    risk_flags: cleanArray(row.risk_flags),
    quality_check_status: enumOrDefault(row.quality_check_status, qualityCheckStatuses, "pending"),
    quality_check_json: row.quality_check_json && typeof row.quality_check_json === "object" && !Array.isArray(row.quality_check_json)
      ? row.quality_check_json as Record<string, unknown>
      : {},
    final_file_status: enumOrDefault(row.final_file_status, finalFileStatuses, "not_ready"),
    delivery_method: enumOrDefault(row.delivery_method, ["portal", "manual", "external"] as const, "portal"),
    last_admin_activity_at: safeDate(row.last_admin_activity_at),
    last_customer_activity_at: safeDate(row.last_customer_activity_at),
    created_at: safeDate(row.created_at) ?? nowIso(),
    updated_at: safeDate(row.updated_at) ?? nowIso(),
  };
}

function fallbackWorkOrder(order: OrderRow): WorkOrderRow {
  const timestamp = order.created_at ?? nowIso();
  return {
    id: `fallback-${order.id}`,
    request_id: order.id,
    priority: "normal",
    admin_status: mapLegacyOrderStatus(order.status),
    tuner_status: "unassigned",
    payment_review_status: Number(order.credits_required ?? 0) > 0 ? "pending" : "not_checked",
    delivery_status: order.modified_file_path || order.status === "completed" ? "delivered" : "not_ready",
    assigned_admin_id: null,
    assigned_tuner_id: null,
    internal_notes: null,
    customer_visible_notes: null,
    estimated_turnaround_minutes: null,
    eta_note: order.estimated_delivery_note ?? null,
    risk_flags: [],
    quality_check_status: "pending",
    quality_check_json: {},
    final_file_status: order.modified_file_path ? "uploaded" : "not_ready",
    delivery_method: "portal",
    last_admin_activity_at: null,
    last_customer_activity_at: null,
    created_at: timestamp,
    updated_at: order.updated_at ?? timestamp,
  };
}

async function fetchProfiles(ids: string[]) {
  if (ids.length === 0) return new Map<string, ProfileSummary>();
  const admin = getSupabaseAdmin();
  const result = await admin
    .from("profiles")
    .select("id,email,customer_id,full_name,company_name,phone,account_status,customer_tags,internal_admin_note,credit_balance,created_at")
    .in("id", ids);

  if (result.error) return new Map<string, ProfileSummary>();
  return new Map((result.data ?? []).map((row) => [String(row.id), {
    id: String(row.id),
    email: row.email ?? null,
    customer_id: row.customer_id ?? null,
    full_name: row.full_name ?? null,
    company_name: row.company_name ?? null,
    phone: row.phone ?? null,
    account_status: row.account_status ?? null,
    customer_tags: cleanArray(row.customer_tags),
    internal_admin_note: row.internal_admin_note ?? null,
    credit_balance: row.credit_balance ?? null,
    created_at: row.created_at ?? null,
  } satisfies ProfileSummary]));
}

async function fetchWorkOrders(ids: string[]) {
  const result = { rows: new Map<string, WorkOrderRow>(), migrationReady: true };
  if (ids.length === 0) return result;
  const admin = getSupabaseAdmin();
  const query = await admin.from("request_work_orders").select("*").in("request_id", ids);
  if (query.error) {
    return { rows: result.rows, migrationReady: !isWorkOrderMigrationMissing(query.error) };
  }
  for (const row of query.data ?? []) {
    const normalized = normalizeWorkOrder(row as Record<string, unknown>);
    if (normalized) result.rows.set(normalized.request_id, normalized);
  }
  return result;
}

async function fetchTrainingCounts(ids: string[]) {
  const counts = new Map<string, number>();
  if (ids.length === 0) return counts;
  const admin = getSupabaseAdmin();
  const query = await admin.from("ai_training_samples").select("id,request_id").in("request_id", ids);
  if (query.error) return counts;
  for (const row of query.data ?? []) {
    if (!row.request_id) continue;
    counts.set(row.request_id, (counts.get(row.request_id) ?? 0) + 1);
  }
  return counts;
}

function buildListItem(
  order: OrderRow,
  profile: ProfileSummary | null,
  workOrder: WorkOrderRow | null,
  trainingSampleCount: number
): AdminRequestListItem {
  return {
    order,
    customer: profile,
    workOrder: workOrder ?? fallbackWorkOrder(order),
    requestedServices: splitServiceLabels(order.service_type),
    indicators: {
      hasOriginalFile: Boolean(order.original_file_path),
      hasDeliveredFile: Boolean(order.modified_file_path || (Array.isArray(order.modified_files) && order.modified_files.length > 0)),
      hasCustomerUpload: Array.isArray(order.customer_uploads) && order.customer_uploads.length > 0,
      trainingSampleCount,
      hasAiEvidence: trainingSampleCount > 0,
    },
  };
}

export async function getAdminRequestList() {
  const admin = getSupabaseAdmin();
  const ordersResult = await admin.from("orders").select("*").order("created_at", { ascending: false }).limit(500);
  if (ordersResult.error) throw new Error(ordersResult.error.message);
  const orders = (ordersResult.data ?? []) as unknown as OrderRow[];
  const ids = orders.map((order) => order.id);
  const customerIds = [...new Set(orders.map((order) => order.customer_id).filter((id): id is string => Boolean(id)))];
  const [profiles, workOrders, trainingCounts] = await Promise.all([
    fetchProfiles(customerIds),
    fetchWorkOrders(ids),
    fetchTrainingCounts(ids),
  ]);

  return {
    migrationReady: workOrders.migrationReady,
    items: orders.map((order) =>
      buildListItem(order, order.customer_id ? profiles.get(order.customer_id) ?? null : null, workOrders.rows.get(order.id) ?? null, trainingCounts.get(order.id) ?? 0)
    ),
  };
}

async function fetchWorkOrderDetailRows(requestId: string) {
  const admin = getSupabaseAdmin();
  const [notesResult, eventsResult, messagesResult] = await Promise.all([
    admin.from("request_internal_notes").select("*").eq("request_id", requestId).is("deleted_at", null).order("pinned", { ascending: false }).order("created_at", { ascending: false }),
    admin.from("request_work_order_events").select("*").eq("request_id", requestId).order("created_at", { ascending: false }).limit(200),
    admin.from("request_messages").select("id,request_id,sender_id,sender_role,message,created_at,visibility_status,hidden_at,hidden_by,hidden_reason,restored_at,restored_by").eq("request_id", requestId).order("created_at", { ascending: true }).limit(200),
  ]);
  let requestMessages: Array<ReturnType<typeof projectAdminRequestMessage>> = [];
  if (messagesResult.error && isWorkOrderMigrationMissing(messagesResult.error)) {
    const fallbackMessages = await admin
      .from("request_messages")
      .select("id,request_id,sender_id,sender_role,message,created_at")
      .eq("request_id", requestId)
      .order("created_at", { ascending: true })
      .limit(200);
    requestMessages = fallbackMessages.error
      ? []
      : (fallbackMessages.data ?? []).map((row) =>
        projectAdminRequestMessage(row as RequestMessageVisibilityRow)
      );
  } else {
    requestMessages = messagesResult.error
      ? []
      : (messagesResult.data ?? []).map((row) =>
        projectAdminRequestMessage(row as RequestMessageVisibilityRow)
      );
  }
  return {
    notes: notesResult.error ? [] : (notesResult.data ?? []).map((row) => ({
      id: String(row.id),
      request_id: String(row.request_id),
      work_order_id: row.work_order_id ?? null,
      author_user_id: row.author_user_id ?? null,
      note_type: enumOrDefault(row.note_type, workOrderNoteTypes, "internal"),
      body: String(row.body ?? ""),
      pinned: Boolean(row.pinned),
      customer_visible: Boolean(row.customer_visible),
      visibility_status: normalizeRequestMessageVisibility(row.visibility_status),
      hidden_at: row.hidden_at ?? null,
      hidden_by: row.hidden_by ?? null,
      hidden_reason: row.hidden_reason ?? null,
      restored_at: row.restored_at ?? null,
      restored_by: row.restored_by ?? null,
      linked_request_message_id: row.linked_request_message_id ?? null,
      created_at: row.created_at ?? nowIso(),
      updated_at: row.updated_at ?? row.created_at ?? nowIso(),
    } satisfies WorkOrderNote)),
    events: eventsResult.error ? [] : (eventsResult.data ?? []).map((row) => ({
      id: String(row.id),
      request_id: String(row.request_id),
      work_order_id: row.work_order_id ?? null,
      actor_user_id: row.actor_user_id ?? null,
      event_type: String(row.event_type ?? "event"),
      old_value: row.old_value ?? null,
      new_value: row.new_value ?? null,
      customer_visible: Boolean(row.customer_visible),
      message: row.message ?? null,
      metadata: row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata) ? row.metadata as Record<string, unknown> : {},
      created_at: row.created_at ?? nowIso(),
    } satisfies WorkOrderEvent)),
    messages: requestMessages,
    migrationReady: !(isWorkOrderMigrationMissing(notesResult.error) || isWorkOrderMigrationMissing(eventsResult.error)),
  };
}

async function fetchFileExpertSummary(order: OrderRow) {
  if (!order.customer_id) return { linked: false, job: null, warning: "No customer id is available for File Expert lookup." };
  const admin = getSupabaseAdmin();
  const result = await admin
    .from("file_expert_jobs")
    .select("id,status,brand,model,engine,ecu_type,ecu_family,confidence_score,risk_level,executive_summary,detected_features,created_at,updated_at")
    .eq("user_id", order.customer_id)
    .order("created_at", { ascending: false })
    .limit(20);
  if (result.error) return { linked: false, job: null, warning: "File Expert table is unavailable or has no readable records." };
  const jobs = result.data ?? [];
  const matched = jobs.find((job) =>
    (!order.vehicle_brand || String(job.brand ?? "").toLowerCase() === order.vehicle_brand.toLowerCase()) &&
    (!order.vehicle_model || String(job.model ?? "").toLowerCase() === order.vehicle_model.toLowerCase())
  ) ?? jobs[0] ?? null;
  return {
    linked: Boolean(matched),
    job: matched as Record<string, unknown> | null,
    warning: matched ? null : "No direct File Expert job is linked to this request.",
  };
}

async function fetchAiEvidence(requestId: string) {
  const admin = getSupabaseAdmin();
  const samplesResult = await admin
    .from("ai_training_samples")
    .select("id,request_id,ecu_family,ecu_type,sw_number,hw_number,requested_service_labels,performed_service_labels,learning_use_status,human_verification_status,data_quality_score,quality_rating,safety_rating,outcome,created_at")
    .eq("request_id", requestId)
    .order("created_at", { ascending: false });
  if (samplesResult.error) {
    return {
      trainingSamples: [],
      similarity: { count: 0, maxScore: null },
      clusters: [],
      warnings: ["AI training tables are unavailable or no evidence exists for this request."],
    };
  }
  const samples = (samplesResult.data ?? []) as Array<Record<string, unknown>>;
  const sampleIds = samples.map((sample) => String(sample.id));
  const warnings: string[] = [];
  if (samples.some((sample) => sample.learning_use_status !== "approved_for_learning" || sample.human_verification_status !== "confirmed" || Number(sample.data_quality_score ?? 0) < 60)) {
    warnings.push("Some linked samples are not trusted evidence because approval, confirmation or quality gates are incomplete.");
  }

  let similarity = { count: 0, maxScore: null as number | null };
  if (sampleIds.length > 0) {
    const similarityResult = await admin
      .from("ai_similarity_results")
      .select("overall_similarity_score")
      .eq("source_type", "training_sample")
      .in("source_id", sampleIds)
      .order("overall_similarity_score", { ascending: false })
      .limit(50);
    if (!similarityResult.error) {
      const scores = (similarityResult.data ?? []).map((row) => Number(row.overall_similarity_score)).filter(Number.isFinite);
      similarity = { count: scores.length, maxScore: scores[0] ?? null };
    }
  }

  let clusters: Array<Record<string, unknown>> = [];
  if (sampleIds.length > 0) {
    const clusterResult = await admin
      .from("ai_cluster_members")
      .select("membership_score,is_outlier,cluster:ai_pattern_clusters(id,ecu_family,ecu_type,feature_type,cluster_status,cluster_confidence)")
      .in("training_sample_id", sampleIds)
      .limit(50);
    if (!clusterResult.error) clusters = (clusterResult.data ?? []) as Array<Record<string, unknown>>;
  }

  return { trainingSamples: samples, similarity, clusters, warnings };
}

async function fetchVehicleDbSummary(order: OrderRow) {
  const admin = getSupabaseAdmin();
  if (!order.vehicle_engine) {
    return { found: false, vehicleId: null, vehicleKey: null, warning: "Request has no engine label to match against Vehicle DB.", serviceCapabilityWarnings: [] };
  }
  const result = await admin
    .from("vehicle_engines")
    .select(`
      id, vehicle_key, engine_name, active, published,
      generation:vehicle_generations(id, name,
        model:vehicle_models(id, name,
          brand:vehicle_brands(id, name)
        )
      ),
      service_capabilities:vehicle_service_capabilities(service_key, available, customer_safe_note),
      ecu_variants:vehicle_ecu_variants(ecu_family, ecu_type, ecu_notes, protection_notes, unlock_notes, active, published)
    `)
    .ilike("engine_name", order.vehicle_engine)
    .limit(50);
  if (result.error) {
    return { found: false, vehicleId: null, vehicleKey: null, warning: "Vehicle DB is unavailable or not migrated yet.", serviceCapabilityWarnings: [] };
  }
  const rows = (result.data ?? []) as Array<Record<string, unknown>>;
  const matched = rows.find((row) => {
    const generation = row.generation as { name?: string; model?: { name?: string; brand?: { name?: string } } } | null;
    const model = generation?.model;
    const brand = model?.brand;
    return (!order.vehicle_brand || brand?.name?.toLowerCase() === order.vehicle_brand.toLowerCase()) &&
      (!order.vehicle_model || model?.name?.toLowerCase() === order.vehicle_model.toLowerCase());
  }) ?? rows[0] ?? null;
  if (!matched) {
    return { found: false, vehicleId: null, vehicleKey: null, warning: "No matching Vehicle DB record was found.", serviceCapabilityWarnings: [] };
  }
  const capabilities = Array.isArray(matched.service_capabilities) ? matched.service_capabilities as Array<{ service_key?: string; available?: boolean }> : [];
  const supported = new Set(capabilities.filter((item) => item.available).map((item) => item.service_key));
  const warnings = splitServiceLabels(order.service_type)
    .map((label) => label.toLowerCase().replaceAll(" ", "_").replaceAll("/", "_"))
    .filter((label) => supported.size > 0 && !supported.has(label))
    .slice(0, 5)
    .map((label) => `Vehicle DB has no confirmed support flag for ${label}.`);
  return {
    found: true,
    vehicleId: String(matched.id),
    vehicleKey: typeof matched.vehicle_key === "string" ? matched.vehicle_key : null,
    warning: null,
    serviceCapabilityWarnings: warnings,
  };
}

async function fetchPaymentSummary(order: OrderRow, profile: ProfileSummary | null) {
  if (!order.customer_id) {
    return {
      creditTransactions: [],
      paymentRecords: [],
      summary: { creditsRequired: Number(order.credits_required ?? 0), customerBalance: null, paymentStatus: "unknown" },
    };
  }
  const admin = getSupabaseAdmin();
  const [ledger, records] = await Promise.all([
    admin.from("credit_transactions").select("id,type,source_type,credits_delta,balance_after,description,amount_total,currency,created_at").eq("user_id", order.customer_id).order("created_at", { ascending: false }).limit(20),
    admin.from("payment_records").select("id,provider,status,payment_type,credits,amount_total,currency,created_at").eq("user_id", order.customer_id).order("created_at", { ascending: false }).limit(20),
  ]);
  const paymentRecords = records.error ? [] : ((records.data ?? []) as Array<Record<string, unknown>>);
  const succeeded = paymentRecords.some((record) => record.status === "succeeded");
  const pending = paymentRecords.some((record) => record.status === "pending");
  return {
    creditTransactions: ledger.error ? [] : ((ledger.data ?? []) as Array<Record<string, unknown>>),
    paymentRecords,
    summary: {
      creditsRequired: Number(order.credits_required ?? 0),
      customerBalance: numberOrNull(profile?.credit_balance),
      paymentStatus: succeeded ? "paid" : pending ? "pending" : "not_linked",
    },
  };
}

function buildQualityChecklist(order: OrderRow, workOrder: WorkOrderRow, profile: ProfileSummary | null) {
  return [
    { key: "file", label: "Original file uploaded", ok: Boolean(order.original_file_path), detail: order.uploaded_file_name || "No original file path." },
    { key: "vehicle", label: "Vehicle identified", ok: Boolean(order.vehicle_brand && order.vehicle_model && order.vehicle_engine), detail: [order.vehicle_brand, order.vehicle_model, order.vehicle_engine].filter(Boolean).join(" ") || "Vehicle data incomplete." },
    { key: "ecu", label: "ECU/TCU identified", ok: Boolean(order.ecu || order.gearbox || order.hw_sw), detail: order.ecu || order.gearbox || order.hw_sw || "Missing ECU/TCU identifiers." },
    { key: "service", label: "Services selected", ok: splitServiceLabels(order.service_type).length > 0, detail: order.service_type || "No service label." },
    { key: "customer", label: "Customer profile available", ok: Boolean(profile), detail: profile?.customer_id || profile?.email || "No linked profile." },
    { key: "payment", label: "Payment review status", ok: ["paid", "not_checked"].includes(workOrder.payment_review_status), detail: workOrder.payment_review_status },
    { key: "quality", label: "Quality check", ok: workOrder.quality_check_status === "passed", detail: workOrder.quality_check_status },
    { key: "delivery", label: "Delivery state", ok: ["delivered", "ready"].includes(workOrder.delivery_status), detail: workOrder.delivery_status },
  ];
}

export async function getAdminRequestDetail(requestId: string): Promise<AdminRequestDetail> {
  const admin = getSupabaseAdmin();
  const orderResult = await admin.from("orders").select("*").eq("id", requestId).single();
  if (orderResult.error || !orderResult.data) throw new Error(orderResult.error?.message || "Request not found.");
  const order = orderResult.data as unknown as OrderRow;
  const [profileMap, workOrders, trainingCounts] = await Promise.all([
    fetchProfiles(order.customer_id ? [order.customer_id] : []),
    fetchWorkOrders([requestId]),
    fetchTrainingCounts([requestId]),
  ]);
  const profile = order.customer_id ? profileMap.get(order.customer_id) ?? null : null;
  const workOrder = workOrders.rows.get(requestId) ?? fallbackWorkOrder(order);
  const [rows, fileExpert, aiEvidence, vehicleDb, payment] = await Promise.all([
    fetchWorkOrderDetailRows(requestId),
    fetchFileExpertSummary(order),
    fetchAiEvidence(requestId),
    fetchVehicleDbSummary(order),
    fetchPaymentSummary(order, profile),
  ]);
  return {
    ...buildListItem(order, profile, workOrder, trainingCounts.get(requestId) ?? 0),
    migrationReady: workOrders.migrationReady && rows.migrationReady,
    requestMessages: rows.messages,
    notes: rows.notes,
    events: rows.events,
    fileExpert,
    aiEvidence,
    vehicleDb,
    payment,
    qualityChecklist: buildQualityChecklist(order, workOrder, profile),
  };
}

export async function recordWorkOrderEvent(input: {
  requestId: string;
  workOrderId?: string | null;
  actorUserId?: string | null;
  eventType: string;
  oldValue?: unknown;
  newValue?: unknown;
  customerVisible?: boolean;
  message?: string | null;
  metadata?: Record<string, unknown>;
  mode?: "strict" | "best_effort";
}) {
  const admin = getSupabaseAdmin();
  const result = await admin.from("request_work_order_events").insert({
    request_id: input.requestId,
    work_order_id: input.workOrderId ?? null,
    actor_user_id: input.actorUserId ?? null,
    event_type: input.eventType,
    old_value: input.oldValue ?? null,
    new_value: input.newValue ?? null,
    customer_visible: Boolean(input.customerVisible),
    message: input.message ?? null,
    metadata: input.metadata ?? {},
  });
  if (result.error) {
    if (input.mode === "best_effort" || isWorkOrderMigrationMissing(result.error)) {
      return { ok: false as const, error: result.error.message };
    }
    throw new Error(`Work-order event could not be recorded: ${result.error.message}`);
  }
  return { ok: true as const };
}

async function ensureWorkOrder(requestId: string, actorUserId: string) {
  const admin = getSupabaseAdmin();
  const existing = await admin.from("request_work_orders").select("*").eq("request_id", requestId).maybeSingle();
  if (existing.error && !isWorkOrderMigrationMissing(existing.error)) throw new Error(existing.error.message);
  if (existing.data) return normalizeWorkOrder(existing.data as Record<string, unknown>);
  if (isWorkOrderMigrationMissing(existing.error)) throw new Error("Work Order migration is required.");

  const created = await admin.from("request_work_orders").insert({
    request_id: requestId,
    last_admin_activity_at: nowIso(),
  }).select("*").single();
  if (created.error || !created.data) throw new Error(created.error?.message || "Work order could not be created.");
  const workOrder = normalizeWorkOrder(created.data as Record<string, unknown>);
  await recordWorkOrderEvent({
    requestId,
    workOrderId: workOrder?.id,
    actorUserId,
    eventType: "work_order_created",
    message: "Admin work order created.",
  });
  return workOrder;
}

export type WorkOrderPatch = Partial<Pick<WorkOrderRow,
  "priority" | "admin_status" | "tuner_status" | "payment_review_status" |
  "delivery_status" | "assigned_admin_id" | "assigned_tuner_id" |
  "internal_notes" | "customer_visible_notes" | "estimated_turnaround_minutes" |
  "eta_note" | "risk_flags" | "quality_check_status" | "quality_check_json" |
  "final_file_status" | "delivery_method"
>>;

export async function updateAdminWorkOrder(requestId: string, actorUserId: string, patch: WorkOrderPatch) {
  const admin = getSupabaseAdmin();
  const current = await ensureWorkOrder(requestId, actorUserId);
  if (!current) throw new Error("Work order could not be loaded.");
  const payload: Record<string, unknown> = { last_admin_activity_at: nowIso() };
  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined) payload[key] = value;
  }
  const updated = await admin.from("request_work_orders").update(payload).eq("request_id", requestId).select("*").single();
  if (updated.error || !updated.data) throw new Error(updated.error?.message || "Work order could not be updated.");
  const next = normalizeWorkOrder(updated.data as Record<string, unknown>);
  await recordWorkOrderEvent({
    requestId,
    workOrderId: next?.id,
    actorUserId,
    eventType: "work_order_updated",
    oldValue: current,
    newValue: patch,
    message: "Work order fields updated.",
  });
  return next;
}

export async function addAdminWorkOrderNote(input: {
  requestId: string;
  actorUserId: string;
  noteType: WorkOrderNoteType;
  body: string;
  pinned?: boolean;
}) {
  const admin = getSupabaseAdmin();
  const workOrder = await ensureWorkOrder(input.requestId, input.actorUserId);
  if (!workOrder) throw new Error("Work order could not be loaded.");
  const customerVisible = input.noteType === "customer_visible";
  const note = await admin.from("request_internal_notes").insert({
    request_id: input.requestId,
    work_order_id: workOrder.id,
    author_user_id: input.actorUserId,
    note_type: input.noteType,
    body: input.body,
    pinned: Boolean(input.pinned || input.noteType === "pinned"),
    customer_visible: customerVisible,
  }).select("*").single();
  if (note.error || !note.data) throw new Error(note.error?.message || "Note could not be saved.");

  if (customerVisible) {
    const messageResult = await admin.from("request_messages").insert({
      request_id: input.requestId,
      sender_id: input.actorUserId,
      sender_role: "admin",
      message: input.body,
      visibility_status: "visible",
    }).select("id").single();
    if (messageResult.error || !messageResult.data) {
      throw new Error(`Customer-visible note could not be copied to request messages: ${messageResult.error?.message ?? "No message id was returned."}`);
    }
    await admin
      .from("request_internal_notes")
      .update({ linked_request_message_id: messageResult.data.id })
      .eq("id", note.data.id);
  }

  await recordWorkOrderEvent({
    requestId: input.requestId,
    workOrderId: workOrder.id,
    actorUserId: input.actorUserId,
    eventType: customerVisible ? "customer_visible_note_added" : "internal_note_added",
    customerVisible,
    message: customerVisible ? "Customer-visible note added." : "Internal note added.",
    metadata: { note_type: input.noteType, note_id: note.data.id },
  });
  return note.data;
}

export async function updateRequestMessageVisibility(input: {
  requestId: string;
  messageId: string;
  actorUserId: string;
  action: "hide" | "restore";
  reason?: string | null;
}) {
  const admin = getSupabaseAdmin();
  const currentResult = await admin
    .from("request_messages")
    .select("id,request_id,sender_id,sender_role,message,created_at,visibility_status,hidden_at,hidden_by,hidden_reason,restored_at,restored_by")
    .eq("id", input.messageId)
    .eq("request_id", input.requestId)
    .maybeSingle();

  if (currentResult.error) {
    if (isWorkOrderMigrationMissing(currentResult.error)) {
      throw new Error("Request message visibility migration is required.");
    }
    throw new Error(currentResult.error.message);
  }
  if (!currentResult.data) throw new Error("Request message not found.");

  const current = currentResult.data as RequestMessageVisibilityRow;
  const oldVisibility = normalizeRequestMessageVisibility(current.visibility_status);
  const nextVisibility: RequestMessageVisibilityStatus = input.action === "hide" ? "hidden" : "visible";
  const timestamp = nowIso();
  const reason = input.reason?.trim() || null;
  const patch = input.action === "hide"
    ? {
      visibility_status: nextVisibility,
      hidden_at: timestamp,
      hidden_by: input.actorUserId,
      hidden_reason: reason,
      restored_at: null,
      restored_by: null,
    }
    : {
      visibility_status: nextVisibility,
      restored_at: timestamp,
      restored_by: input.actorUserId,
    };

  const updatedResult = await admin
    .from("request_messages")
    .update(patch)
    .eq("id", input.messageId)
    .eq("request_id", input.requestId)
    .select("id,request_id,sender_id,sender_role,message,created_at,visibility_status,hidden_at,hidden_by,hidden_reason,restored_at,restored_by")
    .single();

  if (updatedResult.error || !updatedResult.data) {
    throw new Error(updatedResult.error?.message || "Request message visibility could not be updated.");
  }

  const notePatch = input.action === "hide"
    ? {
      visibility_status: nextVisibility,
      hidden_at: timestamp,
      hidden_by: input.actorUserId,
      hidden_reason: reason,
      restored_at: null,
      restored_by: null,
    }
    : {
      visibility_status: nextVisibility,
      restored_at: timestamp,
      restored_by: input.actorUserId,
    };

  await admin
    .from("request_internal_notes")
    .update(notePatch)
    .eq("linked_request_message_id", input.messageId);

  await admin
    .from("request_internal_notes")
    .update(notePatch)
    .eq("request_id", input.requestId)
    .eq("customer_visible", true)
    .eq("body", current.message)
    .is("linked_request_message_id", null);

  await recordWorkOrderEvent({
    requestId: input.requestId,
    actorUserId: input.actorUserId,
    eventType: input.action === "hide" ? "message_hidden_from_customer" : "message_restored_to_customer",
    oldValue: { message_id: input.messageId, visibility_status: oldVisibility },
    newValue: { message_id: input.messageId, visibility_status: nextVisibility, reason },
    customerVisible: false,
    message: input.action === "hide"
      ? "Customer-visible message hidden from customer."
      : "Customer-visible message restored to customer.",
    metadata: { message_id: input.messageId, reason },
  });

  return projectAdminRequestMessage(updatedResult.data as RequestMessageVisibilityRow);
}
