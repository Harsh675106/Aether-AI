import { describe, expect, it, vi, beforeEach } from "vitest";
import { publishVoiceMonitoringEvent, resetVoiceMonitoringState, subscribeVoiceMonitoringEvents } from "./monitoring";
import { AetherVoiceEngine } from "./engine";
import type { MonitoringEvent } from "@/types/monitoring";

describe("Voice Monitoring State Machine & Deduplication", () => {
  beforeEach(() => {
    resetVoiceMonitoringState();
    vi.restoreAllMocks();

    Object.defineProperty(window, "SpeechRecognition", {
      writable: true,
      value: vi.fn().mockImplementation(() => ({
        start: vi.fn(),
        stop: vi.fn(),
        abort: vi.fn(),
      })),
    });

    Object.defineProperty(window, "speechSynthesis", {
      writable: true,
      value: {
        speak: vi.fn(),
        cancel: vi.fn(),
        getVoices: vi.fn().mockReturnValue([]),
      },
    });

    Object.defineProperty(window, "SpeechSynthesisUtterance", {
      writable: true,
      value: vi.fn(),
    });
  });

  it("suppresses consecutive duplicate monitoring events in publishVoiceMonitoringEvent", () => {
    const events: MonitoringEvent[] = [];
    const unsubscribe = subscribeVoiceMonitoringEvents((evt) => events.push(evt));

    const eventPayload = {
      event_type: "voice_listening_started",
      subsystem: "voice",
      severity: "info" as const,
      category: "voice",
      title: "Listening Started",
      description: "Listening for wake word 'Aether'.",
      status: "running",
    };

    publishVoiceMonitoringEvent(eventPayload);
    publishVoiceMonitoringEvent(eventPayload);
    publishVoiceMonitoringEvent(eventPayload);

    expect(events).toHaveLength(1);
    expect(events[0].title).toBe("Listening Started");

    unsubscribe();
  });

  it("emits Listening Started once and does not duplicate on recognition session restarts", async () => {
    let sessionOnStartCallback: Function | null = null;

    Object.defineProperty(window, "SpeechRecognition", {
      writable: true,
      value: vi.fn().mockImplementation(() => ({
        start: vi.fn().mockImplementation(() => {
          if (sessionOnStartCallback) sessionOnStartCallback();
        }),
        stop: vi.fn(),
        abort: vi.fn(),
      })),
    });

    const mockRecognition = {
      createSession: vi.fn().mockImplementation((opts: any) => {
        sessionOnStartCallback = opts.onStart;
        return {
          start: () => opts.onStart?.(),
          stop: vi.fn(),
          abort: vi.fn(),
        };
      }),
      isSupported: () => true,
    };

    const engine = new AetherVoiceEngine({
      chatTransport: { sendMessage: vi.fn() },
    });

    // Replace internal provider with mock
    (engine as any).speechRecognition = mockRecognition;

    const publishedEvents: MonitoringEvent[] = [];
    const unsubscribe = subscribeVoiceMonitoringEvents((evt) => publishedEvents.push(evt));

    await engine.start();

    // Trigger onStart multiple times simulating Web Speech API restarts
    const triggerStart = sessionOnStartCallback as any;
    if (triggerStart) {
      triggerStart();
      triggerStart();
    }

    const listeningEvents = publishedEvents.filter((e) => e.title === "Listening Started");
    const micEvents = publishedEvents.filter((e) => e.title === "Microphone Activated");

    expect(listeningEvents).toHaveLength(1);
    expect(micEvents).toHaveLength(1);

    await engine.stop();

    const stoppedEvents = publishedEvents.filter((e) => e.title === "Listening Stopped");
    expect(stoppedEvents).toHaveLength(1);

    unsubscribe();
  });
});
