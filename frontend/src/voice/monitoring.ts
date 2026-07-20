import type { MonitoringEvent } from "@/types/monitoring";

type VoiceEventListener = (event: MonitoringEvent) => void;

const listeners = new Set<VoiceEventListener>();

function createEventId() {
  return `voice-${crypto.randomUUID()}`;
}

export function publishVoiceMonitoringEvent(
  event: Omit<MonitoringEvent, "event_id" | "timestamp"> &
    Partial<Pick<MonitoringEvent, "event_id" | "timestamp">>
): MonitoringEvent {
  const payload: MonitoringEvent = {
    event_id: event.event_id ?? createEventId(),
    timestamp: event.timestamp ?? Date.now(),
    ...event,
  };

  for (const listener of listeners) {
    listener(payload);
  }

  return payload;
}

export function subscribeVoiceMonitoringEvents(listener: VoiceEventListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
