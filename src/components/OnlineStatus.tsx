"use client";

import { useEffect, useMemo, useState } from "react";

function getGermanyTime() {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: "Europe/Berlin" })
  );
}

function formatTime(date: Date) {
  return new Intl.DateTimeFormat("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function isOnline(date: Date) {
  const hour = date.getHours();
  const minute = date.getMinutes();
  const minutes = hour * 60 + minute;

  // Daily operation window: 06:00 - 02:00, with a short night pause.
  const open = 6 * 60;
  const nightPause = 2 * 60;

  return minutes >= open || minutes < nightPause;
}

function getStatusLabel(date: Date, online: boolean) {
  if (!online) {
    return (
      <>
        We are <span className="font-black text-red-400">offline</span>
      </>
    );
  }

  if (date.getDay() === 0) {
    return (
      <>
        Sunday support is <span className="font-black text-amber-300">online</span>
      </>
    );
  }

  return (
    <>
      Now we are <span className="font-black text-emerald-400">online!</span>
    </>
  );
}

export function OnlineStatus() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(getGermanyTime());

    const interval = window.setInterval(() => {
      setNow(getGermanyTime());
    }, 30_000);

    return () => window.clearInterval(interval);
  }, []);

  const status = useMemo(() => {
    if (!now) {
      return {
        time: "--:--",
        online: false,
        label: (
          <>
            We are <span className="font-black text-red-400">offline</span>
          </>
        ),
      };
    }

    const online = isOnline(now);

    return {
      time: formatTime(now),
      online,
      label: getStatusLabel(now, online),
    };
  }, [now]);

  return (
    <div className="fixed bottom-4 left-4 z-[60]">
      <div className="rounded-xl border border-white/10 bg-black/90 px-4 py-3 text-white shadow-2xl shadow-black/40 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <span
            className={`h-4 w-4 rounded-full ${
              status.online
                ? "bg-emerald-500 shadow-lg shadow-emerald-500/30"
                : "bg-red-500 shadow-lg shadow-red-500/30"
            }`}
          />
          <div className="text-sm leading-tight">
            <div className="font-black">It&apos;s {status.time}.</div>
            <div className="text-xs text-zinc-300">
              {status.label}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
