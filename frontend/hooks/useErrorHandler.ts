import { useState, useCallback, useRef, useEffect } from "react";
import { ApiRequestError } from "../lib/api";

export interface ErrorState {
  message: string | null;
  status: number | null;
  retryAfter: number | null;
}

export function useErrorHandler() {
  const [error, setError] = useState<ErrorState>({ message: null, status: null, retryAfter: null });
  const [countdown, setCountdown] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const startCountdown = useCallback((seconds: number) => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setCountdown(seconds);
    let remaining = seconds;
    intervalRef.current = setInterval(() => {
      remaining -= 1;
      setCountdown(remaining);
      if (remaining <= 0) {
        clearInterval(intervalRef.current!);
        intervalRef.current = null;
        setError({ message: null, status: null, retryAfter: null });
      }
    }, 1000);
  }, []);

  const handleError = useCallback(
    (err: unknown) => {
      if (err instanceof ApiRequestError) {
        setError({ message: err.message, status: err.status, retryAfter: err.retryAfter ?? null });
        if (err.status === 429 && err.retryAfter) {
          startCountdown(err.retryAfter);
        }
      } else if (err instanceof Error) {
        setError({ message: err.message, status: null, retryAfter: null });
      } else {
        setError({ message: "Something went wrong", status: null, retryAfter: null });
      }
    },
    [startCountdown],
  );

  const clearError = useCallback(() => {
    setError({ message: null, status: null, retryAfter: null });
    setCountdown(0);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  return {
    error,
    countdown,
    isRateLimited: countdown > 0,
    handleError,
    clearError,
  };
}
