import React, { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { Target, BookOpen } from "lucide-react";
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
import QuestionCard from "../../../components/Learning/QuestionCard";

// ─── Demo data ────────────────────────────────────────────────────────────────

const DEMO_VIDEOS = [
  {
    index: 0,
    title: "Introduction to Machine Learning",
    youtubeId: "ukzFI9rgwfU",
    durationSeconds: 845,
    summary: "This video introduces machine learning concepts, including supervised and unsupervised learning, model training, and how algorithms learn from data patterns.",
  },
  {
    index: 1,
    title: "Supervised Learning Fundamentals",
    youtubeId: "1vsmaEfbnoE",
    durationSeconds: 1260,
    summary: "Covers supervised learning in depth: labelled datasets, training/test splits, loss functions, and how models generalise from training examples to new data.",
  },
  {
    index: 2,
    title: "Neural Networks Explained",
    youtubeId: "aircAruvnKk",
    durationSeconds: 1020,
    summary: "Explains neural network architecture, layers, activation functions, and how networks approximate complex functions by composing simple nonlinear transformations.",
  },
  {
    index: 3,
    title: "Backpropagation & Gradient Descent",
    youtubeId: "Ilg3gGewQ5U",
    durationSeconds: 930,
    summary: "Details the backpropagation algorithm and gradient descent optimisation, showing how networks compute gradients and update weights to minimise the loss function.",
  },
];

const DEMO_CONCEPTS = [
  { name: "Supervised Learning", status: "mastered" as const, mastery: 92, description: "Training a model on labelled input-output pairs so it can generalise to unseen examples." },
  { name: "Loss Function", status: "learning" as const, mastery: 58, description: "A measure of how far the model's predictions are from the true labels." },
  { name: "Gradient Descent", status: "learning" as const, mastery: 45, description: "An optimisation algorithm that iteratively adjusts parameters to minimise the loss." },
  { name: "Backpropagation", status: "not_started" as const, mastery: 0 },
  { name: "Overfitting", status: "not_started" as const, mastery: 0 },
];

// ─── AI question state ────────────────────────────────────────────────────────

interface AIQuestion {
  question: string;
  type: "free_text" | "multiple_choice";
  options?: string[];
  correct_answer: string;
  difficulty: string;
  estimated_time_seconds?: number;
}

// ─── Main page ────────────────────────────────────────────────────────────────

interface PathVideo {
  index: number;
  title: string;
  youtubeId: string;
  durationSeconds: number;
  summary: string;
}

interface BuiltPathLite {
  topic_id: string;
  topic_name: string;
  learning_path: Array<{
    video_id?: string;
    youtube_id: string;
    title: string;
    duration_minutes?: number;
    summary?: string;
  }>;
}

function pathVideoFromApi(v: BuiltPathLite["learning_path"][number], i: number): PathVideo {
  return {
    index: i,
    title: v.title || `Video ${i + 1}`,
    youtubeId: v.youtube_id || "",
    durationSeconds: Math.max(60, (v.duration_minutes || 0) * 60),
    summary: v.summary || "",
  };
}

export default function LearningSessionPage() {
  const router = useRouter();
  const { pathId, videoIndex: videoIndexParam } = router.query;
  const decodedPathId = useMemo(() => {
    if (typeof pathId !== "string") return "";
    try { return decodeURIComponent(pathId); } catch { return pathId; }
  }, [pathId]);

  const [builtVideos, setBuiltVideos] = useState<PathVideo[] | null>(null);
  const [builtTopicName, setBuiltTopicName] = useState<string>("");

  const videoIndex = Number(videoIndexParam ?? 0);
  const videos: PathVideo[] = builtVideos ?? DEMO_VIDEOS;
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
  const playerRef = useRef<VideoPlayerHandle>(null);
  const [currentSeconds, setCurrentSeconds] = useState(0);
  const [quizOpen, setQuizOpen] = useState(false);
  const [chapterQuiz, setChapterQuiz] = useState<{ chunkId: string; chapterTitle: string; questions: QuizQuestion[] } | null>(null);
  // Chunks are lifted here so VideoPlayer can receive boundaries for pause-at-end.
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const activeChunkIdx = useMemo(
    () => chunks.findIndex((c) => currentSeconds >= c.start_seconds && currentSeconds < c.end_seconds),
    [chunks, currentSeconds],
  );

  const accessToken = useMemo(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("access_token") ?? sessionStorage.getItem("access_token");
  }, []);

  const authHeader = useMemo(
    (): Record<string, string> => (accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    [accessToken],
  );

  // Load the actual built path so the page shows the user's real search,
  // not the demo ML videos. Priority:
  //  1. sessionStorage stash from SearchTopicForm (instant)
  //  2. GET /api/search/path/{topic_id} (cache lookup, no rebuild)
  //  3. Fall back to DEMO_VIDEOS (only when neither yielded anything)
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
          return;
        }
      }
    } catch { /* stashed value malformed — fall through to fetch */ }

    (async () => {
      try {
        const res = await axios.get<BuiltPathLite>(
          `/api/search/path/${encodeURIComponent(decodedPathId)}`,
          { headers: authHeader },
        );
        if (cancelled) return;
        if (res.data?.learning_path?.length) {
          setBuiltVideos(res.data.learning_path.map(pathVideoFromApi));
          setBuiltTopicName(res.data.topic_name || decodedPathId);
        }
      } catch {
        // 404 (no cached path) or 401 — fall back to DEMO_VIDEOS for now.
        // Catalog course IDs (e.g. "photosynthesis-101") also land here.
      }
    })();

    return () => { cancelled = true; };
  }, [router.isReady, decodedPathId, authHeader]);

  // Start session on mount
  useEffect(() => {
    if (!router.isReady || !pathId) return;
    const start = async () => {
      try {
        const res = await axios.post(
          "/api/sessions/start",
          {
            topic_id: "00000000-0000-0000-0000-000000000001",
            video_index: videoIndex,
            youtube_id: currentVideo.youtubeId,
            path_id: String(pathId),
          },
          { headers: authHeader },
        );
        setSessionId(res.data.session_id);
      } catch {
        // Graceful degradation — session tracking is not critical for viewing
      }
    };
    start();
  }, [router.isReady, pathId, videoIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleProgress = useCallback(
    (pct: number, positionSeconds: number, watchTimeSeconds: number) => {
      setVideoProgress((prev) => ({ ...prev, [videoIndex]: Math.max(prev[videoIndex] ?? 0, pct) }));
      setTotalWatchSeconds((prev) => Math.max(prev, watchTimeSeconds));
      setCurrentSeconds(positionSeconds);
      if (!sessionId) return;
      if (progressDebounce.current) clearTimeout(progressDebounce.current);
      progressDebounce.current = setTimeout(async () => {
        try {
          await axios.put(
            `/api/sessions/progress/${sessionId}`,
            { watch_percentage: pct, last_position_seconds: positionSeconds, total_watch_time_seconds: watchTimeSeconds, playback_speed: 1.0 },
            { headers: authHeader },
          );
        } catch { /* Non-blocking */ }
      }, 5000);
    },
    [sessionId, videoIndex, authHeader], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const handleVideoComplete = useCallback(async () => {
    setCompletedVideos((prev) => new Set(prev).add(videoIndex));
    if (sessionId) {
      axios.post(`/api/sessions/complete/${sessionId}`, {}, { headers: authHeader }).catch(() => {});
    }

    // Generate AI question
    setQuestionLoading(true);
    setShowQuestion(true);
    try {
      const res = await fetch("/api/questions/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader },
        body: JSON.stringify({
          video_summary: currentVideo.summary,
          concept_name: currentVideo.title,
          difficulty: "medium",
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setAiQuestion(data as AIQuestion);
      }
    } catch {
      // Show question panel even without AI — fallback handled in render
    } finally {
      setQuestionLoading(false);
    }
  }, [sessionId, videoIndex, currentVideo, authHeader]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAnswerSubmit = useCallback(
    (score: number, feedback: string) => {
      void feedback;
      setShowQuestion(false);
      setAiQuestion(null);
      const hasNext = videoIndex < videos.length - 1;
      if (score >= 0 && hasNext) {
        router.push(`/learning/${pathId}/${videoIndex + 1}`);
      } else if (!hasNext) {
        router.push(`/dashboard?pathComplete=true`);
      }
    },
    [videoIndex, pathId, router, videos.length],
  );

  // Fired by VideoPlayer when it pauses at a chunk boundary.
  const handleChunkComplete = useCallback((chunkIdx: number) => {
    const chunk = chunks[chunkIdx];
    if (!chunk) return;
    const validQs = chunk.quiz.questions.filter((q) => q.question_text && q.options?.length > 0);
    if (!validQs.length) {
      // No valid questions — advance automatically
      const next = chunks[chunkIdx + 1];
      if (next) {
        playerRef.current?.seekTo(next.start_seconds);
        playerRef.current?.play();
      } else {
        handleVideoComplete();
      }
      return;
    }
    setChapterQuiz({ chunkId: chunk.id, chapterTitle: chunk.title, questions: chunk.quiz.questions });
  }, [chunks, handleVideoComplete]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fired by ChapterQuizModal "Next chapter" button.
  const handleChapterQuizComplete = useCallback((scorePercent: number) => {
    void scorePercent;
    const completedIdx = chunks.findIndex((c) => c.id === chapterQuiz?.chunkId);
    setChapterQuiz(null);
    const nextIdx = completedIdx + 1;
    if (nextIdx < chunks.length) {
      const next = chunks[nextIdx];
      playerRef.current?.seekTo(next.start_seconds);
      playerRef.current?.play();
    } else {
      handleVideoComplete();
    }
  }, [chunks, chapterQuiz, handleVideoComplete]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleNavigate = (idx: number) => {
    router.push(`/learning/${pathId}/${idx}`);
  };

  const videosWithProgress = videos.map((v, i) => ({
    ...v,
    index: i,
    watchPercentage: videoProgress[i] ?? 0,
    completed: completedVideos.has(i),
  }));

  // Pull the user's real concept mastery from /api/progress/concepts so the
  // sidebar reflects what they've actually learned. Falls back gracefully if
  // the endpoint fails (e.g. no auth, no concept_progress rows yet).
  const [conceptMastery, setConceptMastery] = useState<Record<string, { status: string; mastery: number }>>({});
  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await axios.get<{ concepts: Array<{ concept_name: string; status: string; mastery_score: number }> }>(
          "/api/progress/concepts",
          { headers: authHeader },
        );
        if (cancelled) return;
        const map: Record<string, { status: string; mastery: number }> = {};
        for (const c of res.data.concepts || []) {
          map[c.concept_name.toLowerCase()] = {
            status: c.status,
            mastery: Math.round(c.mastery_score * 100),
          };
        }
        setConceptMastery(map);
      } catch { /* non-fatal — sidebar shows derived defaults */ }
    })();
    return () => { cancelled = true; };
  }, [accessToken, authHeader]);

  // Derive concepts from the built path if we have one — every video object
  // from the API has a "concepts" string[] field. Aggregate, dedupe, merge
  // with real mastery data from /api/progress/concepts. Falls back to the
  // curated DEMO_CONCEPTS for catalog/demo paths.
  const derivedConcepts = useMemo(() => {
    if (!builtVideos) return DEMO_CONCEPTS;
    const seen = new Set<string>();
    const list: { name: string; status: "mastered" | "learning" | "not_started"; mastery: number }[] = [];
    builtVideos.forEach((_, i) => {
      // builtVideos doesn't carry concepts directly; we need to pull from the
      // raw stashed path. Read it once here.
      const raw = typeof window !== "undefined" ? sessionStorage.getItem(`builtPath:${decodedPathId}`) : null;
      if (!raw) return;
      try {
        const parsed = JSON.parse(raw) as BuiltPathLite;
        const concepts = (parsed.learning_path?.[i] as { concepts?: string[] } | undefined)?.concepts || [];
        concepts.forEach((c) => {
          if (seen.has(c)) return;
          seen.add(c);
          const real = conceptMastery[c.toLowerCase()];
          let status: "mastered" | "learning" | "not_started";
          let mastery: number;
          if (real) {
            // Real mastery wins over heuristic
            status = real.status === "mastered"
              ? "mastered"
              : real.mastery > 0
                ? "learning"
                : "not_started";
            mastery = real.mastery;
          } else {
            // No real mastery data yet — show 0 until the backend records progress.
            // "learning" status signals the user is actively on this concept.
            status = i === videoIndex ? "learning" : "not_started";
            mastery = 0;
          }
          list.push({ name: c, status, mastery });
        });
      } catch { /* malformed stash — ignore */ }
    });
    return list.length > 0 ? list : DEMO_CONCEPTS;
  }, [builtVideos, decodedPathId, videoIndex, conceptMastery]);

  const hasNext = videoIndex < videos.length - 1;
  const hasPrev = videoIndex > 0;

  return (
    <>
      <Head>
        <title>{currentVideo.title} — LearnPath AI</title>
      </Head>

      <div className="min-h-screen bg-[#0f0f0f] text-white flex flex-col">
        {/* Top nav */}
        <header className="sticky top-0 z-50 bg-[#0f0f0f]/90 backdrop-blur-xl border-b border-white/[0.06]">
          <div className="max-w-screen-2xl mx-auto px-4 h-14 flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2 text-white/40 hover:text-white/80 transition-colors text-sm">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </Link>
            <div className="w-px h-4 bg-white/10" />
            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="text-white/30 truncate hidden sm:block">{builtTopicName || "Learning Path"}</span>
              <svg className="w-3 h-3 text-white/20 flex-shrink-0 hidden sm:block" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
              <span className="text-white/70 truncate font-medium">{currentVideo.title}</span>
            </div>
            <div className="flex-1" />
            <span className="text-xs text-white/30 tabular-nums hidden sm:block">
              {videoIndex + 1} / {videos.length}
            </span>
            <button
              onClick={() => setSidebarOpen((v) => !v)}
              className="p-2 rounded-lg hover:bg-white/5 text-white/40 hover:text-white/70 transition-colors"
              aria-label="Toggle sidebar"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h7" />
              </svg>
            </button>
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 max-w-screen-2xl mx-auto w-full px-4 py-6">
          <div className={`grid gap-6 ${sidebarOpen ? "lg:grid-cols-[1fr_340px]" : "grid-cols-1"}`}>
            {/* Left column: player + question */}
            <div className="flex flex-col gap-5 min-w-0">
              <VideoPlayer
                ref={playerRef}
                youtubeId={currentVideo.youtubeId}
                onProgress={handleProgress}
                onComplete={handleVideoComplete}
                chunks={chunks}
                activeChunkIndex={activeChunkIdx}
                onChunkComplete={handleChunkComplete}
              />

              {/* Video metadata */}
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h1 className="text-lg font-semibold text-white leading-snug">{currentVideo.title}</h1>
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="text-xs text-white/30">Video {videoIndex + 1} of {videos.length}</span>
                    {completedVideos.has(videoIndex) && (
                      <span className="flex items-center gap-1 text-xs text-emerald-400">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        Completed
                      </span>
                    )}
                  </div>
                </div>
                {/* Navigation */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => hasPrev && handleNavigate(videoIndex - 1)}
                    disabled={!hasPrev}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/10 text-sm text-white/60 hover:text-white hover:border-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                    Prev
                  </button>
                  <button
                    onClick={() => hasNext && handleNavigate(videoIndex + 1)}
                    disabled={!hasNext}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-sm text-white font-medium disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    Next
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Chapters (NEW-PACKET-B video chunking) */}
              <ChaptersList
                youtubeId={currentVideo.youtubeId}
                accessToken={accessToken}
                currentSeconds={currentSeconds}
                onSeekTo={(s) => {
                  playerRef.current?.seekTo(s);
                  playerRef.current?.play();
                }}
                onChunksLoaded={setChunks}
              />

              {/* Adaptive quiz prompt (NEW-PACKET-C) */}
              <div className="flex items-center justify-between gap-4 rounded-2xl border border-indigo-500/30 bg-indigo-500/5 p-4">
                <div className="min-w-0">
                  <p className="text-white font-medium">Test your knowledge</p>
                  <p className="text-white/50 text-sm">
                    Take a short adaptive quiz on this topic — difficulty adjusts to you.
                  </p>
                </div>
                <button
                  onClick={() => setQuizOpen(true)}
                  className="inline-flex flex-shrink-0 items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors"
                >
                  <Target className="h-4 w-4" /> Start quiz
                </button>
              </div>

              {/* Study notes prompt (NEW-PACKET-D) */}
              <div className="flex items-center justify-between gap-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4">
                <div className="min-w-0">
                  <p className="text-white font-medium">Study notes</p>
                  <p className="text-white/50 text-sm">
                    Turn this video into AI study notes — 5 styles, flashcards, downloadable.
                  </p>
                </div>
                <Link
                  href={`/notes/${currentVideo.youtubeId}?title=${encodeURIComponent(currentVideo.title)}`}
                  className="inline-flex flex-shrink-0 items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors"
                >
                  <BookOpen className="h-4 w-4" /> Generate notes
                </Link>
              </div>

              {/* Question panel */}
              {showQuestion && (
                <div className="animate-slide-up">
                  {questionLoading ? (
                    <div className="bg-[#1c1c1c] rounded-2xl border border-indigo-500/20 p-6 flex items-center gap-4">
                      <svg className="w-5 h-5 animate-spin text-indigo-400 flex-shrink-0" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                      </svg>
                      <div>
                        <p className="text-sm font-medium text-white">Generating comprehension question…</p>
                        <p className="text-xs text-white/30 mt-0.5">Claude is crafting a question tailored to this video</p>
                      </div>
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
                    // Fallback when API is unavailable
                    <div className="bg-[#1c1c1c] rounded-2xl border border-white/[0.06] p-5">
                      <p className="text-sm text-white/60 mb-3">
                        In your own words, what was the most important concept from this video?
                      </p>
                      <button
                        onClick={() => setShowQuestion(false)}
                        className="text-xs text-white/30 hover:text-white/60 transition-colors"
                      >
                        Skip for now
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Mobile sidebar */}
              {!sidebarOpen && (
                <div className="lg:hidden grid sm:grid-cols-2 gap-4">
                  <ProgressTracker
                    videos={videosWithProgress}
                    currentIndex={videoIndex}
                    totalWatchSeconds={totalWatchSeconds}
                    onNavigate={handleNavigate}
                  />
                  <ConceptSidebar
                    concepts={derivedConcepts}
                    videoTitle={currentVideo.title}
                    notes={notes}
                    onNotesChange={setNotes}
                  />
                </div>
              )}
            </div>

            {/* Right sidebar */}
            {sidebarOpen && (
              <div className="hidden lg:flex flex-col gap-4">
                <ProgressTracker
                  videos={videosWithProgress}
                  currentIndex={videoIndex}
                  totalWatchSeconds={totalWatchSeconds}
                  onNavigate={handleNavigate}
                />
                <div className="flex-1" style={{ minHeight: 400 }}>
                  <ConceptSidebar
                    concepts={derivedConcepts}
                    videoTitle={currentVideo.title}
                    notes={notes}
                    onNotesChange={setNotes}
                  />
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {chapterQuiz && (
        <ChapterQuizModal
          chunkId={chapterQuiz.chunkId}
          chapterTitle={chapterQuiz.chapterTitle}
          questions={chapterQuiz.questions}
          accessToken={accessToken}
          onClose={() => {
            setChapterQuiz(null);
            playerRef.current?.play(); // resume if user skips quiz
          }}
          onComplete={handleChapterQuizComplete}
        />
      )}

      <QuizModal
        isOpen={quizOpen}
        onClose={() => setQuizOpen(false)}
        topicName={currentVideo.title}
      />

      <AITutorPanel
        accessToken={accessToken}
        subject={builtTopicName || undefined}
        videoTitle={currentVideo.title}
        learningPathId={decodedPathId || undefined}
      />
    </>
  );
}
