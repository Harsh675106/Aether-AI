import { AvatarState } from "./AvatarState";

export interface AnimationEngineOutputs {
  floatOffset: number;
  breathOffset: number;
  blink: number;
  headPitch: number;
  headYaw: number;
  headRoll: number;
  eyeX: number;
  eyeY: number;
  glowIntensity: number;
}

export class AnimationEngine {
  private time = 0;
  private blinkTimer = 3000; // Time until next blink (ms)
  private blinkDurationMs = 150;
  private blinkProgress = -1; // -1 means eyes open
  private isDoubleBlinking = false;
  private doubleBlinkGapTimer = 0;

  // Head offsets targets and currents for interpolation
  private currentYaw = 0;
  private currentPitch = 0;
  private currentRoll = 0;
  private targetYaw = 0;
  private targetPitch = 0;
  private targetRoll = 0;

  // Eye look targets and currents
  private currentEyeX = 0;
  private currentEyeY = 0;
  private targetEyeX = 0;
  private targetEyeY = 0;
  private eyeMoveTimer = 2000;

  // LERP speeds
  private headLerpSpeed = 5;
  private eyeLerpSpeed = 8;

  constructor() {}

  /**
   * Main calculation cycle for hardware transforms, blinking, and glows.
   */
  public calculate(
    deltaTimeSeconds: number,
    state: AvatarState,
    emotions: Record<string, number>,
    facialFeatures: Record<string, number>,
    cursorPosition?: { x: number; y: number }
  ): AnimationEngineOutputs {
    this.time += deltaTimeSeconds;
    const deltaTimeMs = deltaTimeSeconds * 1000;

    // 1. Resolve Baseline Motion Parameters modulated by Emotions
    // Base configuration per state
    let baseConfig = {
      breathFrequency: 1.5,
      breathAmplitude: 0.015,
      floatFrequency: 0.8,
      floatAmplitude: 5.0,
      glowPulseRate: 1.0,
    };

    switch (state) {
      case "listening":
        baseConfig.breathFrequency = 2.0;
        baseConfig.breathAmplitude = 0.02;
        baseConfig.floatFrequency = 1.2;
        baseConfig.floatAmplitude = 8.0;
        baseConfig.glowPulseRate = 2.0;
        break;
      case "thinking":
        baseConfig.breathFrequency = 1.0;
        baseConfig.breathAmplitude = 0.01;
        baseConfig.floatFrequency = 0.5;
        baseConfig.floatAmplitude = 3.0;
        baseConfig.glowPulseRate = 0.8;
        break;
      case "speaking":
        baseConfig.breathFrequency = 2.2;
        baseConfig.breathAmplitude = 0.025;
        baseConfig.floatFrequency = 1.4;
        baseConfig.floatAmplitude = 7.0;
        baseConfig.glowPulseRate = 1.5;
        break;
      case "sleep":
        baseConfig.breathFrequency = 0.6;
        baseConfig.breathAmplitude = 0.008;
        baseConfig.floatFrequency = 0.2;
        baseConfig.floatAmplitude = 1.5;
        baseConfig.glowPulseRate = 0.3;
        break;
      case "error":
        baseConfig.breathFrequency = 3.0;
        baseConfig.breathAmplitude = 0.03;
        baseConfig.floatFrequency = 2.0;
        baseConfig.floatAmplitude = 10.0;
        baseConfig.glowPulseRate = 4.0;
        break;
      default:
        // idle / default config
        break;
    }

    // Modulate by emotions
    const excitedVal = emotions.excited || 0;
    const calmVal = emotions.calm || 0;
    const focusedVal = emotions.focused || 0;

    const excMul = 1.0 + excitedVal * 0.8;
    const calmMul = 1.0 - calmVal * 0.4;

    const breathFreq = baseConfig.breathFrequency * excMul * calmMul;
    const breathAmp = baseConfig.breathAmplitude * excMul * calmMul;
    const floatFreq = baseConfig.floatFrequency * excMul * calmMul;
    const floatAmp = baseConfig.floatAmplitude * excMul * (1.0 - focusedVal * 0.4) * calmMul;
    const glowPulseRate = baseConfig.glowPulseRate * (1.0 + excitedVal * 1.0 + (emotions.thinking || 0) * 0.5);

    // 2. Continuous Micro-Movement Calculations (Floating & Breathing)
    const floatOffset = Math.sin(this.time * floatFreq) * floatAmp;
    const breathOffset = 1.0 + Math.sin(this.time * breathFreq) * breathAmp;

    // 3. Eyeblink state machine
    let blink = 0;
    this.updateBlinking(deltaTimeMs);
    
    if (this.blinkProgress >= 0) {
      // Calculate blink shape curve (0 -> 1 -> 0)
      const halfDuration = this.blinkDurationMs / 2;
      if (this.blinkProgress < halfDuration) {
        blink = this.blinkProgress / halfDuration;
      } else {
        blink = 1 - (this.blinkProgress - halfDuration) / halfDuration;
      }
      blink = Math.max(0, Math.min(1, blink));
    }

    // Force eyes closed in sleep state
    if (state === "sleep") {
      blink = 1.0;
    }

    // Override blink with facial features if applicable
    if (facialFeatures.eyeOpen !== undefined) {
      // If facial expression requests closed eyes (like a squint), blend it
      const targetBlink = 1.0 - facialFeatures.eyeOpen;
      blink = Math.max(blink, targetBlink);
    }

    // 4. Head Yaw, Pitch, Roll resolving
    this.updateHeadPoseTargets(state, emotions, floatOffset);
    
    // Smoothly step head positions
    this.currentYaw += (this.targetYaw - this.currentYaw) * Math.min(1, this.headLerpSpeed * deltaTimeSeconds);
    this.currentPitch += (this.targetPitch - this.currentPitch) * Math.min(1, this.headLerpSpeed * deltaTimeSeconds);
    this.currentRoll += (this.targetRoll - this.currentRoll) * Math.min(1, this.headLerpSpeed * deltaTimeSeconds);

    // 5. Look targets resolving (Cursor Tracking or Micro-movements)
    this.updateEyeTargets(cursorPosition, deltaTimeMs);

    this.currentEyeX += (this.targetEyeX - this.currentEyeX) * Math.min(1, this.eyeLerpSpeed * deltaTimeSeconds);
    this.currentEyeY += (this.targetEyeY - this.currentEyeY) * Math.min(1, this.eyeLerpSpeed * deltaTimeSeconds);

    // Modulate eye look offset by facial expression focus variable
    const eyeFocus = facialFeatures.eyeFocus || 0;
    const finalEyeX = this.currentEyeX * (1 - eyeFocus * 0.5);
    const finalEyeY = this.currentEyeY * (1 - eyeFocus * 0.5);

    // 6. Glow intensity pulse calculation
    const glowIntensity = 0.7 + Math.sin(this.time * glowPulseRate * Math.PI) * 0.3;

    return {
      floatOffset,
      breathOffset,
      blink,
      headPitch: this.currentPitch,
      headYaw: this.currentYaw,
      headRoll: this.currentRoll,
      eyeX: finalEyeX,
      eyeY: finalEyeY,
      glowIntensity,
    };
  }

