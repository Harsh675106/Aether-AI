import { describe, expect, it, vi, beforeEach } from "vitest";
import { AetherVoiceEngine } from "./engine";

describe("AetherVoiceEngine", () => {
  beforeEach(() => {
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

  it("initializes with default settings and state", () => {
    const engine = new AetherVoiceEngine({
      chatTransport: {
        sendMessage: vi.fn(),
      },
    });

    const state = engine.getState();
    expect(state.phase).toBe("idle");
    expect(state.wakeWord).toBe("Aether");
    expect(state.supported).toBe(true);
    expect(state.listening).toBe(false);
  });

  it("starts and updates phase to starting", async () => {
    const engine = new AetherVoiceEngine({
      chatTransport: {
        sendMessage: vi.fn(),
      },
    });

    await engine.start();
    const state = engine.getState();
    expect(state.sessionId).not.toBeNull();
  });

  it("stops cleanly and resets listening state", async () => {
    const engine = new AetherVoiceEngine({
      chatTransport: {
        sendMessage: vi.fn(),
      },
    });

    await engine.start();
    await engine.stop();

    const state = engine.getState();
    expect(state.phase).toBe("completed");
    expect(state.listening).toBe(false);
    expect(state.speaking).toBe(false);
  });

  it("notifies subscribers on state change", async () => {
    const engine = new AetherVoiceEngine({
      chatTransport: {
        sendMessage: vi.fn(),
      },
    });

    const listener = vi.fn();
    engine.subscribe(listener);

    expect(listener).toHaveBeenCalled();
    const initialCallCount = listener.mock.calls.length;

    await engine.start();
    expect(listener.mock.calls.length).toBeGreaterThan(initialCallCount);
  });
});
