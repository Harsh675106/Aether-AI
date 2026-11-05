import { findBestVoiceForLanguage, type LanguageConfig } from "./languages";
import { AvatarController } from "@/components/avatar";

const API_URL = import.meta.env.VITE_AETHER_API_URL ?? "http://localhost:8001/api/v1";
const HEALTH_RETRY_DELAYS_MS = [0, 400, 1000, 2000];
const MODEL_LOAD_TIMEOUT_MS = 60_000;
const LIVE_TRANSCRIPTION_INTERVAL_MS = 2_000;

export type SpeechRecognitionSessionOptions = {
  onStart?: () => void;
  onEnd?: () => void;
  onAudioStart?: () => void;
  onUnderstanding?: () => void;
  onResult: (
    transcript: string,
    isFinal: boolean,
    metadata?: { language?: string }
  ) => void;
  onInterimResult?: (transcript: string, metadata?: { language?: string }) => void;
  onError: (message: string, rawErrorType?: string) => void;
};

export type SpeechRecognitionSession = {
  start: () => void;
  stop: () => void;
  abort: () => void;
};

export interface SpeechToTextProvider {
  isSupported(): boolean;
  createSession(options: SpeechRecognitionSessionOptions): SpeechRecognitionSession | null;
}

export type TextToSpeechOptions = {
  language: string;
  voiceName?: string | null;
  rate: number;
  pitch: number;
  volume: number;
};

export interface TextToSpeechProvider {
  isSupported(): boolean;
  speak(text: string, options: TextToSpeechOptions): Promise<void>;
  stop(): void;
}

type TranscriptionResponse = {
  text: string;
  language: string;
};

type VoiceHealthResponse = {
  status: "ready" | "loading" | "error";
  error?: string | null;
};

type VoiceCommandResponse = {
  handled: boolean;
  message: string;
  action_type: string | null;
};

export class RegexWakeWordDetector {
  private escapePattern(text: string): string {
    return text.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
  }

  private normalized(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  private variants(wakeWord: string): string[] {
    const rawLower = wakeWord.toLowerCase().trim();
    const normalized = this.normalized(wakeWord);
    const collapsed = normalized.replace(/\s+/g, "");
    const variants = new Set<string>([rawLower, normalized, collapsed]);

    if (collapsed.startsWith("ae") && collapsed.length > 1) {
      variants.add(collapsed.slice(1));
    }

    if (collapsed.startsWith("a") && collapsed.length > 1) {
      variants.add(collapsed.slice(1));
    }

    for (const variant of [
      "ether",
      "either",
      "ither",
      "aither",
      "ayther",
      "eyther",
      "hey aether",
      "hey ether",
      "ok aether",
      "hi aether",
      "hello aether",
    ]) {
      variants.add(variant);
    }

    return [...variants].filter(Boolean).sort((a, b) => b.length - a.length);
  }

  matches(transcript: string, wakeWord: string): boolean {
    const rawTranscript = transcript.toLowerCase();
    return this.variants(wakeWord).some((variant) => {
      const escaped = this.escapePattern(variant);
      const pattern = new RegExp(
        `(?:^|[\\s,.:;!?\\(\\)\\[\\]])${escaped}(?:$|[\\s,.:;!?\\(\\)\\[\\]])`,
        "i"
      );
      return pattern.test(rawTranscript);
    });
  }

  strip(transcript: string, wakeWord: string): string {
    let cleaned = transcript;

    for (const variant of this.variants(wakeWord)) {
      const escaped = this.escapePattern(variant);
      const pattern = new RegExp(
        `(?:^|[\\s,.:;!?\\(\\)\\[\\]])${escaped}(?:$|[\\s,.:;!?\\(\\)\\[\\]])`,
        "ig"
      );
      cleaned = cleaned.replace(pattern, " ");
    }

    return cleaned.replace(/\s+/g, " ").trim().replace(/^[,.:;!?]+|[,.:;!?]+$/g, "");
  }
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timeout);
  }
}

