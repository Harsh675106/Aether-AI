export class AvatarAudio {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private micStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private dataArray: Uint8Array = new Uint8Array(0);
  private isAnalyzing = false;

  constructor() {}

  /**
   * Starts listening to user's microphone for real-time amplitude analysis.
   */
  public async startListening(): Promise<void> {
    if (this.isAnalyzing) return;

    try {
      this.micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Initialize AudioContext lazily on user action to meet browser security requirements
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.audioContext = new AudioCtx();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.8;

      this.sourceNode = this.audioContext.createMediaStreamSource(this.micStream);
      this.sourceNode.connect(this.analyser);

      const bufferLength = this.analyser.frequencyBinCount;
      this.dataArray = new Uint8Array(bufferLength);
      this.isAnalyzing = true;
    } catch (error) {
      console.warn("Microphone access denied or failed for Avatar animation:", error);
      this.cleanup();
    }
  }

  /**
   * Stops microphone analysis and releases media tracks.
   */
  public stopListening(): void {
    this.cleanup();
  }

  /**
   * Measures current volume amplitude (Root Mean Square / RMS) from 0.0 to 1.0.
   */
  public getAmplitude(): number {
    if (!this.isAnalyzing || !this.analyser) {
      return 0;
    }

    this.analyser.getByteTimeDomainData(this.dataArray as any);

    let sumSquares = 0;
    for (let i = 0; i < this.dataArray.length; i++) {
      // Normalize values from 0-255 byte domain back to [-1.0, 1.0] float range
      const normalized = (this.dataArray[i] - 128) / 128;
      sumSquares += normalized * normalized;
    }

    const rms = Math.sqrt(sumSquares / this.dataArray.length);
    
    // Scale up RMS values and clamp to [0.0, 1.0] for more reactive animations
    const reactiveAmplitude = rms * 4.5;
    return Math.min(1.0, Math.max(0.0, reactiveAmplitude));
  }

  private cleanup(): void {
    this.isAnalyzing = false;

    if (this.sourceNode) {
      try {
        this.sourceNode.disconnect();
      } catch {}
      this.sourceNode = null;
    }

    if (this.micStream) {
      this.micStream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {}
      });
      this.micStream = null;
    }

    if (this.audioContext) {
      try {
        if (this.audioContext.state !== "closed") {
          void this.audioContext.close();
        }
      } catch {}
      this.audioContext = null;
    }

    this.analyser = null;
    this.dataArray = new Uint8Array(0);
  }
}
