import {
  detailTable,
  escapeHtml,
  htmlLayout,
  safeText,
  textBlock,
} from "@/lib/email/render";
import type {
  RenderedTransactionalEmail,
  TransactionalEmailContext,
  TransactionalEmailEventType,
  TransactionalEmailLanguage,
} from "@/lib/email/types";
import {
  renderExtendedLocalizedTransactionalEmailTemplate,
  type ExtendedTransactionalEmailLanguage,
} from "@/lib/email/extendedLocalizedTemplates";

type LocalizedLanguage = "en" | "tr";
type CopyValue = string | ((context: TransactionalEmailContext) => string);

type LocalizedEventCopy = {
  label: string;
  subject: CopyValue;
  title: CopyValue;
  intro: CopyValue;
  extraText?: CopyValue;
  ctaLabel?: string;
  footerNote?: string;
};

type AdminEventType =
  | "customer_registered"
  | "additional_file_uploaded"
  | "new_request_admin_notification"
  | "payment_needs_review_admin_notification"
  | "customer_replied_admin_notification"
  | "revision_requested_admin_notification"
  | "file_uploaded_admin_notification"
  | "failed_email_admin_alert"
  | "admin_email_test";

type CustomerEventType = Exclude<TransactionalEmailEventType, AdminEventType>;

type CommonCopy = {
  reference: string;
  customerId: string;
  status: string;
  vehicle: string;
  services: string;
  amount: string;
  credits: string;
  paymentReference: string;
  accountHolder: string;
  bank: string;
  account: string;
  company: string;
  file: string;
  message: string;
  actionRequired: string;
  openDashboard: string;
  support: string;
};

const commonCopy: Record<LocalizedLanguage, CommonCopy> = {
  en: {
    reference: "Reference",
    customerId: "Customer ID",
    status: "Status",
    vehicle: "Vehicle",
    services: "Services",
    amount: "Amount",
    credits: "Credits",
    paymentReference: "Payment reference",
    accountHolder: "Account holder",
    bank: "Bank",
    account: "Account",
    company: "Company",
    file: "File",
    message: "Message",
    actionRequired: "Action required",
    openDashboard: "Open dashboard",
    support: "Support",
  },
  tr: {
    reference: "Referans",
    customerId: "Müşteri No",
    status: "Durum",
    vehicle: "Araç",
    services: "Hizmetler",
    amount: "Tutar",
    credits: "Kredi",
    paymentReference: "Ödeme referansı",
    accountHolder: "Hesap sahibi",
    bank: "Banka",
    account: "Hesap",
    company: "Şirket",
    file: "Dosya",
    message: "Mesaj",
    actionRequired: "İşlem gerekli",
    openDashboard: "Paneli aç",
    support: "Destek",
  },
};

const customerCopy: Record<
  LocalizedLanguage,
  Record<CustomerEventType, LocalizedEventCopy>
