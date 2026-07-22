import React from "react";
import { ExternalLink } from "lucide-react";
import { motion } from "framer-motion";
import { open } from "@tauri-apps/plugin-shell";

interface CustomLinkProps {
  href?: string;
  children: React.ReactNode;
}

function isTauriDesktop() {
  return typeof window !== "undefined" && ("__TAURI_INTERNALS__" in window || "__TAURI__" in window);
}

export function normalizeUrl(url?: string): string {
  if (!url) return "";
  const trimmed = url.trim();
  if (!trimmed) return "";

  // If URL lacks a protocol scheme (e.g. www.google.com or google.com), prepend https://
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) {
    return `https://${trimmed}`;
  }

  return trimmed;
}

export async function openExternalLink(href?: string) {
  const targetUrl = normalizeUrl(href);
  if (!targetUrl) {
    return;
  }

  try {
    if (isTauriDesktop()) {
      await open(targetUrl);
      return;
    }

    if (typeof window !== "undefined") {
      const popup = window.open(targetUrl, "_blank", "noopener,noreferrer");
      if (!popup) {
        window.location.assign(targetUrl);
      }
    }
  } catch (err) {
    console.warn("Failed to open link with Tauri shell, falling back to browser navigation:", err);
    if (typeof window !== "undefined") {
      window.location.assign(targetUrl);
    }
  }
}

export const CustomLink = React.memo(
  ({ href, children }: CustomLinkProps) => {
    const finalUrl = normalizeUrl(href);
    const shouldHandleLocally = isTauriDesktop();

    const handleClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
      if (!shouldHandleLocally) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      void openExternalLink(href);
    };

    return (
      <motion.a
        href={finalUrl || "#"}
        target="_blank"
        rel="noopener noreferrer"
        onClick={handleClick}
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
          cursor-pointer
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
            shrink-0
          "
        />
      </motion.a>
    );
  }
);

CustomLink.displayName = "CustomLink";