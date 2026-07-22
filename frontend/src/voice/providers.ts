import { findBestVoiceForLanguage, type LanguageConfig } from "./languages";

export type SpeechRecognitionSessionOptions = {
  language: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives?: number;
  onStart?: () => void;
  onEnd?: () => void;
  onResult: (transcript: string, isFinal: boolean) => void;
  onError: (message: string) => void;
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

    // Include a conservative set of common misspellings/variants to reduce sensitivity
    const extra = [
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
    ];

    for (const v of extra) {
      variants.add(v.toLowerCase().trim());
    }

    return [...variants].filter(Boolean).sort((a, b) => b.length - a.length);
  }

  matches(transcript: string, wakeWord: string): boolean {
    const rawTranscript = transcript.toLowerCase();
    return this.variants(wakeWord).some((variant) => {
      const escaped = this.escapePattern(variant);
      const pattern = new RegExp(`(?:^|[\\s,.:;!?\\(\\)\\[\\]])${escaped}(?:$|[\\s,.:;!?\\(\\)\\[\\]])`, "i");
      return pattern.test(rawTranscript);
    });
  }

  strip(transcript: string, wakeWord: string): string {
    let cleaned = transcript;

    for (const variant of this.variants(wakeWord)) {
      const escaped = this.escapePattern(variant);
      const pattern = new RegExp(`(?:^|[\\s,.:;!?\\(\\)\\[\\]])${escaped}(?:$|[\\s,.:;!?\\(\\)\\[\\]])`, "ig");
      cleaned = cleaned.replace(pattern, " ");
    }

    return cleaned.replace(/\s+/g, " ").trim().replace(/^[,.:;!?]+|[,.:;!?]+$/g, "");
  }
}

class BrowserSpeechRecognitionProvider implements SpeechToTextProvider {
  isSupported(): boolean {
    return typeof window !== "undefined" && Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  createSession(options: SpeechRecognitionSessionOptions): SpeechRecognitionSession | null {
    if (!this.isSupported()) {
      return null;
    }

    const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Recognition) {
      return null;
    }

    const recognition = new Recognition();
    recognition.continuous = options.continuous;
    recognition.interimResults = options.interimResults;
    recognition.maxAlternatives = options.maxAlternatives ?? 3;
    if (options.language) {
      recognition.lang = options.language;
    }

    let isStarted = false;

    recognition.onstart = () => {
      isStarted = true;
      options.onStart?.();
    };

    recognition.onend = () => {
      isStarted = false;
      options.onEnd?.();
    };

    recognition.onerror = (event: any) => {
      const err = String(event?.error ?? event?.message ?? "").toLowerCase();
      if (!err) {
        options.onError("Speech recognition encountered an issue.");
        return;
      }

      if (err.includes("aborted")) {
        return;
      }

      options.onError(err || "Speech recognition encountered an issue.");
    };

    recognition.onresult = (event: any) => {
      if (!event.results || event.results.length === 0) {
        return;
      }

      let combinedTranscript = "";
      let isFinal = false;

      for (let i = 0; i < event.results.length; i++) {
        const item = event.results[i];
        const piece = String(item?.[0]?.transcript ?? "").trim();
        if (piece) {
          combinedTranscript = combinedTranscript ? `${combinedTranscript} ${piece}` : piece;
        }
        if (item.isFinal) {
          isFinal = true;
        }
      }

      if (combinedTranscript) {
        options.onResult(combinedTranscript.trim(), isFinal);
      }
    };

    return {
      start: () => {
        if (isStarted) {
          return;
        }
        try {
          recognition.start();
        } catch (err: any) {
          if (!String(err).includes("already started")) {
            throw err;
          }
        }
      },
      stop: () => {
        try {
          recognition.stop();
        } catch {
          try {
            recognition.abort();
          } catch {}
        }
      },
      abort: () => {
        try {
          recognition.abort();
        } catch {}
      },
    };
  }
}

class BrowserSpeechSynthesisProvider implements TextToSpeechProvider {
  constructor() {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      // Chrome & Edge load voices asynchronously; bind listener to pre-fetch voices
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
        const langConfig = ({ code: options.language || "en-US", name: options.language || "en-US", wakeWordVariants: [] } as unknown) as LanguageConfig;
        const bestVoice = findBestVoiceForLanguage(langConfig);
        if (bestVoice) {
          utterance.voice = bestVoice;
        }
      }

      let resolved = false;
      const done = () => {
        if (!resolved) {
          resolved = true;
          resolve();
        }
      };

      utterance.onend = done;
      utterance.onerror = done;

      // Timeout fallback safeguard in case browser TTS event is delayed
      const maxSpeechMs = Math.max(3000, text.length * 120);
      const safetyTimeout = window.setTimeout(done, maxSpeechMs);

      synth.speak(utterance);
    });
  }

  stop(): void {
    if (this.isSupported()) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }
  }
}

export const browserSpeechRecognitionProvider = new BrowserSpeechRecognitionProvider();
export const browserSpeechSynthesisProvider = new BrowserSpeechSynthesisProvider();
