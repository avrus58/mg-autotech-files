import type { Metadata } from "next";
import type { ReactNode } from "react";
import { buildPaymentSuccessMetadata } from "@/lib/privatePageMetadata";
import { getServerLocale } from "@/lib/serverLocale";

export async function generateMetadata(): Promise<Metadata> {
  return buildPaymentSuccessMetadata(await getServerLocale());
}

export default function PaymentSuccessLayout({ children }: { children: ReactNode }) {
  return children;
}