async function waitForVoiceBackend(): Promise<void> {
  let lastError = "Aether voice backend is unavailable.";
  let modelIsLoading = false;
  const checkHealth = async () => {
    const response = await fetchWithTimeout(
      `${API_URL}/voice/health`,
      { method: "GET" },
      3000
    );
    if (!response.ok) {
      throw new Error(`Voice backend health check failed (${response.status}).`);
    }
    return (await response.json()) as VoiceHealthResponse;
  };

  for (const delay of HEALTH_RETRY_DELAYS_MS) {
    if (delay) {
      await new Promise((resolve) => window.setTimeout(resolve, delay));
    }
    try {
      const health = await checkHealth();
      if (health.status === "ready") {
        return;
      }
      if (health.status === "error") {
        throw new Error(health.error || "The local speech model could not be loaded.");
      }
      modelIsLoading = true;
      break;
    } catch (error) {
      if (error instanceof Error) {
        lastError = error.message;
      }
    }
  }

  if (!modelIsLoading) {
    throw new Error(
      "Cannot connect to Aether's voice backend. Check that FastAPI is running."
    );
  }

  const startedAt = Date.now();
  while (Date.now() - startedAt < MODEL_LOAD_TIMEOUT_MS) {
    await new Promise((resolve) => window.setTimeout(resolve, 1000));
    try {
      const health = await checkHealth();
      if (health.status === "ready") {
        return;
      }
      if (health.status === "error") {
        throw new Error(health.error || "The local speech model could not be loaded.");
      }
      lastError = "The local speech model is still loading.";
    } catch (error) {
      if (error instanceof Error) {
        lastError = error.message;
      }
    }
  }

  throw new Error(lastError);
}

function microphoneError(error: unknown): { message: string; code: string } {
  const name = error instanceof DOMException ? error.name : "UnknownError";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return {
      message:
        "Microphone access is blocked. Allow microphone access for Aether in Windows Settings → Privacy & security → Microphone, then restart Aether.",
      code: "not-allowed",
    };
  }
  if (name === "NotFoundError") {
    return {
      message: "No microphone was found. Connect or enable a microphone, then try again.",
      code: "audio-capture",
    };
  }
  return {
    message: `Unable to access the microphone (${name}). Check that it is connected and not in use by another application.`,
    code: "audio-capture",
  };
}

class LocalWhisperSpeechRecognitionProvider implements SpeechToTextProvider {
  private sessionActive = false;
  private transcriptionActive = false;

  isSupported(): boolean {
    return (
      typeof navigator !== "undefined" &&
      Boolean(navigator.mediaDevices?.getUserMedia) &&
      typeof MediaRecorder !== "undefined"
    );
  }

