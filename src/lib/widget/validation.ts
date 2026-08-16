import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { normalizeWidgetLanguage } from "@/lib/i18n/widget-translations";
import { extractRequestDomain, extractRequestOrigin, isDomainAllowed } from "@/lib/widget/domain";
import { getWidgetSettings } from "@/lib/widget/settings";
import { verifyWidgetSession } from "@/lib/widget/session";
import {
  consumeWidgetFrontDoorAbuseLimit,
  consumeWidgetLayeredAbuseLimit,
  consumeWidgetRateLimit,
  getMonthlyWidgetUsage,
  hashRequestIp,
} from "@/lib/widget/usage";
import {
  sanitizeWidgetLanguages,
  type WidgetClient,
  type WidgetLanguage,
  type WidgetValidationResult,
} from "@/lib/widget/types";

type ValidationOptions = {
  path?: string;
  sessionToken?: string | null;
  log?: boolean;
  rateLimit?: boolean;
};

const widgetBootstrapPaths = new Set([
  "/api/widget/config",
  "/api/widget/validate",
  "/embed/vehicle-selector",
]);
const widgetPublicKeyPattern = /^pk_mga_widget_[A-Za-z0-9_-]{24}$/;

function mapClient(row: Record<string, unknown>): WidgetClient {
  return {
    ...row,
    monthly_price: Number(row.monthly_price ?? 4.99),
    monthly_usage_limit: Number(row.monthly_usage_limit ?? 5000),
    allowed_languages: sanitizeWidgetLanguages(row.allowed_languages),
    default_language: normalizeWidgetLanguage(row.default_language, "de"),
    email_enquiries_enabled: row.email_enquiries_enabled === undefined ? Boolean(row.enquiry_email) : Boolean(row.email_enquiries_enabled),
    whatsapp_enquiries_enabled: row.whatsapp_enquiries_enabled === undefined ? Boolean(row.whatsapp_number) : Boolean(row.whatsapp_enquiries_enabled),
  } as WidgetClient;
}

function resolveLanguage(
  requested: string | null | undefined,
  browserLanguage: string | null,
  client: WidgetClient,
  globalDefault: WidgetLanguage,
  globalEnabled: WidgetLanguage[]
) {
  const clientEnabled = sanitizeWidgetLanguages(client.allowed_languages);
  const enabled = new Set(globalEnabled.filter((item) => clientEnabled.includes(item)));
  const candidates = [
    requested,
    client.default_language,
    browserLanguage,
    globalDefault,
    "en",
  ].map((value) => normalizeWidgetLanguage(value, "en"));
  return candidates.find((value) => enabled.has(value)) ?? null;
}

async function writeAccessLog(input: {
  client?: WidgetClient;
  publicKey: string;
  requestDomain: string;
  path: string;
  language?: string;
  status: "allowed" | "blocked";
  reason?: string;
  headers: Headers;
  enabled: boolean;
}) {
  if (!input.enabled) return;
  try {
    await getSupabaseAdmin().from("widget_access_logs").insert({
      client_id: input.client?.id ?? null,
      public_key: input.publicKey.slice(0, 64) || null,
      request_domain: input.requestDomain || null,
      allowed_domain: input.client?.allowed_domain ?? null,
      path: input.path,
      language: input.language ?? null,
      status: input.status,
      block_reason: input.reason ?? null,
      user_agent: input.headers.get("user-agent")?.slice(0, 500) ?? null,
      ip_hash: hashRequestIp(input.headers),
    });
  } catch {
    // Logging must never expose or break the public widget response.
  }
}

