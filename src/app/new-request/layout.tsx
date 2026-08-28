import { Suspense } from "react";
import { NewRequestAccessBoundary } from "@/app/new-request/NewRequestAccessBoundary";

export default function NewRequestLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <Suspense
      fallback={(
        <main className="flex min-h-screen items-center justify-center bg-[#050505] px-4 text-white">
          <p role="status" className="text-sm font-bold text-zinc-400">
            Secure customer access
          </p>
        </main>
      )}
    >
      <NewRequestAccessBoundary>{children}</NewRequestAccessBoundary>
    </Suspense>
  );
}
