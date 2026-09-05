export type NotificationConnectionState = "connecting" | "connected" | "disconnected";

export function notificationConnectionState(status: string, online = true): NotificationConnectionState {
  if (!online) return "disconnected";
  if (status === "SUBSCRIBED") return "connected";
  if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") return "disconnected";
  return "connecting";
}
