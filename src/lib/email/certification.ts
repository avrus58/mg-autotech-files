import { supportedTransactionalEmailLanguages } from "@/lib/email/language";
import {
  listLifecycleStatusCoverage,
  resolveStatusEmail,
  type EmailStatusSource,
} from "@/lib/email/lifecycle";
import {
  getSupabaseAuthTemplateDefinition,
  renderSupabaseAuthTemplatePreview,
  supabaseAuthTemplateCatalog,
} from "@/lib/email/supabaseAuthTemplates";
import {
  listTransactionalEmailTemplates,
  renderTransactionalEmailTemplate,
} from "@/lib/email/templates";
import type {
  TransactionalEmailContext,
  TransactionalEmailEventType,
} from "@/lib/email/types";

export const emailJourneyMilestones = [
  {
    id: "verified_registration",
    label: "Verified registration",
    trigger: "Verified authentication callback",
    eventTypes: ["customer_welcome", "customer_registered"],
  },
  {
    id: "request_created",
    label: "Request created",
    trigger: "Idempotent request creation",
    eventTypes: ["request_created", "new_request_admin_notification"],
  },
  {
    id: "file_received",
    label: "File received",
    trigger: "Work order enters file received",
    eventTypes: ["request_received"],
  },
  {
    id: "technical_review",
    label: "Technical review",
    trigger: "Work order enters review",
    eventTypes: ["request_in_review"],
  },
  {
    id: "work_in_progress",
    label: "Work in progress",
    trigger: "Work order enters in progress",
    eventTypes: ["request_in_progress"],
  },
  {
    id: "customer_action_required",
    label: "Customer action required",
    trigger: "Customer information or another file is required",
    eventTypes: ["request_waiting_for_customer", "additional_file_requested"],
  },
  {
    id: "customer_message",
    label: "Customer-visible message",
    trigger: "Visible admin message only",
    eventTypes: ["customer_visible_message_added"],
  },
  {
    id: "additional_upload",
    label: "Additional upload received",
    trigger: "Customer-owned upload finalization",
    eventTypes: ["additional_file_uploaded_customer", "additional_file_uploaded"],
  },
  {
    id: "delivery",
    label: "Completed delivery",
    trigger: "Verified completed-file delivery",
    eventTypes: ["request_completed", "request_delivered", "delivery_completed"],
  },
  {
    id: "cancelled",
    label: "Request cancelled",
    trigger: "Meaningful cancellation transition",
    eventTypes: ["request_cancelled"],
  },
] as const satisfies ReadonlyArray<{
  id: string;
  label: string;
  trigger: string;
  eventTypes: readonly TransactionalEmailEventType[];
}>;

type CertificationCheck = {
  id: string;
  label: string;
  status: "passed" | "failed";
  checked: number;
  failures: string[];
};

export type EmailJourneyCertificationReport = {
  generatedAt: string;
  mode: "sample_render_only";
  sideEffects: {
    emailsSent: 0;
    databaseWrites: 0;
    customerRecordsRead: 0;
  };
  summary: {
    status: "passed" | "failed";
    passedChecks: number;
    failedChecks: number;
    renderedTemplates: number;
    languages: number;
    milestones: number;
    lifecycleTransitions: number;
  };
  checks: CertificationCheck[];
};

const forbiddenCustomerContent =
  /admin_notes|tuner_notes|risk_flags|audit_logs|raw_binary|hex_preview|storage_path|service_role|sample_id|confidence_score|private_offset|source_reference|provider_secret|hidden_message/i;

