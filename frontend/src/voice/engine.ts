import { browserSpeechRecognitionProvider, browserSpeechSynthesisProvider } from "./providers";
import { publishVoiceMonitoringEvent } from "./monitoring";
import { formatMarkdownForSpeech } from "./formatter";
import type { VoiceEngineOptions, VoiceState } from "./types";

const DEFAULT_CONVERSATION_ID = "frontend-voice";
const STOP_PHRASES = ["stop listening", "go to sleep"];
const RESUME_LISTEN_DELAY_MS = 400;

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
  private activeLanguage: { name: string; code: string };
  private silenceTimer: number | null = null;
  private restartTimer: number | null = null;
  private recognitionGeneration = 0;

  // Centralized State Machine Flags
  private isMicActive = false;
  private isListeningModeActive = false;
  private isSpeakingActive = false;

  constructor(options: VoiceEngineOptions) {
    this.chatTransport = options.chatTransport;
    this.settings = {
      wakeWord: options.wakeWord ?? "",
      language: options.language ?? (typeof navigator !== "undefined" && navigator.language ? navigator.language : "en-US"),
      speechRate: options.speechRate ?? 1,
      speechPitch: options.speechPitch ?? 1,
      speechVolume: options.speechVolume ?? 1,
      voiceName: options.voiceName ?? null,
      continuousListening: options.continuousListening ?? true,
      autoRestart: options.autoRestart ?? true,
      silenceTimeoutMs: options.silenceTimeoutMs ?? 1400,
      conversationId: options.conversationId ?? DEFAULT_CONVERSATION_ID,
    };
    this.conversationId = this.settings.conversationId;
    this.activeLanguage = { name: this.settings.language, code: this.settings.language };

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
      detectedLanguage: this.activeLanguage.name,
      detectedLanguageCode: this.activeLanguage.code,
      updatedAt: Date.now(),
    };
  }

  private setMicrophoneActive(active: boolean): void {
    if (this.isMicActive === active) return;
    this.isMicActive = active;
    if (active) {
      this.publishEvent("voice_microphone_activated", "Microphone Activated", "Microphone hardware initialized and ready.", "info", "running", {
        session_id: this.sessionId,
        conversation_id: this.conversationId,
      });
    } else {
      this.publishEvent("voice_microphone_deactivated", "Microphone Deactivated", "Microphone hardware released.", "info", "stopped", {
        session_id: this.sessionId,
        conversation_id: this.conversationId,
      });
    }
  }

  private setListeningModeActive(active: boolean): void {
    if (this.isListeningModeActive === active) return;
    this.isListeningModeActive = active;
    if (active) {
      this.publishEvent("voice_listening_started", "Listening Started", "Listening for speech commands.", "info", "running", {
        session_id: this.sessionId,
        conversation_id: this.conversationId,
      });
    } else {
      this.publishEvent("voice_listening_stopped", "Listening Stopped", "Voice listening paused or ended.", "info", "stopped", {
        session_id: this.sessionId,
        conversation_id: this.conversationId,
      });
    }
  }

  private setSpeakingActive(active: boolean): void {
    if (this.isSpeakingActive === active) return;
    this.isSpeakingActive = active;
    if (active) {
      this.publishEvent("voice_speaking", "Speaking Response Started", "The response is being spoken aloud.", "info", "running", {
        session_id: this.sessionId,
        conversation_id: this.conversationId,
      });
    } else {
      this.publishEvent("voice_speaking_stopped", "Speaking Response Stopped", "Voice playback completed.", "info", "complete", {
        session_id: this.sessionId,
        conversation_id: this.conversationId,
      });
    }
  }

  private updateDetectedLanguage(code: string, forceEvent = false): void {
    const name = code;
    const isChanged = this.activeLanguage.code !== code;
    this.activeLanguage = { name, code };
    this.updateState({
      detectedLanguage: name,
      detectedLanguageCode: code,
    });
    if (isChanged || forceEvent) {
      this.publishEvent(
        "voice_language_detected",
        "Language Detected",
        `Voice language set to ${name} (${code}).`,
        "info",
        "running",
        {
          language: name,
          code,
          session_id: this.sessionId,
          conversation_id: this.conversationId,
        }
      );
    }
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
      session_id: this.sessionId,
      conversation_id: this.conversationId,
    });

    await this.beginListening();
  }

  async stop(): Promise<void> {
    this.running = false;
    this.stopRequested = true;
    this.paused = true;
    this.clearSilenceTimer();
    this.clearRestartTimer();
    this.recognitionGeneration += 1;
    this.speechSynthesis.stop();
    this.stopRecognition();

    this.setSpeakingActive(false);
    this.setListeningModeActive(false);
    this.setMicrophoneActive(false);

    this.updateState({
      phase: "completed",
      listening: false,
      active: false,
      speaking: false,
    });
    this.publishEvent("voice_stopped", "Voice Engine Stopped", "Voice engine interaction has been stopped.", "info", "stopped", {
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

    this.clearRestartTimer();
    this.stopRecognition();
    this.paused = false;

    // Update UI immediately while the browser speech recognition session initializes.
    this.updateState({
      phase: "listening",
      listening: true,
      active: false,
    });
    this.setMicrophoneActive(true);
    this.setListeningModeActive(true);

    const sessionGeneration = ++this.recognitionGeneration;
    const session = this.speechRecognition.createSession({
      language: this.settings.language,
      continuous: false,
      interimResults: true,
      maxAlternatives: 1,
      onStart: () => {
        if (this.recognitionGeneration !== sessionGeneration || !this.running || this.stopRequested || this.paused) {
          return;
        }

        this.updateState({
          phase: "listening",
          listening: true,
          active: false,
        });

        // Trigger transition events only on state changes (suppresses repeated logs on internal restarts)
        this.setMicrophoneActive(true);
        this.setListeningModeActive(true);
      },
      onEnd: () => {
        if (this.recognitionGeneration !== sessionGeneration || !this.running || this.stopRequested || this.paused) {
          this.recognitionSession = null;
          return;
        }

        this.recognitionSession = null;

        // If the user spoke a command and the speech session ended before the debounce timer,
        // execute the command immediately!
        if (this.state.transcript && this.state.transcript.trim()) {
          const pendingCommand = this.state.transcript.trim();
          this.clearSilenceTimer();
          void this.handleSpokenCommand(pendingCommand);
          return;
        }

        if (this.settings.autoRestart) {
          this.scheduleRestartListening();
        }
      },
      onResult: (transcript, isFinal) => {
        if (this.recognitionGeneration !== sessionGeneration || !this.running || this.stopRequested || this.paused) {
          return;
        }
        void this.handleRecognitionResult(transcript, isFinal);
      },
      onError: (message) => {
        if (this.recognitionGeneration !== sessionGeneration || !this.running || this.stopRequested || this.paused) {
          return;
        }

        const err = message.toLowerCase();
        if (err.includes("aborted")) {
          return;
        }

        if (err.includes("network") || err.includes("audio-capture") || err.includes("no-speech")) {
          this.scheduleRestartListening();
          return;
        }

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

  private clearSilenceTimer(): void {
    if (this.silenceTimer !== null) {
      window.clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
  }

  private clearRestartTimer(): void {
    if (this.restartTimer !== null) {
      window.clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
  }

  private scheduleRestartListening(): void {
    if (!this.running || this.stopRequested || this.paused) {
      return;
    }

    this.clearRestartTimer();
    this.restartTimer = window.setTimeout(() => {
      this.restartTimer = null;
      if (!this.running || this.stopRequested || this.paused) {
        return;
      }
      void this.beginListening();
    }, 350);
  }

  private async handleRecognitionResult(transcript: string, isFinal: boolean): Promise<void> {
    if (!this.running || this.stopRequested) {
      return;
    }

    const normalizedTranscript = normalizeTranscript(transcript);
    if (!normalizedTranscript) {
      return;
    }

    this.updateDetectedLanguage(this.settings.language);
    this.updateState({ transcript: normalizedTranscript });
    this.clearSilenceTimer();

    this.updateState({
      transcript: normalizedTranscript,
      phase: "listening",
      active: true,
      listening: true,
    });

    this.publishEvent("voice_recording_started", "Recording Command Started", "Capturing speech input.", "info", "running", {
      transcript: normalizedTranscript,
      session_id: this.sessionId,
      conversation_id: this.conversationId,
    });

    if (isFinal) {
      this.publishEvent("voice_speech_recognized", "Speech Recognized", `Recognized speech: "${normalizedTranscript}"`, "info", "running", {
        transcript: normalizedTranscript,
        session_id: this.sessionId,
        conversation_id: this.conversationId,
      });
      await this.handleSpokenCommand(normalizedTranscript);
      return;
    }

    // Debounce end-of-speech detection for continuous speech pauses
    this.silenceTimer = window.setTimeout(() => {
      this.silenceTimer = null;
      if (this.running && this.state.transcript) {
        const currentTranscript = this.state.transcript;
        this.publishEvent("voice_speech_recognized", "Speech Recognized", `Recognized speech: "${currentTranscript}"`, "info", "running", {
          transcript: currentTranscript,
          session_id: this.sessionId,
          conversation_id: this.conversationId,
        });
        void this.handleSpokenCommand(currentTranscript);
      }
    }, Math.min(this.settings.silenceTimeoutMs, 1000));
  }

  private async handleSpokenCommand(transcript: string): Promise<void> {
    const rawTranscript = normalizeTranscript(transcript);
    if (!rawTranscript) {
      return;
    }

    // Strip optional wake word prefix (e.g. "Aether, open youtube" or "Hey Aether, open google" -> "open youtube")
    const cleanedTranscript = rawTranscript
      .replace(/^(?:hey\s+)?aether[,:\s]*/i, "")
      .trim() || rawTranscript;

    if (isStopPhrase(cleanedTranscript)) {
      await this.stop();
      return;
    }

    // End listening mode while processing command
    this.setListeningModeActive(false);

    // Use configured language for every voice interaction query
    const queryLanguage = { name: this.settings.language, code: this.settings.language } as any;
    this.updateDetectedLanguage(queryLanguage.code, true);

    this.streamedResponse = "";
    this.updateState({
      phase: "processing_speech",
      transcript: cleanedTranscript,
      response: "",
      listening: false,
      active: true,
      speaking: false,
      detectedLanguage: queryLanguage.name,
      detectedLanguageCode: queryLanguage.code,
    });
    this.publishEvent("voice_processing_speech", "Processing Speech", "Speech input is being prepared for the chatbot.", "info", "running", {
      transcript: cleanedTranscript,
      detected_language: queryLanguage.name,
      detected_language_code: queryLanguage.code,
      session_id: this.sessionId,
      conversation_id: this.conversationId,
    });

    this.pauseRecognition();

    try {
      this.updateState({ phase: "sending_to_chatbot" });
      this.publishEvent("voice_sending_to_chatbot", "Sending to Chatbot", "User speech is being routed through the AI chat pipeline.", "info", "running", {
        transcript: cleanedTranscript,
        detected_language: queryLanguage.name,
        detected_language_code: queryLanguage.code,
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
              detected_language: queryLanguage.name,
              detected_language_code: queryLanguage.code,
            });
          }

          this.streamedResponse = accumulated;
          this.updateState({ response: accumulated });
        },
      });

      const finalResponse = response ?? this.streamedResponse;
      if (!finalResponse.trim()) {
        this.updateState({ phase: "completed", listening: false, active: false, speaking: false });
        this.publishEvent("voice_completed", "Playback Completed", "No speech response was generated.", "info", "complete", {
          session_id: this.sessionId,
          conversation_id: this.conversationId,
          detected_language: queryLanguage.name,
          detected_language_code: queryLanguage.code,
        });
        if (this.running && this.settings.autoRestart && this.settings.continuousListening) {
          await this.restartListeningLoop();
        }
        return;
      }

      const spokenText = formatMarkdownForSpeech(finalResponse);

      this.updateState({
        phase: "converting_to_speech",
        response: finalResponse,
        speaking: false,
        detectedLanguage: queryLanguage.name,
        detectedLanguageCode: queryLanguage.code,
      });
      this.publishEvent("voice_converting_to_speech", "Converting Text to Speech", "Preparing the AI response for playback.", "info", "running", {
        response_length: finalResponse.length,
        spoken_length: spokenText.length,
        detected_language: queryLanguage.name,
        detected_language_code: queryLanguage.code,
        session_id: this.sessionId,
        conversation_id: this.conversationId,
      });

      this.updateState({ phase: "speaking", speaking: true });
      this.setSpeakingActive(true);

      await this.speechSynthesis.speak(spokenText, {
        language: queryLanguage.code,
        voiceName: this.settings.voiceName,
        rate: this.settings.speechRate,
        pitch: this.settings.speechPitch,
        volume: this.settings.speechVolume,
      });

      this.setSpeakingActive(false);
      this.updateState({ phase: "completed", listening: false, active: false, speaking: false });
      this.publishEvent("voice_completed", "Playback Completed", "Voice response playback finished.", "info", "complete", {
        session_id: this.sessionId,
        conversation_id: this.conversationId,
        detected_language: queryLanguage.name,
        detected_language_code: queryLanguage.code,
      });

      if (this.running && this.settings.autoRestart && this.settings.continuousListening) {
        await this.restartListeningLoop();
      }
    } catch (error) {
      this.setSpeakingActive(false);
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
      phase: "listening",
      transcript: "",
      response: "",
      listening: true,
      active: false,
      speaking: false,
    });

    await new Promise<void>((resolve) => {
      window.setTimeout(resolve, RESUME_LISTEN_DELAY_MS);
    });

    if (!this.running || this.stopRequested) {
      return;
    }

    await this.beginListening();
  }

  private pauseRecognition(): void {
    this.paused = true;
    this.clearSilenceTimer();
    this.clearRestartTimer();
    this.recognitionGeneration += 1;
    this.stopRecognition();
  }

  private async handleError(message: string, details: Record<string, unknown>): Promise<void> {
    this.running = false;
    this.stopRequested = true;
    this.paused = true;
    this.clearSilenceTimer();
    this.speechSynthesis.stop();
    this.stopRecognition();

    this.setSpeakingActive(false);
    this.setListeningModeActive(false);
    this.setMicrophoneActive(false);

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

