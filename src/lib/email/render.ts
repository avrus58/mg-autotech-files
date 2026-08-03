import type {
  TransactionalEmailContext,
  TransactionalEmailLanguage,
} from "@/lib/email/types";

const emailLayoutCopy: Record<
  TransactionalEmailLanguage,
  {
    portal: string;
    update: string;
    secureNotice: string;
    defaultFooter: string;
    contact: string;
  }
> = {
  de: {
    portal: "Kundenportal",
    update: "MG AutoTech Update",
    secureNotice:
      "Dateien und vertrauliche technische Daten sind aus Sicherheitsgründen ausschließlich im angemeldeten MG AutoTech Kundenportal verfügbar.",
    defaultFooter:
      "Diese E-Mail enthält nur kundenrelevante Informationen. Interne Bearbeitungsnotizen und technische Privatdaten werden nicht per E-Mail versendet.",
    contact: "Kontakt",
  },
  en: {
    portal: "Customer Portal",
    update: "MG AutoTech Update",
    secureNotice:
      "Files and confidential technical data are available only inside the signed-in MG AutoTech customer portal.",
    defaultFooter:
      "This email contains customer-relevant information only. Internal work notes and private technical data are never sent by email.",
    contact: "Contact",
  },
  tr: {
    portal: "Müşteri Paneli",
    update: "MG AutoTech Güncellemesi",
    secureNotice:
      "Dosyalar ve gizli teknik veriler yalnızca giriş yapılmış MG AutoTech müşteri panelinde sunulur.",
    defaultFooter:
      "Bu e-posta yalnızca müşteriye açık bilgiler içerir. Dahili işlem notları ve özel teknik veriler e-posta ile gönderilmez.",
    contact: "İletişim",
  },
};

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

export function safeEmailUrl(value?: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function htmlLayout(input: {
  preheader: string;
  title: string;
  intro: string;
  content: string;
  language?: TransactionalEmailLanguage;
  ctaLabel?: string;
  ctaUrl?: string | null;
  footerNote?: string;
}) {
  const language = input.language ?? "en";
  const copy = emailLayoutCopy[language];
  const ctaUrl = safeEmailUrl(input.ctaUrl);
  const cta = ctaUrl && input.ctaLabel
    ? `<table role="presentation" cellspacing="0" cellpadding="0" style="margin-top:22px;"><tr><td style="background:#c1121f;border-radius:8px;"><a href="${escapeHtml(ctaUrl)}" style="display:inline-block;color:#ffffff;text-decoration:none;padding:14px 20px;font-size:14px;font-weight:800;">${escapeHtml(input.ctaLabel)}</a></td></tr></table>`
    : "";
  return `<!doctype html>
<html lang="${language}">
  <body style="margin:0;background:#eceef1;font-family:Arial,Helvetica,sans-serif;color:#18181b;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(input.preheader)}</div>
    <div style="padding:32px 14px;">
      <div style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #dfe2e7;border-radius:12px;overflow:hidden;box-shadow:0 16px 45px rgba(15,23,42,0.08);">
        <div style="height:4px;background:#d11221;"></div>
        <div style="background:#08090b;color:#ffffff;padding:24px 26px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>
            <td style="vertical-align:middle;">
              <div style="font-size:18px;font-weight:900;letter-spacing:0.02em;">MG <span style="color:#ff3445;">AUTOTECH</span></div>
              <div style="margin-top:5px;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#a1a1aa;">Secure ECU / TCU File Service</div>
            </td>
            <td style="vertical-align:middle;text-align:right;">
              <span style="display:inline-block;border:1px solid #3f3f46;border-radius:999px;padding:7px 10px;font-size:10px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:#e4e4e7;">${escapeHtml(copy.portal)}</span>
            </td>
          </tr></table>
        </div>
        <div style="padding:30px 26px 32px;">
          <div style="margin-bottom:11px;font-size:11px;font-weight:900;letter-spacing:0.14em;text-transform:uppercase;color:#c1121f;">${escapeHtml(copy.update)}</div>
          <h1 style="margin:0 0 13px;font-size:26px;line-height:1.25;color:#101114;">${escapeHtml(input.title)}</h1>
          <p style="margin:0 0 22px;color:#52525b;font-size:15px;line-height:1.7;">${escapeHtml(input.intro)}</p>
          ${input.content}
          ${cta}
          <div style="margin-top:25px;border-left:3px solid #d11221;background:#fafafa;padding:13px 15px;color:#52525b;font-size:12px;line-height:1.65;">${escapeHtml(copy.secureNotice)}</div>
        </div>
        <div style="border-top:1px solid #e4e4e7;background:#f7f7f8;padding:19px 26px;color:#71717a;font-size:11px;line-height:1.7;">
          ${escapeHtml(input.footerNote || copy.defaultFooter)}
          <br />${escapeHtml(copy.contact)}: <a href="mailto:${escapeHtml(getSupportEmail())}" style="color:#b1121b;text-decoration:none;">${escapeHtml(getSupportEmail())}</a>
        </div>
      </div>
    </div>
  </body>
</html>`;
}

export function detailTable(rows: Array<[string, unknown]>) {
  const visibleRows = rows.filter(([, value]) => safeText(value, "") !== "");
  if (visibleRows.length === 0) return "";
  return `<table role="presentation" style="width:100%;border-collapse:collapse;background:#fafafa;border:1px solid #e4e4e7;margin:18px 0;">
    ${visibleRows.map(([label, value]) => `<tr>
      <td style="width:38%;padding:12px 14px;border-bottom:1px solid #e4e4e7;color:#71717a;font-size:13px;">${escapeHtml(label)}</td>
      <td style="padding:12px 14px;border-bottom:1px solid #e4e4e7;color:#18181b;font-size:13px;font-weight:700;">${escapeHtml(safeText(value))}</td>
    </tr>`).join("")}
  </table>`;
}

export function textBlock(lines: Array<string | null | undefined>) {
  return lines.map((line) => safeText(line, "")).filter(Boolean).join("\n");
}
