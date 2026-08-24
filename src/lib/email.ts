import { Resend } from "resend";
import { createHash } from "node:crypto";
import { sendRequestCreatedNotifications } from "@/lib/email/events";

function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    throw new Error("RESEND_API_KEY is missing");
  }

  return new Resend(apiKey);
}

const fromEmail =
  process.env.EMAIL_FROM || "MG AutoTech <noreply@file.mgautotech.de>";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL || "https://file.mgautotech.de";

const adminNotificationEmail =
  process.env.ADMIN_NOTIFICATION_EMAIL ||
  process.env.EMAIL_TO ||
  "info@mgautotech.de";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatOptional(value: string) {
  const trimmed = value.trim();
  return trimmed ? escapeHtml(trimmed) : "-";
}

function widgetEmailRequestOptions(idempotencyKey?: string) {
  if (!idempotencyKey) return undefined;
  return {
    idempotencyKey: `mg_widget_${createHash("sha256").update(idempotencyKey).digest("hex")}`,
  };
}

export async function sendOrderReceivedEmail({
  orderId,
  customerEmail,
  vehicle,
  service,
  credits,
}: {
  orderId: string;
  customerEmail: string;
  vehicle: string;
  service: string;
  credits: number;
}) {
  await sendRequestCreatedNotifications({
    requestId: orderId,
    customerEmail,
    vehicle,
    service,
    credits,
  });
}

export async function sendWidgetLifecycleEmail({
  customerEmail,
  companyName,
  event,
  detail,
  idempotencyKey,
}: {
  customerEmail: string;
  companyName: string;
  event: "activated" | "payment_failed" | "domain_approved" | "domain_rejected" | "key_changed" | "cancelled";
  detail?: string;
  idempotencyKey?: string;
}) {
  if (!process.env.RESEND_API_KEY || !customerEmail) return;
  const content = {
    activated: ["Your vehicle widget is active", "Your MG AutoTech Vehicle Selector Widget is ready. Sign in to configure the design and copy your embed code."],
    payment_failed: ["Widget payment failed", "We could not collect your widget subscription payment. Public widget access has been paused until billing is updated."],
    domain_approved: ["Widget domain updated", "Your domain change request was approved. Use the widget only on the newly approved domain."],
    domain_rejected: ["Domain change request reviewed", "Your requested widget domain change was not approved. Your existing allowed domain remains unchanged."],
    key_changed: ["Widget public key changed", "A new public widget key was generated. Replace the old embed code on your website."],
    cancelled: ["Widget subscription cancelled", "Your vehicle widget subscription has ended and public widget access is disabled."],
  }[event];
  const result = await getResendClient().emails.send({
    from: fromEmail,
    to: customerEmail,
    subject: content[0],
    html: `<div style="font-family:Arial,sans-serif;background:#050505;color:#fff;padding:30px"><div style="max-width:650px;margin:auto;background:#111;border:1px solid #333;border-radius:18px;padding:26px"><p style="color:#ff4b5c;font-size:12px;font-weight:bold;letter-spacing:2px;text-transform:uppercase">MG AutoTech Vehicle Widget</p><h1 style="font-size:28px">${escapeHtml(content[0])}</h1><p style="color:#bbb;line-height:1.7">Hello ${escapeHtml(companyName || "Partner")},</p><p style="color:#ddd;line-height:1.7">${escapeHtml(content[1])}</p>${detail ? `<p style="background:#050505;border-radius:12px;padding:14px;color:#bbb">${escapeHtml(detail)}</p>` : ""}<a href="${siteUrl}/dashboard/widget" style="display:inline-block;margin-top:16px;background:#b1121b;color:white;text-decoration:none;padding:14px 20px;border-radius:12px;font-weight:bold">Open Widget Dashboard</a></div></div>`,
  }, widgetEmailRequestOptions(idempotencyKey));
  if (result.error) throw new Error(result.error.message);
}

export async function sendNewWidgetSubscriberNotification({
  companyName,
  customerEmail,
  domain,
  subscriptionId,
  idempotencyKey,
}: {
  companyName: string;
  customerEmail: string;
  domain: string;
  subscriptionId: string | null;
  idempotencyKey?: string;
}) {
  if (!process.env.RESEND_API_KEY) return;
  const result = await getResendClient().emails.send({
    from: fromEmail,
    to: adminNotificationEmail,
    subject: `New Widget Subscriber: ${companyName}`,
    html: `<div style="font-family:Arial,sans-serif;background:#050505;color:#fff;padding:30px"><div style="max-width:650px;margin:auto;background:#111;border:1px solid #333;border-radius:18px;padding:26px"><p style="color:#ff4b5c;font-size:12px;font-weight:bold;letter-spacing:2px;text-transform:uppercase">MG AutoTech Vehicle Widget</p><h1>New widget subscriber</h1><p><strong>Company:</strong> ${escapeHtml(companyName)}</p><p><strong>E-mail:</strong> ${escapeHtml(customerEmail)}</p><p><strong>Allowed domain:</strong> ${escapeHtml(domain)}</p><p><strong>Stripe subscription:</strong> ${escapeHtml(subscriptionId || "pending")}</p><a href="${siteUrl}/admin/widget-clients" style="display:inline-block;margin-top:16px;background:#b1121b;color:white;text-decoration:none;padding:14px 20px;border-radius:12px;font-weight:bold">Open Widget Clients</a></div></div>`,
  }, widgetEmailRequestOptions(idempotencyKey));
  if (result.error) throw new Error(result.error.message);
}

