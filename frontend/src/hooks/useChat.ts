import { useCallback, useMemo, useRef, useState } from "react";

import { useImageSearch } from "@/components/image-search";
import type { ChatMessage } from "@/types/chat";

const API_URL = import.meta.env.VITE_AETHER_API_URL ?? "http://localhost:8001/api/v1";

type SendMessageOptions = {
  conversationId?: string;
  source?: "text" | "voice";
  onDelta?: (delta: string, accumulated: string) => void;
};

export function useChat() {
  const imageSearch = useImageSearch();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(async (content: string, options?: SendMessageOptions) => {
    if (!content.trim()) {
      return null;
    }

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      text: content,
      role: "user",
    };
    const assistantMessage: ChatMessage = {
      id: crypto.randomUUID(),
      text: "",
      role: "assistant",
    };

    setMessages((current) => [...current, userMessage, assistantMessage]);
    setIsStreaming(true);
    setError(null);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    let assistantText = "";

    try {
      const response = await fetch(`${API_URL}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify({
          messages: [{ role: "user", content }],
          stream: true,
          conversation_id: options?.conversationId ?? "frontend-chat",
          user_metadata: {
            source: options?.source ?? "text",
          },
        }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        throw new Error("Unable to connect to Aether chat.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";

        for (const event of events) {
          const dataLine = event.split("\n").find((line) => line.startsWith("data:"));
          if (!dataLine) {
            continue;
          }

          const payload = dataLine.replace(/^data:\s*/, "").trim();
          if (!payload) {
            continue;
          }

          try {
            const parsed = JSON.parse(payload);
            const imageSearchPayload = parsed.metadata?.image_search;
            if (imageSearchPayload?.results?.length) {
              imageSearch.openResults(imageSearchPayload);
            }

            if (parsed.done) {
              break;
            }

            const delta = String(parsed.delta ?? "");
            if (!delta) {
              continue;
            }

            assistantText += delta;
            options?.onDelta?.(delta, assistantText);

            setMessages((current) =>
              current.map((message) =>
                message.id === assistantMessage.id
                  ? { ...message, text: message.text + delta }
                  : message
              )
            );
          } catch {
            // Ignore malformed SSE payloads.
          }
        }
      }

      return assistantText;
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        return null;
      }
      setError((err as Error).message);
      setMessages((current) =>
        current.map((message) =>
          message.id === assistantMessage.id ? { ...message, text: "Aether is unavailable right now." } : message
        )
      );
      return null;
    } finally {
      setIsStreaming(false);
    }
  }, [imageSearch]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  return useMemo(
    () => ({
      messages,
      isStreaming,
      error,
      sendMessage,
      clearMessages,
    }),
    [messages, isStreaming, error, sendMessage, clearMessages]
  );
}