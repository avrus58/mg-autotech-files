import { getStableSession } from "@/lib/authGuards";

export async function getFileExpertAuthHeaders(): Promise<Record<string, string>> {
  const { session } = await getStableSession();

  if (!session?.access_token) return {};

  return {
    Authorization: `Bearer ${session.access_token}`,
  };
}
