import React, { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from "react";

declare global {
  interface Window {
    YT: any; // injected globally by the YouTube IFrame API script
    onYouTubeIframeAPIReady: () => void;
  }
}

interface ChunkBoundary {
  chunk_number: number;
  start_seconds: number;
  end_seconds: number;
}

interface VideoPlayerProps {
  youtubeId: string;
  initialPosition?: number;
  onProgress?: (pct: number, positionSeconds: number, watchTimeSeconds: number) => void;
  onComplete?: () => void;
  onReady?: (duration: number) => void;
  // Chunk-based pause: when the player reaches end_seconds of the active chunk,
  // it pauses automatically and fires onChunkComplete(activeChunkIndex).
  chunks?: ChunkBoundary[];
  activeChunkIndex?: number;
  onChunkComplete?: (chunkIndex: number) => void;
}

// Imperative handle so a parent can seek, play, or pause the player.
export interface VideoPlayerHandle {
  seekTo: (seconds: number) => void;
  play: () => void;
  pause: () => void;
}

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
const SKIP_SECONDS = 10;

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

const VideoPlayer = forwardRef<VideoPlayerHandle, VideoPlayerProps>(function VideoPlayer({
  youtubeId,
  initialPosition = 0,
  onProgress,
  onComplete,
  onReady,
  chunks,
  activeChunkIndex,
  onChunkComplete,
}: VideoPlayerProps, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const watchStartRef = useRef<number>(0);
  const totalWatchRef = useRef<number>(0);
  const completedRef = useRef(false);

  // Refs for chunk boundary checking — kept in sync with props so the polling
  // closure always reads the latest values without being recreated.
  const chunksRef = useRef<ChunkBoundary[]>([]);
  const activeChunkIdxRef = useRef(-1);
  const onChunkCompleteRef = useRef<((idx: number) => void) | undefined>(undefined);
  // Track which chunk index we last paused for to prevent re-firing.
  const chunkFiredRef = useRef(-1);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(80);
  const [speed, setSpeed] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [showVolume, setShowVolume] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [playerReady, setPlayerReady] = useState(false);
  const [seeking, setSeeking] = useState(false);
  const hideControlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep chunk refs in sync with props (no closure re-creation needed).
  useEffect(() => { chunksRef.current = chunks ?? []; }, [chunks]);
  useEffect(() => {
    activeChunkIdxRef.current = activeChunkIndex ?? -1;
    // Allow re-firing when the parent advances to a new chunk.
    if ((activeChunkIndex ?? -1) !== chunkFiredRef.current) {
      // Only reset if we're moving forward, not on initial -1.
    }
  }, [activeChunkIndex]);
  useEffect(() => { onChunkCompleteRef.current = onChunkComplete; }, [onChunkComplete]);

  const startProgressPoll = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    watchStartRef.current = Date.now();

    intervalRef.current = setInterval(() => {
      const player = playerRef.current;
      if (!player) return;

      const t = player.getCurrentTime?.() ?? 0;
      const d = player.getDuration?.() ?? 0;
      const loaded = (player.getVideoLoadedFraction?.() ?? 0) * 100;

      setCurrentTime(t);
      setBuffered(loaded);

      const elapsed = (Date.now() - watchStartRef.current) / 1000;
      totalWatchRef.current += elapsed;
      watchStartRef.current = Date.now();

      const pct = d > 0 ? Math.round((t / d) * 100) : 0;
      onProgress?.(pct, Math.floor(t), Math.floor(totalWatchRef.current));

      if (pct >= 90 && !completedRef.current) {
        completedRef.current = true;
        onComplete?.();
      }

      // Chunk boundary check: pause at end_seconds of the active chunk.
      const ci = activeChunkIdxRef.current;
      const chs = chunksRef.current;
      if (ci >= 0 && ci < chs.length && ci !== chunkFiredRef.current) {
        const ch = chs[ci];
        if (ch.end_seconds > 0 && t >= ch.end_seconds - 0.5) {
          chunkFiredRef.current = ci;
          player.pauseVideo(); // triggers onStateChange:PAUSED → stops poll
          onChunkCompleteRef.current?.(ci);
        }
      }
    }, 1000);
  }, [onProgress, onComplete]);

  const stopProgressPoll = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    const elapsed = (Date.now() - watchStartRef.current) / 1000;
    totalWatchRef.current += elapsed;
  }, []);

  useEffect(() => {
    let mounted = true;

    const initPlayer = () => {
      if (!containerRef.current || !mounted) return;

      // Tear down any prior instance so we never leave a stale player whose
      // widget timer keeps postMessage-ing to a detached window (console flood).
      if (playerRef.current) {
        try { playerRef.current.destroy(); } catch { /* ignore */ }
        playerRef.current = null;
      }
      // YT.Player REPLACES the target node with its iframe. Mount into a
      // throwaway child so our React-owned containerRef is never detached.
      containerRef.current.innerHTML = "";
      const mountNode = document.createElement("div");
      containerRef.current.appendChild(mountNode);

      playerRef.current = new window.YT.Player(mountNode, {
        videoId: youtubeId,
        host: "https://www.youtube.com",
        playerVars: {
          controls: 0,
          disablekb: 1,
          modestbranding: 1,
          rel: 0,
          iv_load_policy: 3,
          start: Math.floor(initialPosition),
          enablejsapi: 1,
          // Must match the page origin or the API floods the console with
          // "target origin does not match recipient window's origin".
          origin: typeof window !== "undefined" ? window.location.origin : undefined,
        },
        events: {
                  onReady: (e: any) => {
            if (!mounted) return;
            const d = e.target.getDuration();
            setDuration(d);
            setPlayerReady(true);
            e.target.setVolume(volume);
            onReady?.(d);
          },
                  onStateChange: (e: any) => {
            if (!mounted) return;
            if (e.data === window.YT.PlayerState.PLAYING) {
              setIsPlaying(true);
              watchStartRef.current = Date.now();
              startProgressPoll();
            } else if (
              e.data === window.YT.PlayerState.PAUSED ||
              e.data === window.YT.PlayerState.ENDED
            ) {
              setIsPlaying(false);
              stopProgressPoll();
              if (e.data === window.YT.PlayerState.ENDED) {
                setCurrentTime(duration);
                onComplete?.();
              }
            }
          },
        },
      });
    };

    if (window.YT?.Player) {
      initPlayer();
    } else {
      window.onYouTubeIframeAPIReady = initPlayer;
      if (!document.getElementById("yt-iframe-api")) {
        const script = document.createElement("script");
        script.id = "yt-iframe-api";
        script.src = "https://www.youtube.com/iframe_api";
        document.head.appendChild(script);
      }
    }

    return () => {
      mounted = false;
      stopProgressPoll();
      try { playerRef.current?.destroy(); } catch { /* ignore */ }
      playerRef.current = null;
      // Drop the replaced iframe so no stale widget timer survives the unmount.
      if (containerRef.current) containerRef.current.innerHTML = "";
    };
  }, [youtubeId]); // eslint-disable-line react-hooks/exhaustive-deps

  const togglePlay = () => {
    const p = playerRef.current;
    if (!p) return;
    if (isPlaying) p.pauseVideo(); else p.playVideo();
  };

  const toggleMute = () => {
    const p = playerRef.current;
    if (!p) return;
    if (isMuted) { p.unMute(); setIsMuted(false); }
    else { p.mute(); setIsMuted(true); }
  };

  const changeVolume = (v: number) => {
    playerRef.current?.setVolume(v);
    setVolume(v);
    if (v === 0) setIsMuted(true);
    else if (isMuted) { playerRef.current?.unMute(); setIsMuted(false); }
  };

  const changeSpeed = (s: number) => {
    playerRef.current?.setPlaybackRate(s);
    setSpeed(s);
    setShowSpeedMenu(false);
  };

  const seekTo = (seconds: number) => {
    playerRef.current?.seekTo(Math.max(0, Math.min(seconds, duration)), true);
    setCurrentTime(seconds);
  };

  useImperativeHandle(ref, () => ({
    seekTo,
    play: () => playerRef.current?.playVideo(),
    pause: () => playerRef.current?.pauseVideo(),
  }), [duration]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    seekTo(pct * duration);
  };

  const toggleFullscreen = () => {
    const el = containerRef.current?.closest(".video-wrapper") as HTMLElement | null;
    if (!document.fullscreenElement) {
      el?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const resetHideTimer = () => {
    setShowControls(true);
    if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
    hideControlsTimer.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 3000);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!playerReady) return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      switch (e.key) {
        case " ": case "k": e.preventDefault(); togglePlay(); break;
        case "ArrowLeft": e.preventDefault(); seekTo(currentTime - SKIP_SECONDS); break;
        case "ArrowRight": e.preventDefault(); seekTo(currentTime + SKIP_SECONDS); break;
        case "ArrowUp": e.preventDefault(); changeVolume(Math.min(100, volume + 10)); break;
        case "ArrowDown": e.preventDefault(); changeVolume(Math.max(0, volume - 10)); break;
        case "m": e.preventDefault(); toggleMute(); break;
        case "f": e.preventDefault(); toggleFullscreen(); break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [playerReady, isPlaying, currentTime, volume, isMuted]); // eslint-disable-line react-hooks/exhaustive-deps

  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      className="video-wrapper relative w-full bg-black rounded-2xl overflow-hidden group select-none"
      style={{ aspectRatio: "16/9" }}
      onMouseMove={resetHideTimer}
      onMouseLeave={() => isPlaying && setShowControls(false)}
    >
      {/* YouTube iframe */}
      <div ref={containerRef} className="absolute inset-0 w-full h-full" />

      {/* Click-to-play overlay */}
      <div
        className="absolute inset-0 cursor-pointer z-10"
        onClick={togglePlay}
        onDoubleClick={toggleFullscreen}
      />

      {/* Big play button when paused */}
      {!isPlaying && playerReady && (
        <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
          <div className="w-20 h-20 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center border border-white/20 shadow-2xl">
            <svg className="w-8 h-8 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
      )}

      {/* Loading state */}
      {!playerReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-30">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-white/50 text-sm">Loading player…</span>
          </div>
        </div>
      )}

      {/* Controls bar */}
      <div
        className={`absolute bottom-0 left-0 right-0 z-20 transition-opacity duration-300 ${
          showControls || !isPlaying ? "opacity-100" : "opacity-0"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Gradient fade */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent pointer-events-none" />

        <div className="relative px-4 pb-4 pt-12">
          {/* Progress bar */}
          <div
            className="relative h-1 bg-white/20 rounded-full mb-4 cursor-pointer group/progress"
            onClick={handleProgressClick}
          >
            {/* Buffered */}
            <div
              className="absolute inset-y-0 left-0 bg-white/20 rounded-full transition-all"
              style={{ width: `${buffered}%` }}
            />
            {/* Played */}
            <div
              className="absolute inset-y-0 left-0 bg-indigo-500 rounded-full transition-all"
              style={{ width: `${progressPct}%` }}
            />
            {/* Thumb */}
            <div
              className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-indigo-400 shadow-lg opacity-0 group-hover/progress:opacity-100 transition-opacity"
              style={{ left: `calc(${progressPct}% - 6px)` }}
            />
          </div>

          {/* Controls row */}
          <div className="flex items-center gap-3">
            {/* Play/Pause */}
            <button
              onClick={togglePlay}
              className="text-white hover:text-indigo-300 transition-colors focus:outline-none"
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? (
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 4h4v16H6zm8 0h4v16h-4z" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>

            {/* Skip back */}
            <button
              onClick={() => seekTo(currentTime - SKIP_SECONDS)}
              className="text-white/70 hover:text-white transition-colors focus:outline-none"
              aria-label="Rewind 10 seconds"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12.5 3a9 9 0 1 0 9 9h-2a7 7 0 1 1-7-7V3z"/>
                <path d="M10.5 3v5l5-2.5L10.5 3z"/>
                <text x="8" y="15" fontSize="6" fill="currentColor" fontWeight="bold">10</text>
              </svg>
            </button>

            {/* Skip forward */}
            <button
              onClick={() => seekTo(currentTime + SKIP_SECONDS)}
              className="text-white/70 hover:text-white transition-colors focus:outline-none"
              aria-label="Forward 10 seconds"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M11.5 3a9 9 0 1 1-9 9h2a7 7 0 1 0 7-7V3z"/>
                <path d="M13.5 3v5l-5-2.5L13.5 3z"/>
                <text x="8" y="15" fontSize="6" fill="currentColor" fontWeight="bold">10</text>
              </svg>
            </button>

            {/* Volume */}
            <div className="relative flex items-center gap-2" onMouseLeave={() => setShowVolume(false)}>
              <button
                onClick={toggleMute}
                onMouseEnter={() => setShowVolume(true)}
                className="text-white/70 hover:text-white transition-colors focus:outline-none"
                aria-label={isMuted ? "Unmute" : "Mute"}
              >
                {isMuted || volume === 0 ? (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
                  </svg>
                ) : volume < 50 ? (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M18.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z"/>
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
                  </svg>
                )}
              </button>
              {showVolume && (
                <div className="absolute left-8 bottom-0 flex items-center">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={isMuted ? 0 : volume}
                    onChange={(e) => changeVolume(Number(e.target.value))}
                    className="w-20 h-1 accent-indigo-500 cursor-pointer"
                  />
                </div>
              )}
            </div>

            {/* Time */}
            <span className="text-white/70 text-xs tabular-nums">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>

            <div className="flex-1" />

            {/* Speed */}
            <div className="relative">
              <button
                onClick={() => setShowSpeedMenu((v) => !v)}
                className="text-white/70 hover:text-white text-xs font-medium transition-colors focus:outline-none px-2 py-1 rounded hover:bg-white/10"
              >
                {speed}×
              </button>
              {showSpeedMenu && (
                <div className="absolute bottom-8 right-0 bg-[#1c1c1c] border border-white/10 rounded-xl overflow-hidden shadow-2xl min-w-[80px]">
                  {SPEEDS.map((s) => (
                    <button
                      key={s}
                      onClick={() => changeSpeed(s)}
                      className={`w-full text-left px-4 py-2 text-sm transition-colors hover:bg-white/10 ${
                        s === speed ? "text-indigo-400 font-medium" : "text-white/70"
                      }`}
                    >
                      {s}×
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Fullscreen */}
            <button
              onClick={toggleFullscreen}
              className="text-white/70 hover:text-white transition-colors focus:outline-none"
              aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            >
              {isFullscreen ? (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/>
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Keyboard hint */}
      {playerReady && !isPlaying && (
        <div className="absolute top-3 right-3 z-20 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {[["Space", "Play"], ["Arrows", "Seek"], ["M", "Mute"], ["F", "Full"]].map(([key, label]) => (
            <div key={key} className="flex items-center gap-1 bg-black/60 backdrop-blur-sm rounded px-2 py-1">
              <span className="text-white/50 text-xs font-mono">{key}</span>
              <span className="text-white/30 text-xs">{label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

export default VideoPlayer;
