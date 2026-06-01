/**
 * Rotating motivational success stories widget (Packet 4.3).
 *
 * Displays one story at a time, auto-advancing every 30 seconds.
 * Stories are hardcoded for MVP; the same set is served by the backend
 * at /api/free-tier/success-stories when server-driven content is needed.
 */

import React, { useEffect, useState } from "react";
import { Award, ChevronLeft, ChevronRight } from "lucide-react";

interface Story {
  user_name: string;
  achievement: string;
  story: string;
  before_plan: string;
  after_plan: string;
  metric: string;
}

const STORIES: Story[] = [
  {
    user_name: "Adaeze O.",
    achievement: "Passed AWS Solutions Architect exam",
    story:
      "I upgraded to Pro after hitting the free video limit on my third day. Three months later I passed my AWS exam with 89%. The structured paths made all the difference.",
    before_plan: "Free",
    after_plan: "Pro",
    metric: "3 months to certification",
  },
  {
    user_name: "Emeka N.",
    achievement: "Landed a senior data analyst role",
    story:
      "LearnPath AI helped me go from junior analyst to senior in eight months. The active-recall questions after each video genuinely changed how I retain information.",
    before_plan: "Free",
    after_plan: "Pro",
    metric: "40% salary increase",
  },
  {
    user_name: "Fatima A.",
    achievement: "Built her first full-stack app",
    story:
      "As a complete beginner, the concept branching feature showed me the exact progression from HTML to React. Upgrading to Premium gave me unlimited access without hitting limits.",
    before_plan: "Free",
    after_plan: "Premium",
    metric: "0 to deployed in 6 weeks",
  },
  {
    user_name: "Chukwudi M.",
    achievement: "Google Data Analytics Certificate",
    story:
      "LearnPath AI actually selects quality videos — I wasn't wasting time on outdated content. Pro plan paid for itself on the first month.",
    before_plan: "Free",
    after_plan: "Pro",
    metric: "Certified in 10 weeks",
  },
  {
    user_name: "Ifeoma B.",
    achievement: "Promoted to engineering lead",
    story:
      "I learned system design, distributed systems, and leadership using three concurrent learning paths. Premium's unlimited access let me context-switch freely.",
    before_plan: "Pro",
    after_plan: "Premium",
    metric: "Promoted in 5 months",
  },
];

const ROTATE_MS = 30 * 1000; // 30 seconds

function Dot({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-block w-1.5 h-1.5 rounded-full transition-colors ${active ? "bg-accent" : "bg-surface-hover"}`}
    />
  );
}

function Initials({ name }: { name: string }) {
  const parts = name.trim().split(/\s+/);
  const s = parts.length >= 2 ? parts[0][0] + parts[1][0] : name.slice(0, 2);
  return (
    <div className="w-10 h-10 rounded-full bg-gradient-accent flex items-center justify-center text-white text-xs font-bold shadow-glow-sm shrink-0">
      {s.toUpperCase()}
    </div>
  );
}

interface SuccessStoriesWidgetProps {
  className?: string;
}

export default function SuccessStoriesWidget({ className = "" }: SuccessStoriesWidgetProps) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % STORIES.length);
    }, ROTATE_MS);
    return () => clearInterval(id);
  }, [paused]);

  const story = STORIES[index];

  function prev() {
    setPaused(true);
    setIndex((i) => (i - 1 + STORIES.length) % STORIES.length);
  }
  function next() {
    setPaused(true);
    setIndex((i) => (i + 1) % STORIES.length);
  }

  return (
    <div className={`bg-surface-elevated border border-border rounded-2xl p-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-5">
        <Award size={16} className="text-accent-light" />
        <h3 className="text-sm font-semibold text-white">Success Stories</h3>
      </div>

      {/* Story card */}
      <div className="flex items-start gap-3 mb-4">
        <Initials name={story.user_name} />
        <div className="min-w-0">
          <p className="text-sm font-medium text-white">{story.user_name}</p>
          <p className="text-xs text-accent-light mt-0.5">{story.achievement}</p>
        </div>
      </div>

      <blockquote className="text-sm text-white/60 italic leading-relaxed mb-4 border-l-2 border-accent/30 pl-3">
        &ldquo;{story.story}&rdquo;
      </blockquote>

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-xs text-white/40">
          <span className="px-2 py-0.5 rounded-full bg-surface-hover capitalize">{story.before_plan}</span>
          <span>&rarr;</span>
          <span className="px-2 py-0.5 rounded-full bg-accent-muted text-accent-light capitalize">{story.after_plan}</span>
        </div>
        <span className="text-xs text-success font-medium">{story.metric}</span>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          {STORIES.map((_, i) => (
            <Dot key={i} active={i === index} />
          ))}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={prev}
            className="p-1.5 rounded-lg text-white/30 hover:text-white/70 hover:bg-surface-hover transition-colors"
            aria-label="Previous story"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            onClick={next}
            className="p-1.5 rounded-lg text-white/30 hover:text-white/70 hover:bg-surface-hover transition-colors"
            aria-label="Next story"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
