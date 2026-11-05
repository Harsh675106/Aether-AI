import { beforeEach, describe, expect, it, vi } from "vitest";

import { AetherVoiceEngine } from "./engine";

class MockMediaRecorder {
  static isTypeSupported = vi.fn(() => true);
  static latestInstance: MockMediaRecorder | null = null;
  state: RecordingState = "inactive";
  mimeType = "audio/webm;codecs=opus";
  ondataavailable: ((event: BlobEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onstop: (() => void) | null = null;

  constructor(_stream: MediaStream, _options?: MediaRecorderOptions) {
    MockMediaRecorder.latestInstance = this;
  }

  start() {
    this.state = "recording";
  }

  emitAudio() {
    this.ondataavailable?.({
      data: new Blob([new Uint8Array(200)], { type: "audio/webm" }),
    } as BlobEvent);
  }

  stop() {
    this.state = "inactive";
    this.emitAudio();
    this.onstop?.();
  }
}

const response = (body: unknown, status = 200) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }) as Response;

describe("AetherVoiceEngine", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal("MediaRecorder", MockMediaRecorder);
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith("/voice/health")) {
          return response({ status: "ready" });
        }
        if (url.endsWith("/voice/transcribe")) {
          return response({ text: "explain machine learning", language: "en" });
        }
        if (url.includes("/voice/execute?")) {
          return response({ handled: false, message: "", action_type: null });
        }
        return response({});
      })
    );
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: vi.fn(async () => ({
          getTracks: () => [{ stop: vi.fn() }],
        })),
      },
    });
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: {
        speak: vi.fn((utterance: SpeechSynthesisUtterance) => {
          queueMicrotask(() => utterance.onend?.(new Event("end") as SpeechSynthesisEvent));
        }),
        cancel: vi.fn(),
        getVoices: vi.fn().mockReturnValue([]),
      },
    });
    Object.defineProperty(window, "SpeechSynthesisUtterance", {
      configurable: true,
      value: vi.fn().mockImplementation((text: string) => ({ text })),
    });
  });

  it("records locally, transcribes through FastAPI, and sends the transcript to chat", async () => {
    const sendMessage = vi.fn(async () => "Machine learning is a type of AI.");
    const engine = new AetherVoiceEngine({
      chatTransport: { sendMessage },
    });

    await engine.start();
    await vi.waitFor(() => expect(engine.getState().listening).toBe(true));
    MockMediaRecorder.latestInstance?.emitAudio();
    await vi.waitFor(
      () => expect(engine.getState().transcript).toBe("explain machine learning"),
      { timeout: 4000 }
    );
    await engine.toggle();

    await vi.waitFor(() =>
      expect(sendMessage).toHaveBeenCalledWith(
        "explain machine learning",
        expect.objectContaining({ source: "voice" })
      )
    );
    await engine.stop();
  });

  it("reports microphone permission denial and releases the engine", async () => {
    vi.spyOn(navigator.mediaDevices, "getUserMedia").mockRejectedValue(
      new DOMException("Permission denied", "NotAllowedError")
    );
    const engine = new AetherVoiceEngine({
      chatTransport: { sendMessage: vi.fn() },
    });

    await engine.start();

    await vi.waitFor(() => expect(engine.getState().phase).toBe("error"));
    expect(engine.getState().error).toContain("Microphone access is blocked");
  });

  it("cancels a recording without submitting audio", async () => {
    const engine = new AetherVoiceEngine({
      chatTransport: { sendMessage: vi.fn() },
    });

    await engine.start();
    await vi.waitFor(() => expect(engine.getState().listening).toBe(true));
    await engine.stop();

    expect(engine.getState().phase).toBe("completed");
    expect(fetch).not.toHaveBeenCalledWith(
      expect.stringContaining("/voice/transcribe"),
      expect.anything()
    );
  });

  it("initializes with local recording support and an idle state", () => {
    const engine = new AetherVoiceEngine({
      chatTransport: { sendMessage: vi.fn() },
    });

    expect(engine.getState().phase).toBe("idle");
    expect(engine.getState().supported).toBe(true);
    expect(engine.getState().listening).toBe(false);
  });
});