  createSession(options: SpeechRecognitionSessionOptions): SpeechRecognitionSession | null {
    if (!this.isSupported() || this.sessionActive || this.transcriptionActive) {
      return null;
    }
    this.sessionActive = true;

    let stream: MediaStream | null = null;
    let recorder: MediaRecorder | null = null;
    let chunks: BlobPart[] = [];
    let disposed = false;
    let finalizing = false;
    let partialTranscriptionTimer: number | null = null;
    let partialTranscription: Promise<void> | null = null;

    const releaseStream = () => {
      stream?.getTracks().forEach((track) => track.stop());
      stream = null;
    };
    const clearPartialTranscriptionTimer = () => {
      if (partialTranscriptionTimer !== null) {
        window.clearInterval(partialTranscriptionTimer);
        partialTranscriptionTimer = null;
      }
    };
    const releaseSession = () => {
      this.sessionActive = false;
    };

    const reportError = (error: unknown) => {
      const message = error instanceof Error ? error.message : "Voice recording failed.";
      const code =
        error instanceof DOMException && error.name === "NotAllowedError"
          ? "not-allowed"
          : "backend";
      options.onError(message, code);
    };

    const transcribeAudio = async (
      audio: Blob,
      mimeType: string
    ): Promise<TranscriptionResponse> => {
      const formData = new FormData();
      const extension = mimeType.includes("ogg")
        ? "ogg"
        : mimeType.includes("mp4")
          ? "mp4"
          : mimeType.includes("wav")
            ? "wav"
            : "webm";
      formData.append("file", audio, `recording.${extension}`);
      const response = await fetchWithTimeout(
        `${API_URL}/voice/transcribe`,
        { method: "POST", body: formData },
        180_000
      );
      if (!response.ok) {
        const detail = await response.json().catch(() => null);
        throw new Error(
          detail?.detail || `Local speech transcription failed (${response.status}).`
        );
      }
      return (await response.json()) as TranscriptionResponse;
    };

    const transcribe = async () => {
      if (disposed || this.transcriptionActive) {
        releaseStream();
        return;
      }
      this.transcriptionActive = true;
      releaseSession();
      releaseStream();

      try {
        clearPartialTranscriptionTimer();
        await partialTranscription;
        const mimeType = recorder?.mimeType || "audio/webm";
        const audio = new Blob(chunks, { type: mimeType });
        chunks = [];
        if (audio.size < 100) {
          options.onError("No speech was recorded. Try speaking closer to your microphone.", "no-speech");
          return;
        }

        options.onUnderstanding?.();
        const result = await transcribeAudio(audio, mimeType);
        options.onEnd?.();
        if (!result.text.trim()) {
          options.onError("No speech was recognized. Try again and speak clearly.", "no-speech");
          return;
        }
        options.onResult(result.text.trim(), true, { language: result.language });
      } catch (error) {
        reportError(error);
      } finally {
        this.transcriptionActive = false;
      }
    };

    return {
      start: () => {
        void (async () => {
          try {
            await waitForVoiceBackend();
            if (disposed || finalizing) {
              return;
            }
            stream = await navigator.mediaDevices.getUserMedia({
              audio: {
                channelCount: 1,
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
              },
            });
            if (disposed || finalizing) {
              releaseStream();
              return;
            }
            const mimeType = ["audio/webm;codecs=opus", "audio/webm"].find((type) =>
              MediaRecorder.isTypeSupported(type)
            );
            recorder = mimeType
              ? new MediaRecorder(stream, { mimeType })
              : new MediaRecorder(stream);
            recorder.ondataavailable = (event) => {
              if (event.data.size) {
                chunks.push(event.data);
              }
            };
            recorder.onerror = (event) => {
              clearPartialTranscriptionTimer();
              reportError(event);
              releaseStream();
              releaseSession();
            };
            recorder.onstop = () => {
              if (finalizing && !disposed) {
                void transcribe();
              } else {
                releaseStream();
              }
            };
            recorder.start(250);
            partialTranscriptionTimer = window.setInterval(() => {
              if (disposed || finalizing || partialTranscription) {
                return;
              }

              const mimeType = recorder?.mimeType || "audio/webm";
              const audio = new Blob(chunks.slice(), { type: mimeType });
              if (audio.size < 100) {
                return;
              }

              const transcription = transcribeAudio(audio, mimeType)
                .then((result) => {
                  if (!disposed && !finalizing && result.text.trim()) {
                    options.onInterimResult?.(result.text.trim(), {
                      language: result.language,
                    });
                  }
                })
                .catch((error: unknown) => {
                  console.warn(
                    "[Voice] Live transcription failed; final transcription will still be attempted.",
                    error
                  );
                })
                .finally(() => {
                  if (partialTranscription === transcription) {
                    partialTranscription = null;
                  }
                });
              partialTranscription = transcription;
            }, LIVE_TRANSCRIPTION_INTERVAL_MS);
            options.onAudioStart?.();
            options.onStart?.();
            console.info("[Voice] Local audio recording started.");
          } catch (error) {
            releaseStream();
            releaseSession();
            if (error instanceof DOMException) {
              const mapped = microphoneError(error);
              options.onError(mapped.message, mapped.code);
            } else {
              reportError(error);
            }
            options.onEnd?.();
          }
        })();
      },
      stop: () => {
        if (disposed || finalizing) {
          return;
        }
        finalizing = true;
        clearPartialTranscriptionTimer();
        if (recorder?.state === "recording") {
          recorder.stop();
        } else {
          releaseStream();
          releaseSession();
          options.onEnd?.();
        }
      },
      abort: () => {
        disposed = true;
        finalizing = false;
        clearPartialTranscriptionTimer();
        if (recorder?.state === "recording") {
          recorder.onstop = null;
          recorder.stop();
        }
        chunks = [];
        releaseStream();
        releaseSession();
      },
    };
  }
}

