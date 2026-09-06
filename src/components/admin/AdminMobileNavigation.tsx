"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import { ArrowUpRight, ChevronRight, Menu, ShieldCheck, X } from "lucide-react";
import { resolveAdminAccess } from "@/lib/adminAccessClient";
import { activeAdminDestination, adminMobileDestinations, availableAdminDestinations } from "@/lib/adminMobileNavigation";
import type { AdminAccessResolution } from "@/lib/adminAccess";

export function AdminMobileNavigation() {
  const pathname = usePathname();
  const [hash, setHash] = useState("");
  const [open, setOpen] = useState(false);
  const [resolution, setResolution] = useState<AdminAccessResolution | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const requestRef = useRef(0);
  const skipRestoreRef = useRef(false);
  const unlockRef = useRef<(() => void) | null>(null);
  const activeHref = activeAdminDestination(pathname, hash);
  const label = adminMobileDestinations.find((item) => item.href === activeHref)?.label ?? "Admin workspace";
  const destinations = availableAdminDestinations(resolution?.state === "authorized" ? resolution.access : null);

  const closeMenu = useCallback(() => {
    requestRef.current += 1;
    dialogRef.current?.close();
    unlockRef.current?.();
    unlockRef.current = null;
    setOpen(false);
  }, []);

  useEffect(() => {
    const updateLocation = () => {
      setHash(window.location.hash);
      closeMenu();
    };
    const media = window.matchMedia("(min-width: 1024px)");
    const resize = () => { if (media.matches) closeMenu(); };
    // The server has no fragment. Read it after hydration without changing
    // authorization or causing an extra access request on desktop.
    const frame = window.requestAnimationFrame(() => setHash(window.location.hash));
    window.addEventListener("hashchange", updateLocation);
    window.addEventListener("popstate", updateLocation);
    media.addEventListener("change", resize);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("hashchange", updateLocation);
      window.removeEventListener("popstate", updateLocation);
      media.removeEventListener("change", resize);
      requestRef.current += 1;
      unlockRef.current?.();
    };
  }, [closeMenu]);

  async function loadAccess() {
    const request = ++requestRef.current;
    setResolution(null);
    const result = await resolveAdminAccess();
    if (request === requestRef.current && dialogRef.current?.open) setResolution(result);
  }

  function openMenu() {
    if (!dialogRef.current || window.matchMedia("(min-width: 1024px)").matches) return;
    setHash(window.location.hash);
    skipRestoreRef.current = false;
    dialogRef.current.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    unlockRef.current = () => { document.body.style.overflow = previousOverflow; };
    setOpen(true);
    void loadAccess();
  }

  function navigate(event: MouseEvent<HTMLAnchorElement>, href: string) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    skipRestoreRef.current = true;
    closeMenu();
    if (pathname === "/admin" && href.startsWith("/admin#")) {
      event.preventDefault();
      if (`${window.location.pathname}${window.location.hash}` !== href) {
        window.history.pushState(null, "", href);
      }
      // Same-fragment selections also reveal/focus the main panel. Next's
      // normal link navigation is retained for all other destinations.
      window.dispatchEvent(new Event("hashchange"));
    }
  }

  function keepFocusInMenu(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key !== "Tab") return;
    const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('a[href], button:not([disabled])'))
      .filter((element) => element.getClientRects().length > 0);
    const first = controls[0];
    const last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }

  return (
    <>
      <div className="admin-mobile-bar" data-admin-mobile-bar>
        <button ref={triggerRef} type="button" onClick={openMenu} aria-label="Open admin menu" aria-haspopup="dialog" aria-expanded={open} aria-controls="admin-mobile-menu" className="admin-mobile-menu-trigger">
          <Menu size={20} aria-hidden="true" /><span>Menu</span>
        </button>
        <div className="admin-mobile-location"><span>MG AUTOTECH</span><strong>{label}</strong></div>
        <Link href="/dashboard" aria-label="Customer dashboard" className="admin-mobile-portal"><ArrowUpRight size={20} aria-hidden="true" /></Link>
      </div>
      <dialog ref={dialogRef} id="admin-mobile-menu" aria-labelledby="admin-mobile-menu-title" className="admin-mobile-menu" onKeyDown={keepFocusInMenu} onClose={() => { closeMenu(); if (!skipRestoreRef.current && !window.matchMedia("(min-width: 1024px)").matches) triggerRef.current?.focus(); }} onClick={(event) => { if (event.target === event.currentTarget) closeMenu(); }}>
        <div className="admin-mobile-menu-surface">
          <div className="admin-mobile-menu-heading">
            <ShieldCheck size={22} aria-hidden="true" className="text-red-400" />
            <div><strong id="admin-mobile-menu-title">Admin menu</strong><p>Choose your workspace</p></div>
            <button type="button" onClick={closeMenu} aria-label="Close admin menu"><X size={20} aria-hidden="true" /></button>
          </div>
          <nav aria-label="Mobile admin navigation" className="admin-mobile-menu-body">
            {!resolution && <p role="status">Loading available sections…</p>}
            {resolution?.state === "unavailable" && <div role="alert"><p>Menu access could not be checked. Your current page is unchanged.</p><button type="button" className="admin-mobile-retry" onClick={() => void loadAccess()}>Try again</button></div>}
            {resolution?.state === "denied" && <p role="alert">Staff access is required to use this menu.</p>}
            {resolution?.state === "authorized" && destinations.length === 0 && <p>No sections are available for your current permissions.</p>}
            {(["Workspace", "Business", "Tools"] as const).map((group) => {
              const items = destinations.filter((item) => item.group === group);
              return items.length > 0 && <div key={group} className="admin-mobile-menu-group"><p>{group}</p>{items.map((item) => (
                <Link key={item.href} href={item.href} prefetch={false} aria-current={activeHref === item.href ? "page" : undefined} onClick={(event) => navigate(event, item.href)}>
                  <span>{item.label}</span><ChevronRight size={16} aria-hidden="true" />
                </Link>
              ))}</div>;
            })}
          </nav>
          <Link href="/dashboard" className="admin-mobile-menu-footer" onClick={closeMenu}>Customer dashboard<ArrowUpRight size={18} aria-hidden="true" /></Link>
        </div>
      </dialog>
    </>
  );
}