> = {
  en: {
    customer_welcome: {
      label: "Account confirmed",
      subject: "MG AutoTech - Your customer account is ready",
      title: "Welcome to MG AutoTech",
      intro: "Your email address has been confirmed and your secure customer account is ready to use.",
      extraText: "In the customer portal you can manage credits, create ECU/TCU requests, upload files securely and follow each request status.",
    },
    customer_password_reset: {
      label: "Reset password",
      subject: "MG AutoTech - Secure password reset",
      title: "Reset your password securely",
      intro: "A password reset was requested for your MG AutoTech customer account.",
      extraText: "If you did not request this, ignore this email. Your current password will remain unchanged.",
      ctaLabel: "Reset password securely",
      footerNote: "This security link is intended only for the specified customer account. Do not share it with anyone.",
    },
    request_created: {
      label: "Request created",
      subject: (context) => `MG AutoTech - Your request ${context.requestNumber} was created`,
      title: (context) => `Your request ${context.requestNumber} was created`,
      intro: "Thank you. Your file request has reached MG AutoTech and will be handled securely through the customer portal.",
      extraText: "Next step: our team will review the file, vehicle details and selected services. Please keep an eye on your dashboard.",
    },
    request_abandoned_reminder: {
      label: "Request reminder",
      subject: "MG AutoTech - Your unfinished request is waiting",
      title: "Continue your request securely",
      intro: "You started a file request but did not submit it.",
      extraText: "To continue, open the customer portal and start a new request. If you no longer need it, no action is required.",
      ctaLabel: "Continue request",
    },
    request_received: {
      label: "Request received",
      subject: (context) => `MG AutoTech - Request ${context.requestNumber} received`,
      title: "Request received",
      intro: "Your request was received successfully.",
    },
    file_uploaded: {
      label: "File received",
      subject: (context) => `MG AutoTech - File received for request ${context.requestNumber}`,
      title: "File received",
      intro: "Your file was received. Further review takes place inside the secure MG AutoTech dashboard.",
    },
    additional_file_requested: {
      label: "Additional file required",
      subject: (context) => `MG AutoTech - Additional file required for request ${context.requestNumber}`,
      title: "Additional file required",
      intro: "An additional upload has been enabled in your dashboard so we can continue processing your request.",
      extraText: "Please upload only the requested file through the customer portal. Files are not processed by email.",
    },
    additional_file_uploaded_customer: {
      label: "Additional file confirmed",
      subject: (context) => `MG AutoTech - Additional file received for request ${context.requestNumber}`,
      title: "Additional file received",
      intro: "Your additional file was received securely and attached to the request.",
      extraText: "Our team will continue with the updated information.",
    },
    request_in_review: {
      label: "Request in review",
      subject: (context) => `MG AutoTech - Your request ${context.requestNumber} is under review`,
      title: "Your request is under review",
      intro: "Our team is reviewing your file and selected services.",
    },
    request_in_progress: {
      label: "Request in progress",
      subject: (context) => `MG AutoTech - Your request ${context.requestNumber} is in progress`,
      title: "Your request is in progress",
      intro: "Your request is now being processed by MG AutoTech.",
    },
    request_waiting_for_customer: {
      label: "Waiting for customer",
      subject: (context) => `MG AutoTech - Your response is required for request ${context.requestNumber}`,
      title: "Your response is required",
      intro: "We need a response or an additional file from you before work can continue.",
    },
    request_completed: {
      label: "Request completed",
      subject: (context) => `MG AutoTech - Your request ${context.requestNumber} was completed`,
      title: "Your request was completed",
      intro: "Work on your request has been completed. Full details are available in your dashboard.",
    },
    request_delivered: {
      label: "Request delivered",
      subject: (context) => `MG AutoTech - Your file for request ${context.requestNumber} is ready`,
      title: "Your file is ready",
      intro: "The final information for your request is available in the secure dashboard.",
    },
    request_cancelled: {
      label: "Request cancelled",
      subject: (context) => `MG AutoTech - Your request ${context.requestNumber} was cancelled`,
      title: "Your request was cancelled",
      intro: "This request was cancelled. Please contact support if you have any questions.",
    },
    request_rejected_or_not_possible: {
      label: "Request not possible",
      subject: (context) => `MG AutoTech - Request ${context.requestNumber} cannot be completed`,
      title: "Request currently not possible",
      intro: "After review, this request cannot currently be completed safely. Details are available through the dashboard or support.",
    },
    credit_purchase_started: {
      label: "Credit purchase started",
      subject: "MG AutoTech - Credit purchase started",
      title: "Credit purchase started",
      intro: "Your credit purchase has started. Credits are added after payment is confirmed.",
    },
    bank_transfer_instructions: {
      label: "Bank transfer",
      subject: (context) => `MG AutoTech - Payment information ${context.requestNumber && context.requestNumber !== "-" ? `for request ${context.requestNumber}` : "for credits"}`,
      title: "Bank transfer information",
      intro: "Please use the stated reference so your payment can be matched correctly.",
      extraText: "Credits are added manually after the payment has been reviewed.",
    },
    payment_received: {
      label: "Payment received",
      subject: "MG AutoTech - Payment received",
      title: "Payment received",
      intro: "Your payment has been confirmed.",
    },
    credits_added: {
      label: "Credits added",
      subject: "MG AutoTech - Credits added to your account",
      title: "Credits added",
      intro: "The credits have been added to your MG AutoTech account.",
    },
    payment_failed: {
      label: "Payment failed",
      subject: "MG AutoTech - Payment failed",
      title: "Payment failed",
      intro: "The payment could not be confirmed. Please try again or choose bank transfer.",
    },
    payment_pending_review: {
      label: "Payment under review",
      subject: "MG AutoTech - Payment under review",
      title: "Payment under review",
      intro: "Your payment is waiting for manual review.",
    },
    customer_visible_message_added: {
      label: "New message",
      subject: (context) => `MG AutoTech - New message for request ${context.requestNumber}`,
      title: "New message for your request",
      intro: "MG AutoTech sent you a new message in the customer portal.",
    },
    upload_permission_enabled: {
      label: "Upload enabled",
      subject: (context) => `MG AutoTech - Additional file required for request ${context.requestNumber}`,
      title: "Additional file required",
      intro: "An additional upload has been enabled in your dashboard so we can continue processing your request.",
      extraText: "Please upload only the requested file through the customer portal. Files are not processed by email.",
    },
    upload_permission_disabled: {
      label: "Upload disabled",
      subject: (context) => `MG AutoTech - Upload disabled for request ${context.requestNumber}`,
      title: "Additional upload disabled",
      intro: "The additional upload for this request has been disabled.",
    },
    delivery_completed: {
      label: "Delivery completed",
      subject: (context) => `MG AutoTech - Your file for request ${context.requestNumber} is ready`,
      title: "Your file is ready",
      intro: "The final information for your request is available in the secure dashboard.",
    },
  },
  tr: {
    customer_welcome: {
      label: "Hesap doğrulandı",
      subject: "MG AutoTech - Müşteri hesabınız hazır",
      title: "MG AutoTech'e hoş geldiniz",
      intro: "E-posta adresiniz doğrulandı ve güvenli müşteri hesabınız kullanıma hazır.",
      extraText: "Müşteri panelinde kredilerinizi yönetebilir, ECU/TCU talepleri oluşturabilir, dosyalarınızı güvenli şekilde yükleyebilir ve talep durumunu takip edebilirsiniz.",
    },
    customer_password_reset: {
      label: "Şifre sıfırlama",
      subject: "MG AutoTech - Güvenli şifre sıfırlama",
      title: "Şifrenizi güvenle sıfırlayın",
      intro: "MG AutoTech müşteri hesabınız için şifre sıfırlama talebi oluşturuldu.",
      extraText: "Bu talebi siz oluşturmadıysanız e-postayı dikkate almayın. Mevcut şifreniz değişmeden kalacaktır.",
      ctaLabel: "Şifreyi güvenle sıfırla",
      footerNote: "Bu güvenlik bağlantısı yalnızca belirtilen müşteri hesabı içindir. Bağlantıyı hiç kimseyle paylaşmayın.",
    },
    request_created: {
      label: "Talep oluşturuldu",
      subject: (context) => `MG AutoTech - ${context.requestNumber} numaralı talebiniz oluşturuldu`,
      title: (context) => `${context.requestNumber} numaralı talebiniz oluşturuldu`,
      intro: "Teşekkür ederiz. Dosya talebiniz MG AutoTech'e ulaştı ve müşteri panelinde güvenli şekilde işlenecek.",
      extraText: "Sonraki adım: ekibimiz dosyayı, araç bilgilerini ve seçilen hizmetleri inceleyecek. Lütfen panelinizi takip edin.",
    },
    request_abandoned_reminder: {
      label: "Talep hatirlatmasi",
      subject: "MG AutoTech - Tamamlanmamis talebiniz sizi bekliyor",
      title: "Talebinize guvenle devam edin",
      intro: "Bir dosya talebi baslattiniz ancak henuz gondermediniz.",
      extraText: "Devam etmek icin musteri panelini acip yeni talebi tamamlayin. Artik ihtiyaciniz yoksa herhangi bir islem yapmaniz gerekmez.",
      ctaLabel: "Talebe devam et",
    },
    request_received: {
      label: "Talep alındı",
      subject: (context) => `MG AutoTech - ${context.requestNumber} numaralı talep alındı`,
      title: "Talebiniz alındı",
      intro: "Talebiniz başarıyla alındı.",
    },
    file_uploaded: {
      label: "Dosya alındı",
      subject: (context) => `MG AutoTech - ${context.requestNumber} numaralı talebin dosyası alındı`,
      title: "Dosyanız alındı",
      intro: "Dosyanız alındı. İnceleme güvenli MG AutoTech panelinde devam edecektir.",
    },
    additional_file_requested: {
      label: "Ek dosya gerekli",
      subject: (context) => `MG AutoTech - ${context.requestNumber} numaralı talep için ek dosya gerekli`,
      title: "Ek dosya gerekli",
      intro: "Talebinize devam edebilmemiz için panelinizde ek dosya yükleme alanı açıldı.",
      extraText: "Lütfen yalnızca istenen dosyayı müşteri panelinden yükleyin. Dosyalar e-posta üzerinden işlenmez.",
    },
    additional_file_uploaded_customer: {
      label: "Ek dosya onaylandı",
      subject: (context) => `MG AutoTech - ${context.requestNumber} numaralı talebin ek dosyası alındı`,
      title: "Ek dosyanız alındı",
      intro: "Ek dosyanız güvenli şekilde alındı ve talebinize bağlandı.",
      extraText: "Ekibimiz güncel bilgilerle işleme devam edecektir.",
    },
    request_in_review: {
      label: "Talep inceleniyor",
      subject: (context) => `MG AutoTech - ${context.requestNumber} numaralı talebiniz inceleniyor`,
      title: "Talebiniz inceleniyor",
      intro: "Ekibimiz dosyanızı ve seçilen hizmetleri inceliyor.",
    },
    request_in_progress: {
      label: "Talep işleniyor",
      subject: (context) => `MG AutoTech - ${context.requestNumber} numaralı talebiniz işleniyor`,
      title: "Talebiniz işleniyor",
      intro: "Talebiniz MG AutoTech ekibi tarafından işleme alındı.",
    },
    request_waiting_for_customer: {
      label: "Müşteri yanıtı bekleniyor",
      subject: (context) => `MG AutoTech - ${context.requestNumber} numaralı talep için yanıtınız gerekli`,
      title: "Yanıtınız gerekli",
      intro: "İşleme devam edebilmemiz için yanıtınıza veya ek bir dosyaya ihtiyacımız var.",
    },
    request_completed: {
      label: "Talep tamamlandı",
      subject: (context) => `MG AutoTech - ${context.requestNumber} numaralı talebiniz tamamlandı`,
      title: "Talebiniz tamamlandı",
      intro: "Talebiniz üzerindeki çalışma tamamlandı. Tüm ayrıntıları panelinizde görebilirsiniz.",
    },
    request_delivered: {
      label: "Talep teslim edildi",
      subject: (context) => `MG AutoTech - ${context.requestNumber} numaralı talebinizin dosyası hazır`,
      title: "Dosyanız hazır",
      intro: "Talebinizin son bilgileri güvenli müşteri panelinde hazırdır.",
    },
    request_cancelled: {
      label: "Talep iptal edildi",
      subject: (context) => `MG AutoTech - ${context.requestNumber} numaralı talebiniz iptal edildi`,
      title: "Talebiniz iptal edildi",
      intro: "Bu talep iptal edildi. Sorularınız için destek ekibimizle iletişime geçebilirsiniz.",
    },
    request_rejected_or_not_possible: {
      label: "Talep gerçekleştirilemiyor",
      subject: (context) => `MG AutoTech - ${context.requestNumber} numaralı talep gerçekleştirilemiyor`,
      title: "Talep şu anda gerçekleştirilemiyor",
      intro: "İnceleme sonucunda bu talep şu anda güvenli şekilde gerçekleştirilemiyor. Ayrıntılar panel veya destek üzerinden paylaşılacaktır.",
    },
    credit_purchase_started: {
      label: "Kredi satın alımı başladı",
      subject: "MG AutoTech - Kredi satın alımı başladı",
      title: "Kredi satın alımı başladı",
      intro: "Kredi satın alma işleminiz başladı. Ödeme onaylandıktan sonra krediler hesabınıza eklenecektir.",
    },
    bank_transfer_instructions: {
      label: "Banka havalesi",
      subject: (context) => `MG AutoTech - ${context.requestNumber && context.requestNumber !== "-" ? `${context.requestNumber} numaralı talep için ödeme bilgileri` : "Kredi ödeme bilgileri"}`,
      title: "Banka havalesi bilgileri",
      intro: "Ödemenizin doğru eşleştirilmesi için lütfen belirtilen referansı kullanın.",
      extraText: "Ödeme incelendikten sonra krediler manuel olarak hesabınıza eklenecektir.",
    },
    payment_received: {
      label: "Ödeme alındı",
      subject: "MG AutoTech - Ödemeniz alındı",
      title: "Ödemeniz alındı",
      intro: "Ödemeniz onaylandı.",
    },
    credits_added: {
      label: "Krediler eklendi",
      subject: "MG AutoTech - Krediler hesabınıza eklendi",
      title: "Krediler hesabınıza eklendi",
      intro: "Krediler MG AutoTech hesabınıza eklendi.",
    },
    payment_failed: {
      label: "Ödeme başarısız",
      subject: "MG AutoTech - Ödeme başarısız",
      title: "Ödeme başarısız",
      intro: "Ödeme onaylanamadı. Lütfen yeniden deneyin veya banka havalesini seçin.",
    },
    payment_pending_review: {
      label: "Ödeme inceleniyor",
      subject: "MG AutoTech - Ödemeniz inceleniyor",
      title: "Ödemeniz inceleniyor",
      intro: "Ödemeniz manuel inceleme bekliyor.",
    },
    customer_visible_message_added: {
      label: "Yeni mesaj",
      subject: (context) => `MG AutoTech - ${context.requestNumber} numaralı talep için yeni mesaj`,
      title: "Talebiniz için yeni mesaj",
      intro: "MG AutoTech müşteri panelinde size yeni bir mesaj gönderdi.",
    },
    upload_permission_enabled: {
      label: "Yükleme açıldı",
      subject: (context) => `MG AutoTech - ${context.requestNumber} numaralı talep için ek dosya gerekli`,
      title: "Ek dosya gerekli",
      intro: "Talebinize devam edebilmemiz için panelinizde ek dosya yükleme alanı açıldı.",
      extraText: "Lütfen yalnızca istenen dosyayı müşteri panelinden yükleyin. Dosyalar e-posta üzerinden işlenmez.",
    },
    upload_permission_disabled: {
      label: "Yükleme kapatıldı",
      subject: (context) => `MG AutoTech - ${context.requestNumber} numaralı talep için yükleme kapatıldı`,
      title: "Ek dosya yükleme kapatıldı",
      intro: "Bu talep için ek dosya yükleme alanı kapatıldı.",
    },
    delivery_completed: {
      label: "Teslimat tamamlandı",
      subject: (context) => `MG AutoTech - ${context.requestNumber} numaralı talebinizin dosyası hazır`,
      title: "Dosyanız hazır",
      intro: "Talebinizin son bilgileri güvenli müşteri panelinde hazırdır.",
    },
  },
};

