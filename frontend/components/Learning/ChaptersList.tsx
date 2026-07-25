"use client";
/**
 * ChaptersList — sidebar panel showing AI-generated video chapters.
 *
 * Fetches chunks from GET /api/chunks/{youtubeId}, displays the chapter list,
 * highlights the active chapter based on the player's current position, and
 * triggers the ChapterQuiz overlay when a chapter ends.
 *
 * The component passes back the requested seek time via onSeekTo so the parent
 * VideoPlayer can jump the YouTube embed to the right timestamp.
 */

import React, { useEffect, useState, useCallback, useRef } from "react";
import { Card, Button } from "../../ui-v2/primitives";
import { Icon } from "../../ui-v2/icons";
import { color, font } from "../../ui-v2/tokens";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface QuizQuestion {
  id: string;
  question_number: number;
  question_text: string;
  question_type: string;
  options: Array<{ text: string; correct: boolean }>;
  explanation: string;
}

export interface Chunk {
  id: string;
  chunk_number: number;
  title: string;
  start_seconds: number;
  end_seconds: number;
  duration_seconds: number;
  start_timestamp: string;
  end_timestamp: string;
  learning_objective: string;
  key_concepts: string[];
  summary: string;
  quiz: {
    id: string | null;
    question_count: number;
    questions: QuizQuestion[];
  };
}

interface ChunkProgress {
  completion_percent: number;
  completed: boolean;
  quiz_score: number | null;
}

interface Props {
  youtubeId: string;
  accessToken: string | null;
  currentSeconds: number; // live position from the YouTube player
  onSeekTo: (seconds: number) => void; // caller seeks the player
  onChunksLoaded?: (chunks: Chunk[]) => void; // fires once when chunks are fetched
  onChapterComplete?: (chunkId: string, chapterTitle: string, questions: QuizQuestion[]) => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDur(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ChaptersList({ youtubeId, accessToken, currentSeconds, onSeekTo, onChunksLoaded }: Props) {
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [progress] = useState<Record<string, ChunkProgress>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [generating, setGenerating] = useState(false);
  // True when all transcript sources (YouTube + Whisper) failed; retrying won't help.
  const [noTranscript, setNoTranscript] = useState(false);
  // Tracks how many times we've polled while waiting for background chunking.
  const pollCountRef = useRef(0);

  const authHeaders: Record<string, string> = accessToken ? { Authorization: `Bearer ${accessToken}` } : {};

  // ── Fetch chunks ──────────────────────────────────────────────────────────
  const fetchChunks = useCallback(
    async (triggeredByGenerate = false) => {
      if (!youtubeId || !accessToken) return;
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`/api/chunks/${youtubeId}`, { headers: authHeaders });
        if (!res.ok) {
          // 422 = permanent failure (no captions/transcript) — don't offer retry.
          if (res.status === 422) setNoTranscript(true);
          let detail = "Could not load chapters";
          try {
            const body = await res.json();
            if (body?.detail) detail = body.detail;
          } catch { /* ignore parse error */ }
          throw new Error(detail);
        }
        const data = await res.json();
        if (data.chunks?.length) {
          pollCountRef.current = 0;
          setChunks(data.chunks);
          onChunksLoaded?.(data.chunks);
          if (triggeredByGenerate) setGenerating(false);
        } else if (data.status === "chunking_started" || (triggeredByGenerate && data.status === "not_started")) {
          // Poll while chunking runs in background; Whisper can take ~90s for a long video
          pollCountRef.current += 1;
          if (pollCountRef.current >= 40) {
            // ~3.5 minutes exceeded — both YouTube captions and Whisper likely failed
            pollCountRef.current = 0;
            setGenerating(false);
            setNoTranscript(true);
            return;
          }
          setTimeout(() => fetchChunks(true), 5000);
        } else if (data.status === "not_started") {
          // No chunks yet and not mid-generation — show Generate button
          setGenerating(false);
        }
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Could not load chapters");
        setGenerating(false);
      } finally {
        setLoading(false);
      }
    },
    [youtubeId, accessToken], // eslint-disable-line react-hooks/exhaustive-deps
  );

  useEffect(() => {
    fetchChunks();
  }, [fetchChunks]);

  // ── Determine active chapter ───────────────────────────────────────────────
  const activeIdx = chunks.findIndex((c) => currentSeconds >= c.start_seconds && currentSeconds < c.end_seconds);

  // Chapter-end detection is handled in VideoPlayer (pause-at-end logic).
  // The onChapterComplete prop is kept for legacy callers but no longer fired here.

  // ── Save watch progress for the active chunk ──────────────────────────────
  const lastSavedRef = useRef<Record<string, number>>({});
  useEffect(() => {
    if (activeIdx < 0 || !accessToken) return;
    const chunk = chunks[activeIdx];
    const watched = Math.max(0, currentSeconds - chunk.start_seconds);
    const last = lastSavedRef.current[chunk.id] ?? 0;
    if (watched - last < 10) return; // save every 10 s
    lastSavedRef.current[chunk.id] = watched;
    fetch(`/api/chunks/detail/${chunk.id}/progress`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify({ watched_seconds: watched }),
    }).catch(() => {});
  }, [currentSeconds, activeIdx, chunks, accessToken]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Generate chapters ─────────────────────────────────────────────────────
  const handleGenerate = async () => {
    setGenerating(true);
    setError("");
    setNoTranscript(false);
    pollCountRef.current = 0;
    try {
      await fetch(`/api/chunks/${youtubeId}/generate`, { method: "POST", headers: authHeaders });
      setTimeout(() => fetchChunks(true), 3000);
    } catch {
      setError("Generation failed");
      setGenerating(false);
    }
  };

