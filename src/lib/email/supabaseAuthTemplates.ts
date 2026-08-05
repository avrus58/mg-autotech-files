import { escapeHtml, htmlLayout } from "@/lib/email/render";
import type { TransactionalEmailLanguage } from "@/lib/email/types";
import { supportedTransactionalEmailLanguages } from "@/lib/email/language";
import { emailLocaleCopy } from "@/lib/email/localeCopy";
import {
  getExtendedAuthTemplateCopy,
  type AuthTemplateCopy,
} from "@/lib/email/authLocaleCopy";

type CoreAuthLanguage = "de" | "en" | "tr";

type LocalizedAuthCopy = {
  subject: string;
  title: string;
  intro: string;
  action?: string;
  footer: string;
};

type SupabaseAuthTemplateDefinition = {
  key: string;
  supabaseKey: string;
  label: string;
  category: "authentication" | "security";
  action: "link" | "code" | "none";
  linkVariable?: "{{ .ConfirmationURL }}";
  codeVariable?: "{{ .Token }}";
  copy: Record<CoreAuthLanguage, LocalizedAuthCopy>;
};

const commonFooter = {
  de: "Wenn Sie diese Aktion nicht angefordert haben, ignorieren Sie diese E-Mail oder kontaktieren Sie den MG AutoTech Support.",
  en: "If you did not request this action, ignore this email or contact MG AutoTech support.",
  tr: "Bu işlemi siz istemediyseniz bu e-postayı dikkate almayın veya MG AutoTech destek ekibiyle iletişime geçin.",
} as const;

function definition(input: SupabaseAuthTemplateDefinition) {
  return input;
}

