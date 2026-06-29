import { createHmac, timingSafeEqual } from "node:crypto";
import type { WidgetLanguage } from "@/lib/widget/types";

type WidgetSessionPayload = {
  clientId: string;
  publicKey: string;
  domain: string;
  origin: string;
  language: WidgetLanguage;
  exp: number;
};

function sessionSecret() {
  const secret = process.env.WIDGET_SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("WIDGET_SESSION_SECRET is missing.");
  return secret;
}

function sign(value: string) {
  return createHmac("sha256", sessionSecret()).update(value).digest("base64url");
}

export function createWidgetSession(payload: Omit<WidgetSessionPayload, "exp">, ttlSeconds = 1800) {
  const encoded = Buffer.from(JSON.stringify({
    ...payload,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  })).toString("base64url");
  return `${encoded}.${sign(encoded)}`;
}

export function verifyWidgetSession(token: string): WidgetSessionPayload | null {
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;
  const expected = sign(encoded);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as WidgetSessionPayload;
    if (!payload.clientId || !payload.publicKey || !payload.domain || payload.exp <= Date.now() / 1000) return null;
    return payload;
  } catch {
    return null;
  }
}

