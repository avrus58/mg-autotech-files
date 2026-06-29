import { Resend } from "resend";

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
  if (!process.env.RESEND_API_KEY) return;

  await getResendClient().emails.send({
    from: fromEmail,
    to: customerEmail,
    subject: `Order Received #${orderId.slice(0, 8).toUpperCase()}`,
    html: `
      <div style="font-family:Arial,sans-serif;background:#050505;color:#ffffff;padding:30px;">
        <div style="max-width:650px;margin:auto;background:#111;border:1px solid #333;border-radius:18px;padding:26px;">
          <h1 style="color:#e11d2e;margin-top:0;">Order Successfully Received</h1>
          <p>Thank you for your order. Your file request has been received and is now waiting for processing.</p>
          <div style="background:#050505;border-radius:14px;padding:18px;margin:20px 0;">
            <p><strong>Order ID:</strong> #${orderId.slice(0, 8).toUpperCase()}</p>
            <p><strong>Vehicle:</strong> ${vehicle}</p>
            <p><strong>Service:</strong> ${service}</p>
            <p><strong>Credits Used:</strong> ${credits}</p>
          </div>
          <a href="${siteUrl}/dashboard" style="display:inline-block;background:#b1121b;color:white;text-decoration:none;padding:14px 20px;border-radius:12px;font-weight:bold;">
            Open Dashboard
          </a>
        </div>
      </div>
    `,
  });
}

export async function sendNewCustomerNotificationEmail({
  customerEmail,
  fullName,
  accountType,
  companyName,
  phone,
  source,
}: {
  customerEmail: string;
  fullName: string;
  accountType: string;
  companyName: string;
  phone: string;
  source: string;
}) {
  if (!process.env.RESEND_API_KEY) return;

  const safeEmail = formatOptional(customerEmail);
  const safeName = formatOptional(fullName);
  const safeAccountType = formatOptional(accountType);
  const safeCompany = formatOptional(companyName);
  const safePhone = formatOptional(phone);
  const safeSource = formatOptional(source || "email");

  await getResendClient().emails.send({
    from: fromEmail,
    to: adminNotificationEmail,
    subject: `New Customer Registered: ${customerEmail || "MG AutoTech"}`,
    html: `
      <div style="font-family:Arial,sans-serif;background:#050505;color:#ffffff;padding:30px;">
        <div style="max-width:650px;margin:auto;background:#111;border:1px solid #333;border-radius:18px;padding:26px;">
          <p style="margin:0 0 10px;color:#ff4b5c;font-size:12px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;">MG AutoTech customer notification</p>
          <h1 style="color:#ffffff;margin:0 0 14px;font-size:28px;">New customer registered</h1>
          <p style="color:#b7b7b7;line-height:1.7;margin:0 0 20px;">A new customer account has been created on the MG AutoTech file service platform.</p>

          <div style="background:#050505;border:1px solid #242424;border-radius:14px;padding:18px;margin:20px 0;">
            <p style="margin:0 0 10px;"><strong>E-mail:</strong> ${safeEmail}</p>
            <p style="margin:0 0 10px;"><strong>Name:</strong> ${safeName}</p>
            <p style="margin:0 0 10px;"><strong>Account type:</strong> ${safeAccountType}</p>
            <p style="margin:0 0 10px;"><strong>Company:</strong> ${safeCompany}</p>
            <p style="margin:0 0 10px;"><strong>Phone:</strong> ${safePhone}</p>
            <p style="margin:0;"><strong>Signup source:</strong> ${safeSource}</p>
          </div>

          <a href="${siteUrl}/admin" style="display:inline-block;background:#b1121b;color:white;text-decoration:none;padding:14px 20px;border-radius:12px;font-weight:bold;">
            Open Admin Panel
          </a>
        </div>
      </div>
    `,
  });
}

