import { AvatarState, AvatarExpression, AvatarControllerState, VisemeFrame } from "./AvatarState";
import { AvatarAssetManager } from "./AvatarAssetManager";
import { EmotionEngine } from "./EmotionEngine";
import { ExpressionResolver } from "./ExpressionResolver";
import { AvatarAudio } from "./AvatarAudio";
import { AvatarLipSync } from "./AvatarLipSync";
import { AnimationEngine } from "./AnimationEngine";

export class AvatarController {
  private static instance: AvatarController | null = null;

  // Sub-modules
  private assetManager: AvatarAssetManager;
  private emotionEngine: EmotionEngine;
  private expressionResolver: ExpressionResolver;
  private audioAnalyzer: AvatarAudio;
  private lipSync: AvatarLipSync;
  private animationEngine: AnimationEngine;

  // State
  private state: AvatarState = "idle";
  private expression: AvatarExpression = "neutral";
  private cursorPosition: { x: number; y: number } | undefined = undefined;

  // Speaking state tracking (Level 1 & 2)
  private isSpeaking = false;
  private speechText = "";
  private speechElapsedMs = 0;
  private wordIndices: { charIndex: number; word: string; length: number }[] = [];
  private currentWordIndex = -1;
  private wordStartTimestamp = 0;
  private activeVisemes: VisemeFrame[] = [];
  private speechStartTimestamp = 0;

  // Subscriber callbacks (React state updates)
  private subscribers: Set<(state: AvatarControllerState) => void> = new Set();
  
  // Animation Frame Loop
  private lastFrameTime = 0;
  private animationFrameId: number | null = null;

  private constructor() {
    this.assetManager = new AvatarAssetManager();
    this.emotionEngine = new EmotionEngine();
    this.expressionResolver = new ExpressionResolver();
    this.audioAnalyzer = new AvatarAudio();
    this.lipSync = new AvatarLipSync();
    this.animationEngine = new AnimationEngine();

    // Default skins loading
    void this.assetManager.loadSkin("default");

    // Start requestAnimationFrame loop
    this.startLoop();
  }

  public static getInstance(): AvatarController {
    if (!AvatarController.instance) {
      AvatarController.instance = new AvatarController();
    }
    return AvatarController.instance;
  }

  public getAssetManager(): AvatarAssetManager {
    return this.assetManager;
  }

  // --- API METHODS FOR STATE CONTROLS ---

  public setState(state: AvatarState): void {
    if (this.state === state) return;
    this.state = state;

    // Reset speaker tracks if changing state
    if (state !== "speaking" && this.isSpeaking) {
      this.stopSpeaking();
    }

    // Connect Audio Analyzer triggers
    if (state === "listening") {
      void this.audioAnalyzer.startListening();
      this.expressionResolver.setExpression("listening");
      this.emotionEngine.blendEmotion({ calm: 0.2, focused: 0.8 }, 500);
    } else {
      this.audioAnalyzer.stopListening();
    }

    if (state === "thinking") {
      this.expressionResolver.setExpression("thinking");
      this.emotionEngine.blendEmotion({ thinking: 0.9, calm: 0.4 }, 600);
    }

    if (state === "idle") {
      this.expressionResolver.setExpression("neutral");
      this.emotionEngine.blendEmotion({ neutral: 1.0 }, 1000);
    }

    if (state === "sleep") {
      this.expressionResolver.setExpression("neutral");
      this.emotionEngine.blendEmotion({ calm: 1.0 }, 1500);
    }

    if (state === "error") {
      this.expressionResolver.setExpression("error");
      this.emotionEngine.blendEmotion({ concerned: 1.0 }, 200);
    }

    if (state === "success") {
      this.expressionResolver.setExpression("success");
      this.emotionEngine.blendEmotion({ friendly: 0.8, happy: 0.6 }, 400);
      // Success auto-reverts to idle after a brief period
      setTimeout(() => {
        if (this.state === "success") this.setState("idle");
      }, 3000);
    }

    this.notifySubscribers();
  }

