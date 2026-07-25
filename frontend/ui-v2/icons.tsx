import React from "react";
import {
  LayoutGrid,
  Route,
  Network,
  GraduationCap,
  RotateCcw,
  History as HistoryIcon,
  Award,
  Users,
  Settings as SettingsIcon,
  Search,
  Menu,
  X,
  ChevronRight,
  CreditCard,
  Layers,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Gauge,
  CheckCircle,
  XCircle,
  Trophy,
  Sparkles,
  MessageCircle,
  BookOpen,
  Clock,
  Pencil,
  ChevronDown,
  Send,
  Star,
  AlertCircle,
  TrendingUp,
} from "lucide-react";

/**
 * ui-v2 icon set. The design handoff specifies a hand-drawn 24px-grid,
 * 1.6px-stroke, round-cap icon set (`icons.js`) for navigation/chrome only.
 * We don't have that custom SVG set in this codebase, so this wraps the
 * closest-meaning lucide-react icons (already a project dependency) at the
 * same stroke weight — swap the implementation here if a real hand-drawn
 * set is added later; call sites don't need to change.
 */
const REGISTRY = {
  dashboard: LayoutGrid,
  paths: Route,
  concepts: Network,
  examprep: GraduationCap,
  review: RotateCcw,
  history: HistoryIcon,
  rewards: Award,
  buddies: Users,
  settings: SettingsIcon,
  search: Search,
  menu: Menu,
  close: X,
  chevronRight: ChevronRight,
  billing: CreditCard,
  teachers: Users,
  students: GraduationCap,
  classes: Layers,
  play: Play,
  pause: Pause,
  skipBack: SkipBack,
  skipForward: SkipForward,
  volume: Volume2,
  volumeMute: VolumeX,
  fullscreen: Maximize,
  fullscreenExit: Minimize,
  speed: Gauge,
  checkCircle: CheckCircle,
  xCircle: XCircle,
  trophy: Trophy,
  sparkles: Sparkles,
  chat: MessageCircle,
  book: BookOpen,
  clock: Clock,
  pencil: Pencil,
  chevronDown: ChevronDown,
  send: Send,
  star: Star,
  alertCircle: AlertCircle,
  trendingUp: TrendingUp,
} as const;

export type IconName = keyof typeof REGISTRY;

export function Icon({
  name,
  size = 16,
  className,
}: {
  name: IconName;
  size?: number;
  className?: string;
}) {
  const Cmp = REGISTRY[name];
  return <Cmp size={size} strokeWidth={1.6} className={className} />;
}
