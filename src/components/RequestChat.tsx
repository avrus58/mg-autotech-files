"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type RequestMessage = {
  id: string;
  request_id: string;
  sender_id: string;
  sender_role: "customer" | "admin";
  message: string;
  created_at: string;
};

type RequestChatProps = {
  requestId: string;
  senderRole: "customer" | "admin";
};

export default function RequestChat({
  requestId,
  senderRole,
}: RequestChatProps) {
  const [messages, setMessages] = useState<RequestMessage[]>([]);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [newMessageCount, setNewMessageCount] = useState(0);

  const scrollAreaRef = useRef<HTMLDivElement | null>(null);
  const previousMessageIdsRef = useRef<Set<string>>(new Set());
  const initialLoadDoneRef = useRef(false);
  const sendingOwnMessageRef = useRef(false);

  function sortMessages(items: RequestMessage[]) {
    return [...items].sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  }

  function scrollChatToBottom(behavior: ScrollBehavior = "smooth") {
    const element = scrollAreaRef.current;
    if (!element) return;

    element.scrollTo({
      top: element.scrollHeight,
      behavior,
    });

    setNewMessageCount(0);
  }

  function isNearBottom() {
    const element = scrollAreaRef.current;
    if (!element) return true;

    const distanceFromBottom =
      element.scrollHeight - element.scrollTop - element.clientHeight;

    return distanceFromBottom < 80;
  }

  function playNewMessageSound() {
    try {
      const AudioContextClass =
        window.AudioContext || (window as typeof window & {
          webkitAudioContext?: typeof AudioContext;
        }).webkitAudioContext;

      if (!AudioContextClass) return;

      const audioContext = new AudioContextClass();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
      oscillator.frequency.setValueAtTime(660, audioContext.currentTime + 0.12);

      gainNode.gain.setValueAtTime(0.0001, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(
        0.08,
        audioContext.currentTime + 0.02
      );
      gainNode.gain.exponentialRampToValueAtTime(
        0.0001,
        audioContext.currentTime + 0.28
      );

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.3);
    } catch {
      // Browser blocked sound or audio context failed.
    }
  }

  async function loadMessages(options?: {
    silent?: boolean;
    scrollAfterLoad?: boolean;
  }) {
    if (!requestId) return;

    const wasNearBottom = isNearBottom();

    if (options?.silent) {
      setRefreshing(true);
    } else {
      setInitialLoading(true);
    }

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        setError("Unauthorized");
        return;
      }

      const res = await fetch(`/api/requests/${requestId}/messages`, {
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Messages could not be loaded.");
        return;
      }

      const sortedMessages = sortMessages(data.messages || []);

      const previousIds = previousMessageIdsRef.current;
      const incomingMessages = sortedMessages.filter(
        (item) => !previousIds.has(item.id)
      );

      const incomingFromOtherSide = incomingMessages.filter(
        (item) => item.sender_role !== senderRole
      );

      setMessages(sortedMessages);
      setError("");

      previousMessageIdsRef.current = new Set(
        sortedMessages.map((item) => item.id)
      );

      const shouldNotify =
        initialLoadDoneRef.current &&
        incomingFromOtherSide.length > 0 &&
        !sendingOwnMessageRef.current;

      if (shouldNotify) {
        playNewMessageSound();

        if (!wasNearBottom) {
          setNewMessageCount(
            (current) => current + incomingFromOtherSide.length
          );
        }
      }

      if (!initialLoadDoneRef.current || options?.scrollAfterLoad) {
        window.setTimeout(() => scrollChatToBottom("auto"), 0);
      } else if (wasNearBottom || sendingOwnMessageRef.current) {
        window.setTimeout(() => scrollChatToBottom("smooth"), 0);
      }

      initialLoadDoneRef.current = true;
      sendingOwnMessageRef.current = false;
    } catch {
      setError("Messages could not be loaded.");
    } finally {
      setInitialLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      previousMessageIdsRef.current = new Set();
      initialLoadDoneRef.current = false;
      sendingOwnMessageRef.current = false;
      setMessages([]);
      setNewMessageCount(0);
      void loadMessages({ scrollAfterLoad: true });
    }, 0);
    return () => window.clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestId]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      loadMessages({ silent: true });
    }, 5000);

    return () => window.clearInterval(interval);
  }, [requestId, senderRole]);

  async function sendMessage() {
    const cleanMessage = message.trim();

    if (!cleanMessage || sending) return;

    setSending(true);
    setError("");
    sendingOwnMessageRef.current = true;

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        setError("Unauthorized");
        sendingOwnMessageRef.current = false;
        return;
      }

      const res = await fetch(`/api/requests/${requestId}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ message: cleanMessage }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Message could not be sent.");
        sendingOwnMessageRef.current = false;
        return;
      }

      setMessage("");
      await loadMessages({ silent: true, scrollAfterLoad: true });
    } catch {
      setError("Message could not be sent.");
      sendingOwnMessageRef.current = false;
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  }

  return (
    <section className="min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-[#0f1115] shadow-lg">
      <div className="border-b border-white/10 bg-white/[0.03] px-4 py-4 sm:px-5">
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h3 className="text-lg font-black text-white">Request Chat</h3>

              {newMessageCount > 0 ? (
                <button
                  type="button"
                  onClick={() => scrollChatToBottom("smooth")}
                  className="rounded-full border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-xs font-black text-red-300 transition hover:bg-red-500/20"
                >
                  {newMessageCount} new
                </button>
              ) : null}
            </div>

            <p className="mt-1 text-sm text-zinc-400">
              Communicate directly about this file request.
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-300">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            {refreshing ? "Syncing" : "Live"}
          </div>
        </div>

        <div className="mt-3 text-xs text-zinc-500">
          {messages.length} {messages.length === 1 ? "message" : "messages"}
        </div>
      </div>

      <div
        ref={scrollAreaRef}
        className="max-h-96 min-h-64 space-y-3 overflow-y-auto overflow-x-hidden bg-black/25 p-3 sm:p-5"
      >
        {initialLoading ? (
          <div className="flex h-40 items-center justify-center text-sm text-zinc-500">
            Loading messages...
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-40 items-center justify-center rounded-2xl border border-dashed border-white/10 bg-black/20 text-center">
            <div>
              <div className="text-sm font-bold text-zinc-400">
                No messages yet
              </div>
              <div className="mt-1 text-xs text-zinc-600">
                Start the conversation for this request.
              </div>
            </div>
          </div>
        ) : (
          messages.map((msg) => {
            const isAdmin = msg.sender_role === "admin";
            const isCurrentRole = msg.sender_role === senderRole;

            return (
              <div
                key={msg.id}
                className={`flex ${
                  isCurrentRole ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[92%] rounded-2xl px-4 py-3 text-sm shadow-sm sm:max-w-[82%] ${
                    isAdmin
                      ? "bg-blue-600 text-white"
                      : "bg-zinc-800 text-zinc-100"
                  }`}
                >
                  <div className="mb-1 flex items-center justify-between gap-3 text-xs opacity-80">
                    <span className="font-bold">
                      {isAdmin ? "MG AutoTech" : "Customer"}
                    </span>
                    <span>
                      {new Date(msg.created_at).toLocaleString("de-DE", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>

                  <div className="whitespace-pre-wrap break-words leading-6">
                    {msg.message}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {error ? (
        <div className="border-t border-red-500/20 bg-red-500/10 px-5 py-3 text-sm text-red-300">
          {error}
        </div>
      ) : null}

      <div className="border-t border-white/10 bg-white/[0.03] p-3 sm:p-4">
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Write a message..."
            className="min-h-[48px] min-w-0 flex-1 resize-none rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500 transition focus:border-blue-500"
          />

          <button
            type="button"
            onClick={sendMessage}
            disabled={sending || !message.trim()}
            className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-black text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            {sending ? "Sending..." : "Send"}
          </button>
        </div>

        <div className="mt-2 text-xs text-zinc-600">
          Press Enter to send · Shift + Enter for a new line
        </div>
      </div>
    </section>
  );
}
