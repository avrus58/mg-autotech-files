export type VehicleDatabaseItem = {
  source?: string;
  sourceUrl?: string;
  brand: string;
  brandId?: string;
  model: string;
  modelId?: string;
  generation: string;
  generationId?: string;
  engine: string;
  engineId?: string;
  fuelType?: string | null;
  ecu: string[];
  stage1?: {
    stockHp: number | null;
    tunedHp: number | null;
    gainHp: number | null;
    stockNm: number | null;
    tunedNm: number | null;
    gainNm: number | null;
  } | null;
  stage2?: {
    stockHp: number | null;
    tunedHp: number | null;
    gainHp: number | null;
    stockNm: number | null;
    tunedNm: number | null;
    gainNm: number | null;
  } | null;
  readMethods: string[];
  services: string[];
  imageUrl?: string | null;
  scrapedAt?: string;
};

// Sonradan data/vehicle-database.json çıktısını buraya import edebiliriz.
// Şimdilik sample data:
import sampleData from "./generated/vehicleDatabase.sample.json";

export const vehicleDatabase = sampleData as VehicleDatabaseItem[];
