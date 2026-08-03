import { Resend } from "resend";
import { createHash } from "node:crypto";
import { createEmailEventLog, updateEmailEventLog } from "@/lib/email/logging";
import { defaultTransactionalEmailLanguage } from "@/lib/email/language";
import { renderTransactionalEmailTemplate } from "@/lib/email/templates";
import type {
  SendTransactionalEmailInput,
  SendTransactionalEmailResult,
} from "@/lib/email/types";

const fromEmail =
  process.env.EMAIL_FROM || "MG AutoTech <noreply@file.mgautotech.de>";

let resendClient: Resend | null = null;
const providerRetryDelays = [0, 300, 900] as const;

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

export function buildProviderEmailIdempotencyKey(value: string) {
  return `mg_${createHash("sha256").update(value).digest("hex")}`;
}

export function isRetryableEmailProviderError(error: unknown) {
  if (error instanceof TypeError) return true;
  if (!error || typeof error !== "object") return false;
  const candidate = error as { statusCode?: unknown; name?: unknown; message?: unknown };
  const statusCode = Number(candidate.statusCode ?? 0);
  const name = String(candidate.name ?? "").toLowerCase();
  const message = String(candidate.message ?? "").toLowerCase();

  return statusCode === 429 || statusCode >= 500 ||
    ["rate_limit_exceeded", "concurrent_idempotent_requests", "application_error", "internal_server_error"].includes(name) ||
    /rate limit|temporar|timeout|network|internal server|concurrent idempotent/.test(message);
}

function providerErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message.slice(0, 500);
  if (error && typeof error === "object" && "message" in error) {
    return String(error.message).slice(0, 500);
  }
  return "Transactional email failed";
}

function wait(delayMs: number) {
  return delayMs > 0
    ? new Promise<void>((resolve) => globalThis.setTimeout(resolve, delayMs))
    : Promise.resolve();
}

export async function sendTransactionalEmail(
  input: SendTransactionalEmailInput
): Promise<SendTransactionalEmailResult> {
  const recipient = input.to.trim().toLowerCase();
  const language = input.language ?? defaultTransactionalEmailLanguage;
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
      language,
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
    language
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
    const emailPayload = {
      from: fromEmail,
      to: recipient,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    };
    const providerIdempotencyKey = buildProviderEmailIdempotencyKey(input.idempotencyKey);
    let providerMessageId: string | null = null;
    let providerError: unknown = null;

    for (let attempt = 0; attempt < providerRetryDelays.length; attempt += 1) {
      await wait(providerRetryDelays[attempt]);
      try {
        const result = await getResendClient().emails.send(emailPayload, {
          idempotencyKey: providerIdempotencyKey,
        });
        if (!result.error) {
          providerMessageId = result.data?.id ?? null;
          providerError = null;
          break;
        }
        providerError = result.error;
      } catch (error) {
        providerError = error;
      }

      if (!isRetryableEmailProviderError(providerError)) break;
    }

    if (providerError) throw new Error(providerErrorMessage(providerError));
    await updateEmailEventLog(log.id, {
      status: "sent",
      providerMessageId,
      sentAt: new Date().toISOString(),
    });
    return {
      ok: true,
      status: "sent",
      provider: "resend",
      messageId: providerMessageId,
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
