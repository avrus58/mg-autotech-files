export type PublicUtilitySlot = "language" | "privacy" | "status";

/** Exact-node ownership keeps an outgoing route from removing its successor. */
export function createPublicUtilityHostRegistry<T extends { readonly isConnected: boolean }>() {
  const hosts = new Map<PublicUtilitySlot, Set<T>>();
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const listener of listeners) listener();
  };

  return {
    register(slot: PublicUtilitySlot, node: T) {
      const candidates = hosts.get(slot) ?? new Set<T>();
      candidates.add(node);
      hosts.set(slot, candidates);
      notify();
      let registered = true;
      return () => {
        if (!registered) return;
        registered = false;
        candidates.delete(node);
        if (candidates.size === 0) hosts.delete(slot);
        notify();
      };
    },
    getHost(slot: PublicUtilitySlot): T | null {
      const candidates = [...(hosts.get(slot) ?? [])];
      return candidates.reverse().find((node) => node.isConnected) ?? null;
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
}
