import type { TransactionalEmailLanguage } from "@/lib/email/types";
import { supportedTransactionalEmailLanguages } from "@/lib/email/language";

export const OAUTH_REGISTRATION_PROFILE_KEY = "mg_register_oauth_profile";

export type RegistrationAccountType = "private" | "company";

export type RegistrationProfileDraft = {
  full_name: string;
  account_type: RegistrationAccountType;
  company_name: string | null;
  phone: string | null;
  vat_id: string | null;
  tax_number: string | null;
  email_language: TransactionalEmailLanguage;
};

type RegistrationProfileInput = {
  fullName: string;
  accountType: RegistrationAccountType;
  companyName: string;
  phone: string;
  taxNumber: string;
  emailLanguage: TransactionalEmailLanguage;
};

function optionalText(value: unknown, maxLength: number) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return undefined;
  const clean = value.trim();
  if (!clean) return null;
  return clean.length <= maxLength ? clean : undefined;
}

function requiredText(value: unknown, maxLength: number) {
  const clean = optionalText(value, maxLength);
  return typeof clean === "string" ? clean : undefined;
}

function emailLanguage(value: unknown): TransactionalEmailLanguage | undefined {
  return supportedTransactionalEmailLanguages.includes(value as TransactionalEmailLanguage)
    ? (value as TransactionalEmailLanguage)
    : undefined;
}

export function createRegistrationProfileDraft(
  input: RegistrationProfileInput
): RegistrationProfileDraft | null {
  return parseRegistrationProfileDraft(JSON.stringify({
    full_name: input.fullName,
    account_type: input.accountType,
    company_name: input.accountType === "company" ? input.companyName : null,
    phone: input.phone,
    vat_id: input.accountType === "company" ? input.taxNumber : null,
    tax_number: input.accountType === "company" ? input.taxNumber : null,
    email_language: input.emailLanguage,
  }));
}

export function parseRegistrationProfileDraft(
  serialized: string | null
): RegistrationProfileDraft | null {
  if (!serialized || serialized.length > 2_000) return null;

  try {
    const value = JSON.parse(serialized) as Record<string, unknown>;
    const fullName = requiredText(value.full_name, 120);
    const accountType = value.account_type;
    const companyName = optionalText(value.company_name, 120);
    const phone = optionalText(value.phone, 40);
    const vatId = optionalText(value.vat_id, 80);
    const taxNumber = optionalText(value.tax_number, 80);
    const language = emailLanguage(value.email_language);

    if (
      !fullName ||
      (accountType !== "private" && accountType !== "company") ||
      !language ||
      companyName === undefined ||
      phone === undefined ||
      vatId === undefined ||
      taxNumber === undefined ||
      (accountType === "company" && !companyName)
    ) {
      return null;
    }

    return {
      full_name: fullName,
      account_type: accountType,
      company_name: accountType === "company" ? companyName : null,
      phone,
      vat_id: accountType === "company" ? vatId : null,
      tax_number: accountType === "company" ? taxNumber : null,
      email_language: language,
    };
  } catch {
    return null;
  }
}
