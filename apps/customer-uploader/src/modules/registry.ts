export type DesktopModuleId =
  | "file_upload"
  | "request_history"
  | "diagnostics_future"
  | "dtc_tools_future";

export type DesktopModuleDefinition = {
  id: DesktopModuleId;
  name: string;
  description: string;
  enabledByDefault: boolean;
  minAppVersion: string;
  requiredPermission: string | null;
  customerVisible: boolean;
  route: string | null;
};

export const desktopModules: DesktopModuleDefinition[] = [
  {
    id: "file_upload",
    name: "File Upload",
    description: "Secure online request and file upload workflow.",
    enabledByDefault: true,
    minAppVersion: "0.1.0",
    requiredPermission: null,
    customerVisible: true,
    route: "new-request",
  },
  {
    id: "request_history",
    name: "Request History",
    description: "Read-only customer request history.",
    enabledByDefault: true,
    minAppVersion: "0.1.0",
    requiredPermission: null,
    customerVisible: true,
    route: "dashboard",
  },
  {
    id: "diagnostics_future",
    name: "Diagnostics",
    description: "Future read-only diagnostic helpers. No binary editing.",
    enabledByDefault: false,
    minAppVersion: "9.9.9",
    requiredPermission: "future",
    customerVisible: false,
    route: null,
  },
  {
    id: "dtc_tools_future",
    name: "DTC Tools",
    description: "Future safe tooling placeholder. No DTC OFF generation, patching, checksum or MOD output.",
    enabledByDefault: false,
    minAppVersion: "9.9.9",
    requiredPermission: "future",
    customerVisible: false,
    route: null,
  },
];

export function resolveEnabledModules(allowedModuleIds: string[] | undefined | null) {
  const allowed = new Set(allowedModuleIds ?? []);
  return desktopModules.filter((module) =>
    module.customerVisible &&
    module.enabledByDefault &&
    allowed.has(module.id)
  );
}
