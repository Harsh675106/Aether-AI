import React from "react";
import { CALLOUT_MAP } from "./types";
import type { CalloutConfig } from "./types";

export function cleanStringPrefix(text: string, keyword: string): string {
  let str = text;
  const kw = keyword.toLowerCase();

  const prefixRegex = new RegExp(
    `^(?:[\\s\\r\\n\\*:()!>\\[\\]]|\\\\n)*${kw}(?:[:\\s\\r\\n\\*()!>\\[\\]]|\\\\n)*`,
    "i"
  );

  while (prefixRegex.test(str)) {
    str = str.replace(prefixRegex, "");
  }

  return str.replace(/^(?:[\\s\\r\\n\\*:()!>\\[\\]]|\\\\n)+/, "");
}

export function getCalloutType(
  text: string
): { type: string; config: CalloutConfig; cleanText: string; title: string } | null {
  const trimmed = text.trim();
  const keywords = Object.keys(CALLOUT_MAP).sort((a, b) => b.length - a.length);

  const matchedKeyword = keywords.find((k) =>
    new RegExp(`^(?:[\\s\\r\\n\\*:()\\[\\]]|\\\\n)*(?:\\[!${k}\\]|\\*?\\*?${k}\\*?\\*?\\s*:\\s*|${k}\\s*:\\s*)`, "i").test(trimmed)
  );

  if (!matchedKeyword) {
    return null;
  }

  const config = CALLOUT_MAP[matchedKeyword];
  if (!config) {
    return null;
  }

  const cleanText = cleanStringPrefix(trimmed, matchedKeyword);
  const title = matchedKeyword.charAt(0).toUpperCase() + matchedKeyword.slice(1);

  return {
    type: matchedKeyword,
    config,
    cleanText,
    title,
  };
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