import { Copy } from "lucide-react";
import { useMemo, useState } from "react";

type MarkdownMessageProps = {
  content: string;
};

function splitBlocks(content: string) {
  const lines = content.split(/\r?\n/);
  const blocks: string[] = [];
  let current: string[] = [];

  const flush = () => {
    if (current.length > 0) {
      blocks.push(current.join("\n"));
      current = [];
    }
  };

  for (const line of lines) {
    if (line.trim() === "" && current.length > 0) {
      flush();
      continue;
    }
    current.push(line);
  }
  flush();
  return blocks.filter(Boolean);
}

function renderInline(text: string) {
  const parts: Array<string | { type: "link"; href: string; children: string }> = [];
  const linkPattern = /https?:\/\/[^\s)]+/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = linkPattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const href = match[0];
    parts.push({ type: "link", href, children: href });
    lastIndex = match.index + href.length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.map((part, index) => {
    if (typeof part === "string") {
      const segments = part.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g).filter(Boolean);
      return (
        <span key={`${part}-${index}`}>
          {segments.map((segment, segmentIndex) => {
            if (segment.startsWith("**") && segment.endsWith("**")) {
              return <strong key={`${segment}-${segmentIndex}`}>{segment.slice(2, -2)}</strong>;
            }
            if (segment.startsWith("*") && segment.endsWith("*")) {
              return <em key={`${segment}-${segmentIndex}`}>{segment.slice(1, -1)}</em>;
            }
            if (segment.startsWith("`") && segment.endsWith("`")) {
              return <code key={`${segment}-${segmentIndex}`} className="rounded bg-white/10 px-1 py-0.5 text-[0.9em] text-sky-200">{segment.slice(1, -1)}</code>;
            }
            return <span key={`${segment}-${segmentIndex}`}>{segment}</span>;
          })}
        </span>
      );
    }

    return (
      <a key={`${part.href}-${index}`} href={part.href} target="_blank" rel="noreferrer" className="break-all text-sky-200 underline decoration-sky-300/60 underline-offset-2">
        {part.children}
      </a>
    );
  });
}

