export type MonitoringEvent = {
  event_id: string;
  event_type: string;
  subsystem: string;
  severity: string;
  category: string;
  title: string;
  description: string;
  status: string;
  timestamp: number;
  correlation_id?: string | null;
  details?: Record<string, unknown>;
  duration_ms?: number | null;
};
