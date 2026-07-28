import { supabase } from "@/lib/supabaseClient";
import {
  classifyAdminAccessProfile,
  type AdminAccessQueryError,
  type AdminAccessResolution,
  type AdminProfileRow,
} from "@/lib/adminAccess";

const ADMIN_ACCESS_RETRY_DELAYS_MS = [0, 160, 420] as const;

function wait(delayMs: number) {
  if (delayMs === 0) return Promise.resolve();
  return new Promise<void>((resolve) => window.setTimeout(resolve, delayMs));
}

async function readAdminProfile(userId: string) {
  const current = await supabase
    .from("profiles")
    .select("role, staff_role, staff_permissions")
    .eq("id", userId)
    .maybeSingle();

  if (current.error?.code !== "42703") {
    return {
      profile: current.data as AdminProfileRow | null,
      error: current.error as AdminAccessQueryError,
    };
  }

  const legacy = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  return {
    profile: legacy.data
      ? {
          role: legacy.data.role ?? null,
          staff_role: null,
          staff_permissions: [],
        }
      : null,
    error: legacy.error as AdminAccessQueryError,
  };
}

export async function resolveAdminAccess(userId: string): Promise<AdminAccessResolution> {
  for (const delayMs of ADMIN_ACCESS_RETRY_DELAYS_MS) {
    await wait(delayMs);
    const { profile, error } = await readAdminProfile(userId);
    const resolution = classifyAdminAccessProfile(profile, error);
    if (resolution.state !== "unavailable") return resolution;
  }

  return { state: "unavailable" };
}
