/** Progressive, finite reveals: content never depends on an observer to be visible. */
export function observeHomepageReveals(root: HTMLElement): () => void {
  if (
    typeof window === "undefined" ||
    typeof window.matchMedia !== "function" ||
    typeof window.IntersectionObserver !== "function"
  ) return () => undefined;

  const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
  const targets = Array.from(root.querySelectorAll<HTMLElement>("[data-homepage-reveal]"));
  let observer: IntersectionObserver | undefined;
  const reset = () => {
    observer?.disconnect();
    observer = undefined;
    targets.forEach((target) => target.removeAttribute("data-homepage-revealed"));
  };
  const configure = () => {
    reset();
    if (preference.matches) return;
    observer = new window.IntersectionObserver((entries, current) => {
      if (current !== observer || preference.matches) return;
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.setAttribute("data-homepage-revealed", "true");
        current.unobserve(entry.target);
      }
    }, { threshold: 0.12 });
    targets.forEach((target) => observer?.observe(target));
  };
  configure();
  preference.addEventListener?.("change", configure);
  return () => {
    preference.removeEventListener?.("change", configure);
    reset();
  };
}
