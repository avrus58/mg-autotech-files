// Fetch only the status leaf needed for localized order-status notifications.
// Other notification metadata can contain internal or customer-specific values
// and must not be exposed to the browser notification surfaces.
export const customerNotificationProjection =
  "id,user_id,order_id,type,title,body,status:metadata->>status,read_at,created_at" as const;
