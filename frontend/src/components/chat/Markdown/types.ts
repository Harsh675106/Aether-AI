import React from "react";
import {
  Sparkles,
  Lightbulb,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Star,
  Pin,
  ArrowRight,
} from "lucide-react";

// ==========================================
// TYPES
// ==========================================

export type MarkdownMessageProps = {
  content: string;
};

export type CalloutConfig = {
  icon: React.ComponentType<{ className?: string }>;
  bg: string;
  border: string;
  text: string;
  accent: string;
  emoji: string;
};

// ==========================================
// CALLOUT CONFIGURATION
// ==========================================

export const CALLOUT_MAP: Record<string, CalloutConfig> = {
  summary: {
  icon: Sparkles,
  bg: "bg-blue-500/10",
  border: "border-blue-400/40",
  text: "text-blue-100",
  accent: "text-blue-300",
  emoji: "⚡",
},

overview: {
  icon: Sparkles,
  bg: "bg-blue-500/10",
  border: "border-blue-400/40",
  text: "text-blue-100",
  accent: "text-blue-300",
  emoji: "⚡",
},

  tips: {
    icon: Lightbulb,
    bg: "bg-emerald-500/5",
    border: "border-emerald-500/20",
    text: "text-emerald-200",
    accent: "text-emerald-400",
    emoji: "💡",
  },

  warning: {
    icon: AlertTriangle,
    bg: "bg-rose-500/5",
    border: "border-rose-500/20",
    text: "text-rose-200",
    accent: "text-rose-400",
    emoji: "⚠",
  },

  important: {
    icon: AlertTriangle,
    bg: "bg-rose-500/5",
    border: "border-rose-500/20",
    text: "text-rose-200",
    accent: "text-rose-400",
    emoji: "⚠",
  },

  pros: {
    icon: CheckCircle,
    bg: "bg-teal-500/5",
    border: "border-teal-500/20",
    text: "text-teal-200",
    accent: "text-teal-400",
    emoji: "✅",
  },

  cons: {
    icon: XCircle,
    bg: "bg-red-500/5",
    border: "border-red-500/20",
    text: "text-red-200",
    accent: "text-red-400",
    emoji: "❌",
  },

  recommendation: {
    icon: Star,
    bg: "bg-indigo-500/5",
    border: "border-indigo-500/20",
    text: "text-indigo-200",
    accent: "text-indigo-400",
    emoji: "⭐",
  },

  bestfor: {
    icon: Star,
    bg: "bg-indigo-500/5",
    border: "border-indigo-500/20",
    text: "text-indigo-200",
    accent: "text-indigo-400",
    emoji: "⭐",
  },

  keypoints: {
    icon: Pin,
    bg: "bg-cyan-500/5",
    border: "border-cyan-500/20",
    text: "text-cyan-200",
    accent: "text-cyan-400",
    emoji: "📌",
  },

  notes: {
    icon: Pin,
    bg: "bg-cyan-500/5",
    border: "border-cyan-500/20",
    text: "text-cyan-200",
    accent: "text-cyan-400",
    emoji: "📌",
  },

  nextsteps: {
    icon: ArrowRight,
    bg: "bg-purple-500/5",
    border: "border-purple-500/20",
    text: "text-purple-200",
    accent: "text-purple-400",
    emoji: "➡",
  },
};

// Aliases for common markdown callout prefixes
CALLOUT_MAP["note"] = CALLOUT_MAP["notes"];
CALLOUT_MAP["tip"] = CALLOUT_MAP["tips"];
CALLOUT_MAP["warn"] = CALLOUT_MAP["warning"];
CALLOUT_MAP["caution"] = CALLOUT_MAP["warning"];
CALLOUT_MAP["info"] = CALLOUT_MAP["overview"];