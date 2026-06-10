import React, { useCallback, useEffect, useRef, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { ArrowLeft, Link2, Send, Users, MessageSquare } from "lucide-react";
import { useAuth } from "../../../hooks/useAuth";
import { Button, Skeleton } from "../../../components/ui";

interface MessageItem {
  message_id: string;
  sender_id: string;
  sender_name: string;
  sender_role: string;
  content: string;
  links: Array<{ url: string; title: string }>;
  created_at: string;
  read_by: string[];
  display_time: string;
}

interface ThreadData {
  conversation_id: string;
  conversation_name: string;
  conversation_type: string;
  messages: MessageItem[];
  typing_users: string[];
  pagination: { page: number; page_size: number; total: number };
}

const TYPING_INTERVAL_MS = 3000;

export default function ConversationThreadPage() {
  const router = useRouter();
  const { conversationId } = router.query as { conversationId: string };
  const { user, accessToken } = useAuth();

  const [thread, setThread] = useState<ThreadData | null>(null);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [linkInput, setLinkInput] = useState("");
  const [showLinkBox, setShowLinkBox] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const auth = accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined;

  const load = useCallback(async () => {
    if (!accessToken || !conversationId) return;
    try {
      const res = await fetch(`/api/messaging/conversations/${conversationId}`, { headers: auth });
      if (!res.ok) throw new Error();
      setThread(await res.json());
    } catch {
      setThread(null);
    } finally {
      setLoading(false);
    }
  }, [accessToken, conversationId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { void load(); }, [load]);

  // Poll for new messages + typing indicators every 4s
  useEffect(() => {
    const id = setInterval(load, 4000);
    return () => clearInterval(id);
  }, [load]);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thread?.messages.length]);

  function handleTyping() {
    if (!accessToken || !conversationId) return;
    fetch(`/api/messaging/conversations/${conversationId}/typing?is_typing=true`, {
      method: "POST",
      headers: auth,
    }).catch(() => {});

    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      fetch(`/api/messaging/conversations/${conversationId}/typing?is_typing=false`, {
        method: "POST",
        headers: auth,
      }).catch(() => {});
    }, TYPING_INTERVAL_MS);
  }

  async function send() {
    if (!draft.trim() || !accessToken || !conversationId) return;
    setSending(true);
    const links = linkInput.trim()
      ? [{ url: linkInput.trim(), title: linkInput.trim().slice(0, 60) }]
      : undefined;
    try {
      const res = await fetch(`/api/messaging/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify({ content: draft, links }),
      });
      if (!res.ok) throw new Error();
      setDraft("");
      setLinkInput("");
      setShowLinkBox(false);
      await load();
    } finally {
      setSending(false);
    }
  }

  const myId = user?.id ? String(user.id) : "";

  return (
    <>
      <Head>
        <title>
          {thread ? `${thread.conversation_name} — Messages` : "Conversation"} — LearnPath AI
        </title>
      </Head>
      <div className="flex h-screen flex-col bg-[#0f0f0f]">

        {/* Top bar */}
        <header className="flex shrink-0 items-center gap-3 border-b border-white/10 px-4 py-3">
          <button
            onClick={() => router.push("/teacher/messages")}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-white/50 hover:bg-white/5 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          {thread && (
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-500/20 text-indigo-400">
                {thread.conversation_type === "group" ? (
                  <Users className="h-4 w-4" />
                ) : (
                  <MessageSquare className="h-4 w-4" />
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate font-semibold text-white">{thread.conversation_name}</p>
                {thread.conversation_type === "group" && (
                  <p className="text-xs text-white/40">
                    {thread.pagination.total} messages · group
                  </p>
                )}
              </div>
            </div>
          )}
        </header>

        {/* Message list */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-3/4" />)}
            </div>
          ) : !thread ? (
            <p className="text-center text-sm text-white/40 mt-8">Conversation not found.</p>
          ) : thread.messages.length === 0 ? (
            <p className="text-center text-sm text-white/40 mt-8">
              No messages yet. Say hello!
            </p>
          ) : (
            thread.messages.map((msg) => {
              const isMe = msg.sender_id === myId;
              return (
                <div
                  key={msg.message_id}
                  className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                      isMe
                        ? "rounded-br-sm bg-indigo-600 text-white"
                        : "rounded-bl-sm bg-white/10 text-white"
                    }`}
                  >
                    {!isMe && (
                      <p className="mb-1 text-xs font-semibold text-indigo-300">
                        {msg.sender_name}
                      </p>
                    )}
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                    {msg.links && msg.links.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {msg.links.map((lnk, i) => (
                          <a
                            key={i}
                            href={lnk.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs underline opacity-80 hover:opacity-100"
                          >
                            <Link2 className="h-3 w-3" />
                            {lnk.title || lnk.url}
                          </a>
                        ))}
                      </div>
                    )}
                    <div className={`mt-1 flex items-center gap-1 text-[10px] ${isMe ? "justify-end text-white/60" : "text-white/30"}`}>
                      <span>{msg.display_time}</span>
                      {isMe && msg.read_by.length > 0 && (
                        <span className="ml-0.5">✓✓</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}

          {/* Typing indicator */}
          {thread && thread.typing_users.length > 0 && (
            <div className="flex justify-start">
              <div className="rounded-2xl rounded-bl-sm bg-white/10 px-4 py-2.5">
                <p className="text-xs text-white/40 italic">
                  {thread.typing_users.join(", ")} {thread.typing_users.length === 1 ? "is" : "are"} typing…
                </p>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Compose area */}
        <div className="shrink-0 border-t border-white/10 px-4 py-3">
          {showLinkBox && (
            <div className="mb-2">
              <input
                type="url"
                placeholder="Paste a link…"
                value={linkInput}
                onChange={(e) => setLinkInput(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white placeholder-white/30 focus:border-indigo-500 focus:outline-none"
              />
            </div>
          )}
          <div className="flex items-end gap-2">
            <button
              onClick={() => setShowLinkBox((v) => !v)}
              title="Attach link"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/40 hover:text-white"
            >
              <Link2 className="h-4 w-4" />
            </button>
            <textarea
              rows={1}
              placeholder="Type a message…"
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                handleTyping();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              className="flex-1 resize-none rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/30 focus:border-indigo-500 focus:outline-none"
              style={{ minHeight: "2.25rem", maxHeight: "6rem" }}
            />
            <Button
              size="sm"
              disabled={!draft.trim() || sending}
              onClick={send}
              className="shrink-0"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