  public setExpression(expression: AvatarExpression): void {
    this.expression = expression;
    this.expressionResolver.setExpression(expression);
    
    // Automatically trigger minor emotional shifts matching the expression
    const mapping: Record<AvatarExpression, Record<string, number>> = {
      neutral: { neutral: 1.0 },
      happy: { happy: 0.8, friendly: 0.7 },
      thinking: { thinking: 0.8 },
      curious: { focused: 0.55, thinking: 0.4 },
      sad: { calm: 0.7, concerned: 0.45 },
      excited: { excited: 0.9, happy: 0.45 },
      focused: { focused: 0.9 },
      listening: { calm: 0.5, focused: 0.6 },
      confident: { confident: 0.8 },
      surprised: { excited: 0.7 },
      concerned: { concerned: 0.8 },
      success: { friendly: 0.8, happy: 0.6 },
      error: { concerned: 0.9 },
    };

    if (mapping[expression]) {
      this.emotionEngine.blendEmotion(mapping[expression], 800);
    }

    this.notifySubscribers();
  }

  public setThinking(isThinking: boolean): void {
    this.setState(isThinking ? "thinking" : "idle");
  }

  public setListening(isListening: boolean): void {
    this.setState(isListening ? "listening" : "idle");
  }

  public setCursorPosition(x: number, y: number): void {
    this.cursorPosition = { x, y };
  }

  public clearCursorPosition(): void {
    this.cursorPosition = undefined;
  }

  // --- TTS SPEECH & LIP SYNC RESOLVERS ---

  /**
   * Commences AI TTS speaking loop.
   * Connects text, audio nodes, or custom viseme frames.
   */
  public startSpeaking(speechSource: {
    text?: string;
    audioStream?: MediaStream | AudioNode;
    visemes?: VisemeFrame[];
  }): void {
    this.isSpeaking = true;
    this.setState("speaking");
    this.expressionResolver.setExpression("confident");
    this.emotionEngine.blendEmotion({ friendly: 0.5, confident: 0.6 }, 400);

    this.speechText = speechSource.text || "";
    this.speechElapsedMs = 0;
    this.activeVisemes = speechSource.visemes || [];
    this.speechStartTimestamp = performance.now();
    this.currentWordIndex = -1;

    // Level 2: Compute approximate word boundary arrays if we only got flat text
    if (this.speechText && this.activeVisemes.length === 0) {
      this.computeWordIndices(this.speechText);
    }
  }

  /**
   * Triggered by utterance boundaries from TTS.
   */
  public handleWordBoundary(charIndex: number, charLength: number): void {
    if (!this.isSpeaking) return;

    const matched = this.wordIndices.find(
      (item) => Math.abs(item.charIndex - charIndex) <= 2
    );

    if (matched) {
      this.currentWordIndex = this.wordIndices.indexOf(matched);
      this.wordStartTimestamp = performance.now();
    }
  }

  public stopSpeaking(): void {
    this.isSpeaking = false;
    this.speechText = "";
    this.activeVisemes = [];
    this.wordIndices = [];
    this.currentWordIndex = -1;

    if (this.state === "speaking") {
      this.setState("idle");
    }
  }

  // --- SUBSCRIPTIONS ---

  public subscribe(listener: (state: AvatarControllerState) => void): () => void {
    this.subscribers.add(listener);
    // Trigger immediate update
    listener(this.resolveControllerState());
    
    return () => {
      this.subscribers.delete(listener);
    };
  }

  // --- INTERNAL LOOP EXECUTION ---

  private startLoop(): void {
    this.lastFrameTime = performance.now();
    const frame = (timestamp: number) => {
      const elapsedSeconds = (timestamp - this.lastFrameTime) / 1000;
      this.lastFrameTime = timestamp;

      // Restrict large spikes (e.g. background tab suspension) to max 100ms
      const cappedDelta = Math.min(0.1, elapsedSeconds);

      this.tick(cappedDelta);
      this.animationFrameId = requestAnimationFrame(frame);
    };

    this.animationFrameId = requestAnimationFrame(frame);
  }

