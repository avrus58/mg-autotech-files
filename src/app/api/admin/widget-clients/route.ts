import { NextResponse } from "next/server";
import { requireStaffPermission } from "@/lib/apiAuth";
import { loadAdminWidgetClients } from "@/lib/widget/adminData";

function privateJson(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function GET(request: Request) {
  const auth = await requireStaffPermission(request, "widget.manage");
  if (!auth.ok) return privateJson({ error: auth.error }, auth.status);

  try {
    return privateJson(await loadAdminWidgetClients());
  } catch (error) {
    const databaseError = error as { code?: string; message?: string };
    const message = databaseError.message ?? "Widget clients could not be loaded.";
    const setupRequired = databaseError.code === "42P01" || message.includes("schema cache");
    return privateJson(
      {
        error: setupRequired
          ? "Widget SaaS database setup is required."
          : "Widget clients could not be loaded.",
        setupRequired,
      },
      setupRequired ? 503 : 500,
    );
  }
}
