import {
  customerWorkflowClientRouteManifest,
  type CustomerWorkflowClientGroup,
  type CustomerWorkflowClientRouteConfig,
} from "@/lib/i18n/customer-workflow-client-route-manifest";

export {
  customerWorkflowManagedRouteSegments,
  type CustomerWorkflowClientGroup,
} from "@/lib/i18n/customer-workflow-client-route-manifest";

const customerWorkflowClientSurfaceEntries = Object.entries(
  customerWorkflowClientRouteManifest,
) as Array<[CustomerWorkflowClientGroup, CustomerWorkflowClientRouteConfig]>;

export function customerWorkflowClientGroupForPath(
  pathname: string,
): CustomerWorkflowClientGroup | null {
  for (const [group, surface] of customerWorkflowClientSurfaceEntries) {
    if (
      surface.exactRoutes.some((route) => pathname === route) ||
      surface.prefixRoutes.some((prefix) => pathname.startsWith(prefix))
    ) {
      return group;
    }
  }
  return null;
}