  public destroy(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }
    this.audioAnalyzer.stopListening();
  }

  private tick(deltaTimeSeconds: number): void {
    // 1. Advance Engines
    this.emotionEngine.update(deltaTimeSeconds);
    this.expressionResolver.update(deltaTimeSeconds * 1000);

    // 2. Perform multi-level Lip Sync evaluation
    this.resolveLipSync(deltaTimeSeconds);

    // 3. Compute Coordinates & Anim Variables
    const blendedEmotions = this.emotionEngine.getBlendedEmotions();
    const activeFacialFeatures = this.expressionResolver.resolveCurrentExpression();

    const animOutputs = this.animationEngine.calculate(
      deltaTimeSeconds,
      this.state,
      blendedEmotions,
      activeFacialFeatures,
      this.cursorPosition
    );

    // 4. Update and Broadcast resolved state variables
    const controllerState = this.resolveControllerState(animOutputs);
    this.subscribers.forEach((callback) => callback(controllerState));
  }

  private resolveLipSync(deltaTimeSeconds: number): void {
    // LEVEL 1: Explicit Visemes
    if (this.isSpeaking && this.activeVisemes.length > 0) {
      const elapsedMs = performance.now() - this.speechStartTimestamp;
      // Find current active viseme frame
      const active = this.activeVisemes.find(
        (frame) => elapsedMs >= frame.timeMs && elapsedMs <= frame.timeMs + frame.durationMs
      );

      if (active) {
        this.lipSync.updateFromVisemes(active.viseme);
      } else {
        this.lipSync.updateFromVisemes("Relaxed");
      }
    }
    // LEVEL 2: Syllables / Characters based on text and boundaries
    else if (this.isSpeaking && this.speechText && this.wordIndices.length > 0) {
      const now = performance.now();
      const elapsedInWord = now - this.wordStartTimestamp;
      const currentWordObj = this.wordIndices[this.currentWordIndex];

      if (currentWordObj) {
        // Average speaking rate: 5ms per character + 150ms baseline duration
        const estimatedDuration = currentWordObj.word.length * 15 + 180;
        this.lipSync.updateFromText(currentWordObj.word, elapsedInWord, estimatedDuration);
      } else {
        // Falling back to simple default speech bounce if index not set
        const bounce = Math.sin(now * 0.015);
        this.lipSync.updateFromAmplitude(0.1 + Math.max(0, bounce) * 0.5);
      }
    }
    // LEVEL 3: Microphone analysis (Listening mode)
    else if (this.state === "listening") {
      const amp = this.audioAnalyzer.getAmplitude();
      // Pulsing lip scale based on microphone input
      this.lipSync.updateFromAmplitude(amp);
    }
    // Else, reset mouth to relaxed
    else {
      this.lipSync.updateFromAmplitude(0);
    }

    // Animate mouth interpolation step
    this.lipSync.update(deltaTimeSeconds);
  }

  private computeWordIndices(text: string): void {
    this.wordIndices = [];
    // Regex splits text into words matching letters
    const wordRegex = /[a-zA-Z]+/g;
    let match;

    while ((match = wordRegex.exec(text)) !== null) {
      this.wordIndices.push({
        charIndex: match.index,
        word: match[0],
        length: match[0].length,
      });
    }
  }

  private resolveControllerState(animOutputs?: any): AvatarControllerState {
    const mouth = this.lipSync.getMouthParameters();
    const assetsLoading = this.assetManager.getLoadingState();

    return {
      state: this.state,
      expression: this.expression,
      emotions: this.emotionEngine.getBlendedEmotions(),
      blink: animOutputs?.blink ?? 0,
      mouthOpen: mouth.open,
      mouthWidth: mouth.width,
      mouthShape: mouth.shape,
      eyeX: animOutputs?.eyeX ?? 0,
      eyeY: animOutputs?.eyeY ?? 0,
      headPitch: animOutputs?.headPitch ?? 0,
      headYaw: animOutputs?.headYaw ?? 0,
      headRoll: animOutputs?.headRoll ?? 0,
      floatOffset: animOutputs?.floatOffset ?? 0,
      breathOffset: animOutputs?.breathOffset ?? 1.0,
      glowColor: this.resolveGlowColor(),
      glowIntensity: animOutputs?.glowIntensity ?? 1.0,
      loading: !assetsLoading.loaded,
      skin: this.assetManager.getCurrentSkin(),
    };
  }

  private resolveGlowColor(): string {
    if (this.state === "error") return "#ef4444"; // Red
    if (this.state === "success") return "#22d3ee"; // Cyan
    if (this.state === "warning") return "#f97316"; // Orange
    if (this.state === "listening") return "#38bdf8"; // Blue/cyan listening
    if (this.state === "thinking") return "#a855f7"; // Magenta/purple

    // Idle state glow matches dominant emotion
    const emotions = this.emotionEngine.getBlendedEmotions();
    if (emotions.happy > 0.4) return "#10b981"; // Emerald
    if (emotions.excited > 0.4) return "#facc15"; // Yellow
    if (emotions.concerned > 0.4) return "#94a3b8"; // Cool slate

    return "#60a5fa"; // Cool corporate blue default
  }

  private notifySubscribers(): void {
    const current = this.resolveControllerState();
    this.subscribers.forEach((cb) => cb(current));
  }
}
