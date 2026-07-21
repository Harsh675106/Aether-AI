export interface LanguageConfig {
  code: string;               // BCP-47 tag (e.g. 'en-IN', 'en-US', 'en-GB')
  name: string;               // Human name (e.g. 'English (India)')
  scriptRegex: RegExp;        // Regex to identify script character content
  wakeWordVariants: string[]; // Variations of "Aether"
  voiceKeywords: string[];    // Priority keywords to filter matching SpeechSynthesis voices
}

export const INDIAN_ENGLISH_CONFIG: LanguageConfig = {
  code: "en-IN",
  name: "English (India)",
  scriptRegex: /^[a-zA-Z0-9\s,.:;!?'-]+$/,
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
  voiceKeywords: [
    "neerja",
    "prabhat",
    "heera",
    "ravi",
    "veena",
    "karan",
    "ananya",
    "rishi",
    "india",
    "indian",
    "en-in",
  ],
};

export const US_ENGLISH_CONFIG: LanguageConfig = {
  code: "en-US",
  name: "English (US)",
  scriptRegex: /^[a-zA-Z0-9\s,.:;!?'-]+$/,
  wakeWordVariants: ["aether", "hey aether", "ok aether", "hi aether"],
  voiceKeywords: [
    "aria",
    "guy",
    "jenny",
    "samantha",
    "alex",
    "google us english",
    "natural",
    "neural",
    "en-us",
  ],
};

export const UK_ENGLISH_CONFIG: LanguageConfig = {
  code: "en-GB",
  name: "English (UK)",
  scriptRegex: /^[a-zA-Z0-9\s,.:;!?'-]+$/,
  wakeWordVariants: ["aether", "hey aether", "ok aether", "hi aether"],
  voiceKeywords: [
    "sonia",
    "ryan",
    "oliver",
    "serena",
    "google uk english female",
    "google uk english male",
    "en-gb",
  ],
};

export const HINDI_CONFIG: LanguageConfig = {
  code: "hi-IN",
  name: "Hindi",
  scriptRegex: /[\u0900-\u097F]/,
  wakeWordVariants: [
    "aether",
    "ether",
    "eyther",
    "hey aether",
    "namaste aether",
    "suno aether",
  ],
  voiceKeywords: [
    "google हिन्दी",
    "hi-in",
    "hindi",
    "swara",
    "madhur",
    "kalpana",
    "hemant",
  ],
};

export const MULTILINGUAL_CONFIGS: LanguageConfig[] = [
  INDIAN_ENGLISH_CONFIG,
  US_ENGLISH_CONFIG,
  UK_ENGLISH_CONFIG,
  HINDI_CONFIG,
];

export function detectLanguageFromText(text?: string): LanguageConfig {
  if (!text || !text.trim()) {
    return INDIAN_ENGLISH_CONFIG;
  }

  // Check for Devanagari script content (Hindi)
  if (HINDI_CONFIG.scriptRegex.test(text)) {
    return HINDI_CONFIG;
  }

  return INDIAN_ENGLISH_CONFIG;
}

/**
 * Ranks available SpeechSynthesis voices by quality and accent match.
 * Prioritizes high-definition (Natural, Neural, Google, Apple, Microsoft) voices.
 */
export function scoreVoiceQuality(voice: SpeechSynthesisVoice, langConfig: LanguageConfig): number {
  let score = 0;
  const vName = voice.name.toLowerCase();
  const vLang = voice.lang.toLowerCase();
  const targetCode = langConfig.code.toLowerCase();
  const targetLangPrefix = targetCode.split("-")[0];

  // Exact BCP-47 tag match
  if (vLang === targetCode) {
    score += 50;
  } else if (vLang.startsWith(targetLangPrefix)) {
    score += 30;
  }

  // Keyword match for requested accent
  for (const keyword of langConfig.voiceKeywords) {
    if (vName.includes(keyword.toLowerCase())) {
      score += 25;
      break;
    }
  }

  // Quality multipliers for natural / neural / premium voices
  if (vName.includes("natural") || vName.includes("neural")) {
    score += 35;
  }
  if (vName.includes("google")) {
    score += 25;
  }
  if (vName.includes("microsoft") || vName.includes("apple")) {
    score += 15;
  }
  if (voice.localService) {
    score += 10;
  }
  if (voice.default) {
    score += 5;
  }

  return score;
}

export function findBestVoiceForLanguage(
  langConfig: LanguageConfig = INDIAN_ENGLISH_CONFIG
): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    return null;
  }

  const voices = window.speechSynthesis.getVoices();
  if (!voices || voices.length === 0) {
    return null;
  }

  const langPrefix = langConfig.code.toLowerCase().split("-")[0];
  const candidates = voices.filter((v) => {
    const vLang = v.lang.toLowerCase();
    return vLang.startsWith(langPrefix) || vLang.startsWith("en");
  });

  if (candidates.length === 0) {
    return voices[0] || null;
  }

  // Sort candidates by quality score descending
  candidates.sort((a, b) => scoreVoiceQuality(b, langConfig) - scoreVoiceQuality(a, langConfig));

  return candidates[0] || null;
}
