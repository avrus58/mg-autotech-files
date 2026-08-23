import { createHmac, timingSafeEqual } from "node:crypto";
import type { WidgetLanguage } from "@/lib/widget/types";
import { getWidgetSessionSecret } from "@/lib/widget/security";

type WidgetSessionPayload = {
  clientId: string;
  publicKey: string;
  domain: string;
  origin: string;
  language: WidgetLanguage;
  exp: number;
};

function sign(value: string) {
  return createHmac("sha256", getWidgetSessionSecret()).update(value).digest("base64url");
}

export function createWidgetSession(payload: Omit<WidgetSessionPayload, "exp">, ttlSeconds = 1800) {
  const encoded = Buffer.from(JSON.stringify({
    ...payload,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  })).toString("base64url");
  return `${encoded}.${sign(encoded)}`;
}

export function verifyWidgetSession(token: string): WidgetSessionPayload | null {
  if (token.length < 80 || token.length > 2000) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [encoded, signature] = parts;
  if (
    !encoded ||
    !signature ||
    encoded.length > 1900 ||
    !/^[A-Za-z0-9_-]+$/.test(encoded) ||
    !/^[A-Za-z0-9_-]{43}$/.test(signature)
  ) return null;
  const expected = sign(encoded);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as WidgetSessionPayload;
    const now = Math.floor(Date.now() / 1000);
    if (
      !payload.clientId || payload.clientId.length > 100 ||
      !payload.publicKey || payload.publicKey.length > 200 ||
      !payload.domain || payload.domain.length > 253 ||
      !payload.origin || payload.origin.length > 500 ||
      !Number.isInteger(payload.exp) || payload.exp <= now || payload.exp > now + 3600
    ) return null;
    return payload;
  } catch {
    return null;
  }
}
