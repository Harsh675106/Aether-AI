import React from "react";
import { ExternalLink } from "lucide-react";
import { motion } from "framer-motion";

interface CustomLinkProps {
  href?: string;
  children: React.ReactNode;
}

export const CustomLink = React.memo(
  ({ href, children }: CustomLinkProps) => {
    return (
      <motion.a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        whileHover={{ y: -1 }}
        whileTap={{ scale: 0.98 }}
        className="
          group
          inline-flex
          items-center
          gap-1.5
          rounded-md
          px-1
          py-0.5
          font-medium
          text-sky-300
          transition-all
          duration-300
          hover:bg-sky-500/10
          hover:text-sky-200
          focus:outline-none
          focus:ring-2
          focus:ring-sky-500/40
        "
      >
        <span className="relative">
          {children}

          <span
            className="
              absolute
              -bottom-[2px]
              left-0
              h-px
              w-full
              origin-left
              scale-x-0
              bg-gradient-to-r
              from-sky-400
              to-cyan-300
              transition-transform
              duration-300
              group-hover:scale-x-100
            "
          />
        </span>

        <ExternalLink
          className="
            h-3.5
            w-3.5
            opacity-70
            transition-all
            duration-300
            group-hover:translate-x-0.5
            group-hover:-translate-y-0.5
            group-hover:opacity-100
          "
        />
      </motion.a>
    );
  }
);

CustomLink.displayName = "CustomLink";