const unsafeUrl = /(?:href|src)\s*=\s*["']\s*(?:javascript|file|data):/i;

function sampleContext(): TransactionalEmailContext {
  return {
    requestId: "00000000-0000-4000-8000-000000000019",
    requestNumber: "MGAT-TEST-0019",
    customerId: "MGA-TEST",
    customerName: "Email Certification Customer",
    customerEmail: "customer@example.com",
    companyName: "Example Workshop",
    vehicleSummary: "Mercedes-Benz E / W214 / E 220 d",
    serviceSummary: "Stage 1",
    dashboardUrl: "https://file.mgautotech.de/dashboard/orders/00000000-0000-4000-8000-000000000019",
    adminUrl: "https://file.mgautotech.de/admin/email",
    messagePreview: "Please review the latest customer-visible message.",
    statusLabel: "In progress",
    actionRequired: "Open the secure customer dashboard.",
    fileName: "sample-original.bin",
    credits: 10,
    amountLabel: "36.00 EUR",
    paymentReference: "MGA-TEST",
    recoveryUrl: "https://file.mgautotech.de/reset-password?certification=sample",
  };
}

function result(
  id: string,
  label: string,
  checked: number,
  failures: string[]
): CertificationCheck {
  return {
    id,
    label,
    checked,
    failures: failures.slice(0, 25),
    status: failures.length === 0 ? "passed" : "failed",
  };
}

function validateRenderedEmail(
  key: string,
  rendered: { subject: string; html: string; text: string },
  failures: string[]
) {
  if (!rendered.subject.trim()) failures.push(`${key}: missing subject`);
  if (!rendered.html.trim()) failures.push(`${key}: missing HTML body`);
  if (!rendered.text.trim()) failures.push(`${key}: missing text body`);

  const serialized = JSON.stringify(rendered);
  if (/>\s*(?:undefined|null)\s*</i.test(rendered.html) || /^(?:undefined|null)$/im.test(rendered.text)) {
    failures.push(`${key}: unresolved value`);
  }
  if (forbiddenCustomerContent.test(serialized)) failures.push(`${key}: private field marker`);
  if (unsafeUrl.test(serialized)) failures.push(`${key}: unsafe URL scheme`);
}

export function getEmailJourneyCoverage() {
  const templateAudience = new Map(
    listTransactionalEmailTemplates().map((template) => [template.eventType, template.audience])
  );

  return emailJourneyMilestones.map((milestone) => ({
    ...milestone,
    eventTypes: milestone.eventTypes.map((eventType) => ({
      eventType,
      audience: templateAudience.get(eventType) ?? "unknown",
    })),
  }));
}

export function runEmailJourneyCertification(
  now: Date = new Date()
): EmailJourneyCertificationReport {
  const context = sampleContext();
  const templates = listTransactionalEmailTemplates();
  const templateEvents = new Set(templates.map((template) => template.eventType));
  const checks: CertificationCheck[] = [];
  let renderedTemplates = 0;

  const milestoneFailures: string[] = [];
  for (const milestone of emailJourneyMilestones) {
    for (const eventType of milestone.eventTypes) {
      if (!templateEvents.has(eventType)) {
        milestoneFailures.push(`${milestone.id}: missing ${eventType}`);
      }
    }
  }
  checks.push(result(
    "journey_milestones",
    "Customer journey milestones are mapped to templates",
    emailJourneyMilestones.length,
    milestoneFailures
  ));

  const transactionalFailures: string[] = [];
  let transactionalRenderCount = 0;
  for (const template of templates) {
    const languages = template.audience === "customer"
      ? supportedTransactionalEmailLanguages
      : (["en"] as const);
    for (const language of languages) {
      const key = `${template.eventType}:${language}`;
      const rendered = renderTransactionalEmailTemplate(
        template.eventType as TransactionalEmailEventType,
        context,
        language
      );
      renderedTemplates += 1;
      transactionalRenderCount += 1;
      validateRenderedEmail(key, rendered, transactionalFailures);
      if (!rendered.html.includes(`<html lang="${language}">`)) {
        transactionalFailures.push(`${key}: incorrect document language`);
      }
    }
  }
  checks.push(result(
    "transactional_templates",
    "Platform templates render safely in every language",
    transactionalRenderCount,
    transactionalFailures
  ));

  const authFailures: string[] = [];
  for (const template of supabaseAuthTemplateCatalog) {
    if (!getSupabaseAuthTemplateDefinition(template.key)) {
      authFailures.push(`${template.key}: missing definition`);
      continue;
    }
    for (const language of supportedTransactionalEmailLanguages) {
      const key = `auth:${template.key}:${language}`;
      const rendered = renderSupabaseAuthTemplatePreview(template.key, language);
      if (!rendered) {
        authFailures.push(`${key}: preview unavailable`);
        continue;
      }
      renderedTemplates += 1;
      validateRenderedEmail(key, rendered, authFailures);
      if (!rendered.html.includes(`lang="${language}"`)) {
        authFailures.push(`${key}: incorrect document language`);
      }
    }
  }
  checks.push(result(
    "auth_templates",
    "Authentication templates render safely in every language",
    supabaseAuthTemplateCatalog.length * supportedTransactionalEmailLanguages.length,
    authFailures
  ));

  const lifecycleCoverage = listLifecycleStatusCoverage();
  const lifecycleFailures: string[] = [];
  for (const item of lifecycleCoverage) {
    const definition = resolveStatusEmail(
      item.status,
      item.source as EmailStatusSource,
      "en"
    );
    if (!definition || definition.eventType !== item.eventType) {
      lifecycleFailures.push(`${item.source}:${item.status}: mapping mismatch`);
    }
    if (!templateEvents.has(item.eventType)) {
      lifecycleFailures.push(`${item.source}:${item.status}: template missing`);
    }
  }
  checks.push(result(
    "lifecycle_transitions",
    "Meaningful status transitions resolve deterministically",
    lifecycleCoverage.length,
    lifecycleFailures
  ));

  const failedChecks = checks.filter((check) => check.status === "failed").length;
  return {
    generatedAt: now.toISOString(),
    mode: "sample_render_only",
    sideEffects: {
      emailsSent: 0,
      databaseWrites: 0,
      customerRecordsRead: 0,
    },
    summary: {
      status: failedChecks === 0 ? "passed" : "failed",
      passedChecks: checks.length - failedChecks,
      failedChecks,
      renderedTemplates,
      languages: supportedTransactionalEmailLanguages.length,
      milestones: emailJourneyMilestones.length,
      lifecycleTransitions: lifecycleCoverage.length,
    },
    checks,
  };
}
