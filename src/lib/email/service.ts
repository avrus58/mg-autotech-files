import { Resend } from "resend";
import { createEmailEventLog, updateEmailEventLog } from "@/lib/email/logging";
import { renderTransactionalEmailTemplate } from "@/lib/email/templates";
import type {
  SendTransactionalEmailInput,
  SendTransactionalEmailResult,
} from "@/lib/email/types";

const fromEmail =
  process.env.EMAIL_FROM || "MG AutoTech <noreply@file.mgautotech.de>";

let resendClient: Resend | null = null;

function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY is missing");
  if (!resendClient) resendClient = new Resend(apiKey);
  return resendClient;
}

export function isTransactionalEmailDryRun() {
  return process.env.EMAIL_DRY_RUN !== "false" || process.env.NODE_ENV === "test";
}

export function getTransactionalEmailProviderStatus() {
  const dryRun = isTransactionalEmailDryRun();
  const configured = Boolean(process.env.RESEND_API_KEY);
  return {
    provider: "resend",
    configured,
    dryRun,
    sendingEnabled: configured && !dryRun,
    fromEmail,
  };
}

export function isValidRecipientEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) && value.length <= 250;
}

export async function sendTransactionalEmail(
  input: SendTransactionalEmailInput
): Promise<SendTransactionalEmailResult> {
  const recipient = input.to.trim().toLowerCase();
  if (!isValidRecipientEmail(recipient)) {
    return {
      ok: false,
      status: "skipped",
      provider: "disabled",
      skippedReason: "invalid_recipient",
      idempotencyKey: input.idempotencyKey,
    };
  }

  const log = await createEmailEventLog({
    eventType: input.eventType,
    recipientEmail: recipient,
    recipientUserId: input.recipientUserId,
    relatedOrderId: input.relatedOrderId,
    relatedRequestId: input.relatedRequestId,
    idempotencyKey: input.idempotencyKey,
    status: "pending",
    provider: isTransactionalEmailDryRun() ? "dry_run" : "resend",
    metadata: {
      ...input.metadata,
      template: input.eventType,
      has_request: Boolean(input.relatedRequestId || input.relatedOrderId),
    },
  });

  if (log.ok && log.duplicate) {
    return {
      ok: true,
      status: "skipped",
      provider: "disabled",
      skippedReason: "duplicate_idempotency_key",
      idempotencyKey: input.idempotencyKey,
    };
  }

  if (!log.ok && !isTransactionalEmailDryRun()) {
    return {
      ok: true,
      status: "skipped",
      provider: "disabled",
      skippedReason: "event_log_unavailable",
      idempotencyKey: input.idempotencyKey,
    };
  }

  const rendered = renderTransactionalEmailTemplate(
    input.eventType,
    input.context,
    input.language ?? "de"
  );

  if (isTransactionalEmailDryRun()) {
    await updateEmailEventLog(log.id, {
      status: "skipped",
      errorMessage: "EMAIL_DRY_RUN enabled",
      sentAt: new Date().toISOString(),
    });
    return {
      ok: true,
      status: "skipped",
      provider: "dry_run",
      skippedReason: "dry_run",
      idempotencyKey: input.idempotencyKey,
    };
  }

  if (!process.env.RESEND_API_KEY) {
    await updateEmailEventLog(log.id, {
      status: "skipped",
      errorMessage: "RESEND_API_KEY missing",
    });
    return {
      ok: true,
      status: "skipped",
      provider: "disabled",
      skippedReason: "provider_not_configured",
      idempotencyKey: input.idempotencyKey,
    };
  }

  try {
    const result = await getResendClient().emails.send({
      from: fromEmail,
      to: recipient,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    });
    if (result.error) throw new Error(result.error.message);
    await updateEmailEventLog(log.id, {
      status: "sent",
      providerMessageId: result.data?.id ?? null,
      sentAt: new Date().toISOString(),
    });
    return {
      ok: true,
      status: "sent",
      provider: "resend",
      messageId: result.data?.id ?? null,
      idempotencyKey: input.idempotencyKey,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Transactional email failed";
    await updateEmailEventLog(log.id, {
      status: "failed",
      errorMessage: message,
    });
    return {
      ok: false,
      status: "failed",
      provider: "resend",
      error: message,
      idempotencyKey: input.idempotencyKey,
    };
  }
}
