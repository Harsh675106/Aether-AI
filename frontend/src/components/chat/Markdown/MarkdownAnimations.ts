import { Variants } from "framer-motion";

export const blockVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 10,
    filter: "blur(4px)",
  },

  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",

    transition: {
      duration: 0.35,
      ease: [0.22, 1, 0.36, 1],
    },
  },
};