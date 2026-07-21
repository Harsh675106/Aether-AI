import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MarkdownMessage } from "./Markdown/MarkdownMessage";

describe("MarkdownMessage", () => {
  it("renders markdown headings, lists, and code blocks with copy support", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText },
    });

    render(
      <MarkdownMessage
        content={"# Heading\n\n- item one\n- item two\n\n```ts\nconst answer = 42;\n```"}
      />
    );

    expect(screen.getByText("Heading")).toBeInTheDocument();
    expect(screen.getByText("item one")).toBeInTheDocument();
    expect(document.querySelector("code")).toHaveTextContent(/const\s+answer\s+=\s+42;/);

    fireEvent.click(screen.getByRole("button", { name: /copy/i }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("const answer = 42;"));
  });

  it("renders plain URLs as clickable links", () => {
    render(<MarkdownMessage content="Visit https://example.com/docs for details." />);

    const link = screen.getByRole("link", { name: /https:\/\/example\.com\/docs/i });
    expect(link).toHaveAttribute("href", "https://example.com/docs");
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("renders callout-style paragraphs using the shared callout configuration", () => {
    render(<MarkdownMessage content="Warning: This needs attention." />);

    expect(screen.getByRole("note", { name: /warning/i })).toBeInTheDocument();
    expect(screen.getAllByText(/this needs attention/i).length).toBeGreaterThan(0);
  });

  it("strips duplicate or repeated callout prefixes from callout content", () => {
    render(<MarkdownMessage content="**Summary:**\nSummary: This is the summary content." />);

    expect(screen.getByRole("note", { name: /summary/i })).toBeInTheDocument();
    expect(screen.getByText("This is the summary content.")).toBeInTheDocument();
    expect(screen.queryByText("Summary:")).toBeNull();
  });

  it("renders blockquote-style callouts as CalloutBlock elements directly without nesting", () => {
    render(<MarkdownMessage content="> [!IMPORTANT]\n> This is an important blockquote callout." />);

    expect(screen.getByRole("note", { name: /important/i })).toBeInTheDocument();
    expect(screen.getByText("This is an important blockquote callout.")).toBeInTheDocument();
  });
});


