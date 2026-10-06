import { headers } from "next/headers";
import { notFound } from "next/navigation";
import CanonicalRequestBriefBuilderPage, {
  generateMetadata as generateCanonicalMetadata,
} from "@/app/tools/request-brief-builder/page";
import { isRequestBriefDocumentRequest } from "@/lib/requestBriefDocumentRoute";

type Props = { params: Promise<{ locale: string }> };

async function requireCanonicalRewrite({ params }: Props) {
  const { locale } = await params;
  if (!isRequestBriefDocumentRequest(locale, await headers())) notFound();
}

export async function generateMetadata(props: Props) {
  await requireCanonicalRewrite(props);
  return generateCanonicalMetadata();
}

export default async function RequestBriefDocumentPage(props: Props) {
  await requireCanonicalRewrite(props);
  return CanonicalRequestBriefBuilderPage();
}
