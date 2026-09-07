import { z } from "zod";

export const serviceReportMetricSources = ["measured", "datalog_estimate", "catalog_reference", "manually_declared"] as const;
const singleLine = z.string().trim().max(160).regex(/^[^\u0000-\u001f\u007f]*$/);
const note = z.string().trim().max(2000).regex(/^[^\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]*$/)
  .refine((value) => value.split(/\r\n|\r|\n/).length <= 30, "Keep report notes to 30 lines or fewer.");
const hp = z.number().finite().min(0).max(5000).nullable();
const nm = z.number().finite().min(0).max(20000).nullable();
const performanceFields = {
  beforeHp: hp,
  afterHp: hp,
  beforeNm: nm,
  afterNm: nm,
};

export const serviceReportDetailsSchema = z.object({
  performedServices: z.array(singleLine.min(1)).max(30).transform((items) => [...new Set(items)]),
  ...performanceFields,
  metricSource: z.enum(serviceReportMetricSources).nullable(),
  sourceNote: note,
  customerNote: note,
}).strict().superRefine((details, ctx) => {
  if (Object.values({ beforeHp: details.beforeHp, afterHp: details.afterHp, beforeNm: details.beforeNm, afterNm: details.afterNm }).some((value) => value !== null)) {
    if (!details.metricSource) ctx.addIssue({ code: "custom", path: ["metricSource"], message: "Select the source of the performance values." });
    if (!details.sourceNote) ctx.addIssue({ code: "custom", path: ["sourceNote"], message: "Describe the source of the performance values." });
  }
});

export type ServiceReportDetails = z.infer<typeof serviceReportDetailsSchema>;

export function emptyServiceReportDetails(): ServiceReportDetails {
  return { performedServices: [], beforeHp: null, afterHp: null, beforeNm: null, afterNm: null, metricSource: null, sourceNote: "", customerNote: "" };
}

export const saveServiceReportDetailsSchema = z.object({
  expectedRevision: z.number().int().min(0).max(2147483646),
  details: serviceReportDetailsSchema,
}).strict();

const snapshotText = z.string().max(512).nullable();
const snapshotShape = z.object({
  schemaVersion: z.literal(1),
  id: z.string().uuid(),
  orderId: z.string().uuid(),
  customerId: z.string().uuid(),
  revision: z.number().int().positive(),
  issuedAt: z.string().datetime({ offset: true }),
  workshop: z.object({ name: snapshotText, logoPath: z.string().max(200).nullable() }).strict(),
  vehicle: z.object({
    brand: snapshotText, model: snapshotText, generation: snapshotText, engine: snapshotText,
    year: snapshotText, ecu: snapshotText, gearbox: snapshotText, licensePlate: snapshotText,
  }).strict(),
  requestedServices: z.array(z.string().max(512)).max(100),
  performedServices: z.array(singleLine.min(1)).max(30),
  performance: z.object({ ...performanceFields, source: z.enum(serviceReportMetricSources).nullable(), sourceNote: note }).strict(),
  customerNote: note,
}).strict();

export const serviceReportSnapshotSchema = snapshotShape.superRefine((snapshot, ctx) => {
  const { source, ...values } = snapshot.performance;
  const details = serviceReportDetailsSchema.safeParse({ ...values, metricSource: source, performedServices: snapshot.performedServices, customerNote: snapshot.customerNote });
  if (!details.success) ctx.addIssue({ code: "custom", path: ["performance"], message: "Invalid performance provenance." });
  const path = snapshot.workshop.logoPath;
  if (path !== null && !new RegExp(`^${snapshot.customerId}/profile/report-logo/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.png$`, "i").test(path)) {
    ctx.addIssue({ code: "custom", path: ["workshop", "logoPath"], message: "Invalid report branding path." });
  }
});

export type ServiceReportSnapshot = z.infer<typeof serviceReportSnapshotSchema>;
export type ServiceReportEditorState = { revision: number; details: ServiceReportDetails; requestedServices: string[]; orderStatus: string };

export class ServiceReportError extends Error {
  constructor(public readonly code: "REPORT_NOT_FOUND" | "REPORT_NOT_COMPLETED" | "REPORT_CONFLICT" | "REPORT_UNAVAILABLE", public readonly status: number) {
    super(code);
    this.name = "ServiceReportError";
  }
}
