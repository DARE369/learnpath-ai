"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface AITutorPanelProps {
  accessToken: string | null;
  subject?: string;
  topicTitle?: string;
  videoTitle?: string;
  learningPathId?: string;
}

function LexiAvatar() {
  return (
    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center flex-shrink-0 text-xs font-bold text-white">
      L
    </div>
  );
}

function TypingDots() {
  return (
    <div className="flex items-center gap-1 py-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </div>
  );
}

export default function AITutorPanel({
  accessToken,
  subject,
  topicTitle,
  videoTitle,
  learningPathId,
}: AITutorPanelProps) {
  const [open, setOpen] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionLoading, setSessionLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const authHeader = accessToken ? { Authorization: `Bearer ${accessToken}` } : {};

  // Start a tutor session when the panel is first opened
  const initSession = useCallback(async () => {
    if (sessionId || sessionLoading) return;
    setSessionLoading(true);
    try {
      const res = await fetch("/api/tutor/session", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader },
        body: JSON.stringify({
          subject: subject || null,
          topic_id: null,
          video_title: videoTitle || null,
          learning_path_id: learningPathId || null,
        }),
      });
      if (!res.ok) throw new Error("Could not start tutor session");
      const data = await res.json();
      setSessionId(data.session_id);

      // Load existing history if there is any
      const histRes = await fetch(`/api/tutor/session/${data.session_id}/history`, {
        headers: authHeader,
      });
      if (histRes.ok) {
        const histData = await histRes.json();
        if (histData.messages?.length) {
          setMessages(histData.messages);
        } else {
          // Greet first-time opener
          const greeting = videoTitle
            ? `Hi! I'm Lexi, your AI study tutor. I can see you're watching "${videoTitle}". What would you like to understand better?`
            : subject
            ? `Hi! I'm Lexi. I'm here to help you with ${subject}. What's on your mind?`
            : "Hi! I'm Lexi, your AI study tutor. Ask me anything about what you're studying and I'll guide you through it.";
          setMessages([{ role: "assistant", content: greeting }]);
        }
      }
    } catch {
      setError("Couldn't connect to tutor. Try again.");
    } finally {
      setSessionLoading(false);
    }
  }, [sessionId, sessionLoading, subject, videoTitle, learningPathId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (open && !sessionId) {
      void initSession();
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [open]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading || !sessionId) return;

    setInput("");
    setError(null);
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setLoading(true);

    try {
      const res = await fetch("/api/tutor/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader },
        body: JSON.stringify({
          session_id: sessionId,
          message: text,
          subject: subject || null,
          topic_title: topicTitle || null,
          video_title: videoTitle || null,
        }),
      });

      if (res.status === 429) {
        setError("You've reached your hourly limit. Upgrade for unlimited tutoring.");
        setMessages((prev) => prev.slice(0, -1)); // remove the user message on rate limit
        setInput(text); // put it back
        return;
      }
      if (!res.ok) throw new Error("Tutor request failed");

      const data = await res.json();
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
    } catch {
      setError("Lexi is unavailable right now. Try again in a moment.");
      setMessages((prev) => prev.slice(0, -1));
      setInput(text);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  };

  return (
    <>
      {/* Floating trigger button */}
      <button
        onClick={() => setOpen((o) => !o)}
        title="Ask Lexi — your AI tutor"
        className={`fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all ${
          open
            ? "bg-indigo-700 rotate-45"
            : "bg-gradient-to-br from-violet-600 to-indigo-600 hover:scale-105"
        }`}
      >
        {open ? (
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed bottom-24 right-6 z-50 w-[360px] max-w-[calc(100vw-24px)] h-[520px] max-h-[calc(100vh-120px)] bg-[#1a1a2e] border border-indigo-500/20 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-fade-in">
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.06] bg-gradient-to-r from-violet-900/40 to-indigo-900/40">
            <LexiAvatar />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white">Lexi</p>
              <p className="text-xs text-white/40 truncate">
                {topicTitle || subject || "AI Study Tutor"}
              </p>
            </div>
            <span className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" title="Online" />
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {sessionLoading && (
              <div className="flex items-center gap-2 text-white/40 text-xs py-4 justify-center">
                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                Connecting to Lexi…
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-2 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
                {msg.role === "assistant" && <LexiAvatar />}
                <div
                  className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === "user"
                      ? "bg-indigo-600 text-white rounded-tr-sm"
                      : "bg-white/[0.06] text-white/85 rounded-tl-sm"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex gap-2">
                <LexiAvatar />
                <div className="bg-white/[0.06] rounded-2xl rounded-tl-sm px-3.5 py-2.5">
                  <TypingDots />
                </div>
              </div>
            )}

            {error && (
              <p className="text-xs text-rose-400 text-center bg-rose-500/10 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Suggested starters — shown when no messages yet */}
          {messages.length <= 1 && !sessionLoading && (
            <div className="px-4 pb-2 flex flex-wrap gap-1.5">
              {[
                "I don't understand this concept",
                "Can you give me an example?",
                "How do I solve this type of question?",
              ].map((s) => (
                <button
                  key={s}
                  onClick={() => { setInput(s); inputRef.current?.focus(); }}
                  className="text-xs px-2.5 py-1.5 rounded-full bg-indigo-500/15 text-indigo-300 hover:bg-indigo-500/25 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="px-3 py-3 border-t border-white/[0.06]">
            <div className="flex items-end gap-2 bg-white/[0.05] rounded-xl border border-white/[0.08] px-3 py-2 focus-within:border-indigo-500/40 transition-colors">
              <textarea
                ref={inputRef}
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask Lexi anything…"
                disabled={loading || sessionLoading || !sessionId}
                className="flex-1 bg-transparent text-sm text-white placeholder-white/25 resize-none focus:outline-none max-h-24 leading-relaxed disabled:opacity-50"
                style={{ minHeight: "24px" }}
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || loading || !sessionId}
                className="w-7 h-7 rounded-lg bg-indigo-600 hover:bg-indigo-500 flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0"
              >
                <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M2 21l21-9L2 3v7l15 2-15 2z" />
                </svg>
              </button>
            </div>
            <p className="text-[10px] text-white/20 text-center mt-1.5">
              Lexi guides you — she won&apos;t just give you answers
            </p>
          </div>
        </div>
      )}
    </>
  );
}