const adminCopy: Record<AdminEventType, LocalizedEventCopy> = {
  customer_registered: {
    label: "Customer registered",
    subject: (context) => `New MG AutoTech customer: ${safeText(context.customerEmail, "Customer")}`,
    title: "New customer registered",
    intro: "A new customer account was created on the MG AutoTech platform.",
  },
  additional_file_uploaded: {
    label: "Additional file uploaded",
    subject: (context) => `Additional file uploaded for request ${context.requestNumber}`,
    title: "Customer uploaded an additional file",
    intro: "A requested additional file was uploaded through the portal.",
  },
  new_request_admin_notification: {
    label: "New request",
    subject: (context) => `New MG AutoTech request ${context.requestNumber}`,
    title: "New request received",
    intro: "A new customer request was created.",
  },
  payment_needs_review_admin_notification: {
    label: "Payment needs review",
    subject: "MG AutoTech payment needs review",
    title: "Payment needs review",
    intro: "A payment should be reviewed in the admin panel.",
  },
  customer_replied_admin_notification: {
    label: "Customer reply",
    subject: (context) => `Customer reply for request ${context.requestNumber}`,
    title: "Customer replied",
    intro: "A new customer message was created in the portal.",
  },
  revision_requested_admin_notification: {
    label: "Revision requested",
    subject: (context) => `Revision requested for request ${context.requestNumber}`,
    title: "Customer requested a revision",
    intro: "A new revision request was submitted for a delivered request.",
  },
  file_uploaded_admin_notification: {
    label: "File uploaded",
    subject: (context) => `File uploaded for request ${context.requestNumber}`,
    title: "File uploaded",
    intro: "A file was uploaded through the customer portal.",
  },
  failed_email_admin_alert: {
    label: "Email delivery failure",
    subject: "MG AutoTech email delivery failure",
    title: "Email delivery failure",
    intro: "A transactional email could not be sent.",
  },
  admin_email_test: {
    label: "Admin test",
    subject: "MG AutoTech - Test email",
    title: "Test email",
    intro: "This is a safe test email from the admin panel.",
  },
};

