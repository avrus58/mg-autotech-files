import type { Metadata } from "next";
import { HowItWorksPageContent } from "@/components/HowItWorksPageContent";
import { getHowItWorksCopy, howItWorksJsonLd } from "@/lib/howItWorksI18n";
import { absoluteUrl, languageAlternates, organizationJsonLd, siteName, websiteJsonLd } from "@/lib/seo";

const copy = getHowItWorksCopy("en");
const pageUrl = absoluteUrl("/how-it-works");

export const metadata: Metadata = {
  title: copy.pageTitle,
  description: copy.description,
  alternates: {
    canonical: "/how-it-works",
    languages: languageAlternates("/how-it-works"),
  },
  openGraph: {
    title: copy.pageTitle,
    description: copy.description,
    url: pageUrl,
    siteName,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: copy.pageTitle,
    description: copy.description,
  },
};

export default function HowItWorksPage() {
  const pageJsonLd = howItWorksJsonLd("en", pageUrl);
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      organizationJsonLd(),
      websiteJsonLd("en"),
      {
        ...pageJsonLd.page,
        isPartOf: { "@id": `${absoluteUrl("/")}#website` },
        about: { "@id": `${absoluteUrl("/")}#organization` },
      },
      pageJsonLd.faq,
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <HowItWorksPageContent copy={copy} locale="en" />
    </>
  );
}