export async function sendOrderCompletedEmail({
  orderId,
  customerEmail,
}: {
  orderId: string;
  customerEmail: string;
}) {
  if (!process.env.RESEND_API_KEY) return;

  await getResendClient().emails.send({
    from: fromEmail,
    to: customerEmail,
    subject: `Your File Is Ready #${orderId.slice(0, 8).toUpperCase()}`,
    html: `
      <div style="font-family:Arial,sans-serif;background:#050505;color:#ffffff;padding:30px;">
        <div style="max-width:650px;margin:auto;background:#111;border:1px solid #333;border-radius:18px;padding:26px;">
          <h1 style="color:#00d084;margin-top:0;">Your File Is Ready</h1>
          <p>Your modified file has been completed and is ready for download.</p>
          <div style="background:#050505;border-radius:14px;padding:18px;margin:20px 0;">
            <p><strong>Order ID:</strong> #${orderId.slice(0, 8).toUpperCase()}</p>
            <p><strong>Status:</strong> Completed</p>
          </div>
          <a href="${siteUrl}/dashboard" style="display:inline-block;background:#00a86b;color:white;text-decoration:none;padding:14px 20px;border-radius:12px;font-weight:bold;">
            Download File
          </a>
        </div>
      </div>
    `,
  });
}

export async function sendWidgetLifecycleEmail({
  customerEmail,
  companyName,
  event,
  detail,
}: {
  customerEmail: string;
  companyName: string;
  event: "activated" | "payment_failed" | "domain_approved" | "domain_rejected" | "key_changed" | "cancelled";
  detail?: string;
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
  await getResendClient().emails.send({
    from: fromEmail,
    to: customerEmail,
    subject: content[0],
    html: `<div style="font-family:Arial,sans-serif;background:#050505;color:#fff;padding:30px"><div style="max-width:650px;margin:auto;background:#111;border:1px solid #333;border-radius:18px;padding:26px"><p style="color:#ff4b5c;font-size:12px;font-weight:bold;letter-spacing:2px;text-transform:uppercase">MG AutoTech Vehicle Widget</p><h1 style="font-size:28px">${escapeHtml(content[0])}</h1><p style="color:#bbb;line-height:1.7">Hello ${escapeHtml(companyName || "Partner")},</p><p style="color:#ddd;line-height:1.7">${escapeHtml(content[1])}</p>${detail ? `<p style="background:#050505;border-radius:12px;padding:14px;color:#bbb">${escapeHtml(detail)}</p>` : ""}<a href="${siteUrl}/dashboard/widget" style="display:inline-block;margin-top:16px;background:#b1121b;color:white;text-decoration:none;padding:14px 20px;border-radius:12px;font-weight:bold">Open Widget Dashboard</a></div></div>`,
  });
}

export async function sendNewWidgetSubscriberNotification({
  companyName,
  customerEmail,
  domain,
  subscriptionId,
}: {
  companyName: string;
  customerEmail: string;
  domain: string;
  subscriptionId: string | null;
}) {
  if (!process.env.RESEND_API_KEY) return;
  await getResendClient().emails.send({
    from: fromEmail,
    to: adminNotificationEmail,
    subject: `New Widget Subscriber: ${companyName}`,
    html: `<div style="font-family:Arial,sans-serif;background:#050505;color:#fff;padding:30px"><div style="max-width:650px;margin:auto;background:#111;border:1px solid #333;border-radius:18px;padding:26px"><p style="color:#ff4b5c;font-size:12px;font-weight:bold;letter-spacing:2px;text-transform:uppercase">MG AutoTech Vehicle Widget</p><h1>New widget subscriber</h1><p><strong>Company:</strong> ${escapeHtml(companyName)}</p><p><strong>E-mail:</strong> ${escapeHtml(customerEmail)}</p><p><strong>Allowed domain:</strong> ${escapeHtml(domain)}</p><p><strong>Stripe subscription:</strong> ${escapeHtml(subscriptionId || "pending")}</p><a href="${siteUrl}/admin/widget-clients" style="display:inline-block;margin-top:16px;background:#b1121b;color:white;text-decoration:none;padding:14px 20px;border-radius:12px;font-weight:bold">Open Widget Clients</a></div></div>`,
  });
}
