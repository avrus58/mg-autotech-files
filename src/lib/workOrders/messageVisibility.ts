export const requestMessageVisibilityStatuses = ["visible", "hidden", "archived"] as const;
export type RequestMessageVisibilityStatus = (typeof requestMessageVisibilityStatuses)[number];

export type RequestMessageVisibilityRow = {
  id: string;
  request_id?: string | null;
  sender_id?: string | null;
  sender_role: string;
  message: string;
  created_at: string;
  visibility_status?: string | null;
  hidden_at?: string | null;
  hidden_by?: string | null;
  hidden_reason?: string | null;
  restored_at?: string | null;
  restored_by?: string | null;
};

export function normalizeRequestMessageVisibility(value: unknown): RequestMessageVisibilityStatus {
  return requestMessageVisibilityStatuses.includes(value as RequestMessageVisibilityStatus)
    ? value as RequestMessageVisibilityStatus
    : "visible";
}

export function isCustomerVisibleRequestMessage(row: Pick<RequestMessageVisibilityRow, "visibility_status">) {
  return normalizeRequestMessageVisibility(row.visibility_status) === "visible";
}

export function isHiddenFromCustomer(row: Pick<RequestMessageVisibilityRow, "visibility_status">) {
  return normalizeRequestMessageVisibility(row.visibility_status) !== "visible";
}

export function projectCustomerRequestMessage(row: RequestMessageVisibilityRow) {
  return {
    id: row.id,
    request_id: row.request_id,
    sender_id: row.sender_id,
    sender_role: row.sender_role,
    message: row.message,
    created_at: row.created_at,
  };
}

export function projectAdminRequestMessage(row: RequestMessageVisibilityRow) {
  const visibilityStatus = normalizeRequestMessageVisibility(row.visibility_status);
  return {
    id: row.id,
    request_id: row.request_id,
    sender_id: row.sender_id,
    sender_role: row.sender_role,
    message: row.message,
    created_at: row.created_at,
    visibility_status: visibilityStatus,
    hidden_at: row.hidden_at ?? null,
    hidden_by: row.hidden_by ?? null,
    hidden_reason: row.hidden_reason ?? null,
    restored_at: row.restored_at ?? null,
    restored_by: row.restored_by ?? null,
  };
}

export function filterCustomerVisibleRequestMessages(rows: RequestMessageVisibilityRow[]) {
  return rows.filter(isCustomerVisibleRequestMessage).map(projectCustomerRequestMessage);
}
