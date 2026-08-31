import type { Metadata } from "next";
import { NotFoundClient } from "@/components/recovery/NotFoundClient";
import { notFoundMetadata } from "@/lib/notFoundMetadata";

export const metadata: Metadata = notFoundMetadata;

export default function NotFound() {
  return <NotFoundClient />;
}
