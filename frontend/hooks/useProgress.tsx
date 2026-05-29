import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import axios from "axios";
import { useAuth } from "./useAuth";

export interface ProgressStats {
  videosWatched: number;
  conceptsMastered: number;
  hoursLearned: number;
  coursesStarted: number;
}

interface ProgressContextValue {
  stats: ProgressStats;
  streak: number;
  loading: boolean;
  refresh: () => Promise<void>;
}

const DEFAULT_STATS: ProgressStats = {
  videosWatched: 0,
  conceptsMastered: 0,
  hoursLearned: 0,
  coursesStarted: 0,
};

const ProgressContext = createContext<ProgressContextValue | undefined>(undefined);

export function ProgressProvider({ children }: { children: ReactNode }) {
  const { accessToken, user } = useAuth();
  const [stats, setStats] = useState<ProgressStats>(DEFAULT_STATS);
  const [streak, setStreak] = useState(0);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!accessToken || !user) return;
    setLoading(true);
    try {
      const [statsRes, streakRes] = await Promise.allSettled([
        axios.get(`/api/progress/stats/${user.id}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
        axios.get(`/api/progress/streak/${user.id}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
      ]);

      if (statsRes.status === "fulfilled") {
        const d = statsRes.value.data;
        setStats({
          videosWatched: d.videos_watched ?? 0,
          conceptsMastered: d.concepts_mastered ?? 0,
          hoursLearned: d.hours_learned ?? 0,
          coursesStarted: d.courses_started ?? 0,
        });
      }
      if (streakRes.status === "fulfilled") {
        setStreak(streakRes.value.data.current_streak ?? 0);
      }
    } finally {
      setLoading(false);
    }
  }, [accessToken, user]);

  useEffect(() => {
    if (accessToken && user) {
      refresh();
    } else {
      setStats(DEFAULT_STATS);
      setStreak(0);
    }
  }, [accessToken, user, refresh]);

  return (
    <ProgressContext.Provider value={{ stats, streak, loading, refresh }}>
      {children}
    </ProgressContext.Provider>
  );
}

export function useProgress(): ProgressContextValue {
  const ctx = useContext(ProgressContext);
  if (!ctx) {
    throw new Error("useProgress must be used within a ProgressProvider");
  }
  return ctx;
}
