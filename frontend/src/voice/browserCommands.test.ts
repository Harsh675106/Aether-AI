import { describe, expect, it } from "vitest";
import { parseBrowserVoiceCommand, normalizeUrl } from "./browserCommands";

describe("Browser Commands Voice & Text Parser", () => {
  it("normalizes known websites to full URLs", () => {
    expect(normalizeUrl("youtube")).toBe("https://www.youtube.com");
    expect(normalizeUrl("google")).toBe("https://www.google.com");
    expect(normalizeUrl("github")).toBe("https://github.com");
    expect(normalizeUrl("reddit")).toBe("https://www.reddit.com");
    expect(normalizeUrl("https://example.com")).toBe("https://example.com");
    expect(normalizeUrl("ai.google.dev")).toBe("https://ai.google.dev");
  });

  it("normalizes search query when not a url", () => {
    expect(normalizeUrl("quantum computers")).toContain("google.com/search?q=quantum%20computers");
  });

  it("parses open commands", () => {
    const cmd1 = parseBrowserVoiceCommand("open youtube");
    expect(cmd1).not.toBeNull();
    expect(cmd1?.action).toBe("open");
    expect(cmd1?.url).toBe("https://www.youtube.com");

    const cmd2 = parseBrowserVoiceCommand("navigate to github.com");
    expect(cmd2).not.toBeNull();
    expect(cmd2?.action).toBe("navigate");
    expect(cmd2?.url).toBe("https://github.com");
  });

  it("routes browser apps, URL commands, and web searches to the floating browser", () => {
    expect(parseBrowserVoiceCommand("open youtube.com")?.action).toBe("open");
    expect(parseBrowserVoiceCommand("open youtube.com.")?.action).toBe("open");
    expect(parseBrowserVoiceCommand("go to youtube.com")?.action).toBe("navigate");
    expect(parseBrowserVoiceCommand("open chrome")?.action).toBe("open");
    expect(parseBrowserVoiceCommand("open edge")?.action).toBe("open");
    expect(parseBrowserVoiceCommand("open browser")?.action).toBe("open");
    expect(parseBrowserVoiceCommand("open youtube.com")?.url).toBe("https://youtube.com");
    expect(parseBrowserVoiceCommand("open youtube.com.")?.url).toBe("https://youtube.com");
    expect(parseBrowserVoiceCommand("search for python tutorials")?.url).toBe(
      "https://www.google.com/search?q=python%20tutorials"
    );
    expect(parseBrowserVoiceCommand("google python tutorials")?.url).toBe(
      "https://www.google.com/search?q=python%20tutorials"
    );
  });

  it("parses window management commands", () => {
    expect(parseBrowserVoiceCommand("minimize browser")?.action).toBe("hide");
    expect(parseBrowserVoiceCommand("hide browser")?.action).toBe("hide");
    expect(parseBrowserVoiceCommand("show browser")?.action).toBe("show");
    expect(parseBrowserVoiceCommand("restore browser")?.action).toBe("show");
    expect(parseBrowserVoiceCommand("maximize browser")?.action).toBe("maximize");
    expect(parseBrowserVoiceCommand("expand browser")?.action).toBe("maximize");
    expect(parseBrowserVoiceCommand("close browser")?.action).toBe("close");
    expect(parseBrowserVoiceCommand("float browser")?.action).toBe("float");
    expect(parseBrowserVoiceCommand("keep browser always on top")?.action).toBe("always-on-top");
    expect(parseBrowserVoiceCommand("keep browser always on top")?.alwaysOnTop).toBe(true);
    expect(parseBrowserVoiceCommand("unpin browser")?.alwaysOnTop).toBe(false);
  });

  it("parses snap positions", () => {
    expect(parseBrowserVoiceCommand("move browser to the right")?.snapPosition).toBe("right-half");
    expect(parseBrowserVoiceCommand("move browser to the left")?.snapPosition).toBe("left-half");
    expect(parseBrowserVoiceCommand("move browser to top right")?.snapPosition).toBe("top-right");
    expect(parseBrowserVoiceCommand("center browser")?.snapPosition).toBe("center");
  });
});
