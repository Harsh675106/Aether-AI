import { browserSpeechRecognitionProvider, browserSpeechSynthesisProvider, RegexWakeWordDetector } from "./providers";
import { publishVoiceMonitoringEvent } from "./monitoring";
import type { VoiceEngineOptions, VoiceState } from "./types";

const DEFAULT_WAKE_WORD = "Aether";
const DEFAULT_CONVERSATION_ID = "frontend-voice";
const STOP_PHRASES = ["stop listening", "go to sleep", "cancel voice", "cancel"];

function createId() {
  return crypto.randomUUID();
}

function normalizeTranscript(transcript: string) {
  return transcript.replace(/\s+/g, " " ).trim();
}

function isStopPhrase(transcript: string) {
  const normalized = transcript.toLowerCase();
  return STOP_PHRASES.some((phrase) => normalized === phrase || normalized.startsWith(`${phrase} `));
}

export class AetherVoiceEngine {
  private readonly wakeWordDetector = new RegexWakeWordDetector();
  private readonly speechRecognition = browserSpeechRecognitionProvider;
  private readonly speechSynthesis = browserSpeechSynthesisProvider;
  private readonly listeners = new Set<(state: VoiceState) => void>();
  private readonly settings: Required<Omit<VoiceEngineOptions, "chatTransport">>;
  private chatTransport: VoiceEngineOptions["chatTransport"];
  private state: VoiceState;
  private recognitionSession: { start: () => void; stop: () => void; abort: () => void } | null = null;
  private running = false;
  private paused = false;
  private sessionId: string | null = null;
  private conversationId: string;
  private streamedResponse = "";
  private stopRequested = false;

  constructor(options: VoiceEngineOptions) {
    this.chatTransport = options.chatTransport;
    this.settings = {
      wakeWord: options.wakeWord ?? DEFAULT_WAKE_WORD,
      language: options.language ?? "en-US",
      speechRate: options.speechRate ?? 1,
      speechPitch: options.speechPitch ?? 1,
      speechVolume: options.speechVolume ?? 1,
      voiceName: options.voiceName ?? null,
      continuousListening: options.continuousListening ?? true,
      autoRestart: options.autoRestart ?? true,
      silenceTimeoutMs: options.silenceTimeoutMs ?? 1200,
      conversationId: options.conversationId ?? DEFAULT_CONVERSATION_ID,
    };
    this.conversationId = this.settings.conversationId;
    this.state = {
      phase: "idle",
      sessionId: null,
      correlationId: null,
      wakeWord: this.settings.wakeWord,
      transcript: "",
      response: "",
      supported: this.isSupported(),
      error: null,
      listening: false,
      active: false,
      speaking: false,
      updatedAt: Date.now(),
    };
  }

  updateChatTransport(chatTransport: VoiceEngineOptions["chatTransport"]): void {
    this.chatTransport = chatTransport;
  }

  subscribe(listener: (state: VoiceState) => void): () => void {
    this.listeners.add(listener);
    listener({ ...this.state });
    return () => {
      this.listeners.delete(listener);
    };
  }

  getState(): VoiceState {
    return { ...this.state };
  }

  isSupported(): boolean {
    return this.speechRecognition.isSupported() && this.speechSynthesis.isSupported();
  }

  async start(): Promise<void> {
    if (this.running) {
      return;
    }

    if (!this.isSupported()) {
      this.updateState({
        phase: "error",
        supported: false,
        error: "Speech recognition or synthesis is not supported in this browser.",
        listening: false,
        active: false,
        speaking: false,
      });
      this.publishEvent("voice_error", "Voice Error", "Speech features are not supported in this environment.", "error", "error", {
        reason: "unsupported",
      });
      return;
    }

    this.running = true;
    this.stopRequested = false;
    this.paused = false;
    this.streamedResponse = "";
    this.sessionId = createId();
    this.conversationId = `${this.settings.conversationId}-${this.sessionId}`;

    this.updateState({
      phase: "starting",
      sessionId: this.sessionId,
      correlationId: this.conversationId,
      wakeWord: this.settings.wakeWord,
      transcript: "",
      response: "",
      supported: true,
      error: null,
      listening: false,
      active: false,
      speaking: false,
    });
    this.publishEvent("voice_started", "Voice Engine Started", "Voice services are initializing.", "info", "running", {
      wake_word: this.settings.wakeWord,
      session_id: this.sessionId,
      conversation_id: this.conversationId,
    });

    await this.beginListening();
  }

