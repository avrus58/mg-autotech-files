const browserAuthMutationLock = "mg-autotech:browser-auth-mutation";
let browserMutationTail: Promise<void> = Promise.resolve();

// Only explicit session mutations belong here. Do not call this helper again
// inside an operation, or await API/device checks that can themselves sign out.
// Keep the lock until the SDK settles: releasing it on a UI timeout would let
// a late sign-out remove a subsequent successful sign-in.
export function withBrowserAuthMutation<T>(
  operation: () => PromiseLike<T>,
): Promise<T> {
  if (typeof window === "undefined") return Promise.resolve().then(operation);

  const execute = async (): Promise<T> => {
    if (typeof navigator !== "undefined" && navigator.locks?.request) {
      return navigator.locks.request(
        browserAuthMutationLock,
        { mode: "exclusive" },
        () => Promise.resolve().then(operation),
      );
    }
    return Promise.resolve().then(operation);
  };
  const result = browserMutationTail.then(execute);
  browserMutationTail = result.then(() => undefined, () => undefined);
  return result;
}
