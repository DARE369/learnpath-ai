import React, { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from "react";
import { Icon } from "../../ui-v2/icons";
import { color, font } from "../../ui-v2/tokens";

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

// SkipBack/SkipForward with a baked-in "10" label — lucide has no numbered
// variant, so this composes the registry icon with a text overlay.
function SkipIcon({ direction }: { direction: "back" | "forward" }) {
  return (
    <span style={{ position: "relative", display: "inline-flex" }}>
      <Icon name={direction === "back" ? "skipBack" : "skipForward"} size={20} className="" />
      <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 7, fontWeight: 700, transform: "translateY(1px)" }}>10</span>
    </span>
  );
}

const controlBtnStyle: React.CSSProperties = { background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.75)", display: "flex", padding: 0 };

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
  const hideControlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep chunk refs in sync with props (no closure re-creation needed).
  useEffect(() => { chunksRef.current = chunks ?? []; }, [chunks]);
  useEffect(() => {
    activeChunkIdxRef.current = activeChunkIndex ?? -1;
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
      // Pre-size the mount node so the replaced iframe fills the container.
      mountNode.style.cssText = "position:absolute;inset:0;width:100%;height:100%";
      containerRef.current.appendChild(mountNode);

      playerRef.current = new window.YT.Player(mountNode, {
        width: "100%",
        height: "100%",
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
          origin: typeof window !== "undefined" ? window.location.origin : "https://learnpath-ai-eight.vercel.app",
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
      className="video-wrapper"
      style={{ position: "relative", width: "100%", background: "#000", borderRadius: 16, overflow: "hidden", aspectRatio: "16/9", userSelect: "none", fontFamily: font.body }}
      onMouseMove={resetHideTimer}
      onMouseLeave={() => isPlaying && setShowControls(false)}
    >
      <div ref={containerRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />

      <div style={{ position: "absolute", inset: 0, cursor: "pointer", zIndex: 10 }} onClick={togglePlay} onDoubleClick={toggleFullscreen} />

      {!isPlaying && playerReady && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 20, pointerEvents: "none" }}>
          <div style={{ width: 80, height: 80, borderRadius: "50%", background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid rgba(255,255,255,0.2)", boxShadow: "0 20px 40px rgba(0,0,0,0.4)" }}>
            <Icon name="play" size={32} className="" />
          </div>
        </div>
      )}

      {!playerReady && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.8)", zIndex: 30 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
            <div style={{ width: 40, height: 40, border: "2px solid #2B5FA8", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
            <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 13.5 }}>Loading player…</span>
          </div>
        </div>
      )}

      <div
        style={{ position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 20, opacity: showControls || !isPlaying ? 1 : 0, transition: "opacity 300ms ease" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.9), rgba(0,0,0,0.3) 60%, transparent)", pointerEvents: "none" }} />

        <div style={{ position: "relative", padding: "48px 16px 16px" }}>
          <div style={{ position: "relative", height: 4, background: "rgba(255,255,255,0.2)", borderRadius: 100, marginBottom: 16, cursor: "pointer" }} onClick={handleProgressClick}>
            <div style={{ position: "absolute", top: 0, bottom: 0, left: 0, background: "rgba(255,255,255,0.2)", borderRadius: 100, width: `${buffered}%` }} />
            <div style={{ position: "absolute", top: 0, bottom: 0, left: 0, background: "#2B5FA8", borderRadius: 100, width: `${progressPct}%` }} />
            <div style={{ position: "absolute", top: "50%", transform: "translateY(-50%)", width: 12, height: 12, borderRadius: "50%", background: "#6FA0E0", left: `calc(${progressPct}% - 6px)` }} />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <button onClick={togglePlay} style={{ ...controlBtnStyle, color: "#fff" }} aria-label={isPlaying ? "Pause" : "Play"}>
              <Icon name={isPlaying ? "pause" : "play"} size={22} className="" />
            </button>

            <button onClick={() => seekTo(currentTime - SKIP_SECONDS)} style={controlBtnStyle} aria-label="Rewind 10 seconds">
              <SkipIcon direction="back" />
            </button>

            <button onClick={() => seekTo(currentTime + SKIP_SECONDS)} style={controlBtnStyle} aria-label="Forward 10 seconds">
              <SkipIcon direction="forward" />
            </button>

            <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 8 }} onMouseLeave={() => setShowVolume(false)}>
              <button onClick={toggleMute} onMouseEnter={() => setShowVolume(true)} style={controlBtnStyle} aria-label={isMuted ? "Unmute" : "Mute"}>
                <Icon name={isMuted || volume === 0 ? "volumeMute" : "volume"} size={19} className="" />
              </button>
              {showVolume && (
                <div style={{ position: "absolute", left: 32, bottom: 0, display: "flex", alignItems: "center" }}>
                  <input type="range" min={0} max={100} value={isMuted ? 0 : volume} onChange={(e) => changeVolume(Number(e.target.value))} style={{ width: 80, height: 4, cursor: "pointer" }} />
                </div>
              )}
            </div>

            <span style={{ color: "rgba(255,255,255,0.75)", fontSize: 12, fontFamily: font.mono }}>{formatTime(currentTime)} / {formatTime(duration)}</span>

            <div style={{ flex: 1 }} />

            <div style={{ position: "relative" }}>
              <button onClick={() => setShowSpeedMenu((v) => !v)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.75)", fontSize: 12, fontWeight: 600, padding: "4px 8px", borderRadius: 6 }}>
                {speed}×
              </button>
              {showSpeedMenu && (
                <div style={{ position: "absolute", bottom: 32, right: 0, background: color.chromeBg, border: `1px solid ${color.chromeBorder}`, borderRadius: 10, overflow: "hidden", minWidth: 80, boxShadow: "0 8px 24px rgba(0,0,0,0.4)" }}>
                  {SPEEDS.map((s) => (
                    <button key={s} onClick={() => changeSpeed(s)} style={{ width: "100%", textAlign: "left", padding: "8px 14px", fontSize: 13, background: "none", border: "none", cursor: "pointer", color: s === speed ? "#6FA0E0" : "rgba(255,255,255,0.75)", fontWeight: s === speed ? 600 : 400 }}>
                      {s}×
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button onClick={toggleFullscreen} style={controlBtnStyle} aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}>
              <Icon name={isFullscreen ? "fullscreenExit" : "fullscreen"} size={19} className="" />
            </button>
          </div>
        </div>
      </div>

      {playerReady && !isPlaying && (
        <div style={{ position: "absolute", top: 12, right: 12, zIndex: 20, display: "flex", gap: 6 }}>
          {[["Space", "Play"], ["Arrows", "Seek"], ["M", "Mute"], ["F", "Full"]].map(([key, label]) => (
            <div key={key} style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", borderRadius: 6, padding: "4px 8px" }}>
              <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 10.5, fontFamily: font.mono }}>{key}</span>
              <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 10.5 }}>{label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

export default VideoPlayer;
