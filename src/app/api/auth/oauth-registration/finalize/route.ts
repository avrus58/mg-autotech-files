import { NextResponse } from "next/server";
import { requireBaseApiUser } from "@/lib/apiAuth";
import { buildRegistrationCompletionUpdates } from "@/lib/registrationCompletion";
import { parseRegistrationProfileDraft } from "@/lib/registrationProfile";
import { isStaffMember } from "@/lib/staffPermissions";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const responseHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  Vary: "Authorization",
};

export async function POST(request: Request) {
  const auth = await requireBaseApiUser(request);
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.status, headers: responseHeaders }
    );
  }
  if (isStaffMember(auth.access)) {
    return NextResponse.json(
      { error: "Staff profiles cannot use customer registration finalization." },
      { status: 403, headers: responseHeaders }
    );
  }
  const providers = Array.isArray(auth.user.app_metadata?.providers)
    ? auth.user.app_metadata.providers.map(String)
    : [String(auth.user.app_metadata?.provider ?? "")];
  if (!providers.includes("google")) {
    return NextResponse.json(
      { error: "Google registration finalization is not available for this session." },
      { status: 403, headers: responseHeaders }
    );
  }
  if (auth.user.user_metadata?.oauth_registration_finalized === true) {
    return NextResponse.json(
      { finalized: true, unchanged: true },
      { headers: responseHeaders }
    );
  }
  const createdAt = new Date(auth.user.created_at).getTime();
  const registrationAge = Date.now() - createdAt;
  if (!Number.isFinite(createdAt) || registrationAge < 0 || registrationAge > 30 * 60 * 1000) {
    return NextResponse.json(
      { error: "Google registration finalization has expired." },
      { status: 403, headers: responseHeaders }
    );
  }

  const body = await request.json().catch(() => null);
  const profile = parseRegistrationProfileDraft(
    body && typeof body === "object" && !Array.isArray(body)
      ? JSON.stringify((body as { profile?: unknown }).profile ?? null)
      : null
  );
  if (!profile) {
    return NextResponse.json(
      { error: "Registration profile details are invalid." },
      { status: 400, headers: responseHeaders }
    );
  }

  const updates = buildRegistrationCompletionUpdates({
    country: profile.country,
    draft: profile,
    existingMetadata: auth.user.user_metadata,
  });
  if (!updates) {
    return NextResponse.json(
      { error: "Registration country is invalid." },
      { status: 400, headers: responseHeaders }
    );
  }

  const admin = getSupabaseAdmin();
  const profileUpdate = await admin
    .from("profiles")
    .update(updates.profile)
    .eq("id", auth.user.id)
    .select("id")
    .maybeSingle();
  if (profileUpdate.error || !profileUpdate.data) {
    return NextResponse.json(
      { error: "Registration profile could not be finalized." },
      { status: 503, headers: responseHeaders }
    );
  }

  const metadataUpdate = await admin.auth.admin.updateUserById(auth.user.id, {
    user_metadata: {
      ...updates.metadata,
      oauth_registration_finalized: true,
    },
  });
  if (metadataUpdate.error) {
    return NextResponse.json(
      { error: "Registration metadata could not be finalized. Please retry." },
      { status: 503, headers: responseHeaders }
    );
  }

  return NextResponse.json(
    { finalized: true },
    { headers: responseHeaders }
  );
}
