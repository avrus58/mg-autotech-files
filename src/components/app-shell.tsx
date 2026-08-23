import type { ReactNode } from "react";

type AppShellProps = Readonly<{
  children: ReactNode;
}>;

export function AppShell({ children }: AppShellProps) {
  return (
    <div
      data-dashboard-shell="efferd"
      className="mg-efferd-dashboard min-h-screen bg-[#070707] text-white"
    >
      {children}
    </div>
  );
}
