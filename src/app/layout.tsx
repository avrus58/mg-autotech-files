import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { CustomerNotifications } from "@/components/CustomerNotifications";
import {
  absoluteUrl,
  hreflangByLocale,
  languageAlternates,
  organizationJsonLd,
  siteName,
  siteUrl,
  websiteJsonLd,
} from "@/lib/seo";
import { defaultLocale } from "@/lib/i18n";
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
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [organizationJsonLd(), websiteJsonLd(defaultLocale)],
  };

  return (
    <html
      lang={hreflangByLocale[defaultLocale]}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(jsonLd),
          }}
        />
        {children}
        <CustomerNotifications />
        <LanguageSwitcher />
      </body>
    </html>
  );
}
