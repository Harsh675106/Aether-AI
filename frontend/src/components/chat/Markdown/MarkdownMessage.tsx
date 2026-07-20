import { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";

import { AnimatedBlock } from "./blocks/AnimatedBlock";
import { CustomHeading } from "./blocks/Heading";
import { CustomTable } from "./blocks/CustomTable";
import { CustomBlockquote } from "./blocks/CustomBlockQuote";
import { CustomLink } from "./blocks/CustomLink";
import { CustomImage } from "./blocks/CustomImage";

import { CodeBlock } from "./blocks/CodeBlock";
import { CalloutBlock } from "./blocks/CalloutBlock";
import type { MarkdownMessageProps } from "./types";
import { getCalloutType } from "./utils";

function prepareContentForMarkdown(content: string) {
  if (!content) {
    return content;
  }

  return content.replace(
    /(?<!\]\()(?<!\]\[)(?<!\()(?<!\[)(https?:\/\/[^\s<>()]+)/g,
    (url) => {
      const cleanUrl = url.replace(/[.,;:!?]+$/, "");
      return `[${cleanUrl}](${cleanUrl})`;
    }
  );
}

export function MarkdownMessage({ content }: MarkdownMessageProps) {
  const preparedContent = useMemo(() => prepareContentForMarkdown(content), [content]);

  const renderers = useMemo(
    () => ({
      h1: ({ children }: any) => <CustomHeading level={1}>{children}</CustomHeading>,
      h2: ({ children }: any) => <CustomHeading level={2}>{children}</CustomHeading>,
      h3: ({ children }: any) => <CustomHeading level={3}>{children}</CustomHeading>,
      h4: ({ children }: any) => <CustomHeading level={4}>{children}</CustomHeading>,
      h5: ({ children }: any) => <CustomHeading level={5}>{children}</CustomHeading>,
      h6: ({ children }: any) => <CustomHeading level={6}>{children}</CustomHeading>,

      code: ({ inline, className, children }: any) => {
        if (inline) {
          return (
            <code
              className="
    rounded-md
    border
    border-sky-500/15
    bg-sky-500/10
    px-1.5
    py-[2px]
    font-mono
    text-[0.9em]
    font-medium
    text-cyan-300
  "
            >
              {children}
            </code>
          );
        }

        return <CodeBlock className={className}>{children}</CodeBlock>;
      },

      p: ({ children, node }: any) => {
        const textContent = node?.children?.map((child: any) => child.value ?? "").join("") ?? "";
        const callout = getCalloutType(textContent);

        if (callout) {
          const { config } = callout;
          return (
            <CalloutBlock title={textContent} config={config}>
              <p className={`text-sm leading-7 ${config.text}`}>{children}</p>
            </CalloutBlock>
          );
        }

        return (
          <AnimatedBlock>
            <p
              className="
    my-4
    text-[15.5px]
    leading-8
    text-slate-200/95
    [text-wrap:pretty]
  "
            >
              {children}
            </p>
          </AnimatedBlock>
        );
      },

      ul: ({ children }: any) => (
        <AnimatedBlock>
          <ul
            className="
    my-5
    space-y-3
    pl-2
  "
          >
            {children}
          </ul>
        </AnimatedBlock>
      ),

      ol: ({ children }: any) => (
        <AnimatedBlock>
          <ol
            className="
    my-5
    space-y-3
    pl-2
    [counter-reset:custom-counter]
  "
          >
            {children}
          </ol>
        </AnimatedBlock>
      ),

      li: ({ children, checked, ...props }: any) => {
        if (checked !== undefined && checked !== null) {
          return (
            <li className="flex items-start gap-3 py-0.5 text-base text-slate-300">
              <span className="flex h-5 items-center justify-center">
                <input
                  type="checkbox"
                  checked={checked}
                  readOnly
                  className="pointer-events-none h-4 w-4 rounded border-white/20 bg-slate-950 accent-sky-500"
                />
              </span>

              <span className={checked ? "line-through text-slate-500" : ""}>{children}</span>
            </li>
          );
        }

        const isOrdered = props.node?.parent?.tagName === "ol";

        if (isOrdered) {
          return (
            <li className="group flex items-start gap-3 py-0.5 text-base text-slate-300 [counter-increment:custom-counter]">
              <span
                className="
                  flex h-6 w-6 shrink-0 items-center justify-center
                  rounded-full border bg-sky-500/10
border-sky-500/20
                  font-mono text-xs font-semibold text-sky-400
                  transition-colors
                  before:content-[counter(custom-counter)]
                  group-hover:border-sky-500/20
                  group-hover:bg-sky-500/10
                "
              />

              <div className="flex-1 pt-0.5">{children}</div>
            </li>
          );
        }

        return (
          <li className="group flex items-start gap-3 py-0.5 text-base text-slate-300">
            <span className="flex h-6 w-2.5 shrink-0 items-center justify-center">
              <div
                className="
    mt-[11px]
    h-1.5
    w-1.5
    rounded-full
    bg-sky-400/70
    transition-all
    duration-300
    group-hover:scale-125
    group-hover:bg-sky-300
  "
              />
            </span>

            <div className="flex-1">{children}</div>
          </li>
        );
      },

      table: ({ children }: any) => <CustomTable>{children}</CustomTable>,

      thead: ({ children }: any) => (
        <thead className="sticky top-0 z-10 border-b border-white/10 bg-slate-900/80 backdrop-blur-md">
          {children}
        </thead>
      ),

      tbody: ({ children }: any) => <tbody className="divide-y divide-white/5">{children}</tbody>,

      tr: ({ children }: any) => (
        <tr
          className="
    even:bg-white/[0.02]
    transition-colors
    hover:bg-sky-500/[0.05]
  "
        >
          {children}
        </tr>
      ),

      th: ({ children }: any) => (
        <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-200">
          {children}
        </th>
      ),

      td: ({ children }: any) => <td className="px-4 py-3 text-sm text-slate-300">{children}</td>,

      blockquote: ({ children }: any) => <CustomBlockquote>{children}</CustomBlockquote>,

      a: ({ href, children }: any) => <CustomLink href={href}>{children}</CustomLink>,

      img: ({ src, alt }: any) => <CustomImage src={src} alt={alt} />,

      hr: () => (
        <AnimatedBlock>
          <hr className="my-8 h-px border-none bg-gradient-to-r from-transparent via-white/15 to-transparent" />
        </AnimatedBlock>
      ),

      strong: ({ children }: any) => (
        <strong className="font-semibold tracking-wide text-white">{children}</strong>
      ),

      em: ({ children }: any) => <em className="italic text-slate-200">{children}</em>,
    }),
    [],
  );

  return (
    <div
      className="
    markdown-body
    w-full
    max-w-none
    rounded-[1.15rem]
    border
    border-white/10
    bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.12),_transparent_28%),rgba(2,6,23,0.65)]
    p-3
    text-[15.5px]
    leading-8
    tracking-[0.01em]
    text-slate-200/95
    shadow-[0_10px_35px_rgba(2,8,23,0.45)]
    antialiased
    break-words
    selection:bg-sky-500/30
    selection:text-white
  "
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={renderers}
      >
        {preparedContent}
      </ReactMarkdown>
    </div>
  );
}
