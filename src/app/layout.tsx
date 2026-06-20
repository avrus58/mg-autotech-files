import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
  metadataBase: new URL("https://file.mgautotech.de"),

  title: {
    default: "MG AutoTech File Service",
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

  openGraph: {
    title: "MG AutoTech File Service",
    description:
      "Professional ECU & TCU File Service Platform for workshops and tuning companies.",
    url: "https://file.mgautotech.de",
    siteName: "MG AutoTech File Service",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: "/og-image.svg",
        width: 1200,
        height: 630,
        alt: "MG AutoTech ECU and TCU File Service",
      },
    ],
  },

  twitter: {
    card: "summary_large_image",
    title: "MG AutoTech File Service",
    description:
      "Professional ECU & TCU File Service Platform.",
    images: ["/og-image.svg"],
  },

  robots: {
    index: true,
    follow: true,
  },

  alternates: {
    canonical: "https://file.mgautotech.de",
  },

  category: "automotive",
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "AutoRepair",
  name: "MG AutoTech",
  url: "https://file.mgautotech.de",
  email: "info@mgautotech.de",
  description:
    "Professional ECU and TCU file service platform for workshops, tuners and automotive professionals.",
  areaServed: ["Germany", "Europe"],
  serviceType: [
    "ECU file service",
    "TCU tuning",
    "Stage 1 tuning",
    "DPF OFF",
    "EGR OFF",
    "AdBlue OFF",
    "DTC OFF",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(organizationJsonLd),
          }}
        />
        {children}
      </body>
    </html>
  );
}
