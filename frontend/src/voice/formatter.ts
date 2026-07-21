/**
 * Utility to convert Markdown formatted text into clean, natural plain text
 * suitable for Text-to-Speech (TTS) engines.
 */

export function formatMarkdownForSpeech(markdown: string): string {
  if (!markdown) {
    return "";
  }

  let text = markdown;

  // 1. Replace multi-line code blocks with a natural spoken placeholder
  text = text.replace(/```[\s\S]*?```/g, "\nI have provided the code in the chat.\n");

  // 2. Replace HTML tags
  text = text.replace(/<[^>]*>/g, "");

  // 3. Convert headings (# Heading) to natural text ending with punctuation
  text = text.replace(/^(#{1,6})\s+(.+)$/gm, (_, _hashes, content) => {
    const trimmed = content.trim();
    return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
  });

  // 4. Handle blockquotes (> text)
  text = text.replace(/^>\s*/gm, "");

  // 5. Remove horizontal rules (---, ***, ___)
  text = text.replace(/^[-*_]{3,}$/gm, "");

  // 6. Handle tables: strip header divider lines (|---|---|) and format rows
  text = text.replace(/^\|?(?:\s*:?-+:?\s*\|?)+$/gm, "");
  text = text.replace(/^\|(.+)\|$/gm, (_, content) => {
    const cells = content
      .split("|")
      .map((cell: string) => cell.trim())
      .filter((cell: string) => Boolean(cell) && !/^[:-\s]+$/.test(cell));
    if (cells.length === 0) return "";
    return cells.join(", ") + ".";
  });

  // 7. Handle image links ![alt](url) -> alt
  text = text.replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1");

  // 8. Handle text links [text](url) -> text
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");

  // 9. Replace standalone URLs with "link in chat"
  text = text.replace(/https?:\/\/\S+/g, "link in chat");

  // 10. Replace inline code `code` -> code
  text = text.replace(/`([^`]+)`/g, "$1");

  // 11. Remove bold, italic, and strikethrough markdown symbols
  text = text.replace(/\*\*([^*]+)\*\*/g, "$1");
  text = text.replace(/\*([^*]+)\*/g, "$1");
  text = text.replace(/__([^_]+)__/g, "$1");
  text = text.replace(/_([^_]+)_/g, "$1");
  text = text.replace(/~~([^~]+)~~/g, "$1");

  // 12. Handle bullet lists (- item, * item, + item)
  text = text.replace(/^[\s]*[-*+]\s+(.+)$/gm, (_, item) => {
    const trimmed = item.trim();
    return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
  });

  // 13. Handle numbered lists (1. item)
  text = text.replace(/^[\s]*(\d+)\.\s+(.+)$/gm, (_, num, item) => {
    const trimmed = item.trim();
    return `Step ${num}, ${trimmed}${/[.!?]$/.test(trimmed) ? "" : "."}`;
  });

  // 14. Strip decorative Unicode emojis
  text = text.replace(
    /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]/gu,
    ""
  );

  // 15. Normalize extra spaces, newlines, and punctuation pauses
  text = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join(" ");

  // Final cleanup of duplicate whitespace and leading/trailing punctuation
  text = text.replace(/\s+/g, " ").trim();

  return text;
}
