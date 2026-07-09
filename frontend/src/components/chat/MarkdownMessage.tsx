import React, { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Copy, 
  Check, 
  Sparkles, 
  Lightbulb, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Star, 
  Pin, 
  ArrowRight, 
  Info, 
  ExternalLink,
  ChevronRight,
  Maximize2
} from "lucide-react";

// ==========================================
// TYPES & CONFIGURATION
// ==========================================

type MarkdownMessageProps = {
  content: string;
};

type CalloutConfig = {
  icon: React.ComponentType<{ className?: string }>;
  bg: string;
  border: string;
  text: string;
  accent: string;
  emoji: string;
};

const CALLOUT_MAP: Record<string, CalloutConfig> = {
  summary: { icon: Sparkles, bg: "bg-amber-500/5", border: "border-amber-500/20", text: "text-amber-200", accent: "text-amber-400", emoji: "✨" },
  overview: { icon: Sparkles, bg: "bg-amber-500/5", border: "border-amber-500/20", text: "text-amber-200", accent: "text-amber-400", emoji: "✨" },
  tips: { icon: Lightbulb, bg: "bg-emerald-500/5", border: "border-emerald-500/20", text: "text-emerald-200", accent: "text-emerald-400", emoji: "💡" },
  warning: { icon: AlertTriangle, bg: "bg-rose-500/5", border: "border-rose-500/20", text: "text-rose-200", accent: "text-rose-400", emoji: "⚠" },
  important: { icon: AlertTriangle, bg: "bg-rose-500/5", border: "border-rose-500/20", text: "text-rose-200", accent: "text-rose-400", emoji: "⚠" },
  pros: { icon: CheckCircle, bg: "bg-teal-500/5", border: "border-teal-500/20", text: "text-teal-200", accent: "text-teal-400", emoji: "✅" },
  cons: { icon: XCircle, bg: "bg-red-500/5", border: "border-red-500/20", text: "text-red-200", accent: "text-red-400", emoji: "❌" },
  recommendation: { icon: Star, bg: "bg-indigo-500/5", border: "border-indigo-500/20", text: "text-indigo-200", accent: "text-indigo-400", emoji: "⭐" },
  bestfor: { icon: Star, bg: "bg-indigo-500/5", border: "border-indigo-500/20", text: "text-indigo-200", accent: "text-indigo-400", emoji: "⭐" },
  keypoints: { icon: Pin, bg: "bg-cyan-500/5", border: "border-cyan-500/20", text: "text-cyan-200", accent: "text-cyan-400", emoji: "📌" },
  notes: { icon: Pin, bg: "bg-cyan-500/5", border: "border-cyan-500/20", text: "text-cyan-200", accent: "text-cyan-400", emoji: "📌" },
  nextsteps: { icon: ArrowRight, bg: "bg-purple-500/5", border: "border-purple-500/20", text: "text-purple-200", accent: "text-purple-400", emoji: "➡" },
};

function getCalloutType(text: string): { type: string; config: CalloutConfig; cleanText: string } | null {
  const normalized = text.toLowerCase().replace(/[^a-z0-9]/g, "");
  for (const key in CALLOUT_MAP) {
    if (normalized.includes(key)) {
      return { type: key, config: CALLOUT_MAP[key], cleanText: text };
    }
  }
  return null;
}

// ==========================================
// ANIMATION VARIANTS
// ==========================================

const blockVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { type: "spring", stiffness: 260, damping: 20 }
  }
};

// ==========================================
// SUB-COMPONENTS
// ==========================================

const AnimatedBlock = React.memo(({ children }: { children: React.ReactNode }) => (
  <motion.div 
    variants={blockVariants} 
    initial="hidden" 
    whileInView="visible" 
    viewport={{ once: true, margin: "-20px" }}
    className="w-full"
  >
    {children}
  </motion.div>
));
AnimatedBlock.displayName = "AnimatedBlock";

const CustomHeading = React.memo(({ level, children }: { level: number; children: React.ReactNode }) => {
  let textContent = "";
  React.Children.forEach(children, (child) => {
    if (typeof child === "string") textContent += child;
  });

  const callout = getCalloutType(textContent);

  if (callout) {
    const { config } = callout;
    const Icon = config.icon;
    return (
      <AnimatedBlock>
        <div className={`my-6 flex items-center gap-3 rounded-xl border ${config.border} ${config.bg} px-4 py-3 shadow-lg backdrop-blur-sm`}>
          <Icon className={`h-5 w-5 ${config.accent} shrink-0`} />
          <span className={`text-base font-semibold uppercase tracking-wider ${config.accent}`}>
            {textContent}
          </span>
        </div>
      </AnimatedBlock>
    );
  }

  const colorClass = 
    level === 1 ? "text-slate-100 text-2xl md:text-3xl border-sky-500/50" :
    level === 2 ? "text-slate-200 text-xl md:text-2xl border-purple-500/50" :
    "text-slate-300 text-lg md:text-xl border-emerald-500/50";

  const marginClass = level === 1 ? "mt-8 mb-4" : level === 2 ? "mt-6 mb-3" : "mt-5 mb-2";

  return (
    <AnimatedBlock>
      <div className={`group flex items-center gap-3 font-semibold tracking-tight ${colorClass} ${marginClass}`}>
        <span className="text-sky-400/70 font-light select-none tracking-tighter">┃</span>
        {children}
      </div>
    </AnimatedBlock>
  );
});
CustomHeading.displayName = "CustomHeading";

