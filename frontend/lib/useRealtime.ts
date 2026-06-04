import { useEffect, useRef } from "react";

// Opens a WebSocket to the backend for live presence + message push.
// Connects directly to NEXT_PUBLIC_API_URL (Next.js rewrites don't proxy WS).
// No-op if the API base or token is missing.
export function useRealtime(onEvent: (event: any) => void) {
  const cb = useRef(onEvent);
  cb.current = onEvent;

  useEffect(() => {
    let base = process.env.NEXT_PUBLIC_API_URL;
    const token =
      typeof window !== "undefined"
        ? localStorage.getItem("access_token") ?? sessionStorage.getItem("access_token")
        : null;
    if (!base || !token) return;

    // A localhost API base can't be reached from a deployed (non-local) page —
    // don't attempt a WebSocket to it (avoids connection-refused noise when the
    // env var was left at the dev default in prod).
    const baseIsLocal = base.includes("localhost") || base.includes("127.0.0.1");
    const pageIsLocal =
      typeof window !== "undefined" &&
      (window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1");
    if (baseIsLocal && !pageIsLocal) return;

    // On an HTTPS page, force a secure backend origin so the socket is wss://
    // (an ws:// socket from an https page is blocked as mixed content).
    if (
      typeof window !== "undefined" &&
      window.location.protocol === "https:" &&
      base.startsWith("http://") &&
      !base.includes("localhost") &&
      !base.includes("127.0.0.1")
    ) {
      base = "https://" + base.slice("http://".length);
    }

    const wsUrl = base.replace(/^http/, "ws") + "/api/ws?token=" + encodeURIComponent(token);
    let ws: WebSocket | null = null;
    let ping: ReturnType<typeof setInterval> | undefined;

    try {
      ws = new WebSocket(wsUrl);
      ws.onopen = () => {
        ping = setInterval(() => {
          if (ws && ws.readyState === WebSocket.OPEN) ws.send("ping");
        }, 30000);
      };
      ws.onmessage = (ev) => {
        try {
          cb.current(JSON.parse(ev.data));
        } catch {
          /* ignore */
        }
      };
    } catch {
      /* WS unavailable — features still work over REST */
    }

    return () => {
      if (ping) clearInterval(ping);
      try {
        ws?.close();
      } catch {
        /* ignore */
      }
    };
  }, []);
}
