export interface MouthShape {
  open: number;   // Height (0 to 1)
  width: number;  // Width (0 to 1)
  shape: string;  // Class/Identifier for layered PNG or Live2D
}

export class AvatarLipSync {
  private currentOpen = 0;
  private currentWidth = 0.5;
  private currentShape = "Relaxed";

  private targetOpen = 0;
  private targetWidth = 0.5;
  private targetShape = "Relaxed";

  // Lerp factor (higher is faster, e.g. 15 for quick response, 25 for extremely fast response)
  private lerpFactor = 18;

  // Level 1 viseme mapping
  private visemeMap: Record<string, MouthShape> = {
    Closed: { open: 0.0, width: 0.4, shape: "Closed" },
    M: { open: 0.0, width: 0.4, shape: "M" },
    F: { open: 0.25, width: 0.45, shape: "F" },
    Smile: { open: 0.2, width: 0.9, shape: "Smile" },
    SmallOpen: { open: 0.35, width: 0.6, shape: "SmallOpen" },
    MediumOpen: { open: 0.6, width: 0.7, shape: "MediumOpen" },
    WideOpen: { open: 0.95, width: 0.75, shape: "WideOpen" },
    RoundO: { open: 0.7, width: 0.35, shape: "RoundO" },
    Relaxed: { open: 0.1, width: 0.5, shape: "Relaxed" },
    // Public phoneme aliases: useful for TTS engines that emit vowel visemes.
    Open: { open: 0.58, width: 0.62, shape: "Open" },
    A: { open: 0.9, width: 0.74, shape: "A" },
    I: { open: 0.32, width: 0.82, shape: "I" },
    U: { open: 0.62, width: 0.32, shape: "U" },
    E: { open: 0.5, width: 0.72, shape: "E" },
    O: { open: 0.7, width: 0.35, shape: "O" },
    Sad: { open: 0.12, width: 0.52, shape: "Sad" },
    Surprised: { open: 0.82, width: 0.33, shape: "Surprised" },
  };

  constructor() {}

  /**
   * Retrieves the current interpolated mouth parameters.
   */
  public getMouthParameters(): MouthShape {
    return {
      open: this.currentOpen,
      width: this.currentWidth,
      shape: this.currentShape,
    };
  }

  /**
   * Level 1: Updates targets directly using phoneme or viseme identifiers from advanced TTS.
   */
  public updateFromVisemes(viseme: string): void {
    const shape = this.visemeMap[viseme] || this.visemeMap.Relaxed;
    this.targetOpen = shape.open;
    this.targetWidth = shape.width;
    this.targetShape = shape.shape;
  }

  /**
   * Level 2: Generates mouth visemes procedurally based on word text content,
   * matching syllables to shapes over the estimated duration of the word.
   */
  public updateFromText(
    wordText: string,
    elapsedMs: number,
    wordDurationMs: number
  ): void {
    if (!wordText || elapsedMs >= wordDurationMs) {
      this.targetOpen = 0.05;
      this.targetWidth = 0.5;
      this.targetShape = "Relaxed";
      return;
    }

    const cleanWord = wordText.toLowerCase().replace(/[^a-z]/g, "");
    if (cleanWord.length === 0) {
      this.targetOpen = 0.0;
      this.targetShape = "Closed";
      return;
    }

    // Determine how far along the word we are
    const progress = elapsedMs / wordDurationMs;
    const charIndex = Math.min(
      cleanWord.length - 1,
      Math.floor(progress * cleanWord.length)
    );
    const currentChar = cleanWord[charIndex];

    // Syllable/Letter to viseme mapper
    let shapeName = "Relaxed";
    if ("aeiou".includes(currentChar)) {
      if (currentChar === "o" || currentChar === "u") {
        shapeName = "RoundO";
      } else if (currentChar === "a") {
        shapeName = "WideOpen";
      } else if (currentChar === "e") {
        shapeName = "MediumOpen";
      } else {
        shapeName = "SmallOpen";
      }
    } else if ("mbp".includes(currentChar)) {
      shapeName = "M";
    } else if ("fv".includes(currentChar)) {
      shapeName = "F";
    } else if ("stdzcj".includes(currentChar)) {
      shapeName = "Smile";
    } else {
      shapeName = "SmallOpen";
    }

    // Ensure mouth opens and closes naturally between letters (creating a speaking bounce)
    const bounceFactor = Math.sin(progress * Math.PI * cleanWord.length);
    const shape = this.visemeMap[shapeName] || this.visemeMap.Relaxed;

    // Apply bounce to opening height to avoid static wide-open mouth during single words
    this.targetOpen = Math.max(0.1, shape.open * (0.6 + 0.4 * Math.abs(bounceFactor)));
    this.targetWidth = shape.width;
    this.targetShape = shape.shape;
  }

  /**
   * Level 3 (Fallback): Translates real-time audio volume amplitude directly to mouth shapes.
   */
  public updateFromAmplitude(amplitude: number): void {
    if (amplitude < 0.05) {
      this.targetOpen = 0.0;
      this.targetWidth = 0.5;
      this.targetShape = "Closed";
      return;
    }

    // Higher amplitude = wider/more open mouth
    this.targetOpen = amplitude * 0.95;
    this.targetWidth = 0.4 + amplitude * 0.4;

    if (amplitude > 0.6) {
      this.targetShape = "WideOpen";
    } else if (amplitude > 0.3) {
      this.targetShape = "MediumOpen";
    } else {
      this.targetShape = "SmallOpen";
    }
  }

  /**
   * Applies linear interpolation (lerp) to smoothly animate the mouth transitions.
   */
  public update(deltaTimeSeconds: number): void {
    const step = this.lerpFactor * deltaTimeSeconds;
    
    // Smooth open height
    this.currentOpen += (this.targetOpen - this.currentOpen) * Math.min(1, step);
    
    // Smooth width
    this.currentWidth += (this.targetWidth - this.currentWidth) * Math.min(1, step);
    
    // Snappy or blended shapes
    this.currentShape = this.targetShape;
  }
}