export async function executeLocalVoiceCommand(
  transcript: string
): Promise<VoiceCommandResponse> {
  const response = await fetchWithTimeout(
    `${API_URL}/voice/execute?${new URLSearchParams({ transcript })}`,
    { method: "POST" },
    10_000
  );
  if (!response.ok) {
    throw new Error(`Voice command request failed (${response.status}).`);
  }
  return (await response.json()) as VoiceCommandResponse;
}

class BrowserSpeechSynthesisProvider implements TextToSpeechProvider {
  constructor() {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      if (typeof window.speechSynthesis.onvoiceschanged !== "undefined") {
        window.speechSynthesis.onvoiceschanged = () => {
          try {
            window.speechSynthesis.getVoices();
          } catch {}
        };
      }
    }
  }

  isSupported(): boolean {
    return typeof window !== "undefined" && Boolean(window.speechSynthesis && window.SpeechSynthesisUtterance);
  }

  async speak(text: string, options: TextToSpeechOptions): Promise<void> {
    if (!this.isSupported() || !text || !text.trim()) {
      return;
    }

    const synth = window.speechSynthesis;
    synth.cancel();

    const controller = AvatarController.getInstance();
    controller.startSpeaking({ text });

    await new Promise<void>((resolve) => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = options.language || "en-IN";
      utterance.rate = Math.max(0.5, Math.min(options.rate || 1, 2.0));
      utterance.pitch = Math.max(0.5, Math.min(options.pitch || 1, 1.5));
      utterance.volume = Math.max(0, Math.min(options.volume ?? 1, 1.0));

      const availableVoices = synth.getVoices();

      if (options.voiceName && availableVoices.length > 0) {
        const matchedVoice = availableVoices.find((item) => item.name === options.voiceName);
        if (matchedVoice) {
          utterance.voice = matchedVoice;
        }
      }

      if (!utterance.voice) {
        const langConfig = ({
          code: options.language || "en-US",
          name: options.language || "en-US",
          wakeWordVariants: [],
        } as unknown) as LanguageConfig;
        const bestVoice = findBestVoiceForLanguage(langConfig);
        if (bestVoice) {
          utterance.voice = bestVoice;
        }
      }

      let resolved = false;
      const done = () => {
        if (!resolved) {
          resolved = true;
          controller.stopSpeaking();
          resolve();
        }
      };

      utterance.onend = done;
      utterance.onerror = done;
      utterance.onboundary = (event) => {
        if (event.name === "word") {
          controller.handleWordBoundary(event.charIndex, event.charLength || 0);
        }
      };

      const maxSpeechMs = Math.max(3000, text.length * 120);
      window.setTimeout(done, maxSpeechMs);
      synth.speak(utterance);
    });
  }

  stop(): void {
    if (this.isSupported()) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }
    AvatarController.getInstance().stopSpeaking();
  }
}

export const localWhisperSpeechRecognitionProvider = new LocalWhisperSpeechRecognitionProvider();
export const browserSpeechSynthesisProvider = new BrowserSpeechSynthesisProvider();