export async function validateWidgetClient(
  publicKey: string,
  headers: Headers,
  requestedLang?: string | null,
  options: ValidationOptions = {}
): Promise<WidgetValidationResult> {
  const path = options.path ?? "/api/widget/unknown";
  const shouldLog = options.log ?? true;
  const sessionToken = options.sessionToken?.trim() ?? "";
  let session: ReturnType<typeof verifyWidgetSession> = null;
  let sessionValidationFailed = false;
  if (sessionToken) {
    try {
      session = verifyWidgetSession(sessionToken);
      sessionValidationFailed = !session;
    } catch {
      sessionValidationFailed = true;
    }
  }
  const bootstrap = widgetBootstrapPaths.has(path);
  const requestDomain = session?.domain || extractRequestDomain(headers);
  const requestOrigin = session?.origin || extractRequestOrigin(headers);

  if (options.rateLimit !== false) {
    try {
      if (!(await consumeWidgetFrontDoorAbuseLimit(headers))) {
        return { valid: false, requestDomain, requestOrigin, reason: "ip_rate_limit_exceeded" };
      }
    } catch {
      return { valid: false, requestDomain, requestOrigin, reason: "abuse_guard_unavailable" };
    }
  }

  const settingsResult = await getWidgetSettings();
  const settings = settingsResult.settings;

  const block = async (reason: string, client?: WidgetClient, language?: WidgetLanguage) => {
    if (shouldLog) {
      await writeAccessLog({
        client, publicKey, requestDomain, path, language, status: "blocked", reason,
        headers, enabled: settings.usage_logging_enabled && settingsResult.databaseReady,
      });
    }
    return { valid: false, clientId: client?.id, client, settings, language, requestDomain, requestOrigin, reason } satisfies WidgetValidationResult;
  };

  if (!settingsResult.databaseReady || !settings.widget_product_enabled) return block("global_disabled");
  if (!widgetPublicKeyPattern.test(publicKey)) return block("invalid_key");
  if (sessionValidationFailed) return block("invalid_session");
  if (!bootstrap && !session) return block("session_required");

  const admin = getSupabaseAdmin();
  const keyResult = await admin
    .from("widget_api_keys")
    .select("id, client_id, public_key, is_active, revoked_at")
    .eq("public_key", publicKey)
    .maybeSingle();
  if (keyResult.error || !keyResult.data) return block("invalid_key");
  if (!keyResult.data.is_active || keyResult.data.revoked_at) return block("key_inactive");

  const clientResult = await admin.from("widget_clients").select("*").eq("id", keyResult.data.client_id).maybeSingle();
  if (clientResult.error || !clientResult.data) return block("client_not_found");
  const client = mapClient(clientResult.data);

  if (session && (session.publicKey !== publicKey || session.clientId !== client.id)) {
    return block("invalid_session", client);
  }
  if (client.status !== "active") return block("client_not_active", client);
  if (client.admin_suspended || !client.widget_enabled) return block("widget_disabled", client);

  const stripeStatus = client.stripe_subscription_status?.toLowerCase();
  if (stripeStatus && !["active", "trialing"].includes(stripeStatus)) {
    return block("subscription_inactive", client);
  }

  if (settings.require_domain_whitelist) {
    if (!requestDomain) return block("domain_missing", client);
    if (!isDomainAllowed(requestDomain, client.allowed_domain, client.allow_www_alias, client.allow_subdomains)) {
      return block("domain_not_allowed", client);
    }
  }

  const language = resolveLanguage(
    requestedLang,
    headers.get("accept-language"),
    client,
    settings.default_language,
    settings.enabled_languages
  );
  if (!language) return block("language_disabled", client);

  if (options.rateLimit !== false) {
    try {
      const layeredLimit = await consumeWidgetLayeredAbuseLimit({
        headers,
        clientId: client.id,
        sessionToken,
        bootstrap,
      });
      if (!layeredLimit.allowed) return block(layeredLimit.reason, client, language);
    } catch {
      return block("abuse_guard_unavailable", client, language);
    }
  }

  if (path !== "/api/widget/validate") {
    let usage: number;
    try {
      usage = await getMonthlyWidgetUsage(client.id);
    } catch {
      return block("usage_unavailable", client, language);
    }
    if (client.monthly_usage_limit > 0 && usage >= client.monthly_usage_limit) {
      return block("usage_limit_exceeded", client, language);
    }

    if (options.rateLimit !== false) {
      let withinRateLimit: boolean;
      try {
        withinRateLimit = await consumeWidgetRateLimit(client.id);
      } catch {
        return block("rate_limit_unavailable", client, language);
      }
      if (!withinRateLimit) return block("usage_limit_exceeded", client, language);
    }
  }

  if (shouldLog) {
    await writeAccessLog({
      client, publicKey, requestDomain, path, language, status: "allowed", headers,
      enabled: settings.usage_logging_enabled,
    });
  }

  return {
    valid: true,
    clientId: client.id,
    client,
    settings,
    language,
    requestDomain,
    requestOrigin,
  };
}
