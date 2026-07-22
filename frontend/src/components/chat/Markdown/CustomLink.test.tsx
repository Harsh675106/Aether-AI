import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import { CustomLink, normalizeUrl, openExternalLink } from "./blocks/CustomLink";
import { MarkdownMessage } from "./MarkdownMessage";

vi.mock("@tauri-apps/plugin-shell", () => ({
  open: vi.fn().mockResolvedValue(undefined),
}));

import { open as tauriOpen } from "@tauri-apps/plugin-shell";

describe("CustomLink & URL opening", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    delete (window as any).__TAURI_INTERNALS__;
    delete (window as any).__TAURI__;
  });

  describe("normalizeUrl", () => {
    it("prepends https:// to URLs without protocol schemes", () => {
      expect(normalizeUrl("www.example.com")).toBe("https://www.example.com");
      expect(normalizeUrl("example.com")).toBe("https://example.com");
    });

    it("preserves existing protocol schemes", () => {
      expect(normalizeUrl("https://example.com/path")).toBe("https://example.com/path");
      expect(normalizeUrl("http://localhost:8080")).toBe("http://localhost:8080");
      expect(normalizeUrl("mailto:test@example.com")).toBe("mailto:test@example.com");
    });

    it("handles empty or whitespace inputs gracefully", () => {
      expect(normalizeUrl("")).toBe("");
      expect(normalizeUrl("   ")).toBe("");
    });
  });

  describe("openExternalLink", () => {
    it("invokes Tauri plugin open when running inside Tauri desktop shell", async () => {
      (window as any).__TAURI_INTERNALS__ = {};

      await openExternalLink("www.google.com");
      expect(tauriOpen).toHaveBeenCalledWith("https://www.google.com");
    });

    it("opens links via window.open in browser context", async () => {
      const openSpy = vi.spyOn(window, "open").mockImplementation(() => ({}) as Window);

      await openExternalLink("https://searxng.org");
      expect(openSpy).toHaveBeenCalledWith("https://searxng.org", "_blank", "noopener,noreferrer");
      openSpy.mockRestore();
    });
  });

  describe("CustomLink component & Markdown rendering", () => {
    it("renders Markdown links and leaves browser-native navigation enabled", () => {
      const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);

      render(<MarkdownMessage content="Check out [Aether AI](https://aether.ai) for details." />);

      const linkElement = screen.getByRole("link", { name: /aether ai/i });
      expect(linkElement).toBeInTheDocument();
      expect(linkElement).toHaveAttribute("href", "https://aether.ai");

      fireEvent.click(linkElement);
      expect(openSpy).not.toHaveBeenCalled();
      openSpy.mockRestore();
    });

    it("renders plain URLs (https and www) as clickable links in MarkdownMessage", () => {
      const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);

      render(<MarkdownMessage content="Visit https://example.com and www.google.com for more info." />);

      const link1 = screen.getByRole("link", { name: /https:\/\/example.com/i });
      const link2 = screen.getByRole("link", { name: /www.google.com/i });

      expect(link1).toHaveAttribute("href", "https://example.com");
      expect(link2).toHaveAttribute("href", "https://www.google.com");

      fireEvent.click(link2);
      expect(openSpy).not.toHaveBeenCalled();
      openSpy.mockRestore();
    });
  });
});