  private updateBlinking(deltaTimeMs: number): void {
    if (this.blinkProgress >= 0) {
      // Currently blinking
      this.blinkProgress += deltaTimeMs;
      if (this.blinkProgress >= this.blinkDurationMs) {
        this.blinkProgress = -1; // Reset

        // Check double blink gap triggers
        if (this.isDoubleBlinking) {
          this.isDoubleBlinking = false;
          // Set next normal blink timer
          this.blinkTimer = 2500 + Math.random() * 3500;
        } else {
          // 15% probability of double blink
          if (Math.random() < 0.15) {
            this.isDoubleBlinking = true;
            this.doubleBlinkGapTimer = 80 + Math.random() * 120; // Short gap
          } else {
            this.blinkTimer = 3000 + Math.random() * 4000;
          }
        }
      }
    } else if (this.isDoubleBlinking) {
      // Waiting for second blink gap to elapse
      this.doubleBlinkGapTimer -= deltaTimeMs;
      if (this.doubleBlinkGapTimer <= 0) {
        this.blinkProgress = 0; // Trigger second blink
      }
    } else {
      // Waiting for next blink cycle
      this.blinkTimer -= deltaTimeMs;
      if (this.blinkTimer <= 0) {
        this.blinkProgress = 0; // Start blink
      }
    }
  }

