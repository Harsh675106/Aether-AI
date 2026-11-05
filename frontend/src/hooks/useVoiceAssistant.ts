import { useEffect, useMemo, useRef, useState } from "react";

import { AetherVoiceEngine } from "@/voice/engine";
import type { VoiceChatTransport, VoiceState } from "@/voice/types";

const createInitialState = (): VoiceState => ({
  phase: "idle",
  sessionId: null,
  correlationId: null,
  wakeWord: "",
  transcript: "",
  response: "",
  supported: typeof window !== "undefined",
  error: null,
  listening: false,
  active: false,
  speaking: false,
  updatedAt: Date.now(),
});

export function useVoiceAssistant(
  sendMessage: VoiceChatTransport["sendMessage"],
  addLocalResponse?: VoiceChatTransport["addLocalResponse"]
) {
  const engineRef = useRef<AetherVoiceEngine | null>(null);
  const [state, setState] = useState<VoiceState>(() => createInitialState());

  if (!engineRef.current) {
    engineRef.current = new AetherVoiceEngine({
      chatTransport: { sendMessage },
    });
  }

  // Keep the chat transport up-to-date without re-subscribing on every render.
  // Using a ref avoids the sendMessage identity instability that caused the
  // listening session to be torn down and restarted on every render.
  const sendMessageRef = useRef(sendMessage);
  useEffect(() => {
    sendMessageRef.current = sendMessage;
  });

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) {
      return;
    }

    // Wrap in a stable function so the transport always calls the latest version.
    engine.updateChatTransport({
      sendMessage: (content, options) => sendMessageRef.current(content, options),
      addLocalResponse,
    });

    return engine.subscribe(setState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addLocalResponse]);

  useEffect(() => {
    const engine = engineRef.current;
    return () => {
      void engine?.stop();
    };
  }, []);

  const controls = useMemo(
    () => ({
      state,
      start: async () => engineRef.current?.start(),
      stop: async () => engineRef.current?.stop(),
      toggle: async () => engineRef.current?.toggle(),
      supported: state.supported,
      isRunning: state.phase !== "idle" && state.phase !== "error" && state.phase !== "completed",
      hasError: state.phase === "error" || Boolean(state.error),
    }),
    [state]
  );

  return controls;
}
