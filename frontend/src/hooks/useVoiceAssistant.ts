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

export function useVoiceAssistant(sendMessage: VoiceChatTransport["sendMessage"]) {
  const engineRef = useRef<AetherVoiceEngine | null>(null);
  const [state, setState] = useState<VoiceState>(() => createInitialState());

  if (!engineRef.current) {
    engineRef.current = new AetherVoiceEngine({
      chatTransport: { sendMessage },
    });
  }

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) {
      return;
    }

    engine.updateChatTransport({ sendMessage });
    return engine.subscribe(setState);
  }, [sendMessage]);

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
    }),
    [state]
  );

  return controls;
}
