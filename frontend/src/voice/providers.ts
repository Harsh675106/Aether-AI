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
    const normalized = this.normalized(wakeWord);
    const collapsed = normalized.replace(/\s+/g, "");
    const variants = new Set<string>([normalized, collapsed]);

    if (collapsed.startsWith("ae") && collapsed.length > 1) {
      variants.add(collapsed.slice(1));
    }

    if (collapsed.startsWith("a") && collapsed.length > 1) {
      variants.add(collapsed.slice(1));
    }

    return [...variants].filter(Boolean);
  }

  matches(transcript: string, wakeWord: string): boolean {
    const normalizedTranscript = this.normalized(transcript);
    return this.variants(wakeWord).some((variant) => {
      const pattern = new RegExp(`\\b${this.escapePattern(variant)}\\b`, "i");
      return pattern.test(normalizedTranscript);
    });
  }

  strip(transcript: string, wakeWord: string): string {
    let cleaned = transcript;

    for (const variant of this.variants(wakeWord)) {
      const pattern = new RegExp(`\\b${this.escapePattern(variant)}\\b`, "ig");
      cleaned = cleaned.replace(pattern, "");
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
    recognition.maxAlternatives = options.maxAlternatives ?? 1;
    recognition.lang = options.language;

    recognition.onstart = () => options.onStart?.();
    recognition.onend = () => options.onEnd?.();
    recognition.onerror = (event: any) => {
      options.onError(event?.error ?? event?.message ?? "Speech recognition failed.");
    };
    recognition.onresult = (event: any) => {
      const result = event.results?.[event.resultIndex ?? event.results.length - 1];
      const transcript = String(result?.[0]?.transcript ?? "").trim();
      const isFinal = Boolean(result?.isFinal);
      if (transcript) {
        options.onResult(transcript, isFinal);
      }
    };

    return {
      start: () => recognition.start(),
      stop: () => recognition.stop(),
      abort: () => recognition.abort(),
    };
  }
}

class BrowserSpeechSynthesisProvider implements TextToSpeechProvider {
  isSupported(): boolean {
    return typeof window !== "undefined" && Boolean(window.speechSynthesis && window.SpeechSynthesisUtterance);
  }

  async speak(text: string, options: TextToSpeechOptions): Promise<void> {
    if (!this.isSupported()) {
      return;
    }

    const synth = window.speechSynthesis;
    synth.cancel();

    await new Promise<void>((resolve) => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = options.language;
      utterance.rate = options.rate;
      utterance.pitch = options.pitch;
      utterance.volume = options.volume;

      if (options.voiceName) {
        const voice = synth.getVoices().find((item) => item.name === options.voiceName);
        if (voice) {
          utterance.voice = voice;
        }
      }

      utterance.onend = () => resolve();
      utterance.onerror = () => resolve();
      synth.speak(utterance);
    });
  }

  stop(): void {
    if (this.isSupported()) {
      window.speechSynthesis.cancel();
    }
  }
}

export const browserSpeechRecognitionProvider = new BrowserSpeechRecognitionProvider();
export const browserSpeechSynthesisProvider = new BrowserSpeechSynthesisProvider();
