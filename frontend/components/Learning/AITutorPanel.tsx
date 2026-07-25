"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { Icon } from "../../ui-v2/icons";
import { color, font } from "../../ui-v2/tokens";

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
  /** Whether the Lexi tab is the currently-visible one. Session init is
   * lazy — it fires once the first time this becomes true, so users who
   * never open Lexi never burn a /api/tutor/session call. */
  active?: boolean;
}

function LexiAvatar() {
  return (
    <div style={{ width: 26, height: 26, borderRadius: "50%", background: "linear-gradient(135deg, #7C5CBF, #2B5FA8)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 11, fontWeight: 700, color: "#fff" }}>
      L
    </div>
  );
}

function usePulse(intervalMs = 400): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const id = setInterval(() => setOn((v) => !v), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return on;
}

function TypingDots() {
  const on = usePulse();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 0" }}>
      {[0, 1, 2].map((i) => (
        <span key={i} style={{ width: 5, height: 5, borderRadius: "50%", background: "rgba(255,255,255,0.4)", opacity: on ? 1 : 0.4, transform: `translateY(${on ? -2 : 0}px)`, transition: "transform 0.3s ease, opacity 0.3s ease" }} />
      ))}
    </div>
  );
}

const STARTER_PROMPTS = ["I don't understand this concept", "Can you give me an example?", "How do I solve this type of question?"];

export default function AITutorPanel({ accessToken, subject, topicTitle, videoTitle, learningPathId, active = true }: AITutorPanelProps) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionLoading, setSessionLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const hasInitialized = useRef(false);

  const authHeader: Record<string, string> = accessToken ? { Authorization: `Bearer ${accessToken}` } : {};

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

      const histRes = await fetch(`/api/tutor/session/${data.session_id}/history`, { headers: authHeader });
      if (histRes.ok) {
        const histData = await histRes.json();
        if (histData.messages?.length) {
          setMessages(histData.messages);
        } else {
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
    if (active && !hasInitialized.current) {
      hasInitialized.current = true;
      void initSession();
    }
  }, [active]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (active) setTimeout(() => inputRef.current?.focus(), 150);
  }, [active]);

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
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, fontFamily: font.body }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderBottom: `1px solid ${color.chromeBorder}`, background: "linear-gradient(90deg, rgba(124,92,191,0.15), rgba(43,95,168,0.15))", flexShrink: 0 }}>
        <LexiAvatar />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: color.chromeText }}>Lexi</div>
          <div style={{ fontSize: 11, color: color.textFainter, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{topicTitle || subject || "AI Study Tutor"}</div>
        </div>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: color.success.fg, flexShrink: 0 }} title="Online" />
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
        {sessionLoading && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, color: color.textFainter, fontSize: 12, padding: "16px 0" }}>Connecting to Lexi…</div>
        )}

        {messages.map((msg, i) => (
          <div key={i} style={{ display: "flex", gap: 8, flexDirection: msg.role === "user" ? "row-reverse" : "row" }}>
            {msg.role === "assistant" && <LexiAvatar />}
            <div
              style={{
                maxWidth: "82%", borderRadius: 14, padding: "9px 12px", fontSize: 13, lineHeight: 1.5, whiteSpace: "pre-wrap",
                background: msg.role === "user" ? "#2B5FA8" : "rgba(255,255,255,0.06)",
                color: msg.role === "user" ? "#fff" : color.chromeTextMuted,
                borderTopRightRadius: msg.role === "user" ? 4 : 14,
                borderTopLeftRadius: msg.role === "assistant" ? 4 : 14,
              }}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ display: "flex", gap: 8 }}>
            <LexiAvatar />
            <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: 14, borderTopLeftRadius: 4, padding: "9px 12px" }}>
              <TypingDots />
            </div>
          </div>
        )}

        {error && <p style={{ fontSize: 11.5, color: "#E08579", textAlign: "center", background: "rgba(176,54,44,0.12)", borderRadius: 8, padding: "8px 12px", margin: 0 }}>{error}</p>}

        <div ref={bottomRef} />
      </div>

      {messages.length <= 1 && !sessionLoading && (
        <div style={{ padding: "0 14px 8px", display: "flex", flexWrap: "wrap", gap: 6, flexShrink: 0 }}>
          {STARTER_PROMPTS.map((s) => (
            <button key={s} onClick={() => { setInput(s); inputRef.current?.focus(); }} style={{ fontSize: 11.5, padding: "6px 10px", borderRadius: 100, background: "rgba(43,95,168,0.15)", color: "#6FA0E0", border: "none", cursor: "pointer", fontFamily: font.body }}>
              {s}
            </button>
          ))}
        </div>
      )}

      <div style={{ padding: 12, borderTop: `1px solid ${color.chromeBorder}`, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 8, background: "rgba(255,255,255,0.05)", borderRadius: 10, border: `1px solid ${color.chromeBorder}`, padding: "8px 10px" }}>
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Lexi anything…"
            disabled={loading || sessionLoading || !sessionId}
            style={{ flex: 1, background: "transparent", border: "none", outline: "none", resize: "none", fontSize: 13, color: color.chromeText, fontFamily: font.body, maxHeight: 96, minHeight: 24 }}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || loading || !sessionId}
            style={{ width: 26, height: 26, borderRadius: 8, background: "#2B5FA8", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", opacity: !input.trim() || loading || !sessionId ? 0.35 : 1, flexShrink: 0, color: "#fff" }}
          >
            <Icon name="send" size={13} className="" />
          </button>
        </div>
        <p style={{ fontSize: 10, color: color.textFainter, textAlign: "center", marginTop: 6 }}>Lexi guides you — she won&apos;t just give you answers</p>
      </div>
    </div>
  );
}
