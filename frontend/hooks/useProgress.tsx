import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import axios from "axios";
import { useAuth } from "./useAuth";

export interface ProgressStats {
  videosWatched: number;
  conceptsMastered: number;
  hoursLearned: number;
  coursesStarted: number;
}

export interface WeeklyActivityPoint {
  date: string;       // "Mon", "Tue", ...
  videos: number;
  minutes: number;
}

export interface HeatmapPoint {
  date: string;       // ISO date "2026-05-30"
  minutes: number;
  videos: number;
}

interface ProgressContextValue {
  stats: ProgressStats;
  streak: number;
  weekly: WeeklyActivityPoint[];
  heatmap: HeatmapPoint[];
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
  const [weekly, setWeekly] = useState<WeeklyActivityPoint[]>([]);
  const [heatmap, setHeatmap] = useState<HeatmapPoint[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!accessToken || !user) return;
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${accessToken}` };
      const [statsRes, streakRes, weeklyRes, heatmapRes] = await Promise.allSettled([
        axios.get("/api/progress/stats", { headers }),
        axios.get("/api/progress/streak", { headers }),
        axios.get("/api/progress/weekly-activity", { headers }),
        axios.get("/api/progress/heatmap?days=112", { headers }),
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
        setStreak(streakRes.value.data.streak_days ?? 0);
      }
      if (weeklyRes.status === "fulfilled") {
        const activity = weeklyRes.value.data.activity ?? [];
        setWeekly(activity);
      }
      if (heatmapRes.status === "fulfilled") {
        const data = heatmapRes.value.data.data ?? [];
        setHeatmap(data);
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
      setWeekly([]);
      setHeatmap([]);
    }
  }, [accessToken, user, refresh]);

  return (
    <ProgressContext.Provider value={{ stats, streak, weekly, heatmap, loading, refresh }}>
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
