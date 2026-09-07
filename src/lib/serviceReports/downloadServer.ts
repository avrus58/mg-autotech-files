import { z } from "zod";
import type { AuthResult } from "@/lib/apiAuth";
import { BoundedRequestBodyError, readBoundedJsonBody } from "@/lib/boundedRequestBody";
import { supportedLocales, type LocaleCode } from "@/lib/i18nConfig";
import { CUSTOMER_SESSION_REVOKED_CODE, CUSTOMER_SESSION_REVOKED_MESSAGE } from "@/lib/customerDeviceContracts";
import { ServiceReportError, type ServiceReportSnapshot } from "./model";

type Authorized = Extract<AuthResult, { ok: true }>;
export type ReportDownloadDependencies = {
  authorize(request: Request): Promise<AuthResult>;
  rateLimit(request: Request, userId: string): Promise<{ status: 200 | 429 | 503; headers: Record<string, string> }>;
  snapshot(orderId: string, auth: Authorized): Promise<ServiceReportSnapshot>;
  logo(snapshot: ServiceReportSnapshot): Promise<Buffer | null>;
  render(snapshot: ServiceReportSnapshot, locale: LocaleCode, logo: Buffer | null): Promise<Buffer>;
  assertAccessible(snapshot: ServiceReportSnapshot, auth: Authorized): Promise<void>;
};

const requestSchema = z.object({ locale: z.enum(supportedLocales.map(({ code }) => code) as [LocaleCode, ...LocaleCode[]]) }).strict();
const privateHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
};

export function createServiceReportDownloadHandler(dependencies: ReportDownloadDependencies) {
  return async (request: Request, orderId: string): Promise<Response> => {
    let headers: Record<string, string> = privateHeaders;
    const failure = (code: string, status: number, message = code) => Response.json({ error: message, code }, { status, headers });
    const authFailure = (auth: Extract<AuthResult, { ok: false }>) => {
      const code = auth.code ?? "unauthorized";
      // The shared authenticated fetch signs out revoked devices using this exact
      // public contract. Never forward arbitrary authorization/provider messages.
      const message = auth.status === 401 && code === CUSTOMER_SESSION_REVOKED_CODE
        ? CUSTOMER_SESSION_REVOKED_MESSAGE : code;
      return failure(code, auth.status, message);
    };
    try {
      const auth = await dependencies.authorize(request);
      if (!auth.ok) return authFailure(auth);
      if (!z.string().uuid().safeParse(orderId).success) return failure("report_unavailable", 404);
      const rate = await dependencies.rateLimit(request, auth.user.id);
      headers = { ...privateHeaders, ...rate.headers };
      if (rate.status !== 200) return failure(rate.status === 429 ? "rate_limited" : "report_unavailable", rate.status);
      const parsed = requestSchema.safeParse(await readBoundedJsonBody(request, 1024));
      if (!parsed.success) return failure("report_unavailable", 400);
      const snapshot = await dependencies.snapshot(orderId, auth);
      const logo = await dependencies.logo(snapshot);
      const pdf = await dependencies.render(snapshot, parsed.data.locale, logo);
      if (pdf.length > 10 * 1024 * 1024 || pdf.subarray(0, 5).toString("ascii") !== "%PDF-") return failure("report_unavailable", 503);
      // Rendering can take time: recheck role, device/session and order state before return.
      const freshAuth = await dependencies.authorize(request);
      if (!freshAuth.ok) return authFailure(freshAuth);
      if (freshAuth.user.id !== auth.user.id) return failure("unauthorized", 401);
      await dependencies.assertAccessible(snapshot, freshAuth);
      return new Response(new Uint8Array(pdf), { headers: {
        ...headers,
        "Content-Type": "application/pdf",
        "Content-Length": String(pdf.length),
        "Content-Disposition": `attachment; filename="service-report-${snapshot.orderId}-r${snapshot.revision}-${parsed.data.locale}.pdf"`,
      } });
    } catch (error) {
      if (error instanceof BoundedRequestBodyError) return failure("report_unavailable", error.status);
      if (error instanceof ServiceReportError) return failure(error.code === "REPORT_NOT_COMPLETED" ? "report_incomplete" : "report_unavailable", error.status);
      // Do not return provider errors, customer details, paths or renderer internals.
      return failure("report_unavailable", 503);
    }
  };
}