function value(copy: CopyValue, context: TransactionalEmailContext) {
  return typeof copy === "function" ? copy(context) : copy;
}

function customerDetails(context: TransactionalEmailContext, copy: CommonCopy) {
  return detailTable([
    [copy.reference, context.requestNumber],
    [copy.customerId, context.customerId],
    [copy.status, context.statusLabel],
    [copy.vehicle, context.vehicleSummary],
    [copy.services, context.serviceSummary],
  ]);
}

function paymentDetails(context: TransactionalEmailContext, copy: CommonCopy) {
  return detailTable([
    [copy.amount, context.amountLabel],
    [copy.credits, context.credits ?? null],
    [copy.paymentReference, context.paymentReference || context.customerId || context.requestNumber],
    [copy.accountHolder, context.bankAccountName],
    [copy.bank, context.bankName],
    ["IBAN", context.bankIban],
    ["BIC", context.bankBic],
  ]);
}

function customerEventDetails(
  eventType: CustomerEventType,
  context: TransactionalEmailContext,
  copy: CommonCopy
) {
  if (eventType === "customer_welcome") {
    return detailTable([
      [copy.customerId, context.customerId],
      [copy.account, context.customerEmail],
      [copy.company, context.companyName],
    ]);
  }
  if (eventType === "customer_password_reset") {
    return detailTable([
      [copy.customerId, context.customerId],
      [copy.account, context.customerEmail],
    ]);
  }
  if (eventType === "file_uploaded") {
    return detailTable([
      [copy.reference, context.requestNumber],
      [copy.file, context.fileName],
      [copy.vehicle, context.vehicleSummary],
      [copy.services, context.serviceSummary],
    ]);
  }
  if (eventType === "additional_file_uploaded_customer") {
    return detailTable([
      [copy.reference, context.requestNumber],
      [copy.file, context.fileName],
      [copy.vehicle, context.vehicleSummary],
    ]);
  }
  if (
    eventType === "credit_purchase_started" ||
    eventType === "bank_transfer_instructions" ||
    eventType === "payment_received" ||
    eventType === "credits_added"
  ) {
    return paymentDetails(context, copy);
  }
  if (eventType === "customer_visible_message_added") {
    return `${customerDetails(context, copy)}${detailTable([[copy.message, context.messagePreview]])}`;
  }
  return customerDetails(context, copy);
}

