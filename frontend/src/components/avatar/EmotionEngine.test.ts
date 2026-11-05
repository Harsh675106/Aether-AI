import { describe, it, expect } from "vitest";
import { EmotionEngine } from "./EmotionEngine";

describe("EmotionEngine", () => {
  it("should initialize with neutral state at 1.0", () => {
    const engine = new EmotionEngine();
    const emotions = engine.getBlendedEmotions();
    expect(emotions.neutral).toBe(1.0);
    expect(emotions.friendly).toBe(0.0);
  });

  it("should support direct emotion overrides", () => {
    const engine = new EmotionEngine();
    engine.setEmotion("friendly", 0.8);
    const emotions = engine.getBlendedEmotions();
    expect(emotions.friendly).toBe(0.8);
  });

  it("should smoothly blend emotions over time", () => {
    const engine = new EmotionEngine();
    // Blend to friendly: 1.0, excited: 0.5 over 1 second
    engine.blendEmotion({ friendly: 1.0, excited: 0.5 }, 1000);
    
    // Check initial tick
    engine.update(0.5); // Advance 0.5 seconds
    let emotions = engine.getBlendedEmotions();
    expect(emotions.friendly).toBeGreaterThan(0.0);
    expect(emotions.friendly).toBeLessThan(1.0);
    expect(emotions.excited).toBeGreaterThan(0.0);

    // Complete the blend
    engine.update(0.6); // Advance remaining
    emotions = engine.getBlendedEmotions();
    expect(emotions.friendly).toBe(1.0);
    expect(emotions.excited).toBe(0.5);
  });
});
