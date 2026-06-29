import { randomBytes } from "node:crypto";

export function createWidgetPublicKey() {
  return `pk_mga_widget_${randomBytes(18).toString("base64url")}`;
}