  private updateHeadPoseTargets(
    state: AvatarState,
    emotions: Record<string, number>,
    floatOffset: number
  ): void {
    // Idle state pose defaults
    this.targetYaw = 0;
    this.targetPitch = 0;
    this.targetRoll = 0;

    // Small ambient head float oscillations (subtle 3D sway)
    const swayYaw = Math.sin(this.time * 0.3) * 1.5;
    const swayPitch = Math.cos(this.time * 0.4) * 1.0;
    const swayRoll = Math.sin(this.time * 0.25) * 0.8;

    this.targetYaw += swayYaw;
    this.targetPitch += swayPitch;
    this.targetRoll += swayRoll;

    // State specific posture shifts
    switch (state) {
      case "listening":
        // Lean slightly forward (down/pitch) and focus head
        this.targetPitch += 3.5;
        this.targetRoll += (emotions.friendly || 0) * 1.5; // Slight friendly roll tilt
        break;
      case "thinking":
        // Tilt head slightly back and to the side (yaw/roll)
        this.targetYaw += 4.0;
        this.targetPitch -= 2.0;
        this.targetRoll -= 3.0;
        break;
      case "speaking":
        // Talk nod oscillation (sync nod offset to floats)
        const nod = Math.abs(Math.sin(this.time * 4.0)) * 2.5;
        this.targetPitch += nod - 1.0;
        this.targetRoll += Math.cos(this.time * 2.0) * 1.0;
        break;
      case "sleep":
        // Sleep slump (head tilted down, slight roll)
        this.targetPitch += 6.0;
        this.targetRoll -= 2.0;
        break;
      case "happy":
      case "success":
        this.targetPitch -= 2.0;
        this.targetRoll += 3.0;
        break;
      case "error":
        this.targetPitch += 4.0;
        this.targetYaw -= 3.0;
        break;
      default:
        break;
    }
  }

  private updateEyeTargets(
    cursorPosition: { x: number; y: number } | undefined,
    deltaTimeMs: number
  ): void {
    if (cursorPosition) {
      // Calculate delta direction of eye gaze
      // Normalizing screens space delta from screen center
      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 2;

      const dx = (cursorPosition.x - centerX) / centerX; // Range -1 to 1
      const dy = (cursorPosition.y - centerY) / centerY;

      // Restrict eye range limit
      this.targetEyeX = Math.max(-0.8, Math.min(0.8, dx * 0.7));
      this.targetEyeY = Math.max(-0.6, Math.min(0.6, dy * 0.5));
    } else {
      // Natural micro-eye shifts during idle/non-mouse modes
      this.eyeMoveTimer -= deltaTimeMs;
      if (this.eyeMoveTimer <= 0) {
        // Random glance targets
        if (Math.random() < 0.3) {
          this.targetEyeX = (Math.random() - 0.5) * 0.4;
          this.targetEyeY = (Math.random() - 0.5) * 0.3;
        } else {
          this.targetEyeX = 0;
          this.targetEyeY = 0;
        }
        this.eyeMoveTimer = 1000 + Math.random() * 3000;
      }
    }
  }
}
