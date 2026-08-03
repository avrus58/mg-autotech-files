import {
  defaultTransactionalEmailLanguage,
  resolveTransactionalEmailLanguageFromMetadata,
} from "@/lib/email/language";
import type { TransactionalEmailLanguage } from "@/lib/email/types";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function loadUserTransactionalEmailLanguage(
  userId: string | null | undefined
): Promise<TransactionalEmailLanguage> {
  if (!userId) return defaultTransactionalEmailLanguage;

  try {
    const result = await getSupabaseAdmin().auth.admin.getUserById(userId);
    if (result.error || !result.data.user) return defaultTransactionalEmailLanguage;
    return resolveTransactionalEmailLanguageFromMetadata(result.data.user.user_metadata);
  } catch {
    return defaultTransactionalEmailLanguage;
  }
}
