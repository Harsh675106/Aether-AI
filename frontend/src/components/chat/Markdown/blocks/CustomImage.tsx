import React, { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Maximize2 } from "lucide-react";

import { AnimatedBlock } from "./AnimatedBlock";

interface CustomImageProps {
  src?: string;
  alt?: string;
}

export const CustomImage = React.memo(
  ({ src, alt }: CustomImageProps) => {
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
      const handleKey = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          setIsOpen(false);
        }
      };

      window.addEventListener("keydown", handleKey);
      return () => window.removeEventListener("keydown", handleKey);
    }, []);

    if (!src) return null;

    return (
      <AnimatedBlock>
        <div className="my-8">
          <motion.div
            whileHover={{ y: -3 }}
            transition={{ duration: 0.25 }}
            onClick={() => setIsOpen(true)}
            className="
              group
              relative
              cursor-zoom-in
              overflow-hidden
              rounded-2xl
              border
              border-white/10
              bg-white/[0.03]
              backdrop-blur-md
              shadow-xl
              transition-all
              duration-300
              hover:border-sky-400/40
              hover:shadow-[0_0_40px_rgba(56,189,248,0.12)]
            "
          >
            <img
              src={src}
              alt={alt}
              loading="lazy"
              className="
                w-full
                max-h-[480px]
                object-cover
                transition-transform
                duration-500
                group-hover:scale-[1.03]
              "
            />

            <div
              className="
                absolute
                inset-0
                bg-gradient-to-t
                from-black/30
                via-transparent
                to-transparent
                opacity-0
                transition-opacity
                duration-300
                group-hover:opacity-100
              "
            />

            <div className="absolute inset-0 flex items-center justify-center">
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                whileHover={{ scale: 1 }}
                className="
                  rounded-full
                  border
                  border-white/20
                  bg-black/40
                  p-3
                  backdrop-blur-md
                  opacity-0
                  transition-opacity
                  duration-300
                  group-hover:opacity-100
                "
              >
                <Maximize2 className="h-5 w-5 text-white" />
              </motion.div>
            </div>
          </motion.div>

          {alt && (
            <p className="mt-3 text-center text-xs italic tracking-wide text-slate-400">
              {alt}
            </p>
          )}

          <AnimatePresence>
            {isOpen && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsOpen(false)}
                className="
                  fixed
                  inset-0
                  z-50
                  flex
                  items-center
                  justify-center
                  bg-black/70
                  backdrop-blur-xl
                  p-6
                  cursor-zoom-out
                "
              >
                <motion.img
                  initial={{ scale: 0.92, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.92, opacity: 0 }}
                  transition={{
                    type: "spring",
                    stiffness: 220,
                    damping: 24,
                  }}
                  onClick={(e) => e.stopPropagation()}
                  src={src}
                  alt={alt}
                  className="
                    max-h-[90vh]
                    max-w-[92vw]
                    rounded-2xl
                    border
                    border-white/10
                    shadow-2xl
                  "
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </AnimatedBlock>
    );
  }
);

CustomImage.displayName = "CustomImage";