import assert from "node:assert/strict";
import test from "node:test";
import { readServiceReportDownload, ServiceReportDownloadError } from "../src/lib/serviceReports/download";

test("report downloads require an actual PDF response, not HTML or a print page", async () => {
  const result = await readServiceReportDownload(new Response("%PDF-1.7\nsynthetic", { headers: { "Content-Type": "application/pdf" } }));
  assert.equal(await result.slice(0, 5).text(), "%PDF-");
  for (const response of [
    new Response("<html>Print this report</html>", { headers: { "Content-Type": "text/html" } }),
    new Response("not a PDF", { headers: { "Content-Type": "application/pdf" } }),
    new Response("", { headers: { "Content-Type": "application/pdf" } }),
    new Response("%PDF-" + "x".repeat(20 * 1024 * 1024), { headers: { "Content-Type": "application/pdf" } }),
  ]) await assert.rejects(() => readServiceReportDownload(response), (error: unknown) => error instanceof ServiceReportDownloadError && error.translationKey === "downloadError");
});

test("server failures expose only stable localized error keys, never server text", async () => {
  for (const [status, code, expected] of [
    [401, "unauthorized", "downloadUnauthorized"],
    [403, "forbidden", "downloadUnauthorized"],
    [428, "verification_required", "downloadUnauthorized"],
    [429, "rate_limited", "downloadRateLimited"],
    [404, "report_unavailable", "downloadUnavailable"],
    [409, "report_incomplete", "downloadUnavailable"],
    [500, "sensitive internal details", "downloadError"],
  ] as const) {
    await assert.rejects(() => readServiceReportDownload(Response.json({ error: code }, { status })), (error: unknown) => error instanceof ServiceReportDownloadError && error.translationKey === expected && !error.message.includes(code));
  }
  await assert.rejects(() => readServiceReportDownload(new Response("invalid-json", { status: 502 })), (error: unknown) => error instanceof ServiceReportDownloadError && error.translationKey === "downloadError");
});
