"use client";

import { useCallback, useRef, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { createPublicUtilityHostRegistry, type PublicUtilitySlot } from "@/lib/publicUtilityHosts";

const registry = createPublicUtilityHostRegistry<HTMLElement>();
const noServerHost = () => null;

export function usePublicUtilityHost(slot: PublicUtilitySlot) {
  const getSnapshot = useCallback(() => registry.getHost(slot), [slot]);
  return useSyncExternalStore(registry.subscribe, getSnapshot, noServerHost);
}

export function renderPublicUtilityControl(host: HTMLElement | null, control: ReactNode) {
  return host ? createPortal(control, host) : control;
}

function UtilityHost({ slot, className, children }: {
  slot: PublicUtilitySlot;
  className: string;
  children?: ReactNode;
}) {
  const unregister = useRef<(() => void) | null>(null);
  const register = useCallback((node: HTMLDivElement | null) => {
    unregister.current?.();
    unregister.current = node ? registry.register(slot, node) : null;
  }, [slot]);

  return <div ref={register} data-public-utility-host={slot} className={className}>{children}</div>;
}

/** Only opted-in public headers own this normal-flow row; private shells stay unchanged. */
export function PublicUtilityBar({ wide = false }: { wide?: boolean }) {
  return (
    <div data-public-utility-bar className="border-t border-white/5">
      <div className={`mx-auto flex min-h-13 items-center gap-2 px-4 py-1 ${wide ? "max-w-[86rem] sm:px-6" : "max-w-7xl"}`}>
        <UtilityHost slot="status" className="min-w-0 flex-1" />
        <UtilityHost slot="privacy" className="shrink-0 empty:hidden" />
        <UtilityHost slot="language" className="relative min-w-[4.625rem] shrink-0">
          <span data-public-utility-placeholder aria-hidden="true" className="flex h-11 items-center justify-center rounded-full border border-white/10 bg-[#111720]/95 text-base text-white">🌐</span>
        </UtilityHost>
      </div>
    </div>
  );
}
