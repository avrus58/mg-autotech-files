export type FaultCode = {
  code: string;
  description: string;
  system: string;
  severity: "Info" | "Medium" | "High";
};

const knownFaultCodes: Record<string, Omit<FaultCode, "code">> = {
  P0000: { description: "No fault detected", system: "General", severity: "Info" },
  P0001: { description: "Fuel volume regulator control circuit open", system: "Fuel system", severity: "Medium" },
  P0002: { description: "Fuel volume regulator control circuit range or performance", system: "Fuel system", severity: "Medium" },
  P0003: { description: "Fuel volume regulator control circuit low", system: "Fuel system", severity: "Medium" },
  P0004: { description: "Fuel volume regulator control circuit high", system: "Fuel system", severity: "Medium" },
  P0005: { description: "Fuel shutoff valve control circuit open", system: "Fuel system", severity: "Medium" },
  P0006: { description: "Fuel shutoff valve control circuit low", system: "Fuel system", severity: "Medium" },
  P0007: { description: "Fuel shutoff valve control circuit high", system: "Fuel system", severity: "Medium" },
  P0008: { description: "Engine position system performance bank 1", system: "Timing", severity: "High" },
  P0009: { description: "Engine position system performance bank 2", system: "Timing", severity: "High" },
  P0010: { description: "A camshaft position actuator circuit bank 1", system: "Timing", severity: "Medium" },
  P0011: { description: "A camshaft position timing over-advanced bank 1", system: "Timing", severity: "Medium" },
  P0012: { description: "A camshaft position timing over-retarded bank 1", system: "Timing", severity: "Medium" },
  P0013: { description: "B camshaft position actuator circuit bank 1", system: "Timing", severity: "Medium" },
  P0014: { description: "B camshaft position timing over-advanced bank 1", system: "Timing", severity: "Medium" },
  P0015: { description: "B camshaft position timing over-retarded bank 1", system: "Timing", severity: "Medium" },
  P0016: { description: "Crankshaft and camshaft position correlation bank 1 sensor A", system: "Timing", severity: "High" },
  P0017: { description: "Crankshaft and camshaft position correlation bank 1 sensor B", system: "Timing", severity: "High" },
  P0018: { description: "Crankshaft and camshaft position correlation bank 2 sensor A", system: "Timing", severity: "High" },
  P0019: { description: "Crankshaft and camshaft position correlation bank 2 sensor B", system: "Timing", severity: "High" },
  P0020: { description: "A camshaft position actuator circuit bank 2", system: "Timing", severity: "Medium" },
  P0021: { description: "A camshaft position timing over-advanced bank 2", system: "Timing", severity: "Medium" },
  P0022: { description: "A camshaft position timing over-retarded bank 2", system: "Timing", severity: "Medium" },
  P0023: { description: "B camshaft position actuator circuit bank 2", system: "Timing", severity: "Medium" },
  P0024: { description: "B camshaft position timing over-advanced bank 2", system: "Timing", severity: "Medium" },
  P0025: { description: "B camshaft position timing over-retarded bank 2", system: "Timing", severity: "Medium" },
  P0030: { description: "Heated oxygen sensor heater control circuit bank 1 sensor 1", system: "Oxygen sensor", severity: "Medium" },
  P0031: { description: "Heated oxygen sensor heater control circuit low bank 1 sensor 1", system: "Oxygen sensor", severity: "Medium" },
  P0032: { description: "Heated oxygen sensor heater control circuit high bank 1 sensor 1", system: "Oxygen sensor", severity: "Medium" },
  P0036: { description: "Heated oxygen sensor heater control circuit bank 1 sensor 2", system: "Oxygen sensor", severity: "Medium" },
  P0045: { description: "Turbocharger or supercharger boost control circuit open", system: "Boost control", severity: "High" },
  P0046: { description: "Turbocharger boost control circuit range or performance", system: "Boost control", severity: "High" },
  P0047: { description: "Turbocharger boost control circuit low", system: "Boost control", severity: "High" },
  P0048: { description: "Turbocharger boost control circuit high", system: "Boost control", severity: "High" },
  P0068: { description: "MAP, MAF and throttle position correlation", system: "Air measurement", severity: "Medium" },
  P0087: { description: "Fuel rail or system pressure too low", system: "Fuel system", severity: "High" },
  P0088: { description: "Fuel rail or system pressure too high", system: "Fuel system", severity: "High" },
  P0093: { description: "Fuel system large leak detected", system: "Fuel system", severity: "High" },
  P0100: { description: "Mass or volume air flow circuit", system: "Air measurement", severity: "Medium" },
  P0101: { description: "Mass air flow circuit range or performance", system: "Air measurement", severity: "Medium" },
  P0102: { description: "Mass air flow circuit low input", system: "Air measurement", severity: "Medium" },
  P0103: { description: "Mass air flow circuit high input", system: "Air measurement", severity: "Medium" },
  P0105: { description: "Manifold absolute pressure circuit", system: "Air measurement", severity: "Medium" },
  P0110: { description: "Intake air temperature sensor circuit", system: "Air measurement", severity: "Medium" },
  P0115: { description: "Engine coolant temperature circuit", system: "Cooling", severity: "Medium" },
  P0120: { description: "Throttle or pedal position sensor circuit", system: "Throttle", severity: "Medium" },
  P0171: { description: "System too lean bank 1", system: "Fuel trim", severity: "Medium" },
  P0172: { description: "System too rich bank 1", system: "Fuel trim", severity: "Medium" },
  P0190: { description: "Fuel rail pressure sensor circuit", system: "Fuel system", severity: "High" },
  P0200: { description: "Injector circuit malfunction", system: "Injection", severity: "High" },
  P0234: { description: "Turbocharger overboost condition", system: "Boost control", severity: "High" },
  P0299: { description: "Turbocharger underboost condition", system: "Boost control", severity: "High" },
  P0300: { description: "Random or multiple cylinder misfire detected", system: "Misfire", severity: "High" },
  P0301: { description: "Cylinder 1 misfire detected", system: "Misfire", severity: "High" },
  P0400: { description: "Exhaust gas recirculation flow malfunction", system: "EGR", severity: "Medium" },
  P0401: { description: "Exhaust gas recirculation insufficient flow", system: "EGR", severity: "Medium" },
  P0402: { description: "Exhaust gas recirculation excessive flow", system: "EGR", severity: "Medium" },
  P0420: { description: "Catalyst system efficiency below threshold bank 1", system: "Catalyst", severity: "Medium" },
  P0440: { description: "Evaporative emission control system malfunction", system: "EVAP", severity: "Medium" },
  P0471: { description: "Exhaust pressure sensor range or performance", system: "Exhaust", severity: "Medium" },
  P0488: { description: "EGR throttle position control range or performance", system: "EGR", severity: "Medium" },
  P2002: { description: "Diesel particulate filter efficiency below threshold", system: "DPF", severity: "Medium" },
  P2015: { description: "Intake manifold runner position sensor range or performance", system: "Intake", severity: "Medium" },
  P204F: { description: "Reductant system performance", system: "AdBlue / SCR", severity: "Medium" },
  P20E8: { description: "Reductant pressure too low", system: "AdBlue / SCR", severity: "Medium" },
  P2263: { description: "Turbocharger boost system performance", system: "Boost control", severity: "High" },
  P2452: { description: "Diesel particulate filter pressure sensor circuit", system: "DPF", severity: "Medium" },
  P2453: { description: "Diesel particulate filter pressure sensor range or performance", system: "DPF", severity: "Medium" },
  P2463: { description: "Diesel particulate filter soot accumulation", system: "DPF", severity: "Medium" },
};

