export function AuthBackdrop() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_16%_4%,rgba(177,18,27,0.24),transparent_30%),radial-gradient(circle_at_84%_92%,rgba(128,22,31,0.15),transparent_32%),linear-gradient(135deg,#050505_0%,#0b0b0d_48%,#120709_100%)]" />
      <div className="absolute inset-0 [background-image:linear-gradient(rgba(255,255,255,0.022)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.022)_1px,transparent_1px)] [background-size:48px_48px] [mask-image:radial-gradient(ellipse_at_center,black_0%,transparent_78%)]" />
    </div>
  );
}
