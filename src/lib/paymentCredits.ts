import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export type PaymentCreditInput = {
  userId: string;
  sourceType: string;
  sourceId: string;
  credits: number;
  amountTotal: number | null;
  currency: string | null;
  description: string;
  metadata?: Record<string, unknown>;
};

export async function addPurchasedCredits(input: PaymentCreditInput) {
  const supabaseAdmin = getSupabaseAdmin();

  if (!input.userId || !input.sourceType || !input.sourceId) {
    throw new Error("Credit purchase source data is missing.");
  }

  if (!Number.isFinite(input.credits) || input.credits <= 0) {
    throw new Error("Credit amount is invalid.");
  }

  const { data: existingTransaction, error: existingError } = await supabaseAdmin
    .from("credit_transactions")
    .select("id, credits_delta, balance_after")
    .eq("source_type", input.sourceType)
    .eq("source_id", input.sourceId)
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message);
  }

  if (existingTransaction) {
    return {
      alreadyProcessed: true,
      credits: Number(existingTransaction.credits_delta ?? input.credits),
      balanceAfter: Number(existingTransaction.balance_after ?? 0),
    };
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("credit_balance")
    .eq("id", input.userId)
    .single();

  if (profileError) {
    throw new Error(profileError.message);
  }

  const currentBalance = Number(profile?.credit_balance ?? 0);
  const balanceAfter = currentBalance + input.credits;

  const { error: updateError } = await supabaseAdmin
    .from("profiles")
    .update({ credit_balance: balanceAfter })
    .eq("id", input.userId);

  if (updateError) {
    throw new Error(updateError.message);
  }

  const { error: ledgerError } = await supabaseAdmin
    .from("credit_transactions")
    .insert({
      user_id: input.userId,
      type: "purchase",
      source_type: input.sourceType,
      source_id: input.sourceId,
      credits_delta: input.credits,
      balance_after: balanceAfter,
      description: input.description,
      amount_total: input.amountTotal,
      currency: input.currency,
      metadata: input.metadata ?? {},
    });

  if (ledgerError) {
    throw new Error(ledgerError.message);
  }

  return {
    alreadyProcessed: false,
    credits: input.credits,
    balanceAfter,
  };
}
