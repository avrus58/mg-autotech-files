import type { TransactionalEmailContext } from "@/lib/email/types";

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function safeText(value: unknown, fallback = "-") {
  if (typeof value !== "string" && typeof value !== "number") return fallback;
  const text = normalizeWhitespace(String(value));
  return text || fallback;
}

export function formatRequestReference(value?: string | null) {
  const text = safeText(value, "");
  if (!text) return "-";
  if (/^\d+$/.test(text)) return `#${text}`;
  return `#${text.slice(0, 8).toUpperCase()}`;
}

export function getSiteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL || "https://file.mgautotech.de").replace(/\/+$/, "");
}

export function getSupportEmail() {
  return process.env.SUPPORT_EMAIL || process.env.EMAIL_TO || "info@mgautotech.de";
}

export function getAdminNotificationEmail() {
  return process.env.ADMIN_NOTIFICATION_EMAIL || process.env.EMAIL_TO || "info@mgautotech.de";
}

export function getDefaultEmailContext(context: TransactionalEmailContext): TransactionalEmailContext {
  const siteUrl = getSiteUrl();
  return {
    dashboardUrl: `${siteUrl}/dashboard`,
    adminUrl: `${siteUrl}/admin`,
    supportEmail: getSupportEmail(),
    ...context,
    requestNumber: context.requestNumber || formatRequestReference(context.requestId),
  };
}

export function htmlLayout(input: {
  preheader: string;
  title: string;
  intro: string;
  content: string;
  ctaLabel?: string;
  ctaUrl?: string | null;
  footerNote?: string;
}) {
  const cta = input.ctaUrl && input.ctaLabel
    ? `<a href="${escapeHtml(input.ctaUrl)}" style="display:inline-block;background:#b1121b;color:#ffffff;text-decoration:none;padding:13px 18px;border-radius:10px;font-weight:800;margin-top:18px;">${escapeHtml(input.ctaLabel)}</a>`
    : "";
  return `<!doctype html>
<html>
  <body style="margin:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(input.preheader)}</div>
    <div style="padding:28px 14px;">
      <div style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #e4e4e7;border-radius:16px;overflow:hidden;">
        <div style="background:#080808;color:#ffffff;padding:22px 24px;">
          <div style="font-size:12px;font-weight:900;letter-spacing:0.16em;text-transform:uppercase;color:#ff4b5c;">MG AutoTech</div>
          <div style="margin-top:6px;font-size:20px;font-weight:900;">File-Service Plattform</div>
        </div>
        <div style="padding:26px 24px;">
          <h1 style="margin:0 0 12px;font-size:24px;line-height:1.25;color:#111827;">${escapeHtml(input.title)}</h1>
          <p style="margin:0 0 20px;color:#3f3f46;line-height:1.65;">${escapeHtml(input.intro)}</p>
          ${input.content}
          ${cta}
        </div>
        <div style="border-top:1px solid #e4e4e7;background:#fafafa;padding:18px 24px;color:#71717a;font-size:12px;line-height:1.6;">
          ${escapeHtml(input.footerNote || "Diese E-Mail enthält nur kundenrelevante Informationen. Interne Bearbeitungsnotizen und technische Privatdaten werden nicht per E-Mail versendet.")}
          <br />Kontakt: <a href="mailto:${escapeHtml(getSupportEmail())}" style="color:#b1121b;text-decoration:none;">${escapeHtml(getSupportEmail())}</a>
        </div>
      </div>
    </div>
  </body>
</html>`;
}

export function detailTable(rows: Array<[string, unknown]>) {
  const visibleRows = rows.filter(([, value]) => safeText(value, "") !== "");
  if (visibleRows.length === 0) return "";
  return `<table style="width:100%;border-collapse:collapse;background:#fafafa;border:1px solid #e4e4e7;border-radius:12px;overflow:hidden;margin:18px 0;">
    ${visibleRows.map(([label, value]) => `<tr>
      <td style="width:38%;padding:12px 14px;border-bottom:1px solid #e4e4e7;color:#71717a;font-size:13px;">${escapeHtml(label)}</td>
      <td style="padding:12px 14px;border-bottom:1px solid #e4e4e7;color:#18181b;font-size:13px;font-weight:700;">${escapeHtml(safeText(value))}</td>
    </tr>`).join("")}
  </table>`;
}

export function textBlock(lines: Array<string | null | undefined>) {
  return lines.map((line) => safeText(line, "")).filter(Boolean).join("\n");
}
