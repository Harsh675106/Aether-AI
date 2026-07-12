import React from "react";
import { motion } from "framer-motion";
import { Quote, Info } from "lucide-react";

import { AnimatedBlock } from "./AnimatedBlock";

interface CustomBlockquoteProps {
  children: React.ReactNode;
}

export const CustomBlockquote = React.memo(
  ({ children }: CustomBlockquoteProps) => {
    return (
      <AnimatedBlock>
        <motion.div
          whileHover={{ y: -2 }}
          transition={{ duration: 0.25 }}
          className="
            group
            relative
            my-8
            overflow-hidden
            rounded-2xl
            border
            border-sky-500/20
            bg-gradient-to-br
            from-sky-500/[0.08]
            via-slate-900/20
            to-transparent
            backdrop-blur-lg
            shadow-xl
          "
        >
          {/* Left Accent */}
          <div className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-sky-400 via-cyan-400 to-transparent" />

          {/* Background Icon */}
          <Quote
            className="
              absolute
              right-5
              top-5
              h-20
              w-20
              text-white/[0.03]
              transition-transform
              duration-500
              group-hover:rotate-6
              group-hover:scale-110
            "
          />

          <div className="relative z-10 flex gap-4 p-6">
            <div
              className="
                flex
                h-10
                w-10
                shrink-0
                items-center
                justify-center
                rounded-full
                border
                border-sky-400/20
                bg-sky-500/10
                backdrop-blur-md
              "
            >
              <Info className="h-5 w-5 text-sky-300" />
            </div>

            <div
              className="
                flex-1
                leading-8
                italic
                text-slate-300
              "
            >
              {children}
            </div>
          </div>
        </motion.div>
      </AnimatedBlock>
    );
  }
);

CustomBlockquote.displayName = "CustomBlockquote";