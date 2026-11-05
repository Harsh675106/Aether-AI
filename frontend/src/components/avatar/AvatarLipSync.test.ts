import { describe, it, expect } from "vitest";
import { AvatarLipSync } from "./AvatarLipSync";

describe("AvatarLipSync", () => {
  it("should initialize with a relaxed mouth shape", () => {
    const lipSync = new AvatarLipSync();
    const params = lipSync.getMouthParameters();
    expect(params.open).toBe(0);
    expect(params.width).toBe(0.5);
    expect(params.shape).toBe("Relaxed");
  });

  it("should update mouth parameters from direct visemes (Level 1)", () => {
    const lipSync = new AvatarLipSync();
    lipSync.updateFromVisemes("WideOpen");
    // Advance simulation immediately (large deltaTime to hit target instantly)
    lipSync.update(1.0);

    const params = lipSync.getMouthParameters();
    expect(params.open).toBeGreaterThan(0.8);
    expect(params.shape).toBe("WideOpen");
  });

  it("should update mouth parameters from text boundaries (Level 2)", () => {
    const lipSync = new AvatarLipSync();
    // Test speaking 'Aether'
    lipSync.updateFromText("Aether", 50, 200);
    lipSync.update(1.0);

    const params = lipSync.getMouthParameters();
    expect(params.open).toBeGreaterThan(0.1);
    expect(params.shape).not.toBe("Closed");
  });

  it("should update mouth parameters from audio amplitude (Level 3)", () => {
    const lipSync = new AvatarLipSync();
    lipSync.updateFromAmplitude(0.8);
    lipSync.update(1.0);

    const params = lipSync.getMouthParameters();
    expect(params.open).toBeGreaterThan(0.75);
    expect(params.shape).toBe("WideOpen");
  });
});
