const ADMIN_ROOT_PATH = "/admin";

function normalizePathname(pathname: string | null | undefined) {
  if (!pathname) return "";
  if (pathname === "/") return pathname;
  return pathname.replace(/\/+$/, "");
}

export function shouldReloadAdminFromPageCache(input: {
  persisted: boolean;
  navigationType: PerformanceNavigationTiming["type"] | null | undefined;
  navigationEntryPathname: string | null | undefined;
  currentPathname: string | null | undefined;
}) {
  if (input.persisted) return true;

  return input.navigationType === "back_forward" &&
    normalizePathname(input.navigationEntryPathname) === normalizePathname(input.currentPathname);
}

export function shouldReloadAdminAfterHistoryReturn(input: {
  previousPathname: string | null | undefined;
  currentPathname: string | null | undefined;
  historyTargetPathname: string | null | undefined;
}) {
  const previousPathname = normalizePathname(input.previousPathname);
  const currentPathname = normalizePathname(input.currentPathname);
  const historyTargetPathname = normalizePathname(input.historyTargetPathname);

  return previousPathname.startsWith(`${ADMIN_ROOT_PATH}/`) &&
    currentPathname === ADMIN_ROOT_PATH &&
    historyTargetPathname === currentPathname;
}