function CodeBlock({ code, language }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };

  return (
    <div className="my-4 overflow-hidden rounded-2xl border border-white/10 bg-slate-950/95 shadow-[0_0_35px_rgba(56,189,248,0.08)]">
      <div className="flex items-center justify-between border-b border-white/10 bg-slate-900/90 px-3 py-2 text-[11px] uppercase tracking-[0.24em] text-slate-300">
        <span>{language || "text"}</span>
        <button type="button" onClick={handleCopy} className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-slate-200 transition hover:bg-white/10">
          <Copy className="h-3.5 w-3.5" />
          {copied ? "Copied" : "Copy code"}
        </button>
      </div>
      <pre className="overflow-x-auto whitespace-pre-wrap p-4 text-sm text-slate-100">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export function MarkdownMessage({ content }: MarkdownMessageProps) {
  const blocks = useMemo(() => splitBlocks(content), [content]);

  return (
    <div className="prose prose-in prose-slate max-w-none break-words text-inherit [&_a]:text-sky-200 [&_a]:underline [&_a]:decoration-sky-300/60 [&_a]:underline-offset-2 [&_blockquote]:border-sky-300/40 [&_blockquote]:bg-white/5 [&_blockquote]:px-4 [&_blockquote]:py-3 [&_blockquote]:text-slate-200 [&_code]:rounded [&_code]:bg-white/10 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[0.9em] [&_code]:text-sky-200 [&_h1]:mt-4 [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:mt-4 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:mt-3 [&_h3]:text-base [&_h3]:font-semibold [&_li]:mb-1 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-2 [&_table]:my-4 [&_table]:w-full [&_table]:overflow-hidden [&_table]:rounded-xl [&_table]:border [&_table]:border-white/10 [&_table]:text-sm [&_th]:bg-white/10 [&_th]:px-3 [&_th]:py-2 [&_td]:px-3 [&_td]:py-2 [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6">
      {blocks.map((block, index) => {
        const trimmed = block.trim();
        if (!trimmed) {
          return null;
        }

        if (trimmed.startsWith("## Sources")) {
          return (
            <div key={`${trimmed}-${index}`} className="mt-4 rounded-2xl border border-sky-400/20 bg-sky-400/10 p-4">
              <div className="whitespace-pre-wrap text-sm">{trimmed}</div>
            </div>
          );
        }

        const codeFenceMatch = trimmed.match(/^```([\w+-]*)\s*\n([\s\S]*?)\s*```$/);
        if (codeFenceMatch) {
          return <CodeBlock key={`${trimmed}-${index}`} code={codeFenceMatch[2]} language={codeFenceMatch[1] || undefined} />;
        }

        if (/^#{1,3}\s/.test(trimmed)) {
          const level = trimmed.match(/^#+/)?.[0].length ?? 1;
          const text = trimmed.replace(/^#{1,3}\s/, "");
          const className = level === 1 ? "text-xl font-semibold" : level === 2 ? "text-lg font-semibold" : "text-base font-semibold";
          const Tag = (level === 1 ? "h1" : level === 2 ? "h2" : "h3") as keyof JSX.IntrinsicElements;
          return <Tag key={`${trimmed}-${index}`} className={className}>{renderInline(text)}</Tag>;
        }

        if (/^[-*]\s+/.test(trimmed)) {
          const items = trimmed.split(/\n/).filter((line) => /^[-*]\s+/.test(line.trim()));
          return (
            <ul key={`${trimmed}-${index}`} className="my-3 list-disc pl-6">
              {items.map((item, itemIndex) => (
                <li key={`${item}-${itemIndex}`} className="mb-1">{renderInline(item.replace(/^[-*]\s+/, ""))}</li>
              ))}
            </ul>
          );
        }

        if (/^\d+\.\s+/.test(trimmed)) {
          const items = trimmed.split(/\n/).filter((line) => /^\d+\.\s+/.test(line.trim()));
          return (
            <ol key={`${trimmed}-${index}`} className="my-3 list-decimal pl-6">
              {items.map((item, itemIndex) => (
                <li key={`${item}-${itemIndex}`} className="mb-1">{renderInline(item.replace(/^\d+\.\s+/, ""))}</li>
              ))}
            </ol>
          );
        }

        if (/^\|/.test(trimmed)) {
          const rows = trimmed.split(/\n/).filter(Boolean);
          const headers = rows[0].split("|").filter(Boolean).map((cell) => cell.trim());
          const body = rows.slice(1).map((row) => row.split("|").filter(Boolean).map((cell) => cell.trim()));
          return (
            <div key={`${trimmed}-${index}`} className="my-4 overflow-x-auto">
              <table className="min-w-full rounded-xl border border-white/10 text-sm">
                <thead>
                  <tr>
                    {headers.map((header, headerIndex) => (
                      <th key={`${header}-${headerIndex}`} className="border-b border-white/10 bg-white/10 px-3 py-2 text-left font-semibold">
                        {renderInline(header)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {body.map((row, rowIndex) => (
                    <tr key={`${rowIndex}-${row.join("-")}`}>
                      {row.map((cell, cellIndex) => (
                        <td key={`${cell}-${cellIndex}`} className="border-t border-white/10 px-3 py-2">
                          {renderInline(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }

        if (trimmed.startsWith(">")) {
          return (
            <blockquote key={`${trimmed}-${index}`} className="my-4 rounded-xl border border-sky-300/20 bg-white/5 px-4 py-3 text-slate-200">
              {renderInline(trimmed.replace(/^>/, ""))}
            </blockquote>
          );
        }

        if (trimmed === "---") {
          return <hr key={`${trimmed}-${index}`} className="my-5 border-white/10" />;
        }

        return <p key={`${trimmed}-${index}`} className="my-2 leading-7">{renderInline(trimmed)}</p>;
      })}
    </div>
  );
}