  async stop(): Promise<void> {
    this.running = false;
    this.stopRequested = true;
    this.paused = true;
    this.speechSynthesis.stop();
    this.stopRecognition();
    this.updateState({
      phase: "completed",
      listening: false,
      active: false,
      speaking: false,
    });
    this.publishEvent("voice_completed", "Completed", "Voice interaction cycle completed successfully.", "info", "complete", {
      session_id: this.sessionId,
      conversation_id: this.conversationId,
    });
  }

  async toggle(): Promise<void> {
    if (this.running) {
      await this.stop();
      return;
    }

    await this.start();
  }

  private async beginListening(): Promise<void> {
    if (!this.running || this.stopRequested) {
      return;
    }

    this.stopRecognition();

    const session = this.speechRecognition.createSession({
      language: this.settings.language,
      continuous: this.settings.continuousListening,
      interimResults: true,
      maxAlternatives: 1,
      onStart: () => {
        this.updateState({
          phase: "waiting_for_wake_word",
          listening: true,
          active: false,
        });
        this.publishEvent("voice_waiting_for_wake_word", "Waiting for Wake Word", `Listening for '${this.settings.wakeWord}'.`, "info", "running", {
          wake_word: this.settings.wakeWord,
          session_id: this.sessionId,
          conversation_id: this.conversationId,
        });
      },
      onEnd: () => {
        this.recognitionSession = null;
        if (this.paused || this.stopRequested) {
          return;
        }

        if (this.running && this.settings.autoRestart) {
          window.setTimeout(() => {
            void this.beginListening();
          }, 250);
        }
      },
      onResult: (transcript, isFinal) => {
        void this.handleRecognitionResult(transcript, isFinal);
      },
      onError: (message) => {
        void this.handleError(message, { reason: "speech_recognition" });
      },
    });

    if (!session) {
      await this.handleError("Unable to start speech recognition.", { reason: "session_unavailable" });
      return;
    }

    this.recognitionSession = session;

    try {
      session.start();
    } catch (error) {
      await this.handleError(error instanceof Error ? error.message : "Failed to start voice listening.", {
        reason: "start_failure",
      });
    }
  }

  private stopRecognition(): void {
    if (!this.recognitionSession) {
      return;
    }

    try {
      this.recognitionSession.stop();
    } catch {
      this.recognitionSession.abort();
    }

    this.recognitionSession = null;
  }

  private async handleRecognitionResult(transcript: string, isFinal: boolean): Promise<void> {
    if (!this.running || this.stopRequested) {
      return;
    }

    const normalizedTranscript = normalizeTranscript(transcript);
    if (!normalizedTranscript) {
      return;
    }

    this.updateState({ transcript: normalizedTranscript });

    if (!this.state.active) {
      if (!this.wakeWordDetector.matches(normalizedTranscript, this.settings.wakeWord)) {
        return;
      }

      const command = this.wakeWordDetector.strip(normalizedTranscript, this.settings.wakeWord);
      this.updateState({
        phase: "wake_word_detected",
        active: true,
        listening: true,
      });
      this.publishEvent("voice_wake_word_detected", "Wake Word Detected", `"${this.settings.wakeWord}" activated voice mode.`, "info", "running", {
        transcript: normalizedTranscript,
        cleaned_transcript: command,
        session_id: this.sessionId,
        conversation_id: this.conversationId,
      });

      if (command) {
        await this.handleSpokenCommand(command);
      } else {
        this.updateState({ phase: "listening" });
        this.publishEvent("voice_listening", "Listening", "Capturing speech input.", "info", "running", {
          session_id: this.sessionId,
          conversation_id: this.conversationId,
        });
      }
      return;
    }

    if (isFinal) {
      await this.handleSpokenCommand(normalizedTranscript);
    }
  }

