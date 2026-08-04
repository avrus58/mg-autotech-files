import { NextResponse } from "next/server";
import { Resend } from "resend";
import {
  normalizeResendDeliveryEvent,
  persistProviderDeliveryEvent,
} from "@/lib/email/deliveryReliability";

const maxWebhookBytes = 64 * 1024;

function noStoreJson(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: Request) {
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return noStoreJson({ error: "Webhook is not configured." }, 503);
  }

  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (declaredLength > maxWebhookBytes) {
    return noStoreJson({ error: "Webhook payload is too large." }, 413);
  }

  const providerEventId = request.headers.get("svix-id") || "";
  const timestamp = request.headers.get("svix-timestamp") || "";
  const signature = request.headers.get("svix-signature") || "";
  if (!providerEventId || !timestamp || !signature) {
    return noStoreJson({ error: "Webhook signature is missing." }, 400);
  }

  const payload = await request.text();
  if (Buffer.byteLength(payload, "utf8") > maxWebhookBytes) {
    return noStoreJson({ error: "Webhook payload is too large." }, 413);
  }

  let verifiedEvent;
  try {
    verifiedEvent = new Resend().webhooks.verify({
      payload,
      headers: {
        id: providerEventId,
        timestamp,
        signature,
      },
      webhookSecret,
    });
  } catch {
    return noStoreJson({ error: "Webhook signature is invalid." }, 400);
  }

  const event = normalizeResendDeliveryEvent({
    providerEventId,
    payload,
    event: verifiedEvent,
  });
  if (!event) {
    return noStoreJson({ accepted: true, tracked: false }, 202);
  }

  try {
    const result = await persistProviderDeliveryEvent(event);
    if (!result.ok) {
      return noStoreJson({ error: "Webhook event could not be stored." }, 503);
    }
    return noStoreJson({ accepted: true, duplicate: result.duplicate });
  } catch {
    return noStoreJson({ error: "Webhook event could not be stored." }, 503);
  }
}
