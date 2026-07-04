import type { LucideIcon } from "lucide-react";

export type SystemStatus = "online" | "degraded" | "offline" | "initializing";

export interface NavigationItem {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  future?: boolean;
}

export interface HealthMetric {
  label: string;
  value: string;
  status: SystemStatus;
  detail: string;
}

export interface ExecutionEvent {
  id: string;
  title: string;
  description: string;
  timestamp: string;
  type: "task" | "tool" | "log" | "plan" | "memory";
}

