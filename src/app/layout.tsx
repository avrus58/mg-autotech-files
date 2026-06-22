import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
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
    default: siteName,
    template: "%s | MG AutoTech",
  },

  description:
    "Professional ECU & TCU File Service Platform. Stage 1, Stage 2, TCU Tuning, DPF OFF, EGR OFF, AdBlue OFF, VMAX OFF, ECU Unlock and custom tuning solutions.",

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
  verification: {
    google: "google7844e5845c531482.html",
  },

  openGraph: {
    title: siteName,
    description:
      "Professional ECU & TCU File Service Platform for workshops and tuning companies.",
    url: siteUrl,
    siteName,
    locale: "en_US",
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
    title: siteName,
    description:
      "Professional ECU & TCU File Service Platform.",
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
        <LanguageSwitcher />
      </body>
    </html>
  );
}
