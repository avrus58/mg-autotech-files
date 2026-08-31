import type { Metadata } from "next";
import type { ReactNode } from "react";
import { buildPaymentCancelMetadata } from "@/lib/privatePageMetadata";
import { getServerLocale } from "@/lib/serverLocale";

export async function generateMetadata(): Promise<Metadata> {
  return buildPaymentCancelMetadata(await getServerLocale());
}

export default function PaymentCancelLayout({ children }: { children: ReactNode }) {
  return children;
}
