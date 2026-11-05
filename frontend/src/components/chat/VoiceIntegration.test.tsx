import { render, screen, waitFor, act } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { ChatPanelAether } from "./ChatPanelAether";
import { MonitorPanel } from "../monitor/MonitorPanel";
import { publishVoiceMonitoringEvent } from "@/voice/monitoring";

describe("Voice Integration", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal(
      "MediaRecorder",
      class {
        static isTypeSupported() {
          return true;
        }
      }
    );
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: vi.fn() },
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

  it("renders microphone button in ChatPanelAether when supported", () => {
    render(<ChatPanelAether />);
    const micButton = screen.getByTitle(/Start Voice Engine/i);
    expect(micButton).toBeInTheDocument();
  });

  it("renders voice activity events with appropriate labels in MonitorPanel", async () => {
    render(<MonitorPanel />);

    await act(async () => {
      publishVoiceMonitoringEvent({
        event_type: "voice_started",
        subsystem: "voice",
        severity: "info",
        category: "voice",
        title: "Voice Engine Started",
        description: "Voice services are initializing.",
        status: "running",
        timestamp: Date.now(),
      });
    });

    await waitFor(() => {
      expect(screen.getByText("Voice Engine Started")).toBeInTheDocument();
      expect(screen.getByText("LISTENING")).toBeInTheDocument();
    });
  });
});