  // ── Completed count ───────────────────────────────────────────────────────
  const doneCount = chunks.filter((c, i) => {
    const p = progress[c.id];
    if (p?.completed) return true;
    // Treat any chapter the user has passed as done
    if (activeIdx > i) return true;
    return false;
  }).length;

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading && !chunks.length) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 96, color: color.textFainter, fontSize: 13 }}>
        Loading chapters…
      </div>
    );
  }

  if (!chunks.length) {
    return (
      <Card dark padding="md" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <p style={{ fontSize: 13.5, fontWeight: 500, color: color.chromeTextMuted, margin: 0 }}>Chapters</p>
        <p style={{ fontSize: 12, color: color.textFainter, lineHeight: 1.5, margin: 0 }}>
          Break this video into bite-sized chapters with AI-generated summaries and quizzes.
        </p>
        {error && <p style={{ fontSize: 12, color: "#E08579", margin: 0 }}>{error}</p>}
        {noTranscript ? (
          <p style={{ fontSize: 12, color: color.textFainter, fontStyle: "italic", margin: 0 }}>
            Couldn&apos;t generate chapters for this video — no captions or audio transcript could be obtained. Try a different video.
          </p>
        ) : (
          <Button onClick={handleGenerate} disabled={generating} fullWidth style={{ fontFamily: font.body, fontSize: 12.5 }}>
            {generating ? "Generating chapters…" : (<><Icon name="sparkles" size={14} className="" /> Generate Chapters</>)}
          </Button>
        )}
      </Card>
    );
  }

  return (
    <Card dark padding="sm" style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: `1px solid ${color.chromeBorder}` }}>
        <span style={{ fontSize: 13.5, fontWeight: 600, color: color.chromeText }}>Chapters</span>
        <span style={{ fontSize: 11.5, color: color.textFainter, background: "rgba(255,255,255,0.05)", padding: "3px 9px", borderRadius: 100 }}>{doneCount} / {chunks.length} done</span>
      </div>

      <div>
        {chunks.map((chunk, idx) => {
          const isActive = idx === activeIdx;
          const isDone = idx < Math.max(activeIdx, 0) || progress[chunk.id]?.completed;

          return (
            <button
              key={chunk.id}
              type="button"
              onClick={() => onSeekTo(chunk.start_seconds)}
              style={{ width: "100%", textAlign: "left", padding: "12px 16px", border: "none", cursor: "pointer", borderBottom: `1px solid rgba(255,255,255,0.04)`, background: isActive ? "rgba(43,95,168,0.1)" : "transparent", fontFamily: font.body }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                <div style={{ marginTop: 2, flexShrink: 0, width: 20, height: 20, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, background: isDone ? color.success.fg : isActive ? "#2B5FA8" : "rgba(255,255,255,0.1)", color: isDone || isActive ? "#fff" : color.textFainter }}>
                  {isDone ? <Icon name="checkCircle" size={12} className="" /> : chunk.chunk_number}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.4, color: isActive ? color.chromeText : color.chromeTextMuted }}>{chunk.title}</span>
                    <span style={{ fontSize: 11, color: color.textFainter, flexShrink: 0 }}>{chunk.start_timestamp}</span>
                  </div>

                  {chunk.learning_objective && (
                    <p style={{ fontSize: 11.5, color: color.textFainter, marginTop: 2, lineHeight: 1.4, margin: "2px 0 0" }}>{chunk.learning_objective}</p>
                  )}

                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                    <span style={{ fontSize: 11, color: color.textFainter }}>{fmtDur(chunk.duration_seconds)}</span>
                    {chunk.quiz.question_count > 0 && (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: "#6FA0E0" }}>
                        <Icon name="pencil" size={11} className="" /> {chunk.quiz.question_count}Q quiz
                      </span>
                    )}
                    {progress[chunk.id]?.quiz_score != null && <span style={{ fontSize: 11, color: "#5FCFA0" }}>{progress[chunk.id].quiz_score}%</span>}
                  </div>
                </div>
              </div>

              {isActive && chunk.duration_seconds > 0 && (
                <div style={{ marginTop: 8, height: 2, width: "100%", borderRadius: 100, background: "rgba(255,255,255,0.1)", overflow: "hidden" }}>
                  <div style={{ height: "100%", borderRadius: 100, background: "#2B5FA8", width: `${Math.min(100, ((currentSeconds - chunk.start_seconds) / chunk.duration_seconds) * 100)}%` }} />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {activeIdx >= 0 && (chunks[activeIdx]?.learning_objective || chunks[activeIdx]?.key_concepts?.length > 0) && (
        <div style={{ padding: "10px 16px 14px", borderTop: `1px solid ${color.chromeBorder}`, display: "flex", flexDirection: "column", gap: 8 }}>
          {chunks[activeIdx]?.learning_objective && <p style={{ fontSize: 12, color: color.textFainter, lineHeight: 1.5, margin: 0 }}>{chunks[activeIdx].learning_objective}</p>}
          {chunks[activeIdx]?.key_concepts?.length > 0 && (
            <div>
              <p style={{ fontSize: 11, color: color.textFainter, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>Key concepts</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {chunks[activeIdx].key_concepts.map((c) => (
                  <span key={c} style={{ borderRadius: 6, background: "rgba(255,255,255,0.05)", border: `1px solid ${color.chromeBorder}`, padding: "2px 8px", fontSize: 11, color: color.chromeTextMuted }}>{c}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
