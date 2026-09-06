"use client";

import { useId, useState, type ReactNode } from "react";
import { ChevronDown, Activity } from "lucide-react";

/** One content tree: collapsible on mobile, unchanged and always visible on desktop. */
export function AdminMobileOverview({ children, label = "Activity overview & latest orders" }: { children: ReactNode; label?: string }) {
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  return (
    <div data-admin-mobile-overview>
      <button type="button" className="admin-mobile-overview-toggle" aria-expanded={expanded} aria-controls={id} onClick={() => setExpanded((value) => !value)}>
        <Activity size={18} aria-hidden="true" /><span>{label}</span><ChevronDown size={18} aria-hidden="true" className={expanded ? "rotate-180" : ""} />
      </button>
      <div id={id} data-admin-overview-content data-expanded={expanded}>{children}</div>
    </div>
  );
}
