import {
  buildCustomerIntelligenceReport,
  type CustomerIntelligenceAttributionInput,
  type CustomerIntelligenceEmailInput,
  type CustomerIntelligenceJourneyInput,
  type CustomerIntelligenceLedgerInput,
  type CustomerIntelligenceMessageInput,
  type CustomerIntelligenceOrderInput,
  type CustomerIntelligencePaymentInput,
  type CustomerIntelligencePreferenceInput,
  type CustomerIntelligenceProfileInput,
  type CustomerIntelligenceSourceState,
  type CustomerIntelligenceWorkEventInput,
} from "@/lib/growth/customerIntelligence";
import type { GrowthCustomerClassification } from "@/lib/growth/types";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type QueryResult = { data: unknown; error: unknown };

function sourceState(result: QueryResult): CustomerIntelligenceSourceState {
  return result.error ? "unavailable" : "ready";
}

function warning(label: string, result: QueryResult) {
  return result.error ? `${label} is temporarily unavailable; the remaining verified customer evidence is still shown.` : null;
}

function stringOrNull(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function booleanOrNull(value: unknown) {
  return typeof value === "boolean" ? value : null;
}

function numberOrNull(value: unknown) {
  const parsed = Number(value);
  return value !== null && value !== "" && Number.isFinite(parsed) ? parsed : null;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function records(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value) ? value.map(record) : [];
}

function authProviders(user: Record<string, unknown>) {
  const providers = new Set<string>();
  const metadata = record(user.app_metadata);
  const primary = stringOrNull(metadata.provider);
  if (primary) providers.add(primary);
  if (Array.isArray(metadata.providers)) {
    for (const provider of metadata.providers) {
      const value = stringOrNull(provider);
      if (value) providers.add(value);
    }
  }
  if (Array.isArray(user.identities)) {
    for (const identityValue of user.identities) {
      const provider = stringOrNull(record(identityValue).provider);
      if (provider) providers.add(provider);
    }
  }
  return [...providers];
}

function classificationValue(value: unknown): GrowthCustomerClassification {
  return ["real_customer", "internal_test", "staff_operated"].includes(String(value))
    ? String(value) as GrowthCustomerClassification
    : "unreviewed";
}

export async function loadCustomerIntelligenceReport(userId: string) {
  const admin = getSupabaseAdmin();
  const [
    profileResult,
    authResult,
    classificationResult,
    attributionResult,
    trackingBaselineResult,
    ordersResult,
    ledgerResult,
    paymentsResult,
    emailResult,
    preferenceResult,
    journeyResult,
  ] = await Promise.all([
    admin.from("profiles")
      .select("id,customer_id,email,full_name,credit_balance,account_type,company_name,phone,city,country,preferred_contact,account_status,created_at")
      .eq("id", userId)
      .eq("role", "customer")
      .maybeSingle(),
    admin.auth.admin.getUserById(userId),
    admin.from("growth_customer_classifications")
      .select("classification,analytics_excluded,reason,verified_at")
      .eq("user_id", userId)
      .maybeSingle(),
    admin.from("growth_attribution_sessions")
      .select("first_landing_path,last_landing_path,first_source,last_source,first_medium,last_medium,first_campaign,last_campaign,first_term,last_term,first_referrer_host,last_referrer_host,first_country_code,last_country_code,locale,consent_version,touch_count,first_seen_at,last_seen_at,identified_at")
      .eq("user_id", userId)
      .order("first_seen_at", { ascending: true })
      .limit(50),
    admin.from("growth_attribution_sessions")
      .select("first_seen_at")
      .order("first_seen_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
    admin.from("orders")
      .select("id,vehicle_brand,vehicle_model,vehicle_generation,vehicle_engine,vehicle_year,service_type,credits_required,status,ecu,gearbox,read_method,uploaded_file_name,created_at")
      .eq("customer_id", userId)
      .order("created_at", { ascending: false })
      .limit(500),
    admin.from("credit_transactions")
      .select("id,user_id,type,status,amount_total,currency,credits_delta,balance_after,created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1_000),
    admin.from("payment_records")
      .select("status,payment_type,purchase_type,credits,amount_total,currency,credits_applied_at,refunded_at,created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(500),
    admin.from("email_events")
      .select("event_type,status,delivery_status,created_at,sent_at,delivered_at,delayed_at,bounced_at,complained_at")
      .eq("recipient_user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1_000),
    admin.from("growth_customer_preferences")
      .select("abandoned_request_reminders,consent_version,consented_at,revoked_at")
      .eq("user_id", userId)
      .maybeSingle(),
    admin.from("growth_journey_events")
      .select("event_type,order_id,channel,occurred_at")
      .eq("user_id", userId)
      .order("occurred_at", { ascending: false })
      .limit(1_000),
  ]);

  if (profileResult.error) throw profileResult.error;
  if (!profileResult.data) return null;

  const orderRows = records(ordersResult.data);
  const orderIds = orderRows.map((row) => stringOrNull(row.id)).filter((id): id is string => Boolean(id));
  let messagesResult: QueryResult = { data: [], error: null };
  let workEventsResult: QueryResult = { data: [], error: null };
  if (orderIds.length) {
    [messagesResult, workEventsResult] = await Promise.all([
      admin.from("request_messages")
        .select("request_id,sender_role,is_internal,visibility_status,created_at")
        .in("request_id", orderIds)
        .order("created_at", { ascending: true })
        .limit(5_000),
      admin.from("request_work_order_events")
        .select("request_id,event_type,customer_visible,created_at")
        .in("request_id", orderIds)
        .order("created_at", { ascending: false })
        .limit(5_000),
    ]);
  }

  const profileRow = record(profileResult.data);
  const profile: CustomerIntelligenceProfileInput = {
    id: String(profileRow.id),
    customer_id: stringOrNull(profileRow.customer_id),
    email: stringOrNull(profileRow.email),
    full_name: stringOrNull(profileRow.full_name),
    credit_balance: numberOrNull(profileRow.credit_balance),
    account_type: stringOrNull(profileRow.account_type),
    company_name: stringOrNull(profileRow.company_name),
    phone: stringOrNull(profileRow.phone),
    city: stringOrNull(profileRow.city),
    country: stringOrNull(profileRow.country),
    preferred_contact: stringOrNull(profileRow.preferred_contact),
    account_status: stringOrNull(profileRow.account_status),
    created_at: stringOrNull(profileRow.created_at),
  };

  const authUser = authResult.data?.user ? record(authResult.data.user) : null;
  const classificationRow = record(classificationResult.data);
  const preferenceRow = preferenceResult.data ? record(preferenceResult.data) : null;
  const sourceStates: Record<string, CustomerIntelligenceSourceState> = {
    profile: "ready",
    authentication: authResult.error ? "unavailable" : "ready",
    classification: sourceState(classificationResult),
    attribution: attributionResult.error || trackingBaselineResult.error
      ? "unavailable"
      : sourceState(attributionResult),
    requests: sourceState(ordersResult),
    revenueLedger: sourceState(ledgerResult),
    paymentOperations: sourceState(paymentsResult),
    emailDelivery: sourceState(emailResult),
    communication: sourceState(messagesResult),
    workOrderTimeline: sourceState(workEventsResult),
    journeyEvents: sourceState(journeyResult),
    communicationPreference: sourceState(preferenceResult),
  };
  const warnings = [
    warning("Authentication evidence", { data: authResult.data, error: authResult.error }),
    warning("Customer classification", classificationResult),
    warning("Consented attribution", attributionResult),
    warning("Attribution tracking baseline", trackingBaselineResult),
    warning("Request history", ordersResult),
    warning("Revenue ledger", ledgerResult),
    warning("Payment operations", paymentsResult),
    warning("Email delivery history", emailResult),
    warning("Customer communication metrics", messagesResult),
    warning("Work-order timeline", workEventsResult),
    warning("Customer journey events", journeyResult),
    warning("Communication preference", preferenceResult),
  ].filter((item): item is string => Boolean(item));

  return buildCustomerIntelligenceReport({
    profile,
    auth: authUser ? {
      providers: authProviders(authUser),
      createdAt: stringOrNull(authUser.created_at),
      lastSignInAt: stringOrNull(authUser.last_sign_in_at),
      emailConfirmedAt: stringOrNull(authUser.email_confirmed_at),
    } : null,
    classification: classificationResult.error || !classificationResult.data ? null : {
      classification: classificationValue(classificationRow.classification),
      analyticsExcluded: classificationRow.analytics_excluded === true,
      reason: stringOrNull(classificationRow.reason),
      verifiedAt: stringOrNull(classificationRow.verified_at),
    },
    attribution: records(attributionResult.data).map((row): CustomerIntelligenceAttributionInput => ({
      first_landing_path: stringOrNull(row.first_landing_path),
      last_landing_path: stringOrNull(row.last_landing_path),
      first_source: stringOrNull(row.first_source),
      last_source: stringOrNull(row.last_source),
      first_medium: stringOrNull(row.first_medium),
      last_medium: stringOrNull(row.last_medium),
      first_campaign: stringOrNull(row.first_campaign),
      last_campaign: stringOrNull(row.last_campaign),
      first_term: stringOrNull(row.first_term),
      last_term: stringOrNull(row.last_term),
      first_referrer_host: stringOrNull(row.first_referrer_host),
      last_referrer_host: stringOrNull(row.last_referrer_host),
      first_country_code: stringOrNull(row.first_country_code),
      last_country_code: stringOrNull(row.last_country_code),
      locale: stringOrNull(row.locale),
      consent_version: stringOrNull(row.consent_version),
      touch_count: numberOrNull(row.touch_count),
      first_seen_at: stringOrNull(row.first_seen_at),
      last_seen_at: stringOrNull(row.last_seen_at),
      identified_at: stringOrNull(row.identified_at),
    })),
    trackingStartedAt: stringOrNull(record(trackingBaselineResult.data).first_seen_at),
    orders: orderRows.map((row): CustomerIntelligenceOrderInput => ({
      id: String(row.id),
      vehicle_brand: stringOrNull(row.vehicle_brand),
      vehicle_model: stringOrNull(row.vehicle_model),
      vehicle_generation: stringOrNull(row.vehicle_generation),
      vehicle_engine: stringOrNull(row.vehicle_engine),
      vehicle_year: stringOrNull(row.vehicle_year),
      service_type: stringOrNull(row.service_type),
      credits_required: numberOrNull(row.credits_required),
      status: stringOrNull(row.status),
      ecu: stringOrNull(row.ecu),
      gearbox: stringOrNull(row.gearbox),
      read_method: stringOrNull(row.read_method),
      uploaded_file_name: stringOrNull(row.uploaded_file_name),
      created_at: stringOrNull(row.created_at),
    })),
    ledger: records(ledgerResult.data).map((row): CustomerIntelligenceLedgerInput => ({
      id: String(row.id),
      user_id: stringOrNull(row.user_id),
      type: stringOrNull(row.type),
      status: stringOrNull(row.status),
      amount_total: numberOrNull(row.amount_total),
      currency: stringOrNull(row.currency),
      credits_delta: numberOrNull(row.credits_delta),
      balance_after: numberOrNull(row.balance_after),
      created_at: stringOrNull(row.created_at),
    })),
    payments: records(paymentsResult.data).map((row): CustomerIntelligencePaymentInput => ({
      status: stringOrNull(row.status),
      payment_type: stringOrNull(row.payment_type),
      purchase_type: stringOrNull(row.purchase_type),
      credits: numberOrNull(row.credits),
      amount_total: numberOrNull(row.amount_total),
      currency: stringOrNull(row.currency),
      credits_applied_at: stringOrNull(row.credits_applied_at),
      refunded_at: stringOrNull(row.refunded_at),
      created_at: stringOrNull(row.created_at),
    })),
    emails: records(emailResult.data).map((row): CustomerIntelligenceEmailInput => ({
      event_type: stringOrNull(row.event_type),
      status: stringOrNull(row.status),
      delivery_status: stringOrNull(row.delivery_status),
      created_at: stringOrNull(row.created_at),
      sent_at: stringOrNull(row.sent_at),
      delivered_at: stringOrNull(row.delivered_at),
      delayed_at: stringOrNull(row.delayed_at),
      bounced_at: stringOrNull(row.bounced_at),
      complained_at: stringOrNull(row.complained_at),
    })),
    messages: records(messagesResult.data).map((row): CustomerIntelligenceMessageInput => ({
      request_id: String(row.request_id),
      sender_role: stringOrNull(row.sender_role),
      is_internal: booleanOrNull(row.is_internal),
      visibility_status: stringOrNull(row.visibility_status),
      created_at: stringOrNull(row.created_at),
    })),
    workEvents: records(workEventsResult.data).map((row): CustomerIntelligenceWorkEventInput => ({
      request_id: String(row.request_id),
      event_type: stringOrNull(row.event_type),
      customer_visible: booleanOrNull(row.customer_visible),
      created_at: stringOrNull(row.created_at),
    })),
    journeyEvents: records(journeyResult.data).map((row): CustomerIntelligenceJourneyInput => ({
      event_type: stringOrNull(row.event_type),
      order_id: stringOrNull(row.order_id),
      channel: stringOrNull(row.channel),
      occurred_at: stringOrNull(row.occurred_at),
    })),
    preference: preferenceRow ? {
      abandoned_request_reminders: booleanOrNull(preferenceRow.abandoned_request_reminders),
      consent_version: stringOrNull(preferenceRow.consent_version),
      consented_at: stringOrNull(preferenceRow.consented_at),
      revoked_at: stringOrNull(preferenceRow.revoked_at),
    } satisfies CustomerIntelligencePreferenceInput : null,
    sourceStates,
    warnings,
  });
}
