import { describe, expect, it } from "vitest";
import { formatMarkdownForSpeech } from "./formatter";

describe("formatMarkdownForSpeech", () => {
  it("returns empty string for empty input", () => {
    expect(formatMarkdownForSpeech("")).toBe("");
  });

  it("replaces code blocks with natural spoken placeholder", () => {
    const input = "Here is the code:\n```typescript\nconst x = 1;\n```\nDone!";
    const output = formatMarkdownForSpeech(input);
    expect(output).toContain("I have provided the code in the chat.");
    expect(output).not.toContain("const x = 1;");
  });

  it("converts headings to punctuated sentences", () => {
    const input = "# Voice Engine\nThis is a test";
    const output = formatMarkdownForSpeech(input);
    expect(output).toContain("Voice Engine.");
  });

  it("removes bold, italic, and strikethrough markers", () => {
    const input = "This is **bold** and *italic* and ~~deleted~~ text.";
    const output = formatMarkdownForSpeech(input);
    expect(output).toBe("This is bold and italic and deleted text.");
  });

  it("replaces URLs with link in chat placeholder", () => {
    const input = "Visit https://example.com for more info.";
    const output = formatMarkdownForSpeech(input);
    expect(output).toContain("link in chat");
    expect(output).not.toContain("https://example.com");
  });

  it("formats numbered lists as Step 1, Step 2", () => {
    const input = "1. First step\n2. Second step";
    const output = formatMarkdownForSpeech(input);
    expect(output).toContain("Step 1, First step.");
    expect(output).toContain("Step 2, Second step.");
  });

  it("strips decorative emojis", () => {
    const input = "Hello world! 🚀✨";
    const output = formatMarkdownForSpeech(input);
    expect(output).toBe("Hello world!");
  });
});
