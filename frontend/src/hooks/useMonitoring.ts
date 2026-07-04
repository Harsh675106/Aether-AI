import { useEffect, useMemo, useState } from "react";

const API_BASE = import.meta.env.VITE_AETHER_API_URL ?? "http://localhost:8001/api/v1";
const WS_URL = (import.meta.env.VITE_AETHER_WS_URL ?? API_BASE.replace(/^http/, "ws").replace(/\/api\/v1$/, "/api/v1/monitoring/ws"));

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

  useEffect(() => {
    const socket = new WebSocket(WS_URL);

    socket.onopen = () => {
      setEvents((current) => current.length > 0 ? current : []);
    };

    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === "snapshot") {
          const snapshotEvents = Array.isArray(payload.payload?.events) ? payload.payload.events : [];
          setEvents(snapshotEvents);
          return;
        }

        if (payload.type === "event") {
          const incomingEvent = payload.payload;
          if (incomingEvent?.event_id) {
            setEvents((current) => {
              const exists = current.some((item) => item.event_id === incomingEvent.event_id);
              return exists ? current : [incomingEvent, ...current].slice(0, 80);
            });
          }
        }
      } catch {
        // Ignore malformed websocket payloads.
      }
    };

    socket.onerror = () => {
      setEvents((current) =>
        current.length > 0
          ? current
          : [{
              event_id: "monitoring-error",
              event_type: "connection",
              subsystem: "frontend",
              severity: "warning",
              category: "monitoring",
              title: "Monitoring unavailable",
              description: "Unable to connect to the live monitoring stream.",
              status: "error",
              timestamp: Date.now(),
            }]
      );
    };

    return () => {
      socket.close();
    };
  }, []);

  return useMemo(
    () => ({
      events,
    }),
    [events]
  );
}