  private async handleSpokenCommand(transcript: string): Promise<void> {
    const cleanedTranscript = normalizeTranscript(transcript);
    if (!cleanedTranscript) {
      return;
    }

    if (isStopPhrase(cleanedTranscript)) {
      await this.stop();
      return;
    }

    this.streamedResponse = "";
    this.updateState({
      phase: "processing_speech",
      transcript: cleanedTranscript,
      response: "",
      listening: false,
      active: true,
      speaking: false,
    });
    this.publishEvent("voice_processing_speech", "Processing Speech", "Speech input is being prepared for the chatbot.", "info", "running", {
      transcript: cleanedTranscript,
      session_id: this.sessionId,
      conversation_id: this.conversationId,
    });

    this.pauseRecognition();

    try {
      this.updateState({ phase: "sending_to_chatbot" });
      this.publishEvent("voice_sending_to_chatbot", "Sending to Chatbot", "User speech is being routed through the current AI chat pipeline.", "info", "running", {
        transcript: cleanedTranscript,
        session_id: this.sessionId,
        conversation_id: this.conversationId,
      });

      const response = await this.chatTransport.sendMessage(cleanedTranscript, {
        conversationId: this.conversationId,
        onDelta: (delta, accumulated) => {
          if (delta && !this.state.phase.startsWith("receiving")) {
            this.updateState({ phase: "receiving_ai_response" });
            this.publishEvent("voice_receiving_ai_response", "Receiving AI Response", "The chatbot is streaming a spoken answer.", "info", "running", {
              session_id: this.sessionId,
              conversation_id: this.conversationId,
            });
          }

          this.streamedResponse = accumulated;
          this.updateState({ response: accumulated });
        },
      });

      const finalResponse = response ?? this.streamedResponse;
      if (!finalResponse.trim()) {
        this.updateState({ phase: "completed", listening: false, active: false, speaking: false });
        this.publishEvent("voice_completed", "Completed", "No speech response was generated.", "info", "complete", {
          session_id: this.sessionId,
          conversation_id: this.conversationId,
        });
        if (this.running && this.settings.autoRestart && this.settings.continuousListening) {
          await this.restartListeningLoop();
        }
        return;
      }

      this.updateState({
        phase: "converting_to_speech",
        response: finalResponse,
        speaking: false,
      });
      this.publishEvent("voice_converting_to_speech", "Converting to Speech", "Preparing the AI response for playback.", "info", "running", {
        response_length: finalResponse.length,
        session_id: this.sessionId,
        conversation_id: this.conversationId,
      });

      this.updateState({ phase: "speaking", speaking: true });
      this.publishEvent("voice_speaking", "Speaking", "The response is being spoken aloud.", "info", "running", {
        response_length: finalResponse.length,
        session_id: this.sessionId,
        conversation_id: this.conversationId,
      });

      await this.speechSynthesis.speak(finalResponse, {
        language: this.settings.language,
        voiceName: this.settings.voiceName,
        rate: this.settings.speechRate,
        pitch: this.settings.speechPitch,
        volume: this.settings.speechVolume,
      });

      this.updateState({ phase: "completed", listening: false, active: false, speaking: false });
      this.publishEvent("voice_completed", "Completed", "Voice interaction cycle completed successfully.", "info", "complete", {
        session_id: this.sessionId,
        conversation_id: this.conversationId,
      });

      if (this.running && this.settings.autoRestart && this.settings.continuousListening) {
        await this.restartListeningLoop();
      }
    } catch (error) {
      await this.handleError(error instanceof Error ? error.message : "Voice processing failed.", {
        reason: "conversation_flow",
      });
    }
  }

  private async restartListeningLoop(): Promise<void> {
    if (!this.running || this.stopRequested) {
      return;
    }

    this.paused = false;
    this.updateState({
      phase: "waiting_for_wake_word",
      transcript: "",
      response: "",
      listening: true,
      active: false,
      speaking: false,
    });
    await this.beginListening();
  }

  private pauseRecognition(): void {
    this.paused = true;
    this.stopRecognition();
  }

  private async handleError(message: string, details: Record<string, unknown>): Promise<void> {
    this.running = false;
    this.stopRequested = true;
    this.paused = true;
    this.speechSynthesis.stop();
    this.stopRecognition();
    this.updateState({
      phase: "error",
      listening: false,
      active: false,
      speaking: false,
      error: message,
    });
    this.publishEvent("voice_error", "Voice Error", message, "error", "error", {
      session_id: this.sessionId,
      conversation_id: this.conversationId,
      ...details,
    });
  }

  private publishEvent(
    eventType: string,
    title: string,
    description: string,
    severity: "info" | "warning" | "error",
    status: string,
    details: Record<string, unknown>
  ): void {
    publishVoiceMonitoringEvent({
      event_id: `voice-${createId()}`,
      event_type: eventType,
      subsystem: "voice",
      severity,
      category: "voice",
      title,
      description,
      status,
      timestamp: Date.now(),
      correlation_id: this.conversationId,
      details,
    });
  }

  private updateState(partialState: Partial<VoiceState>): void {
    this.state = {
      ...this.state,
      ...partialState,
      updatedAt: Date.now(),
    };

    for (const listener of this.listeners) {
      listener({ ...this.state });
    }
  }
}
