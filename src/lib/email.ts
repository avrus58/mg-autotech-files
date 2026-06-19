import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const fromEmail =
  process.env.EMAIL_FROM || "MG AutoTech <noreply@file.mgautotech.de>";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL || "https://file.mgautotech.de";

const adminEmail = process.env.ADMIN_EMAIL || "info@mgautotech.de";

export async function sendNewOrderEmailToAdmin({
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

  await resend.emails.send({
    from: fromEmail,
    to: adminEmail,
    subject: `New File Request #${orderId.slice(0, 8).toUpperCase()}`,
    html: `
      <div style="font-family:Arial,sans-serif;background:#050505;color:#ffffff;padding:30px;">
        <div style="max-width:650px;margin:auto;background:#111;border:1px solid #333;border-radius:18px;padding:26px;">

          <h1 style="color:#e11d2e;margin-top:0;">
            New File Request
          </h1>

          <p>
            A new MG AutoTech file request has been submitted and is waiting in the admin panel.
          </p>

          <div style="background:#050505;border-radius:14px;padding:18px;margin:20px 0;">
            <p><strong>Order ID:</strong> #${orderId
              .slice(0, 8)
              .toUpperCase()}</p>
            <p><strong>Customer:</strong> ${customerEmail || "-"}</p>
            <p><strong>Vehicle:</strong> ${vehicle || "-"}</p>
            <p><strong>Service:</strong> ${service || "-"}</p>
            <p><strong>Credits:</strong> ${credits}</p>
          </div>

          <a
            href="${siteUrl}/admin"
            style="
              display:inline-block;
              background:#b1121b;
              color:white;
              text-decoration:none;
              padding:14px 20px;
              border-radius:12px;
              font-weight:bold;
            "
          >
            Open Admin Panel
          </a>

        </div>
      </div>
    `,
  });
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

  await resend.emails.send({
    from: fromEmail,
    to: customerEmail,
    subject: `Order Received #${orderId.slice(0, 8).toUpperCase()}`,
    html: `
      <div style="font-family:Arial,sans-serif;background:#050505;color:#ffffff;padding:30px;">
        <div style="max-width:650px;margin:auto;background:#111;border:1px solid #333;border-radius:18px;padding:26px;">

          <h1 style="color:#e11d2e;margin-top:0;">
            Order Successfully Received
          </h1>

          <p>
            Thank you for your order. Your file request has been received and is now waiting for processing.
          </p>

          <div style="background:#050505;border-radius:14px;padding:18px;margin:20px 0;">
            <p><strong>Order ID:</strong> #${orderId
              .slice(0, 8)
              .toUpperCase()}</p>
            <p><strong>Vehicle:</strong> ${vehicle}</p>
            <p><strong>Service:</strong> ${service}</p>
            <p><strong>Credits Used:</strong> ${credits}</p>
          </div>

          <a
            href="${siteUrl}/dashboard"
            style="
              display:inline-block;
              background:#b1121b;
              color:white;
              text-decoration:none;
              padding:14px 20px;
              border-radius:12px;
              font-weight:bold;
            "
          >
            Open Dashboard
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

  await resend.emails.send({
    from: fromEmail,
    to: customerEmail,
    subject: `Your File Is Ready #${orderId.slice(0, 8).toUpperCase()}`,
    html: `
      <div style="font-family:Arial,sans-serif;background:#050505;color:#ffffff;padding:30px;">
        <div style="max-width:650px;margin:auto;background:#111;border:1px solid #333;border-radius:18px;padding:26px;">

          <h1 style="color:#00d084;margin-top:0;">
            Your File Is Ready
          </h1>

          <p>
            Your modified file has been completed and is ready for download.
          </p>

          <div style="background:#050505;border-radius:14px;padding:18px;margin:20px 0;">
            <p><strong>Order ID:</strong> #${orderId
              .slice(0, 8)
              .toUpperCase()}</p>
            <p>Status: Completed</p>
          </div>

          <a
            href="${siteUrl}/dashboard"
            style="
              display:inline-block;
              background:#00a86b;
              color:white;
              text-decoration:none;
              padding:14px 20px;
              border-radius:12px;
              font-weight:bold;
            "
          >
            Download File
          </a>

        </div>
      </div>
    `,
  });
}
