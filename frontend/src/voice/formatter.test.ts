import { describe, expect, it } from "vitest";
import { formatMarkdownForSpeech } from "./formatter";

describe("formatMarkdownForSpeech", () => {
  it("replaces code blocks with a friendly spoken placeholder", () => {
    const input = "Here is the solution:\n```js\nconst x = 10;\nconsole.log(x);\n```\nLet me know if you need more help!";
    const output = formatMarkdownForSpeech(input);

    expect(output).toContain("I have provided the code in the chat.");
    expect(output).not.toContain("const x = 10");
    expect(output).not.toContain("```");
  });

  it("strips heading hashes and adds punctuation pauses", () => {
    const input = "# Main Title\n## Section One\n### Sub-heading";
    const output = formatMarkdownForSpeech(input);

    expect(output).toBe("Main Title. Section One. Sub-heading.");
    expect(output).not.toContain("#");
  });

  it("removes bold, italic, and strikethrough formatting tags", () => {
    const input = "This is **bold**, *italic*, __underline__, and ~~strikethrough~~ text.";
    const output = formatMarkdownForSpeech(input);

    expect(output).toBe("This is bold, italic, underline, and strikethrough text.");
  });

  it("formats bullet lists and numbered lists into natural speech", () => {
    const bulletInput = "- First item\n* Second item\n+ Third item";
    expect(formatMarkdownForSpeech(bulletInput)).toBe("First item. Second item. Third item.");

    const numberedInput = "1. Open the app\n2. Click settings\n3. Save changes";
    expect(formatMarkdownForSpeech(numberedInput)).toBe("Step 1, Open the app. Step 2, Click settings. Step 3, Save changes.");
  });

  it("converts markdown links and raw URLs into clean spoken text", () => {
    const linkInput = "Check out [our website](https://example.com) for details.";
    expect(formatMarkdownForSpeech(linkInput)).toBe("Check out our website for details.");

    const rawUrlInput = "Visit https://aether.ai/docs to learn more.";
    expect(formatMarkdownForSpeech(rawUrlInput)).toBe("Visit link in chat to learn more.");
  });

  it("formats tables without raw pipe syntax", () => {
    const tableInput = "| Name | Role |\n| --- | --- |\n| Alice | Developer |\n| Bob | Designer |";
    const output = formatMarkdownForSpeech(tableInput);

    expect(output).not.toContain("|");
    expect(output).toContain("Name, Role.");
    expect(output).toContain("Alice, Developer.");
  });

  it("strips decorative emojis while preserving text", () => {
    const emojiInput = "Hello Aether! 🚀🔥 Have a great day! 😊";
    const output = formatMarkdownForSpeech(emojiInput);

    expect(output).toBe("Hello Aether! Have a great day!");
  });
});