function renderCustomerTemplate(
  eventType: CustomerEventType,
  context: TransactionalEmailContext,
  language: LocalizedLanguage
): RenderedTransactionalEmail {
  const copy = commonCopy[language];
  const event = customerCopy[language][eventType];
  const title = value(event.title, context);
  const intro = value(event.intro, context);
  const subject = value(event.subject, context);
  const extraText = event.extraText ? value(event.extraText, context) : null;
  const ctaUrl = eventType === "customer_password_reset"
    ? context.recoveryUrl
    : context.dashboardUrl;
  const ctaLabel = event.ctaLabel || copy.openDashboard;
  const details = customerEventDetails(eventType, context, copy);
  const actionRequired = context.actionRequired
    ? `<div style="margin:18px 0 0;border:1px solid #f2c6ca;background:#fff7f8;padding:14px 16px;color:#7f1d1d;font-size:13px;line-height:1.65;"><strong>${escapeHtml(copy.actionRequired)}:</strong> ${escapeHtml(safeText(context.actionRequired))}</div>`
    : "";
  const extra = extraText
    ? `<p style="margin:18px 0 0;color:#3f3f46;line-height:1.65;">${escapeHtml(safeText(extraText))}</p>`
    : "";
  const html = htmlLayout({
    language,
    preheader: intro,
    title,
    intro,
    content: `${details}${actionRequired}${extra}`,
    ctaLabel,
    ctaUrl,
    footerNote: event.footerNote,
  });
  const text = textBlock([
    "MG AutoTech",
    title,
    "",
    intro,
    "",
    context.requestNumber && context.requestNumber !== "-"
      ? `${copy.reference}: ${safeText(context.requestNumber)}`
      : null,
    context.customerId ? `${copy.customerId}: ${safeText(context.customerId)}` : null,
    context.statusLabel ? `${copy.status}: ${safeText(context.statusLabel)}` : null,
    context.vehicleSummary ? `${copy.vehicle}: ${safeText(context.vehicleSummary)}` : null,
    context.serviceSummary ? `${copy.services}: ${safeText(context.serviceSummary)}` : null,
    context.amountLabel ? `${copy.amount}: ${safeText(context.amountLabel)}` : null,
    typeof context.credits === "number" ? `${copy.credits}: ${context.credits}` : null,
    context.paymentReference ? `${copy.paymentReference}: ${safeText(context.paymentReference)}` : null,
    context.bankAccountName ? `${copy.accountHolder}: ${safeText(context.bankAccountName)}` : null,
    context.bankName ? `${copy.bank}: ${safeText(context.bankName)}` : null,
    context.bankIban ? `IBAN: ${safeText(context.bankIban)}` : null,
    context.bankBic ? `BIC: ${safeText(context.bankBic)}` : null,
    context.messagePreview ? `${copy.message}: ${safeText(context.messagePreview)}` : null,
    extraText,
    context.actionRequired ? `${copy.actionRequired}: ${safeText(context.actionRequired)}` : null,
    "",
    ctaUrl ? `${ctaLabel}: ${ctaUrl}` : null,
    `${copy.support}: ${safeText(context.supportEmail)}`,
  ]);
  return { subject, html, text };
}

