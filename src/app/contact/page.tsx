import type { Metadata } from "next";
import Link from "next/link";
import { Clock3, Mail, MapPin, MessageCircle, Phone, ShieldCheck } from "lucide-react";
import { Footer } from "@/components/Footer";
import { PublicSeoHeader } from "@/components/PublicSeoHeader";
import { absoluteUrl, companyAddress, contactEmail, contactPhone, organizationJsonLd, siteName, websiteJsonLd } from "@/lib/seo";

const title = "Contact MG AutoTech";
const description = "Contact MG AutoTech in Stuttgart for ECU and TCU file-service questions, order support, compatibility checks and customer-account assistance.";

export const metadata: Metadata = {
  title, description, alternates: { canonical: absoluteUrl("/contact") },
  openGraph: { title: `${title} | MG AutoTech`, description, url: absoluteUrl("/contact"), siteName, type: "website", images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: title }] },
  twitter: { card: "summary_large_image", title, description, images: ["/opengraph-image"] },
};

export default function ContactPage() {
  const whatsappNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.replace(/\D/g, "");
  const whatsappHref = whatsappNumber ? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent("Hello MG AutoTech, I need help with a file service request.")}` : null;
  const jsonLd = { "@context": "https://schema.org", "@graph": [organizationJsonLd(), websiteJsonLd("en"), { "@type": "ContactPage", "@id": `${absoluteUrl("/contact")}#page`, name: title, description, url: absoluteUrl("/contact"), mainEntity: { "@id": `${absoluteUrl("/")}#organization` } }, { "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Home", item: absoluteUrl("/") }, { "@type": "ListItem", position: 2, name: "Contact", item: absoluteUrl("/contact") }] }] };
  const channels = [
    { icon: Mail, title: "Email support", value: contactEmail, href: `mailto:${contactEmail}`, text: "For account, order and technical request questions." },
    { icon: Phone, title: "Telephone", value: contactPhone, href: `tel:${contactPhone.replace(/\s/g, "")}`, text: "For direct business and workshop enquiries." },
    ...(whatsappHref ? [{ icon: MessageCircle, title: "WhatsApp", value: "Open WhatsApp", href: whatsappHref, text: "For concise order or compatibility questions." }] : []),
  ];
  return (
    <main data-no-translate className="min-h-screen bg-[#050505] text-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <PublicSeoHeader />
      <section className="border-b border-white/10 bg-[radial-gradient(circle_at_80%_10%,rgba(177,18,27,0.23),transparent_30%),#050505]"><div className="mx-auto max-w-7xl px-4 py-16 lg:py-24"><p className="text-xs font-black uppercase tracking-[0.24em] text-red-500">Customer and workshop support</p><h1 className="mt-6 max-w-5xl text-[clamp(2.7rem,8vw,5.2rem)] font-black leading-[0.96]">Contact MG AutoTech</h1><p className="mt-7 max-w-3xl text-lg leading-8 text-zinc-300">For an existing order, use the message area inside the customer dashboard so the conversation remains attached to the correct file request.</p></div></section>
      <section className="border-b border-white/10 bg-[#08090b]"><div className="mx-auto max-w-7xl px-4 py-16 lg:py-20"><div className="grid gap-4 md:grid-cols-3">{channels.map(({ icon: Icon, title: itemTitle, value, href, text }) => <article key={itemTitle} className="flex min-h-64 flex-col border border-white/10 bg-[#0d0e10] p-6"><Icon className="h-6 w-6 text-red-500" /><h2 className="mt-6 text-2xl font-black">{itemTitle}</h2><p className="mt-3 text-sm leading-7 text-zinc-400">{text}</p><a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel={href.startsWith("http") ? "noreferrer" : undefined} className="mt-auto break-all pt-6 text-sm font-black text-red-400 hover:text-red-300">{value}</a></article>)}</div></div></section>
      <section className="bg-[#050505]"><div className="mx-auto grid max-w-7xl gap-6 px-4 py-16 lg:grid-cols-2 lg:py-20"><div className="border border-white/10 bg-[#0b0c0e] p-6"><MapPin className="h-6 w-6 text-red-500" /><h2 className="mt-5 text-2xl font-black">Business address</h2><address className="mt-4 not-italic text-sm leading-7 text-zinc-300">MG AutoTech - Melih Gokkaya<br />{companyAddress.streetAddress}<br />{companyAddress.postalCode} {companyAddress.addressLocality}<br />Germany</address></div><div className="border border-white/10 bg-[#0b0c0e] p-6"><Clock3 className="h-6 w-6 text-red-500" /><h2 className="mt-5 text-2xl font-black">File-service availability</h2><p className="mt-4 text-sm leading-7 text-zinc-300">Requests can be submitted through the secure portal at any time. Live status and current response information are shown on the website; complex files may require manual review.</p><div className="mt-5 flex items-center gap-3 text-sm text-emerald-300"><ShieldCheck className="h-5 w-5" />Use your customer account for private file exchange.</div></div></div></section>
      <section className="border-y border-red-900/40 bg-red-950/15"><div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-12 md:flex-row md:items-center md:justify-between"><div><h2 className="text-3xl font-black">Already have an order?</h2><p className="mt-2 text-sm text-zinc-400">Open the order detail page to send a message with the correct request context.</p></div><Link href="/dashboard/orders" className="inline-flex items-center justify-center rounded-lg bg-[#b1121b] px-6 py-4 text-sm font-black hover:bg-[#c91824]">Open my orders</Link></div></section>
      <Footer />
    </main>
  );
}