export const supabaseAuthTemplateCatalog = [
  definition({
    key: "confirm_signup",
    supabaseKey: "confirmation",
    label: "Signup verification",
    category: "authentication",
    action: "link",
    linkVariable: "{{ .ConfirmationURL }}",
    copy: {
      de: { subject: "MG AutoTech - E-Mail-Adresse bestätigen", title: "E-Mail-Adresse bestätigen", intro: "Bestätigen Sie Ihre E-Mail-Adresse, um Ihr sicheres MG AutoTech Kundenkonto zu aktivieren.", action: "E-Mail-Adresse bestätigen", footer: commonFooter.de },
      en: { subject: "MG AutoTech - Confirm your email address", title: "Confirm your email address", intro: "Confirm your email address to activate your secure MG AutoTech customer account.", action: "Confirm email address", footer: commonFooter.en },
      tr: { subject: "MG AutoTech - E-posta adresinizi doğrulayın", title: "E-posta adresinizi doğrulayın", intro: "Güvenli MG AutoTech müşteri hesabınızı etkinleştirmek için e-posta adresinizi doğrulayın.", action: "E-posta adresini doğrula", footer: commonFooter.tr },
    },
  }),
  definition({
    key: "password_recovery",
    supabaseKey: "recovery",
    label: "Password recovery",
    category: "authentication",
    action: "link",
    linkVariable: "{{ .ConfirmationURL }}",
    copy: {
      de: { subject: "MG AutoTech - Passwort zurücksetzen", title: "Neues Passwort festlegen", intro: "Für Ihr MG AutoTech Konto wurde eine Passwort-Zurücksetzung angefordert.", action: "Passwort zurücksetzen", footer: commonFooter.de },
      en: { subject: "MG AutoTech - Reset your password", title: "Set a new password", intro: "A password reset was requested for your MG AutoTech account.", action: "Reset password", footer: commonFooter.en },
      tr: { subject: "MG AutoTech - Şifrenizi sıfırlayın", title: "Yeni şifre belirleyin", intro: "MG AutoTech hesabınız için şifre sıfırlama talebi oluşturuldu.", action: "Şifreyi sıfırla", footer: commonFooter.tr },
    },
  }),
  definition({
    key: "invite_user",
    supabaseKey: "invite",
    label: "Account invitation",
    category: "authentication",
    action: "link",
    linkVariable: "{{ .ConfirmationURL }}",
    copy: {
      de: { subject: "MG AutoTech - Einladung zum Kundenportal", title: "Ihre Einladung", intro: "Sie wurden eingeladen, ein sicheres MG AutoTech Kundenkonto einzurichten.", action: "Einladung annehmen", footer: commonFooter.de },
      en: { subject: "MG AutoTech - Customer portal invitation", title: "Your invitation", intro: "You have been invited to set up a secure MG AutoTech customer account.", action: "Accept invitation", footer: commonFooter.en },
      tr: { subject: "MG AutoTech - Müşteri paneli daveti", title: "Davetiniz", intro: "Güvenli bir MG AutoTech müşteri hesabı oluşturmak için davet edildiniz.", action: "Daveti kabul et", footer: commonFooter.tr },
    },
  }),
  definition({
    key: "magic_link",
    supabaseKey: "magic_link",
    label: "Secure sign-in link",
    category: "authentication",
    action: "link",
    linkVariable: "{{ .ConfirmationURL }}",
    copy: {
      de: { subject: "MG AutoTech - Sicherer Anmeldelink", title: "Sicher anmelden", intro: "Verwenden Sie diesen einmaligen Link, um sich sicher bei MG AutoTech anzumelden.", action: "Sicher anmelden", footer: commonFooter.de },
      en: { subject: "MG AutoTech - Secure sign-in link", title: "Sign in securely", intro: "Use this one-time link to sign in securely to MG AutoTech.", action: "Sign in", footer: commonFooter.en },
      tr: { subject: "MG AutoTech - Güvenli giriş bağlantısı", title: "Güvenli giriş", intro: "MG AutoTech hesabınızda güvenli giriş yapmak için bu tek kullanımlık bağlantıyı kullanın.", action: "Giriş yap", footer: commonFooter.tr },
    },
  }),
  definition({
    key: "email_change",
    supabaseKey: "email_change",
    label: "Email address change verification",
    category: "authentication",
    action: "link",
    linkVariable: "{{ .ConfirmationURL }}",
    copy: {
      de: { subject: "MG AutoTech - Neue E-Mail-Adresse bestätigen", title: "Neue E-Mail-Adresse bestätigen", intro: "Bestätigen Sie {{ .NewEmail }} als neue E-Mail-Adresse für Ihr MG AutoTech Konto.", action: "Neue Adresse bestätigen", footer: commonFooter.de },
      en: { subject: "MG AutoTech - Confirm your new email address", title: "Confirm your new email address", intro: "Confirm {{ .NewEmail }} as the new email address for your MG AutoTech account.", action: "Confirm new address", footer: commonFooter.en },
      tr: { subject: "MG AutoTech - Yeni e-posta adresinizi doğrulayın", title: "Yeni e-posta adresinizi doğrulayın", intro: "{{ .NewEmail }} adresini MG AutoTech hesabınızın yeni e-posta adresi olarak doğrulayın.", action: "Yeni adresi doğrula", footer: commonFooter.tr },
    },
  }),
  definition({
    key: "reauthentication",
    supabaseKey: "reauthentication",
    label: "Sensitive-action verification code",
    category: "authentication",
    action: "code",
    codeVariable: "{{ .Token }}",
    copy: {
      de: { subject: "MG AutoTech - Sicherheitscode", title: "Identität bestätigen", intro: "Verwenden Sie den Sicherheitscode, um die angeforderte sensible Aktion zu bestätigen.", footer: commonFooter.de },
      en: { subject: "MG AutoTech - Security code", title: "Confirm your identity", intro: "Use the security code to confirm the requested sensitive action.", footer: commonFooter.en },
      tr: { subject: "MG AutoTech - Güvenlik kodu", title: "Kimliğinizi doğrulayın", intro: "Talep edilen hassas işlemi onaylamak için güvenlik kodunu kullanın.", footer: commonFooter.tr },
    },
  }),
  ...[
    ["password_changed", "password_changed", "Password changed", "Ihr Passwort wurde geändert", "Your password was changed", "Şifreniz değiştirildi", "Das Passwort für Ihr MG AutoTech Konto {{ .Email }} wurde geändert.", "The password for your MG AutoTech account {{ .Email }} was changed.", "{{ .Email }} MG AutoTech hesabınızın şifresi değiştirildi."],
    ["email_changed", "email_changed", "Email address changed", "Ihre E-Mail-Adresse wurde geändert", "Your email address was changed", "E-posta adresiniz değiştirildi", "Die E-Mail-Adresse wurde von {{ .OldEmail }} in {{ .Email }} geändert.", "The email address was changed from {{ .OldEmail }} to {{ .Email }}.", "E-posta adresiniz {{ .OldEmail }} adresinden {{ .Email }} adresine değiştirildi."],
    ["phone_changed", "phone_changed", "Phone number changed", "Ihre Telefonnummer wurde geändert", "Your phone number was changed", "Telefon numaranız değiştirildi", "Die Telefonnummer wurde von {{ .OldPhone }} in {{ .Phone }} geändert.", "The phone number was changed from {{ .OldPhone }} to {{ .Phone }}.", "Telefon numaranız {{ .OldPhone }} numarasından {{ .Phone }} numarasına değiştirildi."],
    ["identity_linked", "identity_linked", "Sign-in method linked", "Neue Anmeldemethode verknüpft", "A sign-in method was linked", "Giriş yöntemi bağlandı", "Die Anmeldemethode {{ .Provider }} wurde mit Ihrem Konto verknüpft.", "The {{ .Provider }} sign-in method was linked to your account.", "{{ .Provider }} giriş yöntemi hesabınıza bağlandı."],
    ["identity_unlinked", "identity_unlinked", "Sign-in method removed", "Anmeldemethode entfernt", "A sign-in method was removed", "Giriş yöntemi kaldırıldı", "Die Anmeldemethode {{ .Provider }} wurde von Ihrem Konto entfernt.", "The {{ .Provider }} sign-in method was removed from your account.", "{{ .Provider }} giriş yöntemi hesabınızdan kaldırıldı."],
    ["mfa_factor_enrolled", "mfa_factor_enrolled", "Verification method added", "Neue Verifizierungsmethode hinzugefügt", "A verification method was added", "Doğrulama yöntemi eklendi", "Die Verifizierungsmethode {{ .FactorType }} wurde hinzugefügt.", "The {{ .FactorType }} verification method was added.", "{{ .FactorType }} doğrulama yöntemi eklendi."],
    ["mfa_factor_unenrolled", "mfa_factor_unenrolled", "Verification method removed", "Verifizierungsmethode entfernt", "A verification method was removed", "Doğrulama yöntemi kaldırıldı", "Die Verifizierungsmethode {{ .FactorType }} wurde entfernt.", "The {{ .FactorType }} verification method was removed.", "{{ .FactorType }} doğrulama yöntemi kaldırıldı."],
  ].map((row) => definition({
    key: row[0],
    supabaseKey: row[1],
    label: row[2],
    category: "security",
    action: "none",
    copy: {
      de: { subject: `MG AutoTech - ${row[3]}`, title: row[3], intro: row[6], footer: commonFooter.de },
      en: { subject: `MG AutoTech - ${row[4]}`, title: row[4], intro: row[7], footer: commonFooter.en },
      tr: { subject: `MG AutoTech - ${row[5]}`, title: row[5], intro: row[8], footer: commonFooter.tr },
    },
  })),
] satisfies SupabaseAuthTemplateDefinition[];

