import React, { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { Target, BookOpen, Check } from "lucide-react";
import { useRouter } from "next/router";
import Head from "next/head";
import Link from "next/link";
import axios from "axios";
import VideoPlayer, { VideoPlayerHandle } from "../../../components/Learning/VideoPlayer";
import ChaptersList, { Chunk, QuizQuestion } from "../../../components/Learning/ChaptersList";
import ChapterQuizModal from "../../../components/Learning/ChapterQuizModal";
import AITutorPanel from "../../../components/Learning/AITutorPanel";
import QuizModal from "../../../components/Quiz/QuizModal";
import ProgressTracker from "../../../components/Learning/ProgressTracker";
import ConceptSidebar from "../../../components/Learning/ConceptSidebar";
import SessionSidebarTabs from "../../../components/Learning/SessionSidebarTabs";
import QuestionCard from "../../../components/Learning/QuestionCard";
import { color, font } from "../../../ui-v2/tokens";
import { useViewport } from "../../../ui-v2/useViewport";

// ─── Demo data (last-resort fallback only, see derivedConcepts below) ──────

const DEMO_CONCEPTS = [
  { name: "Supervised Learning", status: "mastered" as const, mastery: 92, description: "Training a model on labelled input-output pairs so it can generalise to unseen examples." },
  { name: "Loss Function", status: "learning" as const, mastery: 58, description: "A measure of how far the model's predictions are from the true labels." },
  { name: "Gradient Descent", status: "learning" as const, mastery: 45, description: "An optimisation algorithm that iteratively adjusts parameters to minimise the loss." },
  { name: "Backpropagation", status: "not_started" as const, mastery: 0 },
  { name: "Overfitting", status: "not_started" as const, mastery: 0 },
];

interface AIQuestion {
  question: string;
  type: "free_text" | "multiple_choice";
  options?: string[];
  correct_answer: string;
  difficulty: string;
  estimated_time_seconds?: number;
}

interface PathVideo { index: number; title: string; youtubeId: string; durationSeconds: number; summary: string; }
interface BuiltPathLite {
  topic_id: string;
  topic_name: string;
  learning_path: Array<{ video_id?: string; youtube_id: string; title: string; duration_minutes?: number; summary?: string }>;
}

function pathVideoFromApi(v: BuiltPathLite["learning_path"][number], i: number): PathVideo {
  return { index: i, title: v.title || `Video ${i + 1}`, youtubeId: v.youtube_id || "", durationSeconds: Math.max(60, (v.duration_minutes || 0) * 60), summary: v.summary || "" };
}

export default function LearningSessionPage() {
  const router = useRouter();
  const { isMobile } = useViewport();
  const { pathId, videoIndex: videoIndexParam } = router.query;
  const decodedPathId = useMemo(() => {
    if (typeof pathId !== "string") return "";
    try { return decodeURIComponent(pathId); } catch { return pathId; }
  }, [pathId]);

  const [builtVideos, setBuiltVideos] = useState<PathVideo[] | null>(null);
  const [builtTopicName, setBuiltTopicName] = useState<string>("");
  const [pathLoading, setPathLoading] = useState(true);
  const [pathLoadError, setPathLoadError] = useState(false);

  const videoIndex = Number(videoIndexParam ?? 0);
  const videos: PathVideo[] = builtVideos ?? [];
  const currentVideo = videos[videoIndex] ?? videos[0];

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [videoProgress, setVideoProgress] = useState<Record<number, number>>({});
  const [completedVideos, setCompletedVideos] = useState<Set<number>>(new Set());
  const [totalWatchSeconds, setTotalWatchSeconds] = useState(0);
  const [showQuestion, setShowQuestion] = useState(false);
  const [aiQuestion, setAiQuestion] = useState<AIQuestion | null>(null);
  const [questionLoading, setQuestionLoading] = useState(false);
  const [notes, setNotes] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const progressDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notesDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playerRef = useRef<VideoPlayerHandle>(null);
  const [currentSeconds, setCurrentSeconds] = useState(0);
  const [quizOpen, setQuizOpen] = useState(false);
  const [chapterQuiz, setChapterQuiz] = useState<{ chunkId: string; chapterTitle: string; questions: QuizQuestion[] } | null>(null);
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const activeChunkIdx = useMemo(() => chunks.findIndex((c) => currentSeconds >= c.start_seconds && currentSeconds < c.end_seconds), [chunks, currentSeconds]);

  const accessToken = useMemo(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("access_token") ?? sessionStorage.getItem("access_token");
  }, []);
  const authHeader = useMemo((): Record<string, string> => (accessToken ? { Authorization: `Bearer ${accessToken}` } : {}), [accessToken]);

  useEffect(() => {
    if (!router.isReady || !decodedPathId) return;
    let cancelled = false;
    const stashKey = `builtPath:${decodedPathId}`;
    try {
      const raw = sessionStorage.getItem(stashKey);
      if (raw) {
        const parsed = JSON.parse(raw) as BuiltPathLite;
        if (parsed?.learning_path?.length) {
          setBuiltVideos(parsed.learning_path.map(pathVideoFromApi));
          setBuiltTopicName(parsed.topic_name || decodedPathId);
          setPathLoading(false);
          return;
        }
      }
    } catch { /* fall through to fetch */ }

    (async () => {
      try {
        const res = await axios.get<BuiltPathLite>(`/api/search/path/${encodeURIComponent(decodedPathId)}`, { headers: authHeader });
        if (cancelled) return;
        if (res.data?.learning_path?.length) {
          setBuiltVideos(res.data.learning_path.map(pathVideoFromApi));
          setBuiltTopicName(res.data.topic_name || decodedPathId);
        } else {
          setPathLoadError(true);
        }
      } catch {
        if (!cancelled) setPathLoadError(true);
      } finally {
        if (!cancelled) setPathLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [router.isReady, decodedPathId, authHeader]);

  useEffect(() => {
    if (!router.isReady || !pathId) return;
    const start = async () => {
      try {
        const res = await axios.post("/api/sessions/start", { topic_id: "00000000-0000-0000-0000-000000000001", video_index: videoIndex, youtube_id: currentVideo.youtubeId, path_id: String(pathId) }, { headers: authHeader });
        setSessionId(res.data.session_id);
      } catch { /* non-critical */ }
    };
    start();
  }, [router.isReady, pathId, videoIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    axios.get(`/api/sessions/${sessionId}`, { headers: authHeader })
      .then((res) => { if (!cancelled && typeof res.data?.notes === "string") setNotes(res.data.notes); })
      .catch(() => { /* seed silently fails, notes stay empty */ });
    return () => { cancelled = true; };
  }, [sessionId, authHeader]);

  const handleNotesChange = useCallback((value: string) => {
    setNotes(value);
    if (!sessionId) return;
    if (notesDebounce.current) clearTimeout(notesDebounce.current);
    notesDebounce.current = setTimeout(async () => {
      try {
        await axios.put(`/api/sessions/progress/${sessionId}`, { watch_percentage: videoProgress[videoIndex] ?? 0, last_position_seconds: currentSeconds, total_watch_time_seconds: totalWatchSeconds, playback_speed: 1.0, notes: value }, { headers: authHeader });
      } catch { /* non-blocking */ }
    }, 5000);
  }, [sessionId, videoProgress, videoIndex, currentSeconds, totalWatchSeconds, authHeader]);

  const handleProgress = useCallback((pct: number, positionSeconds: number, watchTimeSeconds: number) => {
    setVideoProgress((prev) => ({ ...prev, [videoIndex]: Math.max(prev[videoIndex] ?? 0, pct) }));
    setTotalWatchSeconds((prev) => Math.max(prev, watchTimeSeconds));
    setCurrentSeconds(positionSeconds);
    if (!sessionId) return;
    if (progressDebounce.current) clearTimeout(progressDebounce.current);
    progressDebounce.current = setTimeout(async () => {
      try {
        await axios.put(`/api/sessions/progress/${sessionId}`, { watch_percentage: pct, last_position_seconds: positionSeconds, total_watch_time_seconds: watchTimeSeconds, playback_speed: 1.0 }, { headers: authHeader });
      } catch { /* non-blocking */ }
    }, 5000);
  }, [sessionId, videoIndex, authHeader]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleVideoComplete = useCallback(async () => {
    setCompletedVideos((prev) => new Set(prev).add(videoIndex));
    if (sessionId) axios.post(`/api/sessions/complete/${sessionId}`, {}, { headers: authHeader }).catch(() => {});
    setQuestionLoading(true);
    setShowQuestion(true);
    try {
      const res = await fetch("/api/questions/generate", { method: "POST", headers: { "Content-Type": "application/json", ...authHeader }, body: JSON.stringify({ video_summary: currentVideo.summary, concept_name: currentVideo.title, difficulty: "medium" }) });
      if (res.ok) setAiQuestion((await res.json()) as AIQuestion);
    } catch { /* fallback UI handles missing question */ }
    finally { setQuestionLoading(false); }
  }, [sessionId, videoIndex, currentVideo, authHeader]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAnswerSubmit = useCallback((score: number, feedback: string) => {
    void feedback;
    setShowQuestion(false);
    setAiQuestion(null);
    const hasNext = videoIndex < videos.length - 1;
    if (score >= 0 && hasNext) router.push(`/learning/${pathId}/${videoIndex + 1}`);
    else if (!hasNext) router.push(`/dashboard?pathComplete=true`);
  }, [videoIndex, pathId, router, videos.length]);

  const handleChunkComplete = useCallback((chunkIdx: number) => {
    const chunk = chunks[chunkIdx];
    if (!chunk) return;
    const validQs = chunk.quiz.questions.filter((q) => q.question_text && q.options?.length > 0);
    if (!validQs.length) {
      const next = chunks[chunkIdx + 1];
      if (next) { playerRef.current?.seekTo(next.start_seconds); playerRef.current?.play(); }
      else handleVideoComplete();
      return;
    }
    setChapterQuiz({ chunkId: chunk.id, chapterTitle: chunk.title, questions: chunk.quiz.questions });
  }, [chunks, handleVideoComplete]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleChapterQuizComplete = useCallback((scorePercent: number) => {
    void scorePercent;
    const completedIdx = chunks.findIndex((c) => c.id === chapterQuiz?.chunkId);
    setChapterQuiz(null);
    const nextIdx = completedIdx + 1;
    if (nextIdx < chunks.length) { const next = chunks[nextIdx]; playerRef.current?.seekTo(next.start_seconds); playerRef.current?.play(); }
    else handleVideoComplete();
  }, [chunks, chapterQuiz, handleVideoComplete]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleNavigate = (idx: number) => { router.push(`/learning/${pathId}/${idx}`); };

  const videosWithProgress = videos.map((v, i) => ({ ...v, index: i, watchPercentage: videoProgress[i] ?? 0, completed: completedVideos.has(i) }));

  const [conceptMastery, setConceptMastery] = useState<Record<string, { status: string; mastery: number }>>({});
  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await axios.get<{ concepts: Array<{ concept_name: string; status: string; mastery_score: number }> }>("/api/progress/concepts", { headers: authHeader });
        if (cancelled) return;
        const map: Record<string, { status: string; mastery: number }> = {};
        for (const c of res.data.concepts || []) map[c.concept_name.toLowerCase()] = { status: c.status, mastery: Math.round(c.mastery_score * 100) };
        setConceptMastery(map);
      } catch { /* sidebar shows derived defaults */ }
    })();
    return () => { cancelled = true; };
  }, [accessToken, authHeader]);

  const derivedConcepts = useMemo(() => {
    if (chunks.length > 0) {
      const seen = new Set<string>();
      const list: { name: string; status: "mastered" | "learning" | "not_started"; mastery: number }[] = [];
      chunks.forEach((chunk) => {
        (chunk.key_concepts || []).forEach((c) => {
          if (seen.has(c)) return;
          seen.add(c);
          const real = conceptMastery[c.toLowerCase()];
          if (real) list.push({ name: c, status: real.status === "mastered" ? "mastered" : real.mastery > 0 ? "learning" : "not_started", mastery: real.mastery });
          else list.push({ name: c, status: "learning", mastery: 0 });
        });
      });
      if (list.length > 0) return list;
    }
    if (builtVideos) {
      const raw = typeof window !== "undefined" ? sessionStorage.getItem(`builtPath:${decodedPathId}`) : null;
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as BuiltPathLite;
          const concepts = (parsed.learning_path?.[videoIndex] as { concepts?: string[] } | undefined)?.concepts || [];
          const seen = new Set<string>();
          const list: { name: string; status: "mastered" | "learning" | "not_started"; mastery: number }[] = [];
          concepts.forEach((c) => {
            if (seen.has(c)) return;
            seen.add(c);
            const real = conceptMastery[c.toLowerCase()];
            list.push({ name: c, status: real ? (real.status === "mastered" ? "mastered" : real.mastery > 0 ? "learning" : "not_started") : "learning", mastery: real?.mastery ?? 0 });
          });
          if (list.length > 0) return list;
        } catch { /* malformed stash */ }
      }
    }
    return DEMO_CONCEPTS;
  }, [chunks, conceptMastery, builtVideos, decodedPathId, videoIndex]);

  const hasNext = videoIndex < videos.length - 1;
  const hasPrev = videoIndex > 0;

  if (pathLoading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: color.chromeBg, fontFamily: font.body }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 36, height: 36, border: "3px solid #2A2E3A", borderTopColor: "#C8792A", borderRadius: "50%", margin: "0 auto 16px", animation: "spin 0.8s linear infinite" }} />
          <p style={{ color: color.chromeTextMuted, fontSize: 13.5 }}>Loading your path…</p>
        </div>
      </div>
    );
  }

  if (pathLoadError || videos.length === 0) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: color.chromeBg, padding: 20, fontFamily: font.body }}>
        <div style={{ textAlign: "center", maxWidth: 360 }}>
          <h2 style={{ color: color.chromeText, fontWeight: 600, fontSize: 18, marginBottom: 8 }}>Path not found</h2>
          <p style={{ color: color.chromeTextMuted, fontSize: 13.5, marginBottom: 24 }}>This learning path could not be loaded. It may have expired or never been built.</p>
          <Link href="/paths" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 20px", borderRadius: 10, background: "#F4F1EA", color: "#14171F", fontSize: 13.5, fontWeight: 600, textDecoration: "none" }}>Back to Explore</Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head><title>{currentVideo.title} — LearnPath AI</title></Head>

      <div style={{ minHeight: "100vh", background: color.chromeBg, color: color.chromeText, display: "flex", flexDirection: "column", fontFamily: font.body }}>
        <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 10 : 14, padding: isMobile ? "12px 16px" : "14px 20px", borderBottom: `1px solid ${color.chromeBorder}`, flexWrap: "wrap" }}>
          <Link href="/paths" style={{ color: color.chromeTextMuted, textDecoration: "none", fontSize: 13, flexShrink: 0 }}>← Exit</Link>
          <div style={{ flex: 1, minWidth: 100 }}>
            <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{(builtTopicName || "Learning Path").slice(0, 60)}</div>
            <div style={{ fontSize: 11.5, color: color.textFainter, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Video {videoIndex + 1} of {videos.length}{!isMobile && ` · ${currentVideo.title}`}</div>
          </div>
          {chunks.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {chunks.map((_, i) => (
                <span key={i} style={{ height: 6, width: i === activeChunkIdx ? 16 : 6, borderRadius: 100, background: i < activeChunkIdx ? color.success.fg : i === activeChunkIdx ? "#C8792A" : color.chromeBorder }} />
              ))}
            </div>
          )}
          {/* The sidebar toggle is meaningless on mobile (content is inline), so hide it. */}
          {!isMobile && (
            <button onClick={() => setSidebarOpen((v) => !v)} title={sidebarOpen ? "Hide sidebar" : "Show sidebar"} style={{ background: "none", border: "none", color: color.chromeTextMuted, cursor: "pointer", fontSize: 12, flexShrink: 0 }}>{sidebarOpen ? "Hide sidebar" : "Show sidebar"}</button>
          )}
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: isMobile ? "column" : "row", gap: isMobile ? 16 : 24, padding: isMobile ? "16px 16px 40px" : "24px 20px", maxWidth: 1400, margin: "0 auto", width: "100%" }}>
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 16 }}>
            <VideoPlayer ref={playerRef} youtubeId={currentVideo.youtubeId} onProgress={handleProgress} onComplete={handleVideoComplete} chunks={chunks} activeChunkIndex={activeChunkIdx} onChunkComplete={handleChunkComplete} />

            <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", alignItems: isMobile ? "stretch" : "flex-start", justifyContent: "space-between", gap: isMobile ? 12 : 16 }}>
              <div style={{ minWidth: 0 }}>
                <h1 style={{ fontSize: isMobile ? 16 : 17, fontWeight: 600, margin: 0, lineHeight: 1.35 }}>{currentVideo.title}</h1>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6 }}>
                  <span style={{ fontSize: 12, color: color.textFainter }}>Video {videoIndex + 1} of {videos.length}</span>
                  {completedVideos.has(videoIndex) && <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "#34D399" }}><Check size={12} /> Completed</span>}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                <button onClick={() => hasPrev && handleNavigate(videoIndex - 1)} disabled={!hasPrev} style={{ flex: isMobile ? 1 : undefined, padding: isMobile ? "11px 14px" : "8px 14px", borderRadius: 8, border: `1px solid ${color.chromeBorder}`, background: "transparent", color: color.chromeTextMuted, fontSize: 13, cursor: hasPrev ? "pointer" : "not-allowed", opacity: hasPrev ? 1 : 0.4 }}>← Previous</button>
                <button onClick={() => hasNext && handleNavigate(videoIndex + 1)} disabled={!hasNext} style={{ flex: isMobile ? 1 : undefined, padding: isMobile ? "11px 14px" : "8px 14px", borderRadius: 8, border: "none", background: "#2B3A67", color: "#fff", fontSize: 13, fontWeight: 600, cursor: hasNext ? "pointer" : "not-allowed", opacity: hasNext ? 1 : 0.4 }}>Next video →</button>
              </div>
            </div>

            <ChaptersList youtubeId={currentVideo.youtubeId} accessToken={accessToken} currentSeconds={currentSeconds} onSeekTo={(s) => { playerRef.current?.seekTo(s); playerRef.current?.play(); }} onChunksLoaded={setChunks} />

            <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", alignItems: isMobile ? "stretch" : "center", justifyContent: "space-between", gap: isMobile ? 12 : 16, borderRadius: 12, border: `1px solid ${color.chromeBorder}`, background: "#1D2230", padding: 16 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 500, fontSize: 14 }}>Whole-video mastery check</div>
                <div style={{ fontSize: 12.5, color: color.chromeTextMuted, marginTop: 2 }}>After the chapter checks above, take this adaptive quiz across the whole video — difficulty adjusts to you and it updates your concept mastery.</div>
              </div>
              <button onClick={() => setQuizOpen(true)} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: isMobile ? "12px 16px" : "9px 16px", borderRadius: 8, border: "none", background: "#C8792A", color: "#14171F", fontSize: 13, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}><Target size={15} /> Start mastery quiz</button>
            </div>

            <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", alignItems: isMobile ? "stretch" : "center", justifyContent: "space-between", gap: isMobile ? 12 : 16, borderRadius: 12, border: `1px solid ${color.chromeBorder}`, background: "#1D2230", padding: 16 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 500, fontSize: 14 }}>Study notes</div>
                <div style={{ fontSize: 12.5, color: color.chromeTextMuted, marginTop: 2 }}>Turn this video into AI study notes — 5 styles, flashcards, downloadable.</div>
              </div>
              <Link href={`/notes/${currentVideo.youtubeId}?title=${encodeURIComponent(currentVideo.title)}`} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: isMobile ? "12px 16px" : "9px 16px", borderRadius: 8, border: `1px solid ${color.chromeBorder}`, color: color.chromeText, fontSize: 13, fontWeight: 600, textDecoration: "none", flexShrink: 0 }}><BookOpen size={15} /> Generate notes</Link>
            </div>

            {showQuestion && (
              <div>
                {questionLoading ? (
                  <div style={{ background: "#1D2230", borderRadius: 12, border: "1px solid #3A5A8F", padding: 22 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>Generating comprehension question…</div>
                    <div style={{ fontSize: 12, color: color.textFainter, marginTop: 4 }}>Claude is crafting a question tailored to this video</div>
                  </div>
                ) : aiQuestion ? (
                  <QuestionCard
                    sessionId={sessionId}
                    question={aiQuestion.question}
                    questionType={aiQuestion.type}
                    options={aiQuestion.options}
                    correctAnswer={aiQuestion.correct_answer}
                    difficulty={aiQuestion.difficulty}
                    estimatedTime={aiQuestion.estimated_time_seconds}
                    conceptName={currentVideo.title}
                    topicId={decodedPathId}
                    onAnswerSubmit={handleAnswerSubmit}
                    onSkip={() => setShowQuestion(false)}
                  />
                ) : (
                  <div style={{ background: "#1D2230", borderRadius: 12, border: `1px solid ${color.chromeBorder}`, padding: 18 }}>
                    <p style={{ fontSize: 13.5, color: color.chromeTextMuted, marginBottom: 10 }}>In your own words, what was the most important concept from this video?</p>
                    <button onClick={() => setShowQuestion(false)} style={{ background: "none", border: "none", color: color.textFainter, fontSize: 12, cursor: "pointer" }}>Skip for now</button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Desktop: fixed 300px right rail (toggleable). Mobile: inline below the
              video, full width — the sidebar content flows into the single scroll
              so nothing competes with the player for the narrow viewport. */}
          {(isMobile || sidebarOpen) && (
            <div style={{ width: isMobile ? "100%" : 300, flexShrink: 0, display: "flex", flexDirection: "column", gap: 16 }}>
              <ProgressTracker videos={videosWithProgress} currentIndex={videoIndex} totalWatchSeconds={totalWatchSeconds} onNavigate={handleNavigate} />
              <div style={{ flex: 1, minHeight: isMobile ? 360 : 400, display: "flex" }}>
                <SessionSidebarTabs
                  masteryContent={<ConceptSidebar concepts={derivedConcepts} videoTitle={currentVideo.title} notes={notes} onNotesChange={handleNotesChange} />}
                  lexiContent={(active) => <AITutorPanel accessToken={accessToken} subject={builtTopicName || undefined} videoTitle={currentVideo.title} learningPathId={decodedPathId || undefined} active={active} />}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {chapterQuiz && (
        <ChapterQuizModal
          chunkId={chapterQuiz.chunkId}
          chapterTitle={chapterQuiz.chapterTitle}
          questions={chapterQuiz.questions}
          accessToken={accessToken}
          onClose={() => { setChapterQuiz(null); playerRef.current?.play(); }}
          onComplete={handleChapterQuizComplete}
        />
      )}

      <QuizModal
        isOpen={quizOpen}
        onClose={() => setQuizOpen(false)}
        topicName={currentVideo.title}
        concept={derivedConcepts?.[0]?.name || undefined}
      />
    </>
  );
}
