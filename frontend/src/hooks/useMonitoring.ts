import { useEffect, useMemo, useState } from "react";

import type { MonitoringEvent } from "@/types/monitoring";
import { subscribeVoiceMonitoringEvents } from "@/voice/monitoring";

const API_BASE = import.meta.env.VITE_AETHER_API_URL ?? "http://localhost:8001/api/v1";
const WS_URL = import.meta.env.VITE_AETHER_WS_URL ?? API_BASE.replace(/^http/, "ws").replace(/\/api\/v1$/, "/api/v1/monitoring/ws");

function isDuplicate(last: MonitoringEvent | undefined, incoming: MonitoringEvent): boolean {
  if (!last) return false;
  if (last.event_id === incoming.event_id) return true;
  return (
    last.event_type === incoming.event_type &&
    last.title === incoming.title &&
    last.status === incoming.status &&
    last.description === incoming.description
  );
}

function appendEvent(current: MonitoringEvent[], incoming: MonitoringEvent): MonitoringEvent[] {
  const last = current[current.length - 1];
  if (isDuplicate(last, incoming)) {
    return current;
  }
  const exists = current.some((item) => item.event_id === incoming.event_id);
  return exists ? current : [...current, incoming].slice(-80);
}

export function useMonitoring() {
  const [events, setEvents] = useState<MonitoringEvent[]>([]);

  useEffect(() => {
    const socket = new WebSocket(WS_URL);

    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === "snapshot") {
          const snapshotEvents = Array.isArray(payload.payload?.events) ? payload.payload.events : [];
          setEvents(snapshotEvents.slice(-80));
          return;
        }

        if (payload.type === "event") {
          const incomingEvent = payload.payload;
          if (incomingEvent?.event_id) {
            setEvents((current) => appendEvent(current, incomingEvent));
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
          : [
              {
                event_id: "monitoring-error",
                event_type: "connection",
                subsystem: "frontend",
                severity: "warning",
                category: "monitoring",
                title: "Monitoring unavailable",
                description: "Unable to connect to the live monitoring stream.",
                status: "error",
                timestamp: Date.now(),
              },
            ]
      );
    };

    return () => {
      socket.close();
    };
  }, []);

  useEffect(() => {
    return subscribeVoiceMonitoringEvents((event) => {
      setEvents((current) => appendEvent(current, event));
    });
  }, []);

  return useMemo(
    () => ({
      events,
    }),
    [events]
  );
}
