import VehicleDetailClient from "@/app/admin/vehicles/[id]/VehicleDetailClient";

export default async function VehicleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <VehicleDetailClient id={id} />;
}
