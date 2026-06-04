import { useEffect, useRef } from "react";

// Opens a WebSocket to the backend for live presence + message push.
// Connects directly to NEXT_PUBLIC_API_URL (Next.js rewrites don't proxy WS).
// No-op if the API base or token is missing.
export function useRealtime(onEvent: (event: any) => void) {
  const cb = useRef(onEvent);
  cb.current = onEvent;

  useEffect(() => {
    const base = process.env.NEXT_PUBLIC_API_URL;
    const token =
      typeof window !== "undefined"
        ? localStorage.getItem("access_token") ?? sessionStorage.getItem("access_token")
        : null;
    if (!base || !token) return;

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
