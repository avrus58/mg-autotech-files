export const supabaseAuthRequestTimeoutMs = 15_000;

export function isSupabaseAuthRequest(input: RequestInfo | URL) {
  const value =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;

  try {
    const pathname = new URL(value).pathname;
    return pathname === "/auth/v1" || pathname.startsWith("/auth/v1/");
  } catch {
    return false;
  }
}

export function createTimedFetch(
  timeoutMs: number,
  fetchImplementation: typeof fetch = fetch,
  shouldTimeout: (input: RequestInfo | URL) => boolean = () => true
): typeof fetch {
  return async (input, init) => {
    if (!shouldTimeout(input)) return fetchImplementation(input, init);

    const controller = new AbortController();
    const callerSignal =
      init?.signal ??
      (typeof Request !== "undefined" && input instanceof Request
        ? input.signal
        : undefined);
    const abortFromCaller = () => controller.abort();

    if (callerSignal?.aborted) {
      controller.abort();
    } else {
      callerSignal?.addEventListener("abort", abortFromCaller, { once: true });
    }

    const timeout = setTimeout(
      () => controller.abort(),
      Math.max(1, timeoutMs)
    );

    try {
      return await fetchImplementation(input, {
        ...init,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
      callerSignal?.removeEventListener("abort", abortFromCaller);
    }
  };
}

export function createSupabaseAuthTimedFetch(
  timeoutMs = supabaseAuthRequestTimeoutMs,
  fetchImplementation: typeof fetch = fetch
) {
  return createTimedFetch(
    timeoutMs,
    fetchImplementation,
    isSupabaseAuthRequest
  );
}
