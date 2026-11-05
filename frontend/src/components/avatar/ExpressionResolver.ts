export class ExpressionResolver {
  private activeExpression: string = "neutral";
  private tempExpression: string | null = null;
  private tempDurationMs = 0;
  private tempElapsedMs = 0;

  private expressions: Record<string, Record<string, number>> = {
    neutral: { eyeOpen: 1, eyebrowLift: 0, mouthSmile: 0, eyeFocus: 0 },
    happy: { eyeOpen: 0.9, eyebrowLift: 0.2, mouthSmile: 1, eyeFocus: 0 },
    thinking: { eyeOpen: 0.85, eyebrowLift: -0.1, mouthSmile: 0, eyeFocus: 0.5 },
    curious: { eyeOpen: 1.05, eyebrowLift: 0.55, mouthSmile: 0.15, eyeFocus: 0.35 },
    sad: { eyeOpen: 0.78, eyebrowLift: -0.35, mouthSmile: -0.75, eyeFocus: 0.25 },
    excited: { eyeOpen: 1.1, eyebrowLift: 0.45, mouthSmile: 0.75, eyeFocus: 0.15 },
    focused: { eyeOpen: 0.8, eyebrowLift: -0.2, mouthSmile: -0.1, eyeFocus: 1 },
    listening: { eyeOpen: 1, eyebrowLift: 0.3, mouthSmile: 0.2, eyeFocus: 0.2 },
    confident: { eyeOpen: 0.95, eyebrowLift: 0.1, mouthSmile: 0.4, eyeFocus: 0.5 },
    surprised: { eyeOpen: 1.2, eyebrowLift: 1, mouthSmile: 0, eyeFocus: 0.3 },
    concerned: { eyeOpen: 0.85, eyebrowLift: 0.2, mouthSmile: -0.5, eyeFocus: 0.5 },
    success: { eyeOpen: 1, eyebrowLift: 0.4, mouthSmile: 0.8, eyeFocus: 0 },
    error: { eyeOpen: 0.8, eyebrowLift: -0.5, mouthSmile: -0.6, eyeFocus: 0.8 },
  };

  public setExpression(expression: string): void {
    const key = expression.toLowerCase();
    if (key in this.expressions) this.activeExpression = key;
  }

  public setTemporaryExpression(expression: string, durationMs = 2000): void {
    const key = expression.toLowerCase();
    if (key in this.expressions) {
      this.tempExpression = key;
      this.tempDurationMs = durationMs;
      this.tempElapsedMs = 0;
    }
  }

  public clearTemporaryExpression(): void {
    this.tempExpression = null;
    this.tempDurationMs = 0;
    this.tempElapsedMs = 0;
  }

  public update(deltaTimeMs: number): void {
    if (this.tempExpression) {
      this.tempElapsedMs += deltaTimeMs;
      if (this.tempElapsedMs >= this.tempDurationMs) this.clearTemporaryExpression();
    }
  }

  public resolveCurrentExpression(): Record<string, number> {
    const active = this.tempExpression || this.activeExpression;
    const baseValues = this.expressions[active] || this.expressions.neutral;
    if (this.tempExpression && this.tempDurationMs > 0) {
      const remainingMs = this.tempDurationMs - this.tempElapsedMs;
      const fadeThresholdMs = 300;
      if (remainingMs < fadeThresholdMs) {
        const factor = remainingMs / fadeThresholdMs;
        const defaultValues = this.expressions[this.activeExpression] || this.expressions.neutral;
        return Object.fromEntries(Object.keys(baseValues).map((key) => [key, baseValues[key] * factor + defaultValues[key] * (1 - factor)]));
      }
    }
    return { ...baseValues };
  }
}