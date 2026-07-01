'use client';
import { Sparkles, Check, Pencil } from 'lucide-react';

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

import React, { useEffect, useState, useCallback, useRef } from 'react';

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
  currentSeconds: number;              // live position from the YouTube player
  onSeekTo: (seconds: number) => void; // caller seeks the player
  onChunksLoaded?: (chunks: Chunk[]) => void; // fires once when chunks are fetched
  onChapterComplete?: (chunkId: string, chapterTitle: string, questions: QuizQuestion[]) => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDur(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s.toString().padStart(2, '0')}s`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ChaptersList({
  youtubeId,
  accessToken,
  currentSeconds,
  onSeekTo,
  onChunksLoaded,
  onChapterComplete,
}: Props) {
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [progress, setProgress] = useState<Record<string, ChunkProgress>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [generating, setGenerating] = useState(false);
  // True when all transcript sources (YouTube + Whisper) failed; retrying won't help.
  const [noTranscript, setNoTranscript] = useState(false);
  // Tracks how many times we've polled while waiting for background chunking.
  const pollCountRef = useRef(0);

  const authHeaders: Record<string, string> = accessToken
    ? { Authorization: `Bearer ${accessToken}` }
    : {};

  // ── Fetch chunks ──────────────────────────────────────────────────────────
  const fetchChunks = useCallback(async (triggeredByGenerate = false) => {
    if (!youtubeId || !accessToken) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/chunks/${youtubeId}`, { headers: authHeaders });
      if (!res.ok) {
        // 422 = permanent failure (no captions/transcript) — don't offer retry.
        if (res.status === 422) setNoTranscript(true);
        let detail = 'Could not load chapters';
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
      } else if (data.status === 'chunking_started' || (triggeredByGenerate && data.status === 'not_started')) {
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
      } else if (data.status === 'not_started') {
        // No chunks yet and not mid-generation — show Generate button
        setGenerating(false);
      }
    } catch (e: any) {
      setError(e?.message || 'Could not load chapters');
      setGenerating(false);
    } finally {
      setLoading(false);
    }
  }, [youtubeId, accessToken]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchChunks();
  }, [fetchChunks]);

  // ── Determine active chapter ───────────────────────────────────────────────
  const activeIdx = chunks.findIndex(
    c => currentSeconds >= c.start_seconds && currentSeconds < c.end_seconds
  );

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
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify({ watched_seconds: watched }),
    }).catch(() => {});
  }, [currentSeconds, activeIdx, chunks, accessToken]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Generate chapters ─────────────────────────────────────────────────────
  const handleGenerate = async () => {
    setGenerating(true);
    setError('');
    setNoTranscript(false);
    pollCountRef.current = 0;
    try {
      await fetch(`/api/chunks/${youtubeId}/generate`, {
        method: 'POST',
        headers: authHeaders,
      });
      setTimeout(() => fetchChunks(true), 3000);
    } catch {
      setError('Generation failed');
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
      <div className="flex items-center justify-center h-24 text-white/30 text-sm">
        Loading chapters…
      </div>
    );
  }

  if (!chunks.length) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
        <p className="text-sm font-medium text-white/70">Chapters</p>
        <p className="text-xs text-white/40 leading-relaxed">
          Break this video into bite-sized chapters with AI-generated summaries and quizzes.
        </p>
        {error && (
          <p className="text-xs text-red-400">{error}</p>
        )}
        {noTranscript ? (
          <p className="text-xs text-white/30 italic">
            Couldn&apos;t generate chapters for this video — no captions or audio transcript could be obtained. Try a different video.
          </p>
        ) : (
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating}
            className="w-full rounded-lg bg-accent/90 py-2.5 text-xs font-semibold text-white hover:bg-accent disabled:opacity-50 transition-colors"
          >
            {generating ? (
              <span className="flex items-center justify-center gap-2">
                <span className="h-3 w-3 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                Generating chapters…
              </span>
            ) : (
              <span className="inline-flex items-center justify-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5" /> Generate Chapters
              </span>
            )}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
        <span className="text-sm font-semibold text-white">Chapters</span>
        <span className="text-xs text-white/30 bg-white/5 px-2 py-0.5 rounded-full">
          {doneCount} / {chunks.length} done
        </span>
      </div>

      {/* Chapter list */}
      <div className="divide-y divide-white/[0.04]">
        {chunks.map((chunk, idx) => {
          const isActive = idx === activeIdx;
          const isDone = idx < Math.max(activeIdx, 0) || progress[chunk.id]?.completed;

          return (
            <button
              key={chunk.id}
              type="button"
              onClick={() => onSeekTo(chunk.start_seconds)}
              className={`w-full text-left px-4 py-3 transition-all group ${
                isActive ? 'bg-accent/10' : 'hover:bg-white/[0.03]'
              }`}
            >
              <div className="flex items-start gap-3">
                {/* State indicator */}
                <div className={`mt-0.5 flex-shrink-0 h-5 w-5 rounded-full flex items-center justify-center text-xs font-bold
                  ${isDone ? 'bg-emerald-500 text-white' : isActive ? 'bg-accent text-white' : 'bg-white/10 text-white/40'}`}>
                  {isDone ? <Check className="h-3 w-3" /> : chunk.chunk_number}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-sm font-medium leading-snug ${
                      isActive ? 'text-white' : 'text-white/70 group-hover:text-white/90'
                    }`}>
                      {chunk.title}
                    </span>
                    <span className="text-xs text-white/30 flex-shrink-0">{chunk.start_timestamp}</span>
                  </div>

                  {chunk.learning_objective && (
                    <p className="text-xs text-white/35 mt-0.5 leading-snug line-clamp-2">
                      {chunk.learning_objective}
                    </p>
                  )}

                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-xs text-white/25">{fmtDur(chunk.duration_seconds)}</span>
                    {chunk.quiz.question_count > 0 && (
                      <span className="inline-flex items-center gap-1 text-xs text-accent/60">
                        <Pencil className="h-3 w-3" /> {chunk.quiz.question_count}Q quiz
                      </span>
                    )}
                    {progress[chunk.id]?.quiz_score != null && (
                      <span className="text-xs text-emerald-400/80">
                        {progress[chunk.id].quiz_score}%
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Active chapter progress bar */}
              {isActive && chunk.duration_seconds > 0 && (
                <div className="mt-2 h-0.5 w-full rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full bg-accent rounded-full transition-all"
                    style={{
                      width: `${Math.min(100,
                        ((currentSeconds - chunk.start_seconds) / chunk.duration_seconds) * 100
                      )}%`,
                    }}
                  />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Learning objective + key concepts for active chapter */}
      {activeIdx >= 0 && (chunks[activeIdx]?.learning_objective || chunks[activeIdx]?.key_concepts?.length > 0) && (
        <div className="px-4 pb-3 pt-2 border-t border-white/[0.06] space-y-2">
          {chunks[activeIdx]?.learning_objective && (
            <p className="text-xs text-white/50 leading-relaxed">{chunks[activeIdx].learning_objective}</p>
          )}
          {chunks[activeIdx]?.key_concepts?.length > 0 && (
            <div>
              <p className="text-xs text-white/30 mb-1.5 uppercase tracking-wider">Key concepts</p>
              <div className="flex flex-wrap gap-1.5">
                {chunks[activeIdx].key_concepts.map((c) => (
                  <span key={c} className="rounded-md bg-white/5 border border-white/10 px-2 py-0.5 text-xs text-white/60">
                    {c}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
