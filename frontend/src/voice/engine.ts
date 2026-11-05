import {
  executeLocalVoiceCommand,
  localWhisperSpeechRecognitionProvider,
  browserSpeechSynthesisProvider,
} from "./providers";
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
  private readonly speechRecognition = localWhisperSpeechRecognitionProvider;
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
  private consecutiveNoSpeechErrors = 0;

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
    // Recognition is the required part of voice commands. Do not disable it
    // simply because a browser/webview has no speech-synthesis implementation.
    return this.speechRecognition.isSupported();
  }

  async start(): Promise<void> {
    if (this.running) {
      return;
    }

    if (!this.isSupported()) {
      this.updateState({
        phase: "error",
        supported: false,
        error: "Local voice recording is unavailable. Check microphone access and WebView2 support.",
        listening: false,
        active: false,
        speaking: false,
      });
      this.publishEvent("voice_error", "Voice Error", "Speech recognition is not supported in this environment.", "error", "error", {
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
      if (this.state.phase === "listening") {
        this.finishRecording();
      } else {
        await this.stop();
      }
      return;
    }

    await this.start();
  }

  finishRecording(): void {
    if (!this.running || !this.recognitionSession || this.state.phase !== "listening") {
      return;
    }

    this.clearSilenceTimer();
    this.updateState({ phase: "processing_speech", listening: false, active: true });
    this.setListeningModeActive(false);
    this.recognitionSession.stop();
  }

  private async beginListening(): Promise<void> {
    if (!this.running || this.stopRequested) {
      return;
    }

    this.clearRestartTimer();
    this.stopRecognition();
    this.paused = false;

    // Keep the UI in "starting" until the recorder confirms that capture began.
    this.updateState({
      phase: "starting",
      listening: false,
      active: false,
    });

    const sessionGeneration = ++this.recognitionGeneration;
    const session = this.speechRecognition.createSession({
      onStart: () => {
        if (this.recognitionGeneration !== sessionGeneration || !this.running || this.stopRequested || this.paused) {
          return;
        }

        this.updateState({
          phase: "listening",
          listening: true,
          active: false,
          error: null,
        });

        this.setMicrophoneActive(true);
        this.setListeningModeActive(true);
      },
      onAudioStart: () => {
        if (this.recognitionGeneration !== sessionGeneration || !this.running || this.stopRequested) return;
        this.publishEvent("voice_audio_start", "Microphone Audio Capturing", "Microphone audio track is actively delivering audio stream.", "info", "running", {
          session_id: this.sessionId,
          conversation_id: this.conversationId,
        });
      },
      onEnd: () => {
        if (this.recognitionGeneration !== sessionGeneration || !this.running || this.stopRequested || this.paused) {
          this.recognitionSession = null;
          return;
        }

        this.recognitionSession = null;

        if (this.settings.autoRestart) {
          this.scheduleRestartListening();
        }
      },
      onUnderstanding: () => {
        if (this.recognitionGeneration !== sessionGeneration || !this.running || this.stopRequested) {
          return;
        }
        this.updateState({ phase: "understanding", listening: false, active: true });
      },
      onInterimResult: (transcript, metadata) => {
        if (
          this.recognitionGeneration !== sessionGeneration ||
          !this.running ||
          this.stopRequested ||
          this.paused ||
          this.state.phase !== "listening"
        ) {
          return;
        }

        const normalizedTranscript = normalizeTranscript(transcript);
        if (!normalizedTranscript) {
          return;
        }
        this.updateDetectedLanguage(metadata?.language || this.settings.language);
        this.updateState({ transcript: normalizedTranscript });
      },
      onResult: (transcript, isFinal, metadata) => {
        if (this.recognitionGeneration !== sessionGeneration || !this.running || this.stopRequested || this.paused) {
          return;
        }
        this.consecutiveNoSpeechErrors = 0;
        void this.handleRecognitionResult(transcript, isFinal, metadata?.language);
      },
      onError: (message, rawErrorType) => {
        if (this.recognitionGeneration !== sessionGeneration || !this.running || this.stopRequested || this.paused) {
          return;
        }

        const err = message.toLowerCase();
        if (err.includes("aborted")) {
          return;
        }

        const isNoSpeech = err.includes("no speech") || err.includes("no-speech") || rawErrorType === "no-speech";

        if (isNoSpeech) {
          this.consecutiveNoSpeechErrors++;
          this.publishEvent("voice_no_speech", "No Speech Detected", "Microphone is listening, but no words were heard. Check mic volume or speak louder.", "warning", "running", {
            consecutive: this.consecutiveNoSpeechErrors,
          });

          if (this.consecutiveNoSpeechErrors >= 3) {
            // After 3 quiet cycles, inform the user in the transcript placeholder
            this.updateState({
              transcript: "No speech heard yet — try speaking closer to your mic...",
            });
          }

          this.scheduleRestartListening();
          return;
        }

        void this.handleError(message, { reason: "local_voice_engine", raw_error: rawErrorType });
      },
    });

    if (!session) {
      await this.handleError("Unable to start local audio recording.", { reason: "session_unavailable" });
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
      this.recognitionSession.abort();
    } catch {
      console.warn("[Voice] Failed to release the active recording session.");
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

  private async handleRecognitionResult(
    transcript: string,
    isFinal: boolean,
    detectedLanguage?: string
  ): Promise<void> {
    if (!this.running || this.stopRequested) {
      console.warn("[Voice:Engine] handleRecognitionResult called but engine is stopped — discarding.");
      return;
    }

    const normalizedTranscript = normalizeTranscript(transcript);
    if (!normalizedTranscript) {
      console.warn("[Voice:Engine] handleRecognitionResult — transcript normalized to empty string, skipping.");
      return;
    }

    console.log(`[Voice:Engine] 🎤 Speech received — isFinal=${isFinal} transcript="${normalizedTranscript}"`);

    this.updateDetectedLanguage(detectedLanguage || this.settings.language);
    this.updateState({ transcript: normalizedTranscript });
    this.clearSilenceTimer();

    this.updateState({
      transcript: normalizedTranscript,
      phase: isFinal ? "understanding" : "listening",
      active: true,
      listening: !isFinal,
    });

    this.publishEvent("voice_recording_started", "Recording Command Started", "Capturing speech input.", "info", "running", {
      transcript: normalizedTranscript,
      session_id: this.sessionId,
      conversation_id: this.conversationId,
    });

    if (isFinal) {
      console.log(`[Voice:Engine] ✅ Final transcript — sending to handleSpokenCommand: "${normalizedTranscript}"`);
      this.publishEvent("voice_speech_recognized", "Speech Recognized", `Recognized speech: "${normalizedTranscript}"`, "info", "running", {
        transcript: normalizedTranscript,
        session_id: this.sessionId,
        conversation_id: this.conversationId,
      });
      await this.handleSpokenCommand(normalizedTranscript);
      return;
    }

    console.log(`[Voice:Engine] Interim transcript — waiting for silence debounce (${Math.min(this.settings.silenceTimeoutMs, 1000)}ms): "${normalizedTranscript}"`);
    // Debounce end-of-speech detection for continuous speech pauses
    this.silenceTimer = window.setTimeout(() => {
      this.silenceTimer = null;
      if (this.running && this.state.transcript) {
        const currentTranscript = this.state.transcript;
        console.log(`[Voice:Engine] Silence timeout fired — sending to handleSpokenCommand: "${currentTranscript}"`);
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

    const languageCode = this.activeLanguage.code;
    const queryLanguage = {
      name: languageCode,
      code: languageCode === "hi" ? "hi-IN" : languageCode === "en" ? "en-US" : languageCode,
    };
    this.updateDetectedLanguage(languageCode, true);

    this.streamedResponse = "";
    this.updateState({
      phase: "understanding",
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
      const command = await executeLocalVoiceCommand(cleanedTranscript);
      let response: string | null;
      if (command.handled) {
        this.updateState({ phase: "executing" });
        response = command.message;
        this.chatTransport.addLocalResponse?.(cleanedTranscript, command.message);
      } else {
        this.updateState({ phase: "sending_to_chatbot" });
        this.publishEvent("voice_sending_to_chatbot", "Sending to Chatbot", "User speech is being routed through the AI chat pipeline.", "info", "running", {
          transcript: cleanedTranscript,
          detected_language: queryLanguage.name,
          detected_language_code: queryLanguage.code,
          session_id: this.sessionId,
          conversation_id: this.conversationId,
        });

        response = await this.chatTransport.sendMessage(cleanedTranscript, {
          conversationId: this.conversationId,
          source: "voice",
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
      }

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
      phase: "starting",
      transcript: "",
      response: "",
      listening: false,
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
