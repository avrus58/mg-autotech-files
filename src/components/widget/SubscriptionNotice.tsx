import { AlertTriangle, CreditCard } from "lucide-react";
import Link from "next/link";

export function SubscriptionNotice({
  canManageBilling,
  onManage,
}: {
  canManageBilling: boolean;
  onManage: () => void;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 border border-amber-700/40 bg-amber-950/20 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
        <div>
          <div className="font-black text-amber-100">Widget subscription inactive</div>
          <p className="mt-1 text-sm leading-6 text-amber-200/70">
            {canManageBilling
              ? "Your widget subscription is currently inactive. Please update your subscription to reactivate your widget."
              : "No Stripe billing profile is linked to this widget yet. Start a widget subscription or contact MG AutoTech support."}
          </p>
        </div>
      </div>
      {canManageBilling ? (
        <button
          type="button"
          onClick={onManage}
          className="flex h-11 shrink-0 items-center justify-center rounded-lg bg-amber-400 px-4 text-sm font-black text-black"
        >
          <CreditCard className="mr-2 h-4 w-4" />
          Manage subscription
        </button>
      ) : (
        <div className="flex shrink-0 flex-wrap gap-2">
          <Link href="/widget" className="flex h-11 items-center justify-center rounded-lg bg-amber-400 px-4 text-sm font-black text-black">
            View widget plans
          </Link>
          <a
            href="mailto:info@mgautotech.de?subject=Widget%20billing%20support"
            className="flex h-11 items-center justify-center rounded-lg border border-amber-500/40 px-4 text-sm font-black text-amber-100"
          >
            Contact support
          </a>
        </div>
      )}
    </div>
  );
}
