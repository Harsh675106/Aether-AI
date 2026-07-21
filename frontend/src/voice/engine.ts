import { browserSpeechRecognitionProvider, browserSpeechSynthesisProvider, RegexWakeWordDetector } from "./providers";
import { publishVoiceMonitoringEvent } from "./monitoring";
import { formatMarkdownForSpeech } from "./formatter";
import { detectLanguageFromText, MULTILINGUAL_CONFIGS, type LanguageConfig } from "./languages";
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
  private activeLanguage: LanguageConfig;
  private silenceTimer: number | null = null;

  constructor(options: VoiceEngineOptions) {
    this.chatTransport = options.chatTransport;
    this.settings = {
      wakeWord: options.wakeWord ?? DEFAULT_WAKE_WORD,
      language: options.language ?? "en-IN",
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
    this.activeLanguage =
      MULTILINGUAL_CONFIGS.find((c) => c.code.toLowerCase() === this.settings.language.toLowerCase()) ||
      MULTILINGUAL_CONFIGS[0];

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

  private updateDetectedLanguage(config: LanguageConfig, forceEvent = false): void {
    const previousLang = this.activeLanguage.name;
    const isChanged = this.activeLanguage.code !== config.code;
    this.activeLanguage = config;
    this.updateState({
      detectedLanguage: config.name,
      detectedLanguageCode: config.code,
    });
    if (isChanged || forceEvent) {
      this.publishEvent(
        "voice_language_detected",
        "Language Detected",
        `Voice language detected as ${config.name} (${config.code}).`,
        "info",
        "running",
        {
          language: config.name,
          code: config.code,
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
    this.clearSilenceTimer();
    this.speechSynthesis.stop();
    this.stopRecognition();
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
        this.publishEvent("voice_microphone_activated", "Microphone Activated", "Microphone hardware initialized and ready.", "info", "running", {
          session_id: this.sessionId,
          conversation_id: this.conversationId,
        });
        this.publishEvent("voice_waiting_for_wake_word", "Waiting for Wake Word", `Listening for wake word '${this.settings.wakeWord}'.`, "info", "running", {
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
        const err = message.toLowerCase();
        if (err.includes("aborted") || err.includes("no-speech")) {
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

  private async handleRecognitionResult(transcript: string, isFinal: boolean): Promise<void> {
    if (!this.running || this.stopRequested) {
      return;
    }

    const normalizedTranscript = normalizeTranscript(transcript);
    if (!normalizedTranscript) {
      return;
    }

    const detected = detectLanguageFromText(normalizedTranscript);
    this.updateDetectedLanguage(detected);

    this.updateState({ transcript: normalizedTranscript });
    this.clearSilenceTimer();

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
        this.publishEvent("voice_speech_recognized", "Speech Recognized", `Recognized speech: "${command}"`, "info", "running", {
          transcript: command,
          session_id: this.sessionId,
          conversation_id: this.conversationId,
        });
        await this.handleSpokenCommand(command);
      } else {
        this.updateState({ phase: "listening" });
        this.publishEvent("voice_listening", "Listening", "Capturing speech input after wake word.", "info", "running", {
          session_id: this.sessionId,
          conversation_id: this.conversationId,
        });
      }
      return;
    }

    if (isFinal) {
      this.publishEvent("voice_speech_recognized", "Speech Recognized", `Recognized speech: "${normalizedTranscript}"`, "info", "running", {
        transcript: normalizedTranscript,
        session_id: this.sessionId,
        conversation_id: this.conversationId,
      });
      await this.handleSpokenCommand(normalizedTranscript);
      return;
    }

    // Debounce end-of-speech detection for continuous speech pauses to prevent cutting off the user mid-sentence:
    if (this.state.active) {
      this.silenceTimer = window.setTimeout(() => {
        this.silenceTimer = null;
        if (this.running && this.state.active && this.state.transcript) {
          const currentTranscript = this.state.transcript;
          this.publishEvent("voice_speech_recognized", "Speech Recognized", `Recognized speech: "${currentTranscript}"`, "info", "running", {
            transcript: currentTranscript,
            session_id: this.sessionId,
            conversation_id: this.conversationId,
          });
          void this.handleSpokenCommand(currentTranscript);
        }
      }, this.settings.silenceTimeoutMs);
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

    // Perform fresh language detection for every voice interaction query
    const queryLanguage = detectLanguageFromText(cleanedTranscript);
    this.updateDetectedLanguage(queryLanguage, true);

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
      this.publishEvent("voice_speaking", "Speaking Response", "The response is being spoken aloud.", "info", "running", {
        response_length: finalResponse.length,
        spoken_length: spokenText.length,
        detected_language: queryLanguage.name,
        detected_language_code: queryLanguage.code,
        session_id: this.sessionId,
        conversation_id: this.conversationId,
      });

      await this.speechSynthesis.speak(spokenText, {
        language: queryLanguage.code,
        voiceName: this.settings.voiceName,
        rate: this.settings.speechRate,
        pitch: this.settings.speechPitch,
        volume: this.settings.speechVolume,
      });

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
    this.publishEvent("voice_returning_to_idle", "Returning to Idle", "Returning to idle wake word listening loop.", "info", "idle", {
      session_id: this.sessionId,
      conversation_id: this.conversationId,
    });
    await this.beginListening();
  }

  private pauseRecognition(): void {
    this.paused = true;
    this.clearSilenceTimer();
    this.stopRecognition();
  }

  private async handleError(message: string, details: Record<string, unknown>): Promise<void> {
    this.running = false;
    this.stopRequested = true;
    this.paused = true;
    this.clearSilenceTimer();
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
