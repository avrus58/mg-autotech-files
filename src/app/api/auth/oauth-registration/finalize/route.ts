import { NextResponse } from "next/server";
import { requireBaseApiUser } from "@/lib/apiAuth";
import {
  buildRegistrationCompletionUpdates,
  isGoogleRegistrationAfterCountryEnforcement,
  isGoogleRegistrationProfileFinalizationWindowOpen,
} from "@/lib/registrationCompletion";
import { parseRegistrationProfileDraft } from "@/lib/registrationProfile";
import { isStaffMember } from "@/lib/staffPermissions";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import type { OAuthRegistrationFinalizeErrorCode } from "@/lib/oauthRegistrationFinalizeErrors";

const responseHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  Vary: "Authorization",
};

function errorResponse(
  errorCode: OAuthRegistrationFinalizeErrorCode,
  status: number,
) {
  return NextResponse.json(
    { errorCode },
    { status, headers: responseHeaders },
  );
}

export async function POST(request: Request) {
  const auth = await requireBaseApiUser(request);
  if (!auth.ok) {
    return errorResponse("auth_required", auth.status);
  }
  if (isStaffMember(auth.access)) {
    return errorResponse("staff_profile_forbidden", 403);
  }
  const providers = Array.isArray(auth.user.app_metadata?.providers)
    ? auth.user.app_metadata.providers.map(String)
    : [String(auth.user.app_metadata?.provider ?? "")];
  if (!providers.includes("google")) {
    return errorResponse("google_session_required", 403);
  }
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return errorResponse("invalid_request", 400);
  }

  const input = body as Record<string, unknown>;
  const inputKeys = Object.keys(input);
  const isFullProfileCompletion =
    inputKeys.length === 1 && inputKeys[0] === "profile";
  const isCountryOnlyCompletion =
    inputKeys.length === 1 && inputKeys[0] === "country";
  if (!isFullProfileCompletion && !isCountryOnlyCompletion) {
    return errorResponse("invalid_request", 400);
  }

  const profile = isFullProfileCompletion
    ? parseRegistrationProfileDraft(JSON.stringify(input.profile ?? null))
    : null;
  if (isFullProfileCompletion && !profile) {
    return errorResponse("invalid_profile", 400);
  }

  if (isFullProfileCompletion) {
    if (!isGoogleRegistrationProfileFinalizationWindowOpen(auth.user)) {
      return errorResponse("finalization_expired", 403);
    }
  } else if (!isGoogleRegistrationAfterCountryEnforcement(auth.user)) {
    return errorResponse("country_completion_unavailable", 403);
  }

  // Country is an ordinary customer-editable profile field. This exact,
  // own-row bootstrap exception stays on base authentication so a new Google
  // account can finish onboarding before the device-assurance RLS gate.

  const updates = buildRegistrationCompletionUpdates({
    country: profile?.country ?? input.country,
    draft: profile,
    existingMetadata: auth.user.user_metadata,
  });
  if (!updates) {
    return errorResponse("invalid_country", 400);
  }

  const admin = getSupabaseAdmin();
  const profileUpdate = await admin
    .from("profiles")
    .update(updates.profile)
    .eq("id", auth.user.id)
    .select("id")
    .maybeSingle();
  if (profileUpdate.error || !profileUpdate.data) {
    return errorResponse("profile_update_failed", 503);
  }

  const metadataUpdate = await admin.auth.admin.updateUserById(auth.user.id, {
    user_metadata: {
      ...updates.metadata,
      oauth_registration_finalized: true,
    },
  });
  if (metadataUpdate.error) {
    return errorResponse("metadata_update_failed", 503);
  }

  return NextResponse.json(
    { finalized: true },
    { headers: responseHeaders }
  );
}
