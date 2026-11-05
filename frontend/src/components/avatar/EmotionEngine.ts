export class EmotionEngine {
  private currentEmotions: Record<string, number> = {
    neutral: 1.0,
    friendly: 0.0,
    calm: 0.0,
    focused: 0.0,
    confident: 0.0,
    curious: 0.0,
    happy: 0.0,
    concerned: 0.0,
    excited: 0.0,
    thinking: 0.0,
  };

  private targetEmotions: Record<string, number> = { ...this.currentEmotions };
  private blendRates: Record<string, number> = {}; // Change per second for each emotion

  constructor() {
    // Initialize default blend rates (default to 2.0, meaning 0.5s transition time)
    Object.keys(this.currentEmotions).forEach((emotion) => {
      this.blendRates[emotion] = 2.0;
    });
  }

  public getBlendedEmotions(): Record<string, number> {
    return { ...this.currentEmotions };
  }

  /**
   * Set a specific emotion value instantly.
   */
  public setEmotion(emotion: string, value: number): void {
    const key = emotion.toLowerCase();
    if (key in this.currentEmotions) {
      this.currentEmotions[key] = Math.max(0, Math.min(1, value));
      this.targetEmotions[key] = this.currentEmotions[key];
    }
  }

  /**
   * Smoothly blend towards a set of target emotions over a duration.
   */
  public blendEmotion(targets: Record<string, number>, durationMs: number): void {
    const durationSeconds = Math.max(0.01, durationMs / 1000);

    Object.entries(targets).forEach(([emotion, val]) => {
      const key = emotion.toLowerCase();
      if (key in this.currentEmotions) {
        const targetVal = Math.max(0, Math.min(1, val));
        this.targetEmotions[key] = targetVal;
        // Calculate the rate required to get from current to target in durationSeconds
        const diff = Math.abs(targetVal - this.currentEmotions[key]);
        this.blendRates[key] = diff / durationSeconds;
      }
    });

    // If 'neutral' is not explicitly targeted, auto-calculate it based on others
    const hasNeutralTarget = Object.keys(targets).some(
      (k) => k.toLowerCase() === "neutral"
    );
    if (!hasNeutralTarget) {
      // Neutral is 1 minus the maximum of all other active emotions
      const maxOther = Object.entries(this.targetEmotions)
        .filter(([k]) => k !== "neutral")
        .reduce((max, [_, val]) => Math.max(max, val), 0);
      this.targetEmotions["neutral"] = Math.max(0, 1 - maxOther);
      const diff = Math.abs(this.targetEmotions["neutral"] - this.currentEmotions["neutral"]);
      this.blendRates["neutral"] = diff / durationSeconds;
    }
  }

  /**
   * Advance the emotion simulation by deltaTime (in seconds).
   */
  public update(deltaTime: number): void {
    Object.keys(this.currentEmotions).forEach((key) => {
      const current = this.currentEmotions[key];
      const target = this.targetEmotions[key];

      if (current === target) return;

      const rate = this.blendRates[key] || 2.0;
      const step = rate * deltaTime;

      if (current < target) {
        this.currentEmotions[key] = Math.min(target, current + step);
      } else {
        this.currentEmotions[key] = Math.max(target, current - step);
      }
    });
  }

  /**
   * Expose utility to resolve custom animation parameters modulated by current emotions.
   * Modifies baseline animation config values like frequency, amplitude, glow ranges.
   */
  public modulateConfig(baseConfig: {
    breathFrequency: number;
    breathAmplitude: number;
    floatFrequency: number;
    floatAmplitude: number;
    glowPulseRate: number;
  }) {
    const emotions = this.currentEmotions;

    // Excitement speeds up breathing and floating
    const excitementMultiplier = 1.0 + emotions.excited * 0.8;
    // Calmness slows down and levels movements
    const calmMultiplier = 1.0 - emotions.calm * 0.4;
    // Friendly mood softens breathing size
    const friendlyInfluence = emotions.friendly * 0.2;

    return {
      breathFrequency: baseConfig.breathFrequency * excitementMultiplier * calmMultiplier,
      breathAmplitude:
        baseConfig.breathAmplitude *
        (1.0 + friendlyInfluence) *
        (1.0 + emotions.excited * 0.3) *
        calmMultiplier,
      floatFrequency: baseConfig.floatFrequency * excitementMultiplier * calmMultiplier,
      floatAmplitude:
        baseConfig.floatAmplitude *
        (1.0 + emotions.excited * 0.5) *
        (1.0 - emotions.focused * 0.4) * // focused reduces float bounce
        calmMultiplier,
      glowPulseRate:
        baseConfig.glowPulseRate *
        (1.0 + emotions.excited * 1.0 + emotions.thinking * 0.5),
    };
  }
}