export type SupabaseAuthTemplateKey =
  (typeof supabaseAuthTemplateCatalog)[number]["key"];

export function getSupabaseAuthTemplateDefinition(key: string) {
  return supabaseAuthTemplateCatalog.find((template) => template.key === key) ?? null;
}

function resolveAuthTemplateCopy(
  template: SupabaseAuthTemplateDefinition,
  language: TransactionalEmailLanguage
): AuthTemplateCopy {
  if (language === "de" || language === "en" || language === "tr") {
    return template.copy[language];
  }
  return getExtendedAuthTemplateCopy(template.key, language);
}

function replacePreviewVariables(value: string) {
  return value
    .replaceAll("{{ .Email }}", "customer@example.com")
    .replaceAll("{{ .OldEmail }}", "old@example.com")
    .replaceAll("{{ .NewEmail }}", "new@example.com")
    .replaceAll("{{ .OldPhone }}", "+49 000 000000")
    .replaceAll("{{ .Phone }}", "+49 111 111111")
    .replaceAll("{{ .Provider }}", "Google")
    .replaceAll("{{ .FactorType }}", "TOTP");
}

export function renderSupabaseAuthTemplatePreview(
  key: string,
  language: TransactionalEmailLanguage
) {
  const template = getSupabaseAuthTemplateDefinition(key);
  if (!template) return null;
  const copy = resolveAuthTemplateCopy(template, language);
  const content = template.action === "code"
    ? `<div style="margin:20px 0;padding:18px;text-align:center;background:#f4f4f5;border:1px solid #e4e4e7;border-radius:8px;font-size:25px;font-weight:900;letter-spacing:0.18em;">12345678</div>`
    : "";
  return {
    subject: copy.subject,
    text: `${copy.title}\n\n${replacePreviewVariables(copy.intro)}\n\n${copy.footer}`,
    html: htmlLayout({
      preheader: replacePreviewVariables(copy.intro),
      title: copy.title,
      intro: replacePreviewVariables(copy.intro),
      content,
      language,
      ctaLabel: copy.action,
      ctaUrl: template.action === "link" ? "https://file.mgautotech.de/auth/callback" : null,
      footerNote: copy.footer,
    }),
  };
}

