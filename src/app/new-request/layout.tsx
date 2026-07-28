import { BrowserAuthBoundary } from "@/components/auth/BrowserAuthBoundary";

export default function NewRequestLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <BrowserAuthBoundary
      title="Please log in to create a file request"
      description="Vehicle details, selected services and private uploads must stay connected to your verified MG AutoTech account."
      nextPath="/new-request"
    >
      {children}
    </BrowserAuthBoundary>
  );
}
