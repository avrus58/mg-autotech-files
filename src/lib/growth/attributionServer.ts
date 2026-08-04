import { createHmac } from "node:crypto";
import { isGrowthVisitorId } from "@/lib/growth/attribution";

export function hashGrowthVisitorId(visitorId: string, secret: string) {
  if (!isGrowthVisitorId(visitorId)) throw new Error("Invalid growth visitor identifier.");
  if (secret.length < 16) throw new Error("Growth attribution HMAC secret is not configured.");
  return createHmac("sha256", secret).update(visitorId.toLowerCase()).digest("hex");
}