export async function sendWidgetEnquiryEmail({
  targetEmail,
  companyName,
  visitorName,
  visitorEmail,
  visitorPhone,
  visitorLocation,
  vehicleRegistration,
  message,
  vehicleName,
  stage,
  services,
  performance,
  requestDomain,
}: {
  targetEmail: string;
  companyName: string;
  visitorName: string;
  visitorEmail: string;
  visitorPhone?: string;
  visitorLocation?: string;
  vehicleRegistration?: string;
  message?: string;
  vehicleName: string;
  stage: "Stage 1" | "Stage 2" | "Stage 3";
  services: string[];
  performance: { stockHp: number | null; tunedHp: number | null; gainHp: number | null; stockNm: number | null; tunedNm: number | null; gainNm: number | null };
  requestDomain: string;
}) {
  if (!process.env.RESEND_API_KEY) throw new Error("RESEND_API_KEY is missing");
  const serviceList = services.length
    ? services.map((service) => `<li style="margin:0 0 7px">${escapeHtml(service)}</li>`).join("")
    : '<li style="color:#888">No additional option selected</li>';
  const metric = (label: string, stock: number | null, tuned: number | null, gain: number | null, unit: string) =>
    `<tr><td style="padding:10px 0;color:#888">${label}</td><td style="padding:10px 0;text-align:right;font-weight:bold">${stock ?? "-"} &rarr; ${tuned ?? "-"} ${unit}${gain !== null ? ` <span style="color:#22c55e">(+${gain})</span>` : ""}</td></tr>`;

  const result = await getResendClient().emails.send({
    from: fromEmail,
    to: targetEmail,
    replyTo: visitorEmail,
    subject: `New vehicle enquiry: ${vehicleName}`,
    html: `<div style="font-family:Arial,sans-serif;background:#050505;color:#fff;padding:30px"><div style="max-width:680px;margin:auto;background:#111;border:1px solid #333;border-radius:14px;padding:26px"><p style="margin:0 0 10px;color:#ff4b5c;font-size:12px;font-weight:bold;letter-spacing:2px;text-transform:uppercase">${escapeHtml(companyName)} vehicle enquiry</p><h1 style="margin:0 0 8px;font-size:26px">New tuning request</h1><p style="margin:0 0 22px;color:#aaa">A visitor submitted an enquiry through your MG AutoTech vehicle widget.</p><div style="background:#080808;border:1px solid #292929;border-radius:10px;padding:18px"><h2 style="margin:0 0 6px;font-size:19px">${escapeHtml(vehicleName)}</h2><div style="color:#ff6674;font-weight:bold">${escapeHtml(stage)}</div><table style="width:100%;margin-top:12px;border-collapse:collapse">${metric("Power", performance.stockHp, performance.tunedHp, performance.gainHp, "HP")}${metric("Torque", performance.stockNm, performance.tunedNm, performance.gainNm, "Nm")}</table></div><div style="margin-top:18px;background:#080808;border:1px solid #292929;border-radius:10px;padding:18px"><h3 style="margin:0 0 12px">Selected options</h3><ul style="margin:0;padding-left:20px">${serviceList}</ul></div><div style="margin-top:18px;background:#080808;border:1px solid #292929;border-radius:10px;padding:18px"><p><strong>Name:</strong> ${formatOptional(visitorName)}</p><p><strong>E-mail:</strong> ${formatOptional(visitorEmail)}</p><p><strong>Phone:</strong> ${formatOptional(visitorPhone || "")}</p><p><strong>Location:</strong> ${formatOptional(visitorLocation || "")}</p><p><strong>Registration:</strong> ${formatOptional(vehicleRegistration || "")}</p><p style="margin-bottom:0"><strong>Message:</strong><br>${formatOptional(message || "")}</p></div><p style="margin:18px 0 0;color:#777;font-size:12px">Source domain: ${escapeHtml(requestDomain || "-")} &middot; Reply directly to this e-mail to contact the visitor.</p></div></div>`,
  });
  if (result.error) throw new Error(result.error.message);
}
