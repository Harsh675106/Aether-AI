import { useCallback, useMemo, useRef, useState } from "react";

import type { ChatMessage } from "@/types/chat";

const API_URL = import.meta.env.VITE_AETHER_API_URL ?? "http://localhost:8001/api/v1";

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim()) {
      return;
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
          conversation_id: "frontend-chat",
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
            if (parsed.done) {
              break;
            }

            setMessages((current) =>
              current.map((message) =>
                message.id === assistantMessage.id ? { ...message, text: message.text + (parsed.delta ?? "") } : message
              )
            );
          } catch {
            // Ignore malformed SSE payloads.
          }
        }
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        return;
      }
      setError((err as Error).message);
      setMessages((current) =>
        current.map((message) =>
          message.id === assistantMessage.id ? { ...message, text: "Aether is unavailable right now." } : message
        )
      );
    } finally {
      setIsStreaming(false);
    }
  }, []);

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
