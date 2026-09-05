"use client";

import { useState } from "react";
import { Check, Clipboard } from "lucide-react";
import { widgetSiteT } from "@/lib/i18n/widget-site-translations";
import { useActiveLocale } from "@/lib/useActiveLocale";

export function EmbedCodeBox({ title, code, disabled = false }: { title: string; code: string; disabled?: boolean }) {
  const locale = useActiveLocale();
  const [copied, setCopied] = useState(false);
  async function copy() {
    if (disabled) return;
    await navigator.clipboard.writeText(code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }
  return <div className="min-w-0 border-t border-white/10 pt-4"><div className="mb-3 flex items-center justify-between gap-3"><h3 className="text-sm font-black">{title}</h3><button type="button" disabled={disabled} onClick={copy} className="flex h-9 items-center rounded-lg border border-white/10 bg-white/[0.04] px-3 text-xs font-black disabled:opacity-35">{copied ? <Check className="mr-2 h-4 w-4 text-emerald-400" /> : <Clipboard className="mr-2 h-4 w-4" />}{widgetSiteT(locale, copied ? "copied" : "copy")}</button></div><pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-lg border border-white/10 bg-black/40 p-4 text-xs leading-6 text-zinc-300"><code translate="no" data-no-translate>{code}</code></pre></div>;
}

