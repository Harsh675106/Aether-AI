import React from "react";
import { motion } from "framer-motion";

import { blockVariants } from "../MarkdownAnimations";

interface AnimatedBlockProps {
  children: React.ReactNode;
  className?: string;
}

export function AnimatedBlock({
  children,
  className = "",
}: AnimatedBlockProps) {
  return (
    <motion.div
      variants={blockVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{
        once: true,
        amount: 0.15,
        margin: "-80px",
      }}
      transition={{
        type: "spring",
        stiffness: 180,
        damping: 22,
      }}
      className={`w-full transform-gpu ${className}`}
    >
      {children}
    </motion.div>
  );
}