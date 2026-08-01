export type RepeatRequestOrder = {
  id: string;
  vehicle_brand?: string | null;
  vehicle_model?: string | null;
  vehicle_generation?: string | null;
  vehicle_engine?: string | null;
  service_type?: string | null;
  ecu?: string | null;
  gearbox?: string | null;
  vehicle_year?: string | null;
  read_method?: string | null;
  hw_sw?: string | null;
  master_slave?: string | null;
};

export type RepeatRequestServiceOption = {
  id: string;
  title: string;
};

export type RepeatRequestServiceSelection = {
  mainServiceId: string | null;
  extraServiceIds: string[];
  fullyResolved: boolean;
  sourceSummary: string | null;
};

export type RepeatRequestPrefill = {
  sourceOrderId: string;
  vehicle: {
    brand: string;
    model: string;
    generation: string;
    engine: string;
  };
  technical: {
    ecu: string;
    gearbox: string;
    year: string;
    readMethod: string;
    hwSw: string;
    masterSlave: "master" | "slave";
  };
  services: RepeatRequestServiceSelection;
  missingVehicleFields: Array<"brand" | "model" | "engine">;
};

const repeatRequestIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function cleanText(value: unknown, maxLength = 180) {
  if (typeof value !== "string") return "";
  return value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function comparableText(value: unknown) {
  return cleanText(value, 1000).toLocaleLowerCase("en-US");
}

function uniqueServiceCandidates(services: RepeatRequestServiceOption[]) {
  const grouped = new Map<string, Set<string>>();

  for (const service of services) {
    const title = comparableText(service.title);
    if (!service.id || !title) continue;
    const ids = grouped.get(title) ?? new Set<string>();
    ids.add(service.id);
    grouped.set(title, ids);
  }

  return [...grouped.entries()]
    .filter(([, ids]) => ids.size === 1)
    .map(([title, ids]) => ({ title, id: [...ids][0] }))
    .sort((left, right) => right.title.length - left.title.length);
}

export function isRepeatRequestId(value: unknown): value is string {
  return typeof value === "string" && repeatRequestIdPattern.test(value.trim());
}

function parseExtraServiceSequence(
  remainingSummary: string,
  extraServices: RepeatRequestServiceOption[]
): string[] | null {
  if (!remainingSummary) return [];

  const candidates = uniqueServiceCandidates(extraServices);

  const memo = new Map<string, string[] | null>();

  function parse(value: string): string[] | null {
    if (!value) return [];
    if (memo.has(value)) return memo.get(value) ?? null;

    for (const candidate of candidates) {
      if (value === candidate.title) {
        const result = [candidate.id];
        memo.set(value, result);
        return result;
      }

      const prefix = `${candidate.title} + `;
      if (!value.startsWith(prefix)) continue;

      const tail = parse(value.slice(prefix.length));
      if (tail) {
        const result = [candidate.id, ...tail];
        memo.set(value, result);
        return result;
      }
    }

    memo.set(value, null);
    return null;
  }

  return parse(comparableText(remainingSummary));
}

export function resolveRepeatRequestServices(
  serviceSummary: unknown,
  mainServices: RepeatRequestServiceOption[],
  extraServices: RepeatRequestServiceOption[]
): RepeatRequestServiceSelection {
  const sourceSummary = cleanText(serviceSummary, 1000) || null;
  const comparableSummary = comparableText(sourceSummary);

  if (!sourceSummary || !comparableSummary) {
    return {
      mainServiceId: null,
      extraServiceIds: [],
      fullyResolved: false,
      sourceSummary,
    };
  }

  const candidates = uniqueServiceCandidates(mainServices);

  for (const candidate of candidates) {
    if (comparableSummary === candidate.title) {
      return {
        mainServiceId: candidate.id,
        extraServiceIds: [],
        fullyResolved: true,
        sourceSummary,
      };
    }

    const prefix = `${candidate.title} + `;
    if (!comparableSummary.startsWith(prefix)) continue;

    const extraServiceIds = parseExtraServiceSequence(
      comparableSummary.slice(prefix.length),
      extraServices
    );

    if (extraServiceIds) {
      return {
        mainServiceId: candidate.id,
        extraServiceIds,
        fullyResolved: true,
        sourceSummary,
      };
    }
  }

  return {
    mainServiceId: null,
    extraServiceIds: [],
    fullyResolved: false,
    sourceSummary,
  };
}

export function buildRepeatRequestPrefill(
  order: RepeatRequestOrder,
  catalog: {
    mainServices: RepeatRequestServiceOption[];
    extraServices: RepeatRequestServiceOption[];
  }
): RepeatRequestPrefill {
  if (!isRepeatRequestId(order.id)) {
    throw new Error("The source request identifier is invalid.");
  }

  const vehicle = {
    brand: cleanText(order.vehicle_brand),
    model: cleanText(order.vehicle_model),
    generation: cleanText(order.vehicle_generation),
    engine: cleanText(order.vehicle_engine),
  };
  const missingVehicleFields = (["brand", "model", "engine"] as const).filter(
    (field) => !vehicle[field]
  );

  return {
    sourceOrderId: order.id,
    vehicle,
    technical: {
      ecu: cleanText(order.ecu),
      gearbox: cleanText(order.gearbox),
      year: cleanText(order.vehicle_year, 20),
      readMethod: cleanText(order.read_method),
      hwSw: cleanText(order.hw_sw),
      masterSlave: comparableText(order.master_slave) === "slave" ? "slave" : "master",
    },
    services: resolveRepeatRequestServices(
      order.service_type,
      catalog.mainServices,
      catalog.extraServices
    ),
    missingVehicleFields,
  };
}
