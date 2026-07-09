import { z } from "zod";
import { vehicleServiceKeys } from "@/lib/vehicleControl/types";

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
  services: z.array(z.string()).default([]).transform((values) =>
    values.filter((value): value is (typeof vehicleServiceKeys)[number] =>
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
