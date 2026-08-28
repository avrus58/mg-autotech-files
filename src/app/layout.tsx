import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { CustomerNotificationsRuntime } from "@/components/CustomerNotificationsRuntime";
import { PublicAnalyticsRuntime } from "@/components/analytics/PublicAnalyticsRuntime";
import { PaidClickPreHydrationGuard } from "@/components/analytics/PaidClickPreHydrationGuard";
import { AccountRuntimeBoundary } from "@/components/analytics/AccountRuntimeBoundary";
import { PlatformReliabilityMonitor } from "@/components/PlatformReliabilityMonitor";
import {
  absoluteUrl,
  hreflangByLocale,
  languageAlternates,
  organizationJsonLd,
  siteName,
  siteUrl,
  websiteJsonLd,
} from "@/lib/seo";
import { defaultLocale } from "@/lib/i18nConfig";
import { buildSearchEngineVerification } from "@/lib/searchEngineIndexing";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),

  title: {
    default: "ECU & TCU File Service for Workshops | MG AutoTech",
    template: "%s | MG AutoTech",
  },

  description:
    "Professional online ECU and TCU file service for workshops with secure upload, tracked orders and portal delivery. Stage 1, DPF, EGR, AdBlue and DTC services.",

  keywords: [
    "ECU Tuning",
    "TCU Tuning",
    "Stage 1",
    "Stage 2",
    "DPF OFF",
    "EGR OFF",
    "AdBlue OFF",
    "File Service",
    "ECU File Service",
    "Online ECU File Service",
    "ECU File Service Germany",
    "TCU File Service",
    "ECU File Upload Service",
    "ECU Tuning File Service",
    "TCU Tuning File Service",
    "BMW Tuning",
    "Mercedes Tuning",
    "VAG Tuning",
    "MG AutoTech",
  ],

  authors: [
    {
      name: "MG AutoTech",
    },
  ],

  creator: "MG AutoTech",
  publisher: "MG AutoTech",
  applicationName: siteName,
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
  },
  openGraph: {
    title: "ECU & TCU File Service for Workshops | MG AutoTech",
    description:
      "Professional online ECU and TCU file service for workshops with secure uploads, order tracking and controlled portal delivery.",
    url: siteUrl,
    siteName,
    locale: "en_US",
    alternateLocale: Object.values(hreflangByLocale).filter((locale) => locale !== "en"),
    type: "website",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "MG AutoTech ECU and TCU File Service",
      },
    ],
  },

  twitter: {
    card: "summary_large_image",
    title: "MG AutoTech ECU & TCU File Service",
    description:
      "Professional online ECU & TCU File Service Platform for workshops.",
    images: ["/opengraph-image"],
  },

  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": -1,
    },
  },

  verification: buildSearchEngineVerification(),

  alternates: {
    canonical: absoluteUrl("/"),
    languages: languageAlternates("/"),
    types: {
      "application/rss+xml": absoluteUrl("/feed.xml"),
    },
  },

  category: "automotive",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const googleAnalyticsMeasurementId =
    process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID?.trim() ?? "";
  const googleAdsId = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID?.trim() ?? "";
  const googleAdsRegistrationLabel =
    process.env.NEXT_PUBLIC_GOOGLE_ADS_REGISTRATION_LABEL?.trim() ?? "";
  const googleAdsRequestLabel =
    process.env.NEXT_PUBLIC_GOOGLE_ADS_REQUEST_LABEL?.trim() ?? "";
  const googleAdsPurchaseLabel =
    process.env.NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_LABEL?.trim() ?? "";
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [organizationJsonLd(), websiteJsonLd(defaultLocale)],
  };

  return (
    <html
      lang={hreflangByLocale[defaultLocale]}
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <PaidClickPreHydrationGuard />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(jsonLd),
          }}
        />
        {children}
        <AccountRuntimeBoundary />
        <PublicAnalyticsRuntime
          googleAnalyticsMeasurementId={googleAnalyticsMeasurementId}
          googleAdsId={googleAdsId}
          registrationLabel={googleAdsRegistrationLabel}
          requestLabel={googleAdsRequestLabel}
          purchaseLabel={googleAdsPurchaseLabel}
        />
        <PlatformReliabilityMonitor />
        <CustomerNotificationsRuntime />
        <LanguageSwitcher />
      </body>
    </html>
  );
}
