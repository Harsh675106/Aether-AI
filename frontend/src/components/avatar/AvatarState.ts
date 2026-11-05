export type AvatarState =
  | "idle"
  | "listening"
  | "thinking"
  | "speaking"
  | "happy"
  | "success"
  | "warning"
  | "error"
  | "sleep";

export type AvatarExpression =
  | "neutral"
  | "happy"
  | "thinking"
  | "curious"
  | "sad"
  | "excited"
  | "focused"
  | "listening"
  | "confident"
  | "surprised"
  | "concerned"
  | "success"
  | "error";

export interface VisemeFrame {
  timeMs: number;
  viseme: string;
  durationMs: number;
}

export interface AvatarControllerState {
  state: AvatarState;
  expression: AvatarExpression;
  emotions: Record<string, number>;
  blink: number;
  mouthOpen: number;
  mouthWidth: number;
  mouthShape: string;
  eyeX: number;
  eyeY: number;
  headPitch: number;
  headYaw: number;
  headRoll: number;
  floatOffset: number;
  breathOffset: number;
  glowColor: string;
  glowIntensity: number;
  loading: boolean;
  skin: string;
}

export interface AvatarConfig {
  skin: string;
  autoBlink: boolean;
  lookAtCursor: boolean;
  audioAnalysis: boolean;
  layeredMode: boolean;
}