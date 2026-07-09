const forbiddenCustomerKeys = [
  "internal_notes",
  "internalNotes",
  "tuner_notes",
  "tunerNotes",
  "risk_flags",
  "riskFlags",
  "admin_technical_notes",
  "adminTechnicalNotes",
  "source_reference",
  "sourceReference",
  "storage_path",
  "storagePath",
  "file_path",
  "filePath",
  "ori_file_path",
  "oriFilePath",
  "mod_file_path",
  "modFilePath",
  "provider",
  "source_type",
  "sourceType",
  "sample_id",
  "sampleId",
  "training_sample_id",
  "trainingSampleId",
  "raw_hex",
  "rawHex",
  "hex_preview",
  "hexPreview",
  "private_offsets",
  "privateOffsets",
] as const;

export type CustomerSafeWorkOrderEvent = {
  id: string;
  eventType: string;
  message: string | null;
  createdAt: string;
};

export function removeCustomerForbiddenKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(removeCustomerForbiddenKeys);
  if (!value || typeof value !== "object") return value;

  const result: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if ((forbiddenCustomerKeys as readonly string[]).includes(key)) continue;
    result[key] = removeCustomerForbiddenKeys(entry);
  }
  return result;
}

export function hasForbiddenCustomerKey(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasForbiddenCustomerKey);
  if (!value || typeof value !== "object") return false;
  return Object.entries(value as Record<string, unknown>).some(([key, entry]) =>
    (forbiddenCustomerKeys as readonly string[]).includes(key) || hasForbiddenCustomerKey(entry)
  );
}

export function sanitizeCustomerVisibleEvents(
  events: Array<{
    id: string;
    event_type: string;
    message: string | null;
    customer_visible: boolean;
    created_at: string;
    metadata?: unknown;
  }>
): CustomerSafeWorkOrderEvent[] {
  return events
    .filter((event) => event.customer_visible)
    .map((event) => ({
      id: event.id,
      eventType: event.event_type,
      message: typeof event.message === "string" ? event.message : null,
      createdAt: event.created_at,
    }));
}

export function sanitizeCustomerAiEvidence(value: unknown) {
  return removeCustomerForbiddenKeys(value);
}

export function safePaymentSummaryOnly(value: {
  creditsRequired?: number | string | null;
  creditTransactions?: unknown[];
  paymentRecords?: unknown[];
}) {
  return {
    creditsRequired: Number(value.creditsRequired ?? 0),
    creditTransactionCount: Array.isArray(value.creditTransactions) ? value.creditTransactions.length : 0,
    paymentRecordCount: Array.isArray(value.paymentRecords) ? value.paymentRecords.length : 0,
  };
}