const extractTextContent = (node: React.ReactNode): string => {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractTextContent).join("");
  if (React.isValidElement<{ children?: React.ReactNode }>(node)) {
    return extractTextContent(node.props.children);
  }
  return "";
};
const CodeBlock = React.memo(({ className, children }: { className?: string; children: React.ReactNode }) => {
  const [copied, setCopied] = useState(false);
  const match = /language-(\w+)/.exec(className || "");
  const language = match ? match[1] : "text";
  
  const rawCode = useMemo(() => {
    return extractTextContent(children).replace(/\n$/, "");
  }, [children]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(rawCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <AnimatedBlock>
      <div className="group relative my-6 overflow-hidden rounded-xl border border-white/10 bg-slate-950/95 shadow-xl transition-all duration-300 hover:border-sky-500/20 hover:shadow-[0_0_30px_rgba(56,189,248,0.03)]">
        <div className="flex h-11 items-center justify-between border-b border-white/5 bg-slate-900/80 px-4 text-xs font-medium tracking-wider text-slate-400">
          <span className="uppercase text-sky-400/80 font-mono">{language}</span>
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 rounded-md border border-white/5 bg-white/5 px-2.5 py-1 text-xs text-slate-300 transition-all duration-200 hover:bg-sky-500/10 hover:text-sky-300 group-hover:border-white/10"
          >
            <AnimatePresence mode="wait" initial={false}>
              {copied ? (
                <motion.span
                  key="copied"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="flex items-center gap-1 text-emerald-400"
                >
                  <Check className="h-3.5 w-3.5" />
                  Copied
                </motion.span>
              ) : (
                <motion.span
                  key="copy"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="flex items-center gap-1"
                >
                  <Copy className="h-3.5 w-3.5" />
                  Copy code
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        </div>
        <pre className="overflow-x-auto p-4 font-mono text-sm leading-relaxed text-slate-200 scrollbar-thin scrollbar-thumb-white/10">
          <code className={className}>{children}</code>
        </pre>
      </div>
    </AnimatedBlock>
  );
});
CodeBlock.displayName = "CodeBlock";

const CustomTable = React.memo(({ children }: { children: React.ReactNode }) => {
  return (
    <AnimatedBlock>
      <div className="my-6 w-full overflow-hidden rounded-xl border border-white/10 bg-slate-900/20 shadow-md backdrop-blur-sm">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm text-slate-300">
            {children}
          </table>
        </div>
      </div>
    </AnimatedBlock>
  );
});
CustomTable.displayName = "CustomTable";

const CustomBlockquote = React.memo(({ children }: { children: React.ReactNode }) => {
  return (
    <AnimatedBlock>
      <div className="relative my-6 flex items-start gap-4 rounded-xl border-l-4 border-sky-500 bg-gradient-to-r from-sky-500/10 to-transparent p-4 shadow-sm">
        <div className="absolute top-4 right-4 text-sky-500/10 select-none">
          <Info className="h-12 w-12" />
        </div>
        <div className="relative z-10 text-slate-300 leading-relaxed italic w-full">
          {children}
        </div>
      </div>
    </AnimatedBlock>
  );
});
CustomBlockquote.displayName = "CustomBlockquote";

const CustomLink = React.memo(({ href, children }: { href?: string; children: React.ReactNode }) => {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-0.5 group relative font-medium text-sky-400 no-underline transition-colors duration-200 hover:text-sky-300"
    >
      <span>{children}</span>
      <ExternalLink className="h-3 w-3 opacity-60 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
      <span className="absolute bottom-0 left-0 h-[1px] w-full scale-x-0 bg-sky-400 transition-transform duration-200 origin-left group-hover:scale-x-100 group-hover:bg-sky-300" />
    </a>
  );
});
CustomLink.displayName = "CustomLink";

const CustomImage = React.memo(({ src, alt }: { src?: string; alt?: string }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <AnimatedBlock>
      <div className="my-6">
        <div 
          onClick={() => setIsOpen(true)}
          className="group relative cursor-zoom-in overflow-hidden rounded-xl border border-white/10 shadow-lg transition-all duration-300 hover:border-white/20"
        >
          <img 
            src={src} 
            alt={alt} 
            className="w-full max-h-[450px] object-cover transition-transform duration-300 group-hover:scale-[1.01]"
            loading="lazy"
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors duration-300 group-hover:bg-black/20">
            <Maximize2 className="h-6 w-6 text-white opacity-0 transform scale-90 transition-all duration-300 group-hover:opacity-100 group-hover:scale-100" />
          </div>
        </div>
        {alt && <p className="mt-2 text-center text-xs text-slate-400 italic">{alt}</p>}

        <AnimatePresence>
          {isOpen && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 cursor-zoom-out"
            >
              <motion.img 
                initial={{ scale: 0.95 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.95 }}
                src={src} 
                alt={alt} 
                className="max-h-full max-w-full rounded-lg object-contain shadow-2xl"
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AnimatedBlock>
  );
});
CustomImage.displayName = "CustomImage";

// ==========================================
// MAIN COMPONENT
// ==========================================

export function MarkdownMessage({ content }: MarkdownMessageProps) {
  const renderers = useMemo(() => ({
    h1: ({ children }: any) => <CustomHeading level={1}>{children}</CustomHeading>,
    h2: ({ children }: any) => <CustomHeading level={2}>{children}</CustomHeading>,
    h3: ({ children }: any) => <CustomHeading level={3}>{children}</CustomHeading>,
    h4: ({ children }: any) => <CustomHeading level={4}>{children}</CustomHeading>,
    h5: ({ children }: any) => <CustomHeading level={5}>{children}</CustomHeading>,
    h6: ({ children }: any) => <CustomHeading level={6}>{children}</CustomHeading>,
    
    code: ({ node, inline, className, children, ...props }: any) => {
      if (inline) {
        return (
          <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[0.85em] text-cyan-300 border border-white/5">
            {children}
          </code>
        );
      }
      return <CodeBlock className={className}>{children}</CodeBlock>;
    },
    
    p: ({ children }: any) => (
      <AnimatedBlock>
        <p className="my-3 text-base leading-7 text-slate-300 font-normal tracking-normal">{children}</p>
      </AnimatedBlock>
    ),
    
    ul: ({ children }: any) => (
      <AnimatedBlock>
        <ul className="my-4 space-y-2 pl-1">{children}</ul>
      </AnimatedBlock>
    ),
    
    ol: ({ children }: any) => (
      <AnimatedBlock>
        <ol className="my-4 space-y-2 pl-1 [counter-reset:custom-counter]">{children}</ol>
      </AnimatedBlock>
    ),
    
    li: ({ children, checked, ...props }: any) => {
      // Handle Task Lists
      if (checked !== undefined && checked !== null) {
        return (
          <li className="flex items-start gap-3 text-base text-slate-300 py-0.5">
            <span className="flex h-5 items-center justify-center">
              <input 
                type="checkbox" 
                checked={checked} 
                readOnly 
                className="h-4 w-4 rounded border-white/20 bg-slate-950 text-sky-500 focus:ring-0 focus:ring-offset-0 accent-sky-500 pointer-events-none"
              />
            </span>
            <span className={checked ? "line-through text-slate-500" : ""}>{children}</span>
          </li>
        );
      }

      const isOrdered = props.node?.parent?.tagName === "ol";

      if (isOrdered) {
        return (
          <li className="group flex items-start gap-3 text-base text-slate-300 py-0.5 [counter-increment:custom-counter]">
            <span className="flex h-6 w-6 shrink-0 select-none items-center justify-center rounded-md bg-white/5 font-mono text-xs font-semibold text-sky-400 border border-white/5 transition-colors group-hover:bg-sky-500/10 group-hover:border-sky-500/20">
              before:content-[counter(custom-counter)]
            </span>
            <div className="flex-1 pt-0.5">{children}</div>
          </li>
        );
      }

      return (
        <li className="group flex items-start gap-3 text-base text-slate-300 py-0.5">
          <span className="flex h-6 w-2.5 shrink-0 select-none items-center justify-center">
            <ChevronRight className="h-3 w-3 text-sky-400/70 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-sky-400" />
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
      <tr className="transition-colors duration-150 hover:bg-white/[0.02]">{children}</tr>
    ),
    
    th: ({ children }: any) => (
      <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-200">{children}</th>
    ),
    
    td: ({ children }: any) => (
      <td className="px-4 py-3 text-sm text-slate-300">{children}</td>
    ),
    
    blockquote: ({ children }: any) => <CustomBlockquote>{children}</CustomBlockquote>,
    
    a: ({ href, children }: any) => <CustomLink href={href}>{children}</CustomLink>,
    
    img: ({ src, alt }: any) => <CustomImage src={src} alt={alt} />,
    
    hr: () => (
      <AnimatedBlock>
        <hr className="my-8 border-none h-[1px] bg-gradient-to-r from-transparent via-white/15 to-transparent" />
      </AnimatedBlock>
    ),
    
    strong: ({ children }: any) => <strong className="font-semibold text-white tracking-wide">{children}</strong>,
    em: ({ children }: any) => <em className="italic text-slate-200">{children}</em>,
  }), []);

  return (
    <div className="w-full text-slate-300 antialiased selection:bg-sky-500/30 selection:text-white">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={renderers}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
