"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  Loader2,
  MessageCircle,
  RefreshCw,
  Send,
  ShieldCheck,
  UserRound,
  Wifi,
  WifiOff,
} from "lucide-react";
import { authenticatedFetch } from "@/lib/authGuards";

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
  variant?: "default" | "workspace";
};

type ChatSyncState = "loading" | "live" | "reconnecting" | "unavailable";

const MESSAGE_MAX_LENGTH = 4000;
const MESSAGE_REFRESH_INTERVAL_MS = 12000;
const MESSAGE_REQUEST_TIMEOUT_MS = 12000;

function sortMessages(items: RequestMessage[]) {
  return [...items].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
}

function isSameCalendarDay(first: string, second: string) {
  const firstDate = new Date(first);
  const secondDate = new Date(second);
  return firstDate.toDateString() === secondDate.toDateString();
}

function formatMessageDay(value: string) {
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";

  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: date.getFullYear() === today.getFullYear() ? undefined : "numeric",
  }).format(date);
}

function formatMessageTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
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
    gainNode.gain.exponentialRampToValueAtTime(0.06, audioContext.currentTime + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.24);

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.26);
  } catch {
    // Notification audio is optional and may be blocked by the browser.
  }
}

export default function RequestChat({
  requestId,
  senderRole,
  variant = "default",
}: RequestChatProps) {
  const [messages, setMessages] = useState<RequestMessage[]>([]);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [historyReady, setHistoryReady] = useState(false);
  const [historyLimited, setHistoryLimited] = useState(false);
  const [syncState, setSyncState] = useState<ChatSyncState>("loading");
  const [loadError, setLoadError] = useState("");
  const [sendError, setSendError] = useState("");
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [newMessageCount, setNewMessageCount] = useState(0);

  const scrollAreaRef = useRef<HTMLDivElement | null>(null);
  const previousMessageIdsRef = useRef<Set<string>>(new Set());
  const initialLoadDoneRef = useRef(false);
  const sendingOwnMessageRef = useRef(false);
  const sendInFlightRef = useRef(false);
  const fetchInFlightRef = useRef<Promise<boolean> | null>(null);
  const fetchAbortRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(requestId);

  const charactersRemaining = MESSAGE_MAX_LENGTH - message.length;
  const canSendMessage =
    historyReady
    && syncState !== "unavailable"
    && !sending
    && message.trim().length > 0
    && message.length <= MESSAGE_MAX_LENGTH;

  const scrollChatToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const element = scrollAreaRef.current;
    if (!element) return;

    element.scrollTo({ top: element.scrollHeight, behavior });
    setNewMessageCount(0);
  }, []);

  const isNearBottom = useCallback(() => {
    const element = scrollAreaRef.current;
    if (!element) return true;

    return element.scrollHeight - element.scrollTop - element.clientHeight < 96;
  }, []);

  const loadMessages = useCallback((options?: {
    silent?: boolean;
    scrollAfterLoad?: boolean;
  }) => {
    if (!requestId) return Promise.resolve(false);
    if (fetchInFlightRef.current) return fetchInFlightRef.current;

    const currentRequestId = requestId;
    const wasNearBottom = isNearBottom();
    const controller = new AbortController();
    fetchAbortRef.current = controller;

    if (options?.silent) {
      setRefreshing(true);
    } else {
      setSyncState("loading");
      setLoadError("");
    }

    const requestTask = (async () => {
      const timeoutId = window.setTimeout(
        () => controller.abort(),
        MESSAGE_REQUEST_TIMEOUT_MS
      );

      try {
        const response = await authenticatedFetch(
          `/api/requests/${currentRequestId}/messages`,
          { cache: "no-store", signal: controller.signal }
        );
        const payload = await response.json().catch(() => ({}));

        if (!response.ok) throw new Error("message_history_unavailable");
        if (requestIdRef.current !== currentRequestId) return false;

        const sortedMessages = sortMessages(
          Array.isArray(payload.messages) ? payload.messages : []
        );
        const previousIds = previousMessageIdsRef.current;
        const incomingFromOtherSide = sortedMessages.filter(
          (item) => !previousIds.has(item.id) && item.sender_role !== senderRole
        );

        setMessages(sortedMessages);
        setHistoryLimited(payload.history_limited === true);
        setHistoryReady(true);
        setSyncState("live");
        setLoadError("");
        setLastSyncedAt(new Date());
        previousMessageIdsRef.current = new Set(sortedMessages.map((item) => item.id));

        if (
          initialLoadDoneRef.current
          && incomingFromOtherSide.length > 0
          && !sendingOwnMessageRef.current
        ) {
          playNewMessageSound();
          if (!wasNearBottom) {
            setNewMessageCount((current) => current + incomingFromOtherSide.length);
          }
        }

        if (!initialLoadDoneRef.current || options?.scrollAfterLoad) {
          window.setTimeout(() => scrollChatToBottom("auto"), 0);
        } else if (wasNearBottom || sendingOwnMessageRef.current) {
          window.setTimeout(() => scrollChatToBottom("smooth"), 0);
        }

        initialLoadDoneRef.current = true;
        sendingOwnMessageRef.current = false;
        return true;
      } catch {
        if (controller.signal.aborted && requestIdRef.current !== currentRequestId) {
          return false;
        }

        if (!initialLoadDoneRef.current) {
          setHistoryReady(false);
          setSyncState("unavailable");
          setLoadError(
            "The secure conversation could not be opened. Check your connection and try again."
          );
        } else {
          setSyncState("reconnecting");
        }
        return false;
      } finally {
        window.clearTimeout(timeoutId);
        if (requestIdRef.current === currentRequestId) setRefreshing(false);
      }
    })();

    fetchInFlightRef.current = requestTask;
    void requestTask.finally(() => {
      if (fetchInFlightRef.current === requestTask) fetchInFlightRef.current = null;
      if (fetchAbortRef.current === controller) fetchAbortRef.current = null;
    });

    return requestTask;
  }, [isNearBottom, requestId, scrollChatToBottom, senderRole]);

  useEffect(() => {
    requestIdRef.current = requestId;
    fetchAbortRef.current?.abort();
    fetchInFlightRef.current = null;

    const resetId = window.setTimeout(() => {
      previousMessageIdsRef.current = new Set();
      initialLoadDoneRef.current = false;
      sendingOwnMessageRef.current = false;
      sendInFlightRef.current = false;
      setMessages([]);
      setMessage("");
      setHistoryReady(false);
      setHistoryLimited(false);
      setLoadError("");
      setSendError("");
      setSyncState("loading");
      setLastSyncedAt(null);
      setNewMessageCount(0);

      void loadMessages({ scrollAfterLoad: true });
    }, 0);

    return () => {
      window.clearTimeout(resetId);
      fetchAbortRef.current?.abort();
    };
  }, [loadMessages, requestId]);

  useEffect(() => {
    const refreshWhenAvailable = () => {
      if (document.visibilityState !== "visible") return;
      if (typeof navigator !== "undefined" && !navigator.onLine) return;
      void loadMessages({ silent: true });
    };

    const handleOffline = () => {
      setSyncState(initialLoadDoneRef.current ? "reconnecting" : "unavailable");
      if (!initialLoadDoneRef.current) {
        setLoadError(
          "The secure conversation could not be opened. Check your connection and try again."
        );
      }
    };

    const intervalId = window.setInterval(
      refreshWhenAvailable,
      MESSAGE_REFRESH_INTERVAL_MS
    );
    document.addEventListener("visibilitychange", refreshWhenAvailable);
    window.addEventListener("online", refreshWhenAvailable);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", refreshWhenAvailable);
      window.removeEventListener("online", refreshWhenAvailable);
      window.removeEventListener("offline", handleOffline);
    };
  }, [loadMessages]);

  async function sendMessage() {
    const cleanMessage = message.trim();
    if (!cleanMessage || !canSendMessage || sendInFlightRef.current) return;

    sendInFlightRef.current = true;
    setSending(true);
    setSendError("");
    sendingOwnMessageRef.current = true;

    try {
      const response = await authenticatedFetch(`/api/requests/${requestId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: cleanMessage }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok || !payload.message) {
        throw new Error("message_send_failed");
      }

      const storedMessage = payload.message as RequestMessage;
      setMessages((current) => sortMessages([
        ...current.filter((item) => item.id !== storedMessage.id),
        storedMessage,
      ]));
      previousMessageIdsRef.current.add(storedMessage.id);
      setMessage("");
      setSyncState("live");
      setLastSyncedAt(new Date());
      window.setTimeout(() => scrollChatToBottom("smooth"), 0);
      void loadMessages({ silent: true, scrollAfterLoad: true });
    } catch {
      sendingOwnMessageRef.current = false;
      setSendError(
        "Your message was not sent. Keep this window open and try again when the connection is stable."
      );
    } finally {
      sendInFlightRef.current = false;
      setSending(false);
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendMessage();
    }
  }

  const syncLabel = syncState === "live"
    ? "Secure and live"
    : syncState === "reconnecting"
      ? "Reconnecting"
      : syncState === "unavailable"
        ? "Unavailable"
        : "Connecting";
  const SyncIcon = syncState === "live"
    ? Wifi
    : syncState === "unavailable"
      ? WifiOff
      : RefreshCw;

  return (
    <section
      className={`w-full min-w-0 max-w-full overflow-hidden rounded-lg border border-white/10 bg-[#101216] shadow-[0_18px_60px_rgba(0,0,0,0.28)] ${
        variant === "workspace" ? "xl:flex xl:h-full xl:min-h-0 xl:flex-col" : ""
      }`}
      aria-label="Secure request conversation"
    >
      <div className="shrink-0 border-b border-white/10 bg-[#15171c] px-4 py-3.5 sm:px-5">
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-3 sm:flex-nowrap sm:gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-red-500/25 bg-red-500/10 text-red-300">
              <MessageCircle aria-hidden="true" size={18} />
            </span>
            <div className="min-w-0">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <h3 className="min-w-0 break-words text-base font-black text-white sm:text-lg">
                  {variant === "workspace" ? "Order conversation" : "Request chat"}
                </h3>
                <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-zinc-400">
                  <ShieldCheck aria-hidden="true" size={11} />
                  Private
                </span>
              </div>
              <p className="mt-1 text-xs leading-5 text-zinc-500">
                Messages stay securely attached to this order.
              </p>
            </div>
          </div>

          <div
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[11px] font-bold ${
              syncState === "live"
                ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
                : syncState === "unavailable"
                  ? "border-red-500/20 bg-red-500/10 text-red-300"
                  : "border-amber-500/20 bg-amber-500/10 text-amber-200"
            }`}
            role="status"
            aria-live="polite"
          >
            <SyncIcon
              aria-hidden="true"
              size={12}
              className={syncState === "loading" || refreshing ? "animate-spin" : ""}
            />
            <span className="hidden sm:inline">{syncLabel}</span>
          </div>
        </div>

        <div className="mt-3 flex min-w-0 items-center justify-between gap-3 text-[11px] text-zinc-500">
          <span>{messages.length} {messages.length === 1 ? "message" : "messages"}</span>
          {lastSyncedAt ? (
            <span>Updated {lastSyncedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
          ) : null}
        </div>
      </div>

      <div
        ref={scrollAreaRef}
        role="log"
        aria-live="polite"
        aria-busy={syncState === "loading"}
        className={`relative overflow-y-auto overflow-x-hidden bg-[#0b0d10] px-3 py-4 sm:px-5 ${
          variant === "workspace"
            ? "min-h-80 max-h-[32rem] xl:min-h-0 xl:max-h-none xl:flex-1"
            : "min-h-64 max-h-[26rem]"
        }`}
      >
        {historyLimited ? (
          <div className="mb-4 text-center text-[11px] text-zinc-600">
            Showing the latest 200 messages
          </div>
        ) : null}

        {syncState === "loading" && !historyReady ? (
          <div className="flex h-44 flex-col items-center justify-center gap-3 text-sm text-zinc-500">
            <Loader2 aria-hidden="true" className="animate-spin text-red-400" size={22} />
            <span>Opening secure conversation...</span>
          </div>
        ) : syncState === "unavailable" && !historyReady ? (
          <div className="flex h-52 flex-col items-center justify-center px-4 text-center" role="alert">
            <span className="grid h-11 w-11 place-items-center rounded-lg border border-red-500/20 bg-red-500/10 text-red-300">
              <WifiOff aria-hidden="true" size={20} />
            </span>
            <h4 className="mt-4 text-sm font-black text-white">Conversation unavailable</h4>
            <p className="mt-1 max-w-sm text-xs leading-5 text-zinc-500">{loadError}</p>
            <button
              type="button"
              onClick={() => void loadMessages({ scrollAfterLoad: true })}
              className="mt-4 inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.05] px-3.5 py-2 text-xs font-bold text-white transition hover:border-red-500/30 hover:bg-red-500/10 focus:outline-none focus:ring-2 focus:ring-red-500/50"
            >
              <RefreshCw aria-hidden="true" size={14} />
              Try again
            </button>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-44 flex-col items-center justify-center text-center">
            <span className="grid h-11 w-11 place-items-center rounded-lg border border-white/10 bg-white/[0.03] text-zinc-500">
              <MessageCircle aria-hidden="true" size={20} />
            </span>
            <h4 className="mt-4 text-sm font-black text-zinc-200">No messages yet</h4>
            <p className="mt-1 max-w-xs text-xs leading-5 text-zinc-600">
              Send the first message to keep every technical detail with this order.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((item, index) => {
              const isCurrentRole = item.sender_role === senderRole;
              const showDay = index === 0
                || !isSameCalendarDay(messages[index - 1].created_at, item.created_at);
              const senderLabel = isCurrentRole
                ? "You"
                : item.sender_role === "admin"
                  ? "MG AutoTech"
                  : "Customer";

              return (
                <Fragment key={item.id}>
                  {showDay ? (
                    <div className="flex items-center gap-3 py-1" aria-label={formatMessageDay(item.created_at)}>
                      <span className="h-px flex-1 bg-white/[0.06]" />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-600">
                        {formatMessageDay(item.created_at)}
                      </span>
                      <span className="h-px flex-1 bg-white/[0.06]" />
                    </div>
                  ) : null}

                  <div className={`flex items-end gap-2 ${isCurrentRole ? "justify-end" : "justify-start"}`}>
                    {!isCurrentRole ? (
                      <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border ${
                        item.sender_role === "admin"
                          ? "border-red-500/25 bg-red-500/10 text-red-300"
                          : "border-white/10 bg-white/[0.04] text-zinc-500"
                      }`}>
                        {item.sender_role === "admin"
                          ? <ShieldCheck aria-hidden="true" size={13} />
                          : <UserRound aria-hidden="true" size={13} />}
                      </span>
                    ) : null}

                    <article className={`min-w-0 max-w-[86%] rounded-lg border px-3.5 py-2.5 shadow-sm sm:max-w-[78%] ${
                      isCurrentRole
                        ? "border-red-500/25 bg-red-500/[0.12] text-white"
                        : "border-white/[0.08] bg-white/[0.045] text-zinc-100"
                    }`}>
                      <div className="mb-1.5 flex items-center justify-between gap-4 text-[10px]">
                        <span className={`font-black ${isCurrentRole ? "text-red-200" : "text-zinc-400"}`}>
                          {senderLabel}
                        </span>
                        <time dateTime={item.created_at} className="text-zinc-600">
                          {formatMessageTime(item.created_at)}
                        </time>
                      </div>
                      <p className="whitespace-pre-wrap break-words text-sm leading-6">
                        {item.message}
                      </p>
                      {isCurrentRole ? (
                        <div className="mt-1.5 flex justify-end text-red-300/70" aria-label="Message stored">
                          <CheckCircle2 aria-hidden="true" size={12} />
                        </div>
                      ) : null}
                    </article>
                  </div>
                </Fragment>
              );
            })}
          </div>
        )}

        {newMessageCount > 0 ? (
          <button
            type="button"
            onClick={() => scrollChatToBottom("smooth")}
            className="sticky bottom-2 left-1/2 mt-3 -translate-x-1/2 rounded-full border border-red-500/30 bg-[#201014] px-3 py-1.5 text-xs font-black text-red-200 shadow-lg transition hover:bg-red-500/20 focus:outline-none focus:ring-2 focus:ring-red-500/50"
          >
            {newMessageCount} new {newMessageCount === 1 ? "message" : "messages"}
          </button>
        ) : null}
      </div>

      <div className="shrink-0 border-t border-white/10 bg-[#15171c] p-3 sm:p-4">
        {syncState === "reconnecting" ? (
          <div className="mb-2 flex items-center gap-2 text-[11px] text-amber-200" role="status">
            <RefreshCw aria-hidden="true" className="animate-spin" size={12} />
            Reconnecting in the background. Your loaded messages remain available.
          </div>
        ) : null}

        <div className="flex min-w-0 items-end gap-2">
          <textarea
            value={message}
            onChange={(event) => {
              setMessage(event.target.value);
              if (sendError) setSendError("");
            }}
            onKeyDown={handleKeyDown}
            maxLength={MESSAGE_MAX_LENGTH}
            rows={2}
            disabled={!historyReady || syncState === "unavailable"}
            aria-label="Message"
            aria-describedby="request-chat-message-help request-chat-message-limit request-chat-send-error"
            placeholder={historyReady ? "Write a message..." : "Waiting for secure connection..."}
            className="min-h-[52px] min-w-0 flex-1 resize-none rounded-lg border border-white/10 bg-black/35 px-3.5 py-3 text-sm leading-5 text-white outline-none placeholder:text-zinc-600 transition focus:border-red-500/50 focus:ring-2 focus:ring-red-500/10 disabled:cursor-not-allowed disabled:opacity-60"
          />

          <button
            type="button"
            onClick={() => void sendMessage()}
            disabled={!canSendMessage}
            aria-label={sending ? "Sending message" : "Send message"}
            className="inline-flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-lg bg-[#c91522] text-white shadow-[0_8px_24px_rgba(201,21,34,0.22)] transition hover:bg-[#e01b2a] focus:outline-none focus:ring-2 focus:ring-red-500/50 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-600 disabled:shadow-none"
          >
            {sending
              ? <Loader2 aria-hidden="true" className="animate-spin" size={18} />
              : <Send aria-hidden="true" size={18} />}
          </button>
        </div>

        <div
          id="request-chat-message-help"
          className="mt-2 flex min-w-0 flex-col gap-1 text-[11px] text-zinc-600 sm:flex-row sm:items-center sm:justify-between"
        >
          <span>Press Enter to send / Shift + Enter for a new line</span>
          <span
            id="request-chat-message-limit"
            aria-live="polite"
            className={`shrink-0 font-bold ${charactersRemaining < 200 ? "text-amber-300" : "text-zinc-500"}`}
          >
            {charactersRemaining} characters remaining
          </span>
        </div>

        <div id="request-chat-send-error" aria-live="assertive">
          {sendError ? (
            <div className="mt-2 flex items-start justify-between gap-3 rounded-lg border border-red-500/20 bg-red-500/[0.08] px-3 py-2 text-xs leading-5 text-red-200" role="alert">
              <span>{sendError}</span>
              <button
                type="button"
                onClick={() => void sendMessage()}
                className="shrink-0 font-black text-white underline decoration-red-400/50 underline-offset-4"
              >
                Try again
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
