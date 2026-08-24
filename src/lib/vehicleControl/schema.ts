import { z } from "zod";
import {
  vehicleAdminPageSizes,
  vehiclePerformanceStages,
  vehicleServiceKeys,
  type VehicleAdminListQuery,
} from "@/lib/vehicleControl/types";
import { vehiclePerformanceLimits } from "@/lib/vehicleControl/validation";

export const vehicleAdminListQueryDefaults: VehicleAdminListQuery = {
  page: 1,
  pageSize: 25,
  q: "",
  brand: "",
  model: "",
  generation: "",
  ecuFamily: "",
  publishStatus: "all",
  verificationStatus: "all",
};

const vehicleAdminPageSizeSchema = z.preprocess(
  (value) => typeof value === "string" ? Number(value) : value,
  z.union([z.literal(25), z.literal(50), z.literal(100)]),
);

export const vehicleAdminListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(vehicleAdminListQueryDefaults.page),
  pageSize: vehicleAdminPageSizeSchema.default(vehicleAdminListQueryDefaults.pageSize),
  q: z.string().trim().max(120).default(vehicleAdminListQueryDefaults.q),
  brand: z.string().trim().max(120).default(vehicleAdminListQueryDefaults.brand),
  model: z.string().trim().max(120).default(vehicleAdminListQueryDefaults.model),
  generation: z.string().trim().max(120).default(vehicleAdminListQueryDefaults.generation),
  ecuFamily: z.string().trim().max(120).default(vehicleAdminListQueryDefaults.ecuFamily),
  publishStatus: z.enum(["all", "published", "draft", "archived"]).default(vehicleAdminListQueryDefaults.publishStatus),
  verificationStatus: z.enum(["all", "imported", "unverified", "needs_review", "verified", "rejected"]).default(vehicleAdminListQueryDefaults.verificationStatus),
}).strict().superRefine((query, context) => {
  for (const key of ["q", "brand", "model", "generation", "ecuFamily"] as const) {
    if (query[key] && !/[\p{L}\p{N}]/u.test(sanitizeVehicleAdminSearchTerm(query[key]))) {
      context.addIssue({
        code: "custom",
        path: [key],
        message: "Filter must contain at least one letter or number.",
      });
    }
  }
});

export function parseVehicleAdminListQuery(searchParams: URLSearchParams) {
  return vehicleAdminListQuerySchema.safeParse(Object.fromEntries(searchParams.entries()));
}

export function sanitizeVehicleAdminSearchTerm(value: string) {
  return value
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}\s.:/+\-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildVehicleAdminSearchPattern(value: string) {
  return sanitizeVehicleAdminSearchTerm(value).replace(/\s+/g, "%");
}

export function getVehicleAdminPageRange(query: Pick<VehicleAdminListQuery, "page" | "pageSize">) {
  const from = (query.page - 1) * query.pageSize;
  return { from, to: from + query.pageSize - 1 };
}

export function buildVehicleAdminPagination(query: Pick<VehicleAdminListQuery, "page" | "pageSize">, value: number | null) {
  const total = Math.max(0, Math.trunc(value ?? 0));
  const pageCount = total === 0 ? 0 : Math.ceil(total / query.pageSize);
  return {
    page: query.page,
    pageSize: query.pageSize,
    total,
    pageCount,
    hasPreviousPage: query.page > 1,
    hasNextPage: query.page < pageCount,
  };
}

export function isVehicleAdminPageSize(value: number): value is (typeof vehicleAdminPageSizes)[number] {
  return vehicleAdminPageSizes.includes(value as (typeof vehicleAdminPageSizes)[number]);
}

const vehiclePerformanceProfileSchema = z.object({
  stage: z.enum(vehiclePerformanceStages),
  tunedHp: z.number().int().positive().max(vehiclePerformanceLimits.maxTunedHp).nullable(),
  tunedNm: z.number().int().positive().max(vehiclePerformanceLimits.maxTunedNm).nullable(),
  active: z.boolean().optional(),
});

const vehiclePerformanceProfilesSchema = z.array(vehiclePerformanceProfileSchema).max(vehiclePerformanceStages.length).superRefine((profiles, context) => {
  const seen = new Set<string>();
  for (const [index, profile] of profiles.entries()) {
    if (seen.has(profile.stage)) {
      context.addIssue({
        code: "custom",
        path: [index, "stage"],
        message: "Each performance stage can be submitted only once.",
      });
    }
    seen.add(profile.stage);
  }
});

export const vehicleAdminPayloadSchema = z.object({
  brand: z.string().min(1).max(120),
  model: z.string().min(1).max(160),
  generation: z.string().min(1).max(180),
  engine: z.string().min(1).max(180),
  displayName: z.string().max(300).nullable().optional(),
  yearFrom: z.number().int().nullable().optional(),
  yearTo: z.number().int().nullable().optional(),
  fuelType: z.string().max(120).nullable().optional(),
  displacementCc: z.number().int().nullable().optional(),
  stockHp: z.number().int().nullable().optional(),
  stockNm: z.number().int().nullable().optional(),
  tunedHp: z.number().int().nullable().optional(),
  tunedNm: z.number().int().nullable().optional(),
  performanceProfiles: vehiclePerformanceProfilesSchema.optional(),
  ecuVariantId: z.string().uuid().nullable().optional(),
  ecuFamily: z.string().max(120).nullable().optional(),
  ecuType: z.string().max(220).nullable().optional(),
  ecuHardware: z.string().max(220).nullable().optional(),
  ecuSoftware: z.string().max(220).nullable().optional(),
  ecuNotes: z.string().max(2000).nullable().optional(),
  protectionNotes: z.string().max(2000).nullable().optional(),
  unlockNotes: z.string().max(2000).nullable().optional(),
  gearboxType: z.string().max(120).nullable().optional(),
  tcuType: z.string().max(160).nullable().optional(),
  tcuNotes: z.string().max(2000).nullable().optional(),
  services: z.array(z.string()).optional().transform((values) =>
    values?.filter((value): value is (typeof vehicleServiceKeys)[number] =>
      (vehicleServiceKeys as string[]).includes(value)
    )
  ),
  customerSafeNotes: z.string().max(2000).nullable().optional(),
  adminTechnicalNotes: z.string().max(4000).nullable().optional(),
  confidenceScore: z.number().min(0).max(100).optional(),
  verificationStatus: z.enum(["imported", "unverified", "needs_review", "verified", "rejected"]).optional(),
  published: z.boolean().optional(),
  active: z.boolean().optional(),
});
