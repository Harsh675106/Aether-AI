import type { MonitoringEvent } from "@/types/monitoring";

export type VoicePhase =
  | "idle"
  | "starting"
  | "listening"
  | "processing_speech"
  | "sending_to_chatbot"
  | "receiving_ai_response"
  | "converting_to_speech"
  | "speaking"
  | "completed"
  | "error";

export type VoiceState = {
  phase: VoicePhase;
  sessionId: string | null;
  correlationId: string | null;
  wakeWord: string;
  transcript: string;
  response: string;
  supported: boolean;
  error: string | null;
  listening: boolean;
  active: boolean;
  speaking: boolean;
  detectedLanguage?: string;
  detectedLanguageCode?: string;
  updatedAt: number;
};

export type VoiceChatTransport = {
  sendMessage: (
    content: string,
    options?: {
      conversationId?: string;
      onDelta?: (delta: string, accumulated: string) => void;
    }
  ) => Promise<string | null>;
};

export type VoiceEngineOptions = {
  chatTransport: VoiceChatTransport;
  wakeWord?: string;
  language?: string;
  speechRate?: number;
  speechPitch?: number;
  speechVolume?: number;
  voiceName?: string | null;
  continuousListening?: boolean;
  autoRestart?: boolean;
  silenceTimeoutMs?: number;
  conversationId?: string;
};

export type VoiceMonitoringDetails = MonitoringEvent;