function padCode(value: number) {
  return value.toString().padStart(4, "0");
}

function fallbackFaultCode(code: string): Omit<FaultCode, "code"> {
  const family = code[0];

  if (family === "P") {
    return {
      description: "Powertrain diagnostic trouble code. Check OEM service data for vehicle-specific meaning.",
      system: "Powertrain / OEM",
      severity: "Medium",
    };
  }

  if (family === "C") {
    return {
      description: "Chassis diagnostic trouble code. Check OEM service data for vehicle-specific meaning.",
      system: "Chassis / OEM",
      severity: "Medium",
    };
  }

  if (family === "B") {
    return {
      description: "Body diagnostic trouble code. Check OEM service data for vehicle-specific meaning.",
      system: "Body / OEM",
      severity: "Medium",
    };
  }

  return {
    description: "Network communication diagnostic trouble code. Check OEM service data for module-specific meaning.",
    system: "Network / OEM",
    severity: "Medium",
  };
}

const generatedCodes = [
  ...Array.from({ length: 4000 }, (_, index) => `P${padCode(index)}`),
  ...Array.from({ length: 2000 }, (_, index) => `C${padCode(index)}`),
  ...Array.from({ length: 500 }, (_, index) => `B${padCode(index)}`),
  ...Array.from({ length: 108 }, (_, index) => `U${padCode(index)}`),
];

export const faultCodes: FaultCode[] = generatedCodes.map((code) => ({
  code,
  ...(knownFaultCodes[code] ?? fallbackFaultCode(code)),
}));
