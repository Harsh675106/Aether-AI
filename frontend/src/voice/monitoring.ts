import type { MonitoringEvent } from "@/types/monitoring";

type VoiceEventListener = (event: MonitoringEvent) => void;

const listeners = new Set<VoiceEventListener>();
let lastPublishedSignature: string | null = null;

function createEventId() {
  return `voice-${crypto.randomUUID()}`;
}

export function resetVoiceMonitoringState() {
  lastPublishedSignature = null;
}

export function publishVoiceMonitoringEvent(
  event: Omit<MonitoringEvent, "event_id" | "timestamp"> &
    Partial<Pick<MonitoringEvent, "event_id" | "timestamp">>
): MonitoringEvent | null {
  const signature = `${event.event_type}:${event.title}:${event.status}:${event.description ?? ""}`;

  if (signature === lastPublishedSignature) {
    return null;
  }

  lastPublishedSignature = signature;

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