function adminDetails(eventType: AdminEventType, context: TransactionalEmailContext) {
  if (eventType === "customer_registered") {
    return detailTable([
      ["Email", context.customerEmail],
      ["Name", context.customerName],
      ["Company", context.companyName],
      ["Customer ID", context.customerId],
    ]);
  }
  if (eventType === "additional_file_uploaded" || eventType === "file_uploaded_admin_notification") {
    return detailTable([
      ["Reference", context.requestNumber],
      ["File", context.fileName],
      ["Customer", context.customerEmail],
      ["Vehicle", context.vehicleSummary],
    ]);
  }
  if (eventType === "new_request_admin_notification") {
    return detailTable([
      ["Reference", context.requestNumber],
      ["Customer", context.customerEmail],
      ["Customer ID", context.customerId],
      ["Vehicle", context.vehicleSummary],
      ["Services", context.serviceSummary],
      ["Credits", context.credits ?? null],
    ]);
  }
  if (eventType === "payment_needs_review_admin_notification") {
    return paymentDetails(context, commonCopy.en);
  }
  if (eventType === "customer_replied_admin_notification" || eventType === "revision_requested_admin_notification") {
    return `${customerDetails(context, commonCopy.en)}${detailTable([["Message", context.messagePreview]])}`;
  }
  return customerDetails(context, commonCopy.en);
}

