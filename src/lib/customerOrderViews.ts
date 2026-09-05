export const customerOrderViewStatuses = {
  active: ["new_request", "file_check", "in_progress", "customer_info_needed", "revision"],
  pending: ["new_request", "file_check"],
  in_progress: ["in_progress"],
  needs_response: ["customer_info_needed"],
  completed: ["completed"],
  cancelled: ["cancelled"],
  all: [],
} as const;

export type CustomerOrderView = keyof typeof customerOrderViewStatuses;

export function isCustomerOrderView(value: string | null): value is CustomerOrderView {
  return value !== null && Object.hasOwn(customerOrderViewStatuses, value);
}
