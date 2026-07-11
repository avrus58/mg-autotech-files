export type DesktopModuleId =
  | "file_upload"
  | "request_history"
  | "support"
  | "dtc_tools_beta_visible"
  | "diagnostics_future"
  | "dtc_tools_future"
  | "tuning_tools_future";

export type DesktopModuleDefinition = {
  id: DesktopModuleId;
  name: string;
  description: string;
  enabledByDefault: boolean;
  minAppVersion: string;
  requiredPermission: string | null;
  customerVisible: boolean;
  route: string | null;
  badge?: string;
  comingSoon?: boolean;
  buttonLabel?: string;
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
    id: "support",
    name: "Support",
    description: "Customer-safe support, diagnostics and update information.",
    enabledByDefault: true,
    minAppVersion: "0.1.0",
    requiredPermission: null,
    customerVisible: true,
    route: "support",
  },
  {
    id: "dtc_tools_beta_visible",
    name: "DTC Tools",
    description: "Prepare DTC requests faster with guided code entry and file submission. This feature is currently in beta and will be available soon.",
    enabledByDefault: true,
    minAppVersion: "0.1.0",
    requiredPermission: null,
    customerVisible: true,
    route: null,
    badge: "Beta / Coming Soon",
    comingSoon: true,
    buttonLabel: "Coming Soon",
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
    description: "Future safe tooling placeholder. Not available in this release.",
    enabledByDefault: false,
    minAppVersion: "9.9.9",
    requiredPermission: "future",
    customerVisible: false,
    route: null,
  },
  {
    id: "tuning_tools_future",
    name: "Tuning Tools",
    description: "Future placeholder only. Not available in this release.",
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
