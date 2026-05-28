import React, { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import Link from "next/link";
import axios from "axios";
import VideoPlayer from "../../../components/Learning/VideoPlayer";
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

export default function LearningSessionPage() {
  const router = useRouter();
  const { pathId, videoIndex: videoIndexParam } = router.query;

  const videoIndex = Number(videoIndexParam ?? 0);
  const currentVideo = DEMO_VIDEOS[videoIndex] ?? DEMO_VIDEOS[0];

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

  const accessToken = useMemo(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("access_token") ?? sessionStorage.getItem("access_token");
  }, []);

  const authHeader = useMemo(
    (): Record<string, string> => (accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    [accessToken],
  );

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
      const hasNext = videoIndex < DEMO_VIDEOS.length - 1;
      if (score >= 0 && hasNext) {
        router.push(`/learning/${pathId}/${videoIndex + 1}`);
      } else if (!hasNext) {
        router.push(`/dashboard?pathComplete=true`);
      }
    },
    [videoIndex, pathId, router],
  );

  const handleNavigate = (idx: number) => {
    router.push(`/learning/${pathId}/${idx}`);
  };

  const videosWithProgress = DEMO_VIDEOS.map((v) => ({
    ...v,
    watchPercentage: videoProgress[v.index] ?? 0,
    completed: completedVideos.has(v.index),
  }));

  const hasNext = videoIndex < DEMO_VIDEOS.length - 1;
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
              <span className="text-white/30 truncate hidden sm:block">Learning Path</span>
              <svg className="w-3 h-3 text-white/20 flex-shrink-0 hidden sm:block" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
              <span className="text-white/70 truncate font-medium">{currentVideo.title}</span>
            </div>
            <div className="flex-1" />
            <span className="text-xs text-white/30 tabular-nums hidden sm:block">
              {videoIndex + 1} / {DEMO_VIDEOS.length}
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
                youtubeId={currentVideo.youtubeId}
                onProgress={handleProgress}
                onComplete={handleVideoComplete}
              />

              {/* Video metadata */}
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h1 className="text-lg font-semibold text-white leading-snug">{currentVideo.title}</h1>
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="text-xs text-white/30">Video {videoIndex + 1} of {DEMO_VIDEOS.length}</span>
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
                    concepts={DEMO_CONCEPTS}
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
                    concepts={DEMO_CONCEPTS}
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
    </>
  );
}
