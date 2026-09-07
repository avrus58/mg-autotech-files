import type { ServiceReportSnapshot } from "../../src/lib/serviceReports/model";

// Synthetic example only. These values are not a vehicle/service coverage claim.
export const reportFixture: ServiceReportSnapshot = {
  schemaVersion: 1,
  id: "30000000-0000-4000-8000-000000000003",
  orderId: "20000000-0000-4000-8000-000000000002",
  customerId: "10000000-0000-4000-8000-000000000001",
  revision: 1,
  issuedAt: "2026-09-07T12:00:00.000Z",
  workshop: { name: "DEMO - Örnek Werkstatt / 示例车间", logoPath: null },
  vehicle: {
    brand: "DEMO", model: "Example vehicle", generation: "Example generation", engine: "2.0 - Example engine",
    year: "2020", ecu: "Example ECU", gearbox: "Automatic", licensePlate: "DEMO-001",
  },
  requestedServices: ["Stage 1", "DPF"],
  performedServices: ["Stage 1", "DPF"],
  performance: { beforeHp: 150, afterHp: 185, beforeNm: 320, afterNm: 390, source: "manually_declared", sourceNote: "DEMO: synthetic values for layout validation only." },
  customerNote: "DEMO: generated for review. Not a real customer, vehicle or completed service.",
};
