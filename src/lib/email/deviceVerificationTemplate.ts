import { emailLocaleCopy } from "@/lib/email/localeCopy";
import {
  detailTable,
  escapeHtml,
  htmlLayout,
  safeText,
  textBlock,
} from "@/lib/email/render";
import type {
  RenderedTransactionalEmail,
  TransactionalEmailContext,
  TransactionalEmailLanguage,
} from "@/lib/email/types";

function normalizeVerificationMinutes(value: number | null | undefined) {
  const minutes = Number(value ?? 10);
  return Number.isFinite(minutes) && minutes > 0 ? Math.trunc(minutes) : 10;
}

function formatVerificationDuration(
  language: TransactionalEmailLanguage,
  minutes: number,
) {
  return new Intl.NumberFormat(language, {
    style: "unit",
    unit: "minute",
    unitDisplay: "long",
  }).format(minutes);
}

export function renderDeviceVerificationEmailTemplate(
  context: TransactionalEmailContext,
  language: TransactionalEmailLanguage,
): RenderedTransactionalEmail {
  const localeCopy = emailLocaleCopy[language];
  const copy = localeCopy.deviceVerification;
  const code = safeText(context.verificationCode, "------");
  const minutes = normalizeVerificationMinutes(context.verificationMinutes);
  const duration = formatVerificationDuration(language, minutes);
  const securityFooter = `${copy.neverShare} ${copy.supportNeverAsks}`;

  const html = htmlLayout({
    language,
    preheader: copy.preheader,
    title: copy.title,
    intro: copy.intro,
    content: `${detailTable([
      [copy.securityCodeLabel, code],
      [copy.deviceLabel, context.deviceLabel],
      [copy.validForLabel, duration],
    ])}<p style="margin:18px 0 0;color:#3f3f46;line-height:1.65;">${escapeHtml(copy.unexpectedAction)}</p>`,
    footerNote: securityFooter,
  });

  const text = textBlock([
    "MG AutoTech",
    copy.title,
    "",
    copy.intro,
    "",
    `${copy.securityCodeLabel}: ${code}`,
    context.deviceLabel
      ? `${copy.deviceLabel}: ${safeText(context.deviceLabel)}`
      : null,
    `${copy.validForLabel}: ${duration}`,
    "",
    copy.unexpectedAction,
    copy.neverShare,
    copy.supportNeverAsks,
    "",
    context.supportEmail
      ? `${localeCopy.details.support}: ${safeText(context.supportEmail)}`
      : null,
  ]);

  return {
    subject: copy.subject,
    html,
    text,
  };
}
