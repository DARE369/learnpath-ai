import React, { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import Link from "next/link";
import axios from "axios";
import VideoPlayer from "../../../components/Learning/VideoPlayer";
import ProgressTracker from "../../../components/Learning/ProgressTracker";
import ConceptSidebar from "../../../components/Learning/ConceptSidebar";

// ─── Demo data (replaced with real API data in Packet 2.3+) ───────────────────

const DEMO_VIDEOS = [
  {
    index: 0,
    title: "Introduction to Machine Learning",
    youtubeId: "ukzFI9rgwfU",
    durationSeconds: 845,
  },
  {
    index: 1,
    title: "Supervised Learning Fundamentals",
    youtubeId: "1vsmaEfbnoE",
    durationSeconds: 1260,
  },
  {
    index: 2,
    title: "Neural Networks Explained",
    youtubeId: "aircAruvnKk",
    durationSeconds: 1020,
  },
  {
    index: 3,
    title: "Backpropagation & Gradient Descent",
    youtubeId: "Ilg3gGewQ5U",
    durationSeconds: 930,
  },
];

const DEMO_CONCEPTS = [
  { name: "Supervised Learning", status: "mastered" as const, mastery: 92, description: "Training a model on labelled input-output pairs so it can generalise to unseen examples." },
  { name: "Loss Function", status: "learning" as const, mastery: 58, description: "A measure of how far the model's predictions are from the true labels." },
  { name: "Gradient Descent", status: "learning" as const, mastery: 45, description: "An optimisation algorithm that iteratively adjusts parameters to minimise the loss." },
  { name: "Backpropagation", status: "not_started" as const, mastery: 0 },
  { name: "Overfitting", status: "not_started" as const, mastery: 0 },
];

// ─── Post-video question panel ────────────────────────────────────────────────

interface QuestionPanelProps {
  sessionId: string | null;
  onSubmit: (question: string, answer: string) => Promise<void>;
  onSkip: () => void;
}

function QuestionPanel({ onSubmit, onSkip }: QuestionPanelProps) {
  const QUESTION = "In your own words, what was the most important concept from this video? How would you explain it to a friend?";
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!answer.trim() || loading) return;
    setLoading(true);
    try {
      await onSubmit(QUESTION, answer.trim());
      setFeedback("Great reflection! Your answer has been saved. AI feedback coming soon.");
      setSubmitted(true);
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="bg-[#1c1c1c] rounded-2xl border border-white/[0.06] p-5">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-white">Answer recorded</p>
            <p className="text-xs text-white/40 mt-1">{feedback}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#1c1c1c] rounded-2xl border border-indigo-500/20 p-5">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-6 h-6 rounded-full bg-indigo-500/20 flex items-center justify-center">
          <svg className="w-3.5 h-3.5 text-indigo-400" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z"/>
          </svg>
        </div>
        <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">Reflection Question</span>
      </div>
      <p className="text-sm text-white/80 leading-relaxed mb-4">{QUESTION}</p>
      <textarea
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        placeholder="Type your answer here…"
        rows={4}
        className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sm text-white/80 placeholder-white/20 resize-none focus:outline-none focus:border-indigo-500/50 transition-colors"
      />
      <div className="flex items-center gap-3 mt-3">
        <button
          onClick={handleSubmit}
          disabled={!answer.trim() || loading}
          className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {loading && (
            <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
          )}
          Submit Answer
        </button>
        <button onClick={onSkip} className="text-sm text-white/30 hover:text-white/60 transition-colors">
          Skip for now
        </button>
      </div>
    </div>
  );
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
  const [notes, setNotes] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const progressDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const accessToken = useMemo(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("access_token") ?? sessionStorage.getItem("access_token");
  }, []);

  const authHeader = useMemo(
    () => (accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
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
        // Graceful degradation — session tracking not critical for viewing
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
            {
              watch_percentage: pct,
              last_position_seconds: positionSeconds,
              total_watch_time_seconds: watchTimeSeconds,
              playback_speed: 1.0,
            },
            { headers: authHeader },
          );
        } catch {
          // Non-blocking
        }
      }, 5000);
    },
    [sessionId, videoIndex, authHeader], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const handleVideoComplete = useCallback(() => {
    setCompletedVideos((prev) => new Set(prev).add(videoIndex));
    setShowQuestion(true);
    if (sessionId) {
      axios
        .post(`/api/sessions/complete/${sessionId}`, {}, { headers: authHeader })
        .catch(() => {});
    }
  }, [sessionId, videoIndex, authHeader]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAnswerSubmit = async (question: string, answer: string) => {
    if (!sessionId) return;
    await axios.post(
      `/api/sessions/answer/${sessionId}`,
      { question, answer },
      { headers: authHeader },
    );
  };

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
            {/* Back */}
            <Link
              href="/"
              className="flex items-center gap-2 text-white/40 hover:text-white/80 transition-colors text-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </Link>

            <div className="w-px h-4 bg-white/10" />

            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="text-white/30 truncate hidden sm:block">Learning Path</span>
              <svg className="w-3 h-3 text-white/20 flex-shrink-0 hidden sm:block" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
              <span className="text-white/70 truncate font-medium">{currentVideo.title}</span>
            </div>

            <div className="flex-1" />

            {/* Video counter */}
            <span className="text-xs text-white/30 tabular-nums hidden sm:block">
              {videoIndex + 1} / {DEMO_VIDEOS.length}
            </span>

            {/* Sidebar toggle */}
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
              {/* Video player */}
              <VideoPlayer
                youtubeId={currentVideo.youtubeId}
                onProgress={handleProgress}
                onComplete={handleVideoComplete}
              />

              {/* Video metadata */}
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h1 className="text-lg font-semibold text-white leading-snug">
                    {currentVideo.title}
                  </h1>
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="text-xs text-white/30">
                      Video {videoIndex + 1} of {DEMO_VIDEOS.length}
                    </span>
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
                  <QuestionPanel
                    sessionId={sessionId}
                    onSubmit={handleAnswerSubmit}
                    onSkip={() => setShowQuestion(false)}
                  />
                </div>
              )}

              {/* Mobile sidebar content */}
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
