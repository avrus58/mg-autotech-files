import type { BrowserAuthUserCheckResult } from "@/lib/authBoundaryState";

export type CustomerOrdersQueryResult<TData> = {
  data: TData | null;
  error: unknown;
  count: number | null;
};

export async function retryCustomerOrdersQueryAfterAuthCheck<TData, TUser>(
  checkAuth: () => Promise<BrowserAuthUserCheckResult<TUser>>,
  retryQuery: () => Promise<CustomerOrdersQueryResult<TData>>,
  canRetry: () => boolean = () => true
): Promise<{
  authCheck: BrowserAuthUserCheckResult<TUser>;
  queryResult: CustomerOrdersQueryResult<TData> | null;
}> {
  const authCheck = await checkAuth();
  if (authCheck.state !== "authenticated" || !canRetry()) {
    return { authCheck, queryResult: null };
  }

  try {
    return { authCheck, queryResult: await retryQuery() };
  } catch (error) {
    return {
      authCheck,
      queryResult: { data: null, error, count: null },
    };
  }
}