function renderAdminTemplate(
  eventType: AdminEventType,
  context: TransactionalEmailContext
): RenderedTransactionalEmail {
  const event = adminCopy[eventType];
  const subject = value(event.subject, context);
  const title = value(event.title, context);
  const intro = value(event.intro, context);
  const html = htmlLayout({
    language: "en",
    preheader: intro,
    title,
    intro,
    content: adminDetails(eventType, context),
    ctaLabel: "Open admin",
    ctaUrl: context.adminUrl,
    footerNote: "Admin notification. No raw data, hex previews or private storage paths are included.",
  });
  const text = textBlock([
    "MG AutoTech Admin",
    title,
    "",
    intro,
    "",
    context.requestNumber && context.requestNumber !== "-"
      ? `Reference: ${safeText(context.requestNumber)}`
      : null,
    context.customerEmail ? `Customer: ${safeText(context.customerEmail)}` : null,
    context.vehicleSummary ? `Vehicle: ${safeText(context.vehicleSummary)}` : null,
    context.serviceSummary ? `Services: ${safeText(context.serviceSummary)}` : null,
    context.messagePreview ? `Message: ${safeText(context.messagePreview)}` : null,
    "",
    context.adminUrl ? `Admin: ${context.adminUrl}` : null,
  ]);
  return { subject, html, text };
}

const adminEventTypes = new Set<TransactionalEmailEventType>(
  Object.keys(adminCopy) as AdminEventType[]
);

export function renderLocalizedTransactionalEmailTemplate(
  eventType: TransactionalEmailEventType,
  context: TransactionalEmailContext,
  language: Exclude<TransactionalEmailLanguage, "de">
) {
  if (adminEventTypes.has(eventType)) {
    return renderAdminTemplate(eventType as AdminEventType, context);
  }
  if (language !== "en" && language !== "tr") {
    return renderExtendedLocalizedTransactionalEmailTemplate(
      eventType,
      context,
      language as ExtendedTransactionalEmailLanguage
    );
  }
  return renderCustomerTemplate(eventType as CustomerEventType, context, language);
}
