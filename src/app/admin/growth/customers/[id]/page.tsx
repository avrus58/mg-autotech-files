import CustomerIntelligenceClient from "@/app/admin/growth/customers/[id]/CustomerIntelligenceClient";

export default async function CustomerIntelligencePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CustomerIntelligenceClient customerId={id} />;
}
