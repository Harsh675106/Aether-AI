import { BrowserCommand, SnapPosition } from '@/types/browser';

const KNOWN_SITES: Record<string, string> = {
  youtube: 'https://www.youtube.com',
  google: 'https://www.google.com',
  github: 'https://github.com',
  netflix: 'https://www.netflix.com',
  reddit: 'https://www.reddit.com',
  amazon: 'https://www.amazon.com',
  wikipedia: 'https://www.wikipedia.org',
  twitter: 'https://x.com',
  x: 'https://x.com',
};

export function normalizeUrl(input: string): string {
  const trimmed = input.trim();

  // Already a valid URL
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  // Known site shorthand
  const lower = trimmed.toLowerCase();
  if (KNOWN_SITES[lower]) {
    return KNOWN_SITES[lower];
  }

  // Looks like a domain (contains a dot, no spaces)
  if (/^[^\s]+\.[^\s]+$/.test(trimmed)) {
    return `https://${trimmed}`;
  }

  // Fall back to Google search
  return `https://www.google.com/search?q=${encodeURIComponent(trimmed)}`;
}

export function parseBrowserVoiceCommand(message: string): BrowserCommand | null {
  const msg = message.trim().toLowerCase().replace(/[.!?]+$/, "");

  // ── Open / Navigate ──────────────────────────────────────────────────────────

  // Open Aether's browser for browser-app commands; never launch a desktop browser.
  if (/^open (?:the )?(?:browser|chrome|google chrome|edge|microsoft edge)$/.test(msg)) {
    return { action: 'open', url: 'https://www.google.com' };
  }

  // Web searches also run in Aether's floating browser.
  const searchMatch = msg.match(
    /^(?:search(?:\s+for)?|google)\s+(.+?)(?:\s+on\s+(?:the\s+)?(?:web|google))?$/
  );
  if (searchMatch) {
    const query = searchMatch[1];
    return {
      action: 'open',
      url: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
    };
  }

  // "open <site/url>"
  const openMatch = msg.match(/^open\s+(.+)$/);
  if (openMatch) {
    return { action: 'open', url: normalizeUrl(openMatch[1]) };
  }

  // "go to <url>"
  const goToMatch = msg.match(/^go\s+to\s+(.+)$/);
  if (goToMatch) {
    return { action: 'navigate', url: normalizeUrl(goToMatch[1]) };
  }

  // "navigate to <url>"
  const navMatch = msg.match(/^navigate\s+to\s+(.+)$/);
  if (navMatch) {
    return { action: 'navigate', url: normalizeUrl(navMatch[1]) };
  }

  // "browse <url>"
  const browseMatch = msg.match(/^browse\s+(.+)$/);
  if (browseMatch) {
    return { action: 'open', url: normalizeUrl(browseMatch[1]) };
  }

  // "show website <url>"
  const showWebMatch = msg.match(/^show\s+website\s+(.+)$/);
  if (showWebMatch) {
    return { action: 'open', url: normalizeUrl(showWebMatch[1]) };
  }

  // These execute through Tauri against the existing browser-view; they never
  // enter the backend planner or create an automation browser.
  if (/^(go\s+back|back)$/.test(msg)) return { action: 'back' };
  if (/^(go\s+forward|forward)$/.test(msg)) return { action: 'forward' };
  if (/^(refresh|reload|refresh\s+page|reload\s+page)$/.test(msg)) return { action: 'reload' };

  // ── Window Control ────────────────────────────────────────────────────────────

  if (/^float\s+browser$|^detach\s+browser$/.test(msg)) {
    return { action: 'float' };
  }

  if (/^minimize\s+browser$|^hide\s+browser$/.test(msg)) {
    return { action: 'hide' };
  }

  if (/^show\s+browser$|^restore\s+browser$/.test(msg)) {
    return { action: 'show' };
  }

  if (/^maximize\s+browser$|^expand\s+browser$/.test(msg)) {
    return { action: 'maximize' };
  }

  if (/^close\s+browser$/.test(msg)) {
    return { action: 'close' };
  }

  // ── Snap Positions ────────────────────────────────────────────────────────────

  if (/^(move\s+browser\s+to\s+the\s+right|snap\s+browser\s+right)$/.test(msg)) {
    return { action: 'snap', snapPosition: 'right-half' };
  }

  if (/^(move\s+browser\s+to\s+the\s+left|snap\s+browser\s+left)$/.test(msg)) {
    return { action: 'snap', snapPosition: 'left-half' };
  }

  if (/^move\s+browser\s+to\s+(the\s+)?top\s+left$/.test(msg)) {
    return { action: 'snap', snapPosition: 'top-left' };
  }

  if (/^move\s+browser\s+to\s+(the\s+)?top\s+right$/.test(msg)) {
    return { action: 'snap', snapPosition: 'top-right' };
  }

  if (/^move\s+browser\s+to\s+(the\s+)?bottom\s+left$/.test(msg)) {
    return { action: 'snap', snapPosition: 'bottom-left' };
  }

  if (/^move\s+browser\s+to\s+(the\s+)?bottom\s+right$/.test(msg)) {
    return { action: 'snap', snapPosition: 'bottom-right' };
  }

  if (/^(center\s+browser|move\s+browser\s+to\s+(the\s+)?center)$/.test(msg)) {
    return { action: 'snap', snapPosition: 'center' };
  }

  // Additional snap shorthands
  const snapShortMatch = msg.match(/^snap\s+browser\s+(top-left|top-right|bottom-left|bottom-right|left|right|center)$/);
  if (snapShortMatch) {
    const posMap: Record<string, SnapPosition> = {
      'top-left': 'top-left',
      'top-right': 'top-right',
      'bottom-left': 'bottom-left',
      'bottom-right': 'bottom-right',
      left: 'left-half',
      right: 'right-half',
      center: 'center',
    };
    return { action: 'snap', snapPosition: posMap[snapShortMatch[1]] };
  }

  // ── Always On Top ─────────────────────────────────────────────────────────────

  if (/^(keep\s+browser\s+always\s+on\s+top|pin\s+browser)$/.test(msg)) {
    return { action: 'always-on-top', alwaysOnTop: true };
  }

  if (/^(unpin\s+browser|stop\s+keeping\s+browser\s+on\s+top)$/.test(msg)) {
    return { action: 'always-on-top', alwaysOnTop: false };
  }

  return null;
}
