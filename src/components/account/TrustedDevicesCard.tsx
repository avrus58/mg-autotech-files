"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Laptop, Loader2, RefreshCcw, ShieldCheck, Trash2 } from "lucide-react";
import {
  authenticatedFetch,
  signOutLocalStable,
} from "@/lib/authGuards";
import { customerWorkflowT } from "@/lib/i18n/customer-workflow-security-translations";
import { intlLocaleByCode, type LocaleCode } from "@/lib/i18nConfig";
import { useActiveLocale } from "@/lib/useActiveLocale";

type TrustedDevice = {
  id: string;
  label: string;
  createdAt: string;
  lastUsedAt: string;
  trustedUntil: string;
  current: boolean;
};

function formatSecurityDate(value: string, locale: LocaleCode) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? customerWorkflowT(locale, "unknownValue")
    : new Intl.DateTimeFormat(intlLocaleByCode[locale], {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
}

export function TrustedDevicesCard() {
  const router = useRouter();
  const locale = useActiveLocale();
  const [devices, setDevices] = useState<TrustedDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const loadDevices = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const response = await authenticatedFetch("/api/account/security/devices", {
        cache: "no-store",
      });
      const payload = await response.json().catch(() => ({})) as {
        devices?: TrustedDevice[];
        error?: string;
      };
      if (!response.ok) throw new Error("Trusted devices could not be loaded.");
      setDevices(Array.isArray(payload.devices) ? payload.devices : []);
    } catch {
      setMessage("Trusted devices could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadDevices(), 0);
    return () => window.clearTimeout(timeout);
  }, [loadDevices]);

  const revokeDevice = async (device: TrustedDevice) => {
    if (!window.confirm(customerWorkflowT(locale, "stopTrustingDevice", { device: device.label }))) return;
    setWorkingId(device.id);
    setMessage("");
    try {
      const response = await authenticatedFetch(
        `/api/account/security/devices/${encodeURIComponent(device.id)}`,
        { method: "DELETE" }
      );
      const payload = await response.json().catch(() => ({})) as {
        error?: string;
        current?: boolean;
      };
      if (!response.ok) throw new Error("Trusted device could not be revoked.");
      if (payload.current) {
        await signOutLocalStable();
        router.replace("/login");
        router.refresh();
        return;
      }
      setDevices((current) => current.filter((item) => item.id !== device.id));
      setMessage("Trusted device removed.");
    } catch {
      setMessage("Trusted device could not be revoked.");
    } finally {
      setWorkingId(null);
    }
  };

  const revokeOthers = async () => {
    if (!window.confirm(customerWorkflowT(locale, "stopTrustingOtherDevices"))) return;
    setWorkingId("others");
    setMessage("");
    try {
      const response = await authenticatedFetch(
        "/api/account/security/devices/revoke-others",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ confirm: true }),
        }
      );
      if (!response.ok) throw new Error("Other devices could not be revoked.");
      setDevices((current) => current.filter((device) => device.current));
      setMessage("All other trusted devices were removed.");
    } catch {
      setMessage("Other devices could not be revoked.");
    } finally {
      setWorkingId(null);
    }
  };

  return (
    <section className="mt-6 rounded-[2rem] border border-white/10 bg-white/[0.04] p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-red-800/40 bg-red-950/25">
            <ShieldCheck className="h-6 w-6 text-red-400" />
          </div>
          <div>
            <h2 className="text-2xl font-black">Security & trusted devices</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
              New devices require an e-mail security code. Devices you explicitly trust can sign in for 30 days without another code.
            </p>
            <p className="mt-2 max-w-2xl text-xs leading-5 text-zinc-500">
              Revoking a saved device blocks its MG AutoTech customer-data access. If you suspect account theft, reset your password too.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void loadDevices()}
          disabled={loading}
          className="inline-flex h-10 items-center justify-center rounded-xl border border-white/10 px-4 text-sm font-black text-zinc-300 disabled:opacity-50"
        >
          <RefreshCcw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      {loading ? (
        <div role="status" className="mt-6 flex items-center gap-3 rounded-2xl border border-white/10 bg-black/25 p-5 text-sm text-zinc-400">
          <Loader2 className="h-5 w-5 animate-spin text-red-500" /> Loading trusted devices...
        </div>
      ) : devices.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-white/10 bg-black/25 p-5 text-sm leading-6 text-zinc-400">
          No trusted devices are saved. You can select “Trust this device for 30 days” the next time you verify a login.
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {devices.map((device) => (
            <article key={device.id} className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-black/25 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <Laptop className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-black text-white" translate="no" data-no-translate>{device.label}</span>
                    {device.current && (
                      <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-black uppercase tracking-wide text-emerald-200">Current</span>
                    )}
                  </div>
                  <div className="mt-2 text-xs leading-5 text-zinc-500">
                    {customerWorkflowT(locale, "trustedDeviceDates", {
                      lastUsed: formatSecurityDate(device.lastUsedAt, locale),
                      trustedUntil: formatSecurityDate(device.trustedUntil, locale),
                    })}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => void revokeDevice(device)}
                disabled={workingId !== null}
                className="inline-flex h-10 shrink-0 items-center justify-center rounded-xl border border-red-800/40 px-4 text-sm font-black text-red-300 disabled:opacity-50"
              >
                {workingId === device.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                Revoke
              </button>
            </article>
          ))}
        </div>
      )}

      {devices.some((device) => !device.current) && (
        <button
          type="button"
          onClick={() => void revokeOthers()}
          disabled={workingId !== null}
          className="mt-5 inline-flex h-11 items-center justify-center rounded-xl border border-red-800/40 px-4 text-sm font-black text-red-300 disabled:opacity-50"
        >
          {workingId === "others" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Revoke all other devices
        </button>
      )}

      {message && <div aria-live="polite" className="mt-4 text-sm text-zinc-300">{message}</div>}
    </section>
  );
}
