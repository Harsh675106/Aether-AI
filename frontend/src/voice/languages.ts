export interface LanguageConfig {
  code: string;
  name: string;
  wakeWordVariants: string[];
}

export const INDIAN_ENGLISH_CONFIG: LanguageConfig = {
  code: "en-IN",
  name: "English (India)",
  wakeWordVariants: [
    "aether",
    "ether",
    "either",
    "ather",
    "eyther",
    "hey aether",
    "hey ether",
    "ok aether",
    "hi aether",
    "hello aether",
  ],
};

export const US_ENGLISH_CONFIG: LanguageConfig = {
  code: "en-US",
  name: "English (US)",
  wakeWordVariants: [
    "aether",
    "ether",
    "either",
    "ather",
    "eyther",
    "hey aether",
    "hey ether",
    "ok aether",
    "hi aether",
    "hello aether",
  ],
};

export const HINDI_CONFIG: LanguageConfig = {
  code: "hi-IN",
  name: "Hindi (India)",
  wakeWordVariants: [
    "aether",
    "ether",
    "ather",
    "एथर",
    "हे एथर",
    "नमस्ते एथर",
  ],
};

export const MULTILINGUAL_CONFIGS: LanguageConfig[] = [
  INDIAN_ENGLISH_CONFIG,
  US_ENGLISH_CONFIG,
  HINDI_CONFIG,
];

// Preferred voice (change this if you prefer another installed voice)
const PREFERRED_VOICE = "Microsoft Ravi Online (Natural)";

export function detectLanguageFromText(text?: string): LanguageConfig {
  if (!text) return INDIAN_ENGLISH_CONFIG;
  if (/[\u0900-\u097F]/.test(text)) {
    return HINDI_CONFIG;
  }
  return INDIAN_ENGLISH_CONFIG;
}

export function scoreVoiceQuality(voice: SpeechSynthesisVoice, langConfig: LanguageConfig): number {
  let score = 0;
  const vLang = voice.lang ? voice.lang.toLowerCase() : "";
  const targetLang = langConfig.code.toLowerCase();

  if (vLang === targetLang) {
    score += 50;
  } else if (vLang.split("-")[0] === targetLang.split("-")[0]) {
    score += 20;
  }

  const vName = voice.name ? voice.name.toLowerCase() : "";
  if (voice.name === PREFERRED_VOICE) {
    score += 100;
  }
  if (vName.includes("natural") || vName.includes("online")) {
    score += 30;
  }
  if (voice.localService) {
    score += 10;
  }

  return score;
}

export function findBestVoiceForLanguage(
  langConfig: LanguageConfig = INDIAN_ENGLISH_CONFIG,
): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return null;
  }

  const voices = window.speechSynthesis.getVoices();

  if (!voices.length) {
    return null;
  }

  let bestVoice: SpeechSynthesisVoice | null = null;
  let maxScore = -1;

  for (const voice of voices) {
    const score = scoreVoiceQuality(voice, langConfig);
    if (score > maxScore) {
      maxScore = score;
      bestVoice = voice;
    }
  }

  return bestVoice ?? voices[0] ?? null;
}