function authEmailBody(copy: LocalizedAuthCopy, template: SupabaseAuthTemplateDefinition) {
  const action = template.action === "link"
    ? `<p style="margin:22px 0 0;"><a href="${template.linkVariable}" style="display:inline-block;background:#c1121f;color:#fff;text-decoration:none;padding:14px 20px;border-radius:8px;font-weight:800;">${copy.action}</a></p>`
    : template.action === "code"
      ? `<div style="margin:22px 0;padding:18px;text-align:center;background:#f4f4f5;border:1px solid #e4e4e7;border-radius:8px;font-size:25px;font-weight:900;letter-spacing:0.18em;">${template.codeVariable}</div>`
      : "";
  return `<h1 style="margin:0 0 13px;font-size:26px;line-height:1.25;color:#101114;">${copy.title}</h1><p style="margin:0;color:#52525b;font-size:15px;line-height:1.7;">${copy.intro}</p>${action}<p style="margin:22px 0 0;color:#71717a;font-size:12px;line-height:1.65;">${copy.footer}</p>`;
}

function buildLanguageConditional(
  template: SupabaseAuthTemplateDefinition,
  render: (copy: AuthTemplateCopy) => string
) {
  return buildSupportedLanguageConditional((language) =>
    render(resolveAuthTemplateCopy(template, language))
  );
}

function buildSupportedLanguageConditional(
  render: (language: TransactionalEmailLanguage) => string
) {
  const fallback = render("en");
  return supportedTransactionalEmailLanguages
    .filter((language) => language !== "en")
    .reverse()
    .reduce(
      (rest, language) => `{{ if eq (index .Data "email_language") "${language}" }}${render(language)}{{ else }}${rest}{{ end }}`,
      fallback
    );
}

export function buildSupabaseAuthTemplateHtml(key: string) {
  const template = getSupabaseAuthTemplateDefinition(key);
  if (!template) return null;
  const serviceName = buildSupportedLanguageConditional((language) =>
    escapeHtml(emailLocaleCopy[language].serviceName)
  );
  const body = buildLanguageConditional(
    template,
    (copy) => authEmailBody(copy, template)
  );
  return `<!doctype html><html><body style="margin:0;background:#eceef1;font-family:Arial,Helvetica,sans-serif;color:#18181b;"><div style="padding:32px 14px;"><div style="max-width:640px;margin:0 auto;background:#fff;border:1px solid #dfe2e7;border-radius:12px;overflow:hidden;"><div style="height:4px;background:#d11221;"></div><div style="background:#08090b;color:#fff;padding:24px 26px;"><div style="font-size:18px;font-weight:900;">MG <span style="color:#ff3445;">AUTOTECH</span></div><div style="margin-top:5px;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#a1a1aa;">${serviceName}</div></div><div style="padding:30px 26px 32px;">${body}</div><div style="border-top:1px solid #e4e4e7;background:#f7f7f8;padding:19px 26px;color:#71717a;font-size:11px;line-height:1.7;">MG AutoTech &middot; ${serviceName} &middot; {{ .SiteURL }}</div></div></div></body></html>`;
}

export function buildSupabaseAuthTemplateSubject(key: string) {
  const template = getSupabaseAuthTemplateDefinition(key);
  if (!template) return null;
  return buildLanguageConditional(template, (copy) => copy.subject);
}
