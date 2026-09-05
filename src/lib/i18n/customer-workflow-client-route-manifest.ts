export type CustomerWorkflowClientRouteConfig = {
  exactRoutes: readonly string[];
  prefixRoutes: readonly string[];
  routeSamples: readonly string[];
};

/**
 * Client-safe customer workflow routing data.
 *
 * Keep audit-only source paths and generated catalog ownership out of this
 * module: it is imported by the global language switcher.
 */
export const customerWorkflowClientRouteManifest = {
  auth: {
    exactRoutes: [
      "/login",
      "/register",
      "/forgot-password",
      "/reset-password",
      "/auth/callback",
      "/auth/complete-profile",
      "/desktop-auth/turnstile",
      "/measurement/complete",
    ],
    prefixRoutes: [],
    routeSamples: [
      "/login",
      "/register",
      "/forgot-password",
      "/reset-password",
      "/auth/callback",
      "/auth/complete-profile",
      "/desktop-auth/turnstile",
      "/measurement/complete",
    ],
  },
  overview: {
    exactRoutes: ["/dashboard"],
    prefixRoutes: [],
    routeSamples: ["/dashboard"],
  },
  request: {
    exactRoutes: ["/new-request"],
    prefixRoutes: [],
    routeSamples: ["/new-request"],
  },
  credits: {
    exactRoutes: [
      "/dashboard/credits",
      "/dashboard/credits/history",
      "/payment/cancel",
      "/payment/success",
    ],
    prefixRoutes: [],
    routeSamples: [
      "/dashboard/credits",
      "/dashboard/credits/history",
      "/payment/cancel",
      "/payment/success",
    ],
  },
  "file-expert": {
    exactRoutes: ["/dashboard/file-expert"],
    prefixRoutes: ["/dashboard/file-expert/"],
    routeSamples: [
      "/dashboard/file-expert",
      "/dashboard/file-expert/report-id",
    ],
  },
  orders: {
    exactRoutes: ["/dashboard/orders"],
    prefixRoutes: ["/dashboard/orders/"],
    routeSamples: ["/dashboard/orders", "/dashboard/orders/order-id"],
  },
  notifications: {
    exactRoutes: ["/dashboard/notifications"],
    prefixRoutes: [],
    routeSamples: ["/dashboard/notifications"],
  },
  portal: {
    exactRoutes: ["/dashboard/log-analysis"],
    prefixRoutes: [],
    routeSamples: ["/dashboard/log-analysis"],
  },
  security: {
    exactRoutes: ["/dashboard/settings"],
    prefixRoutes: [],
    routeSamples: ["/dashboard/settings"],
  },
  widget: {
    exactRoutes: ["/dashboard/widget"],
    prefixRoutes: ["/dashboard/widget/"],
    routeSamples: ["/dashboard/widget", "/dashboard/widget/billing"],
  },
} as const satisfies Record<string, CustomerWorkflowClientRouteConfig>;

export type CustomerWorkflowClientGroup =
  keyof typeof customerWorkflowClientRouteManifest;

export const customerWorkflowManagedRouteSegments = [
  ...new Set(
    Object.values(customerWorkflowClientRouteManifest).flatMap((surface) =>
      [...surface.exactRoutes, ...surface.prefixRoutes]
        .map((route) => route.split("/").filter(Boolean)[0])
        .filter(Boolean),
    ),
  ),
] as readonly string[];
