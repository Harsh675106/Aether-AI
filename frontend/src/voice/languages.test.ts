import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  INDIAN_ENGLISH_CONFIG,
  US_ENGLISH_CONFIG,
  HINDI_CONFIG,
  detectLanguageFromText,
  findBestVoiceForLanguage,
  scoreVoiceQuality,
} from "./languages";

describe("Voice Languages & Accent Selection", () => {
  describe("detectLanguageFromText", () => {
    it("defaults to Indian English for plain English text", () => {
      const config = detectLanguageFromText("Hello, how are you?");
      expect(config.code).toBe("en-IN");
    });

    it("detects Hindi language from Devanagari script", () => {
      const config = detectLanguageFromText("नमस्ते एथर, आप कैसे हैं?");
      expect(config.code).toBe("hi-IN");
    });

    it("defaults to Indian English for empty input", () => {
      expect(detectLanguageFromText("").code).toBe("en-IN");
    });
  });

  describe("scoreVoiceQuality", () => {
    it("scores exact BCP-47 tag and natural keyword higher", () => {
      const naturalIndianVoice = {
        name: "Microsoft Neerja Online (Natural) - English (India)",
        lang: "en-IN",
        localService: true,
        default: false,
        voiceURI: "neerja",
      } as SpeechSynthesisVoice;

      const genericVoice = {
        name: "Generic Voice",
        lang: "en-US",
        localService: false,
        default: false,
        voiceURI: "generic",
      } as SpeechSynthesisVoice;

      const scoreNatural = scoreVoiceQuality(naturalIndianVoice, INDIAN_ENGLISH_CONFIG);
      const scoreGeneric = scoreVoiceQuality(genericVoice, INDIAN_ENGLISH_CONFIG);

      expect(scoreNatural).toBeGreaterThan(scoreGeneric);
    });
  });

  describe("findBestVoiceForLanguage", () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it("returns best matching voice when available", () => {
      const mockVoices = [
        { name: "Standard English", lang: "en-US", localService: false, default: false } as SpeechSynthesisVoice,
        { name: "Google हिन्दी", lang: "hi-IN", localService: true, default: false } as SpeechSynthesisVoice,
        { name: "Microsoft Neerja Online (Natural)", lang: "en-IN", localService: true, default: false } as SpeechSynthesisVoice,
      ];

      Object.defineProperty(window, "speechSynthesis", {
        writable: true,
        value: {
          getVoices: vi.fn().mockReturnValue(mockVoices),
        },
      });

      const bestVoice = findBestVoiceForLanguage(INDIAN_ENGLISH_CONFIG);
      expect(bestVoice?.name).toBe("Microsoft Neerja Online (Natural)");
    });

    it("handles empty voices list gracefully", () => {
      Object.defineProperty(window, "speechSynthesis", {
        writable: true,
        value: {
          getVoices: vi.fn().mockReturnValue([]),
        },
      });

      const bestVoice = findBestVoiceForLanguage(INDIAN_ENGLISH_CONFIG);
      expect(bestVoice).toBeNull();
    });
  });
});
