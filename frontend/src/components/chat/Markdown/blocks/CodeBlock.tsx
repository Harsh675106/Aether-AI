import React, { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Copy } from "lucide-react";

import { AnimatedBlock } from "./AnimatedBlock";
import { extractTextContent } from "../helpers";

interface CodeBlockProps {
  className?: string;
  children: React.ReactNode;
}

export const CodeBlock = React.memo(
  ({ className, children }: CodeBlockProps) => {
    const [copied, setCopied] = useState(false);

    const language =
      /language-(\w+)/.exec(className ?? "")?.[1] ?? "text";

    const rawCode = useMemo(
      () => extractTextContent(children).replace(/\n$/, ""),
      [children]
    );

    const handleCopy = async () => {
      try {
        await navigator.clipboard.writeText(rawCode);

        setCopied(true);

        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error(err);
      }
    };

    return (
      <AnimatedBlock>
        <motion.div
          whileHover={{ y: -2 }}
          transition={{ duration: 0.25 }}
          className="
            group
            my-8
            overflow-hidden
            rounded-2xl
            border
            border-white/10
            bg-slate-950/45
            backdrop-blur-xl
            shadow-xl
            transition-all
            duration-300
            hover:border-sky-400/30
            hover:shadow-[0_0_40px_rgba(56,189,248,0.08)]
          "
        >
          {/* Header */}

          <div
            className="
              sticky
              top-0
              z-10
              flex
              items-center
              justify-between
              border-b
              border-white/10
              bg-slate-900/40
              px-5
              py-3
              backdrop-blur-xl
            "
          >
            <div className="flex items-center gap-3">
              <span className="h-2 w-2 rounded-full bg-red-400/70" />
              <span className="h-2 w-2 rounded-full bg-yellow-400/70" />
              <span className="h-2 w-2 rounded-full bg-green-400/70" />

              <span
                className="
                  rounded-full
                  border
                  border-sky-500/20
                  bg-sky-500/10
                  px-3
                  py-1
                  font-mono
                  text-[11px]
                  uppercase
                  tracking-widest
                  text-sky-300
                "
              >
                {language}
              </span>
            </div>

            <button
              onClick={handleCopy}
              className="
                rounded-lg
                border
                border-white/10
                bg-white/5
                px-3
                py-1.5
                text-xs
                text-slate-300
                transition-all
                duration-300
                hover:border-sky-400/30
                hover:bg-sky-500/10
                hover:text-sky-200
              "
            >
              <AnimatePresence mode="wait">
                {copied ? (
                  <motion.div
                    key="copied"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="flex items-center gap-2 text-emerald-400"
                  >
                    <Check size={14} />
                    Copied
                  </motion.div>
                ) : (
                  <motion.div
                    key="copy"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-2"
                  >
                    <Copy size={14} />
                    Copy
                  </motion.div>
                )}
              </AnimatePresence>
            </button>
          </div>

          {/* Code */}

          <pre
            className="
              max-h-[650px]
              overflow-auto
              p-5
              font-mono
              text-[14px]
              leading-7
              text-slate-200
              scrollbar-thin
              scrollbar-thumb-white/10
              scrollbar-track-transparent
            "
          >
            <code className={className}>{children}</code>
          </pre>
        </motion.div>
      </AnimatedBlock>
    );
  }
);

CodeBlock.displayName = "CodeBlock";