import type { Metadata } from "next";
import Link from "next/link";
import { LegalPageShell, LegalSection } from "@/components/legal/LegalPageShell";
import { absoluteUrl } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Privacy information",
  description: "English privacy information for the MG AutoTech File Service platform and Vehicle Selector Widget.",
  alternates: {
    canonical: absoluteUrl("/privacy"),
    languages: {
      en: absoluteUrl("/privacy"),
      de: absoluteUrl("/datenschutz"),
      "x-default": absoluteUrl("/privacy"),
    },
  },
};

export default function PrivacyPage() {
  return (
    <LegalPageShell
      language="en"
      eyebrow="Privacy information"
      title="Privacy policy"
      updatedAt="29 August 2026"
    >
      <p className="mb-7 rounded-lg border border-amber-700/30 bg-amber-950/20 p-4 text-sm text-amber-100">
        This English version is provided for information. The German{" "}
        <Link className="font-black text-white underline hover:text-red-300" href="/datenschutz">
          Datenschutzerklärung
        </Link>{" "}
        is the legally binding version.
      </p>

      <LegalSection title="1. Controller">
        <p><strong className="text-white">MG AutoTech, owner Melih Gökkaya</strong><br />Böckinger Str. 32, 70437 Stuttgart, Germany<br />E-mail: <a className="font-bold text-white hover:text-red-400" href="mailto:info@mgautotech.de">info@mgautotech.de</a><br />Telephone: <a className="font-bold text-white hover:text-red-400" href="tel:+4915151561670">+49 151 51561670</a></p>
      </LegalSection>

      <LegalSection title="2. Data processed and purposes">
        <p>We process master data, contact details, customer and account identifiers, vehicle and control-unit data, order and service data, messages, payment status, uploaded original files, delivered file versions, and technical security and access logs.</p>
        <p>Processing is carried out to provide the customer account, perform File Service orders, handle billing and communication, secure the portal, diagnose errors, and meet legal record-keeping obligations.</p>
      </LegalSection>

      <LegalSection title="3. Legal bases">
        <p>The legal bases include Article 6(1)(b) GDPR for contracts and pre-contractual steps, Article 6(1)(c) GDPR for legal obligations, Article 6(1)(f) GDPR for IT security, abuse prevention and reliable service operation, and Article 6(1)(a) GDPR where consent is requested.</p>
      </LegalSection>

      <LegalSection title="4. Hosting, database and file storage">
        <p>The public website and File Service application run on a virtual private server (<strong className="text-white">VPS</strong>) provided by <strong className="text-white">Hostinger</strong>. <strong className="text-white">Supabase</strong> provides customer accounts and authentication, database functions, and file storage.</p>
        <p>Access to the website and application passes through <strong className="text-white">Cloudflare</strong> as a CDN, reverse proxy and security service; <strong className="text-white">Caddy</strong> forwards requests to the application on the VPS. For these purposes, Cloudflare may process technical connection and security data such as IP address, time, requested resource, browser and device information, and security signals.</p>
        <p>These services process the data required for their respective technical functions. This may include the account, order and file data described above, as well as technical connection data such as IP address, time, requested resource, browser information and security events.</p>
      </LegalSection>

      <LegalSection title="5. E-mail and support">
        <p>Transactional and notification e-mails are sent through <strong className="text-white">Resend</strong>. This involves processing the recipient address, message content, delivery status and technical delivery information. Direct support enquiries are stored to handle and document the request.</p>
      </LegalSection>

      <LegalSection title="6. Payments">
        <p>Depending on the selected method, card payments are handled by <strong className="text-white">Stripe</strong>, or bank transfers are assigned manually. Stripe processes payment and transaction data under its own data-protection responsibility. MG AutoTech generally receives only the payment status and reference information needed for assignment, confirmation, accounting and fraud prevention. Bank transfers are assigned using the transmitted bank and payment-reference data.</p>
      </LegalSection>

      <LegalSection title="7. Sign-in and Google login">
        <p>Technically required authentication information and session cookies are used for sign-in. If you voluntarily choose “Continue with Google”, you are directed to Google, which processes the data needed for sign-in. MG AutoTech receives the basic profile data released by Google, such as e-mail address and name.</p>
        <p>We use <strong className="text-white">Cloudflare Turnstile</strong> for protected authentication flows. Cloudflare processes technical connection, browser, device and security signals to detect automated or abusive access. The resulting verification token is sent to Supabase with the relevant authentication operation and is verified there on the server side.</p>
      </LegalSection>

      <LegalSection title="8. Cookies, browser storage and optional measurement">
        <p>We use technically necessary cookies and browser storage for sign-in, session management, language selection, security functions and saving your privacy choice. Analytics and advertising measurement are disabled by default and are enabled only after your active choice.</p>
        <p>If you consent to analytics, <strong className="text-white">Google Analytics</strong> is used on approved public content pages to measure page use and the secure request funnel. If you additionally consent to advertising measurement, <strong className="text-white">Google Ads</strong> is used to understand whether an advertisement leads to a verified registration, request or payment. Personalized advertising remains disabled.</p>
        <p>Only information intended for measurement is sent to Google. This may include the sanitized public page path without query parameters or fragments, browser and device information, consent state, and available campaign or ad-click identifiers. For verified outcomes, the event type, a pseudonymous deduplication identifier and, for a verified payment, amount and currency may also be sent. File names, vehicle data, e-mail addresses, account data and order numbers are not sent to Google as measurement events.</p>
        <p>With analytics consent, MG AutoTech also uses a random visitor identifier and processes the public landing path, source and medium, an allow-listed campaign name, referrer domain only, an available country code and browser language for internal campaign attribution. After successful sign-in, this identifier can be linked internally to verified account events so registrations, requests and payments can be attributed to their source. Search terms and complete referrer URLs are not stored for this purpose; the visitor identifier is processed on the server as a one-way value.</p>
        <p>You can change or withdraw your choice at any time through the privacy settings available on the website. Withdrawal applies to future processing.</p>
      </LegalSection>

      <LegalSection title="9. Vehicle Selector Widget">
        <p>When an embedded widget is loaded, technical access data is processed to deliver it, verify the domain, diagnose errors, enforce usage limits and prevent abuse. This may include the time, path, approved and requesting domain, language, browser identifier, access status and a non-reversible hash of the IP address. The raw IP address is not stored in the widget access log.</p>
        <p>When a vehicle is selected, only the vehicle data required for that specific selection is sent to the previously approved website. Operators of embedding websites remain responsible for their own privacy information, contact forms and further processing.</p>
      </LegalSection>

      <LegalSection title="10. Storage duration">
        <p>We retain data only for as long as needed for the account, order, support, security and billing purposes. Contract, payment and booking data is retained in line with legal retention obligations. Files and technical logs are deleted or anonymised when their purpose no longer applies and no contractual, security-related or legal reason requires continued retention.</p>
      </LegalSection>

      <LegalSection title="11. Your rights">
        <p>Subject to the GDPR, data subjects have rights of access, rectification, erasure, restriction of processing, data portability and objection. Consent can be withdrawn at any time with effect for the future.</p>
        <p>Please send requests to <a className="font-bold text-white hover:text-red-400" href="mailto:info@mgautotech.de">info@mgautotech.de</a>. You also have the right to complain to a data-protection supervisory authority, particularly the authority responsible for Baden-Württemberg.</p>
      </LegalSection>

      <LegalSection title="12. Data security and updates">
        <p>We use appropriate technical and organisational measures, including encrypted transmission, role-based access, private file storage, time-limited download links, server-side permission checks and logging of security-relevant operations.</p>
        <p>This privacy information will be updated when the services used or processing workflows materially change.</p>
      </LegalSection>
    </LegalPageShell>
  );
}
