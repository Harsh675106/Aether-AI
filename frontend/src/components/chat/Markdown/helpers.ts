import React from "react";

export function extractTextContent(node: React.ReactNode): string {
  if (
    node === null ||
    node === undefined ||
    typeof node === "boolean"
  ) {
    return "";
  }

  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.reduce(
      (text, child) => text + extractTextContent(child),
      ""
    );
  }

  if (React.isValidElement(node)) {
    return extractTextContent(node.props.children);
  }

  return "";
}