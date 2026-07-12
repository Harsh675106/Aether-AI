import React from "react";
import { CALLOUT_MAP } from "./types";
import type { CalloutConfig } from "./types";

export function getCalloutType(
  text: string
): { type: string; config: CalloutConfig; cleanText: string } | null {
  const normalized = text.toLowerCase().replace(/[^a-z0-9]/g, "");

  for (const [type, config] of Object.entries(CALLOUT_MAP)) {
    if (normalized.includes(type)) {
      return {
        type,
        config,
        cleanText: text,
      };
    }
  }

  return null;
}

export function extractTextContent(node: React.ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") {
    return "";
  }

  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map(extractTextContent).join("");
  }

  if (React.isValidElement<{ children?: React.ReactNode }>(node)) {
    return extractTextContent(node.props.children);
  }

  return "";
}