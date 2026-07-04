import { useEffect, useMemo, useState } from "react";

const WS_URL = import.meta.env.VITE_AETHER_WS_URL ?? "ws://localhost:8001/api/v1/monitoring/ws";

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

export function useMonitoring() {
  const [events, setEvents] = useState<MonitoringEvent[]>([]);
  const [stats, setStats] = useState<{ events: number; errors: number; warnings: number; successes: number }>({
    events: 0,
    errors: 0,
    warnings: 0,
    successes: 0,
  });

  useEffect(() => {
    const socket = new WebSocket(WS_URL);

    socket.onmessage = (event) => {
      const payload = JSON.parse(event.data);
      if (payload.type === "snapshot") {
        const snapshotEvents = payload.payload.events ?? [];
        setEvents(snapshotEvents);
        setStats(payload.payload.stats ?? { events: 0, errors: 0, warnings: 0, successes: 0 });
        return;
      }

      if (payload.type === "event") {
        setEvents((current) => [payload.payload, ...current].slice(0, 80));
        setStats((current) => ({
          events: current.events + 1,
          errors: current.errors + (payload.payload.severity === "error" || payload.payload.severity === "critical" ? 1 : 0),
          warnings: current.warnings + (payload.payload.severity === "warning" ? 1 : 0),
          successes: current.successes + (payload.payload.severity === "success" || payload.payload.severity === "info" ? 1 : 0),
        }));
      }
    };

    return () => {
      socket.close();
    };
  }, []);

  return useMemo(
    () => ({
      events,
      stats,
    }),
    [events, stats]
  );
}
