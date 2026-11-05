export type RenderingMode = "flat" | "layered";

export class AvatarAssetManager {
  private cache: Map<string, HTMLImageElement> = new Map();
  private loadingStates: Map<string, "idle" | "loading" | "loaded" | "error"> = new Map();
  private currentSkin = "default";
  private currentMode: RenderingMode = "flat";
  private skins: Map<string, Record<string, string>> = new Map();

  constructor() {
    // Define the default flat skin
    this.skins.set("default", {
      base: "/assets/Avatar.png",
    });

    // Define a placeholder for the future layered skin to test automatic detection
    this.skins.set("cybernetic_layered", {
      hair: "/assets/layered/hair.png",
      face: "/assets/layered/face.png",
      eyes: "/assets/layered/eyes.png",
      eyelids: "/assets/layered/eyelids.png",
      eyebrows: "/assets/layered/eyebrows.png",
      mouth: "/assets/layered/mouth.png",
      glow: "/assets/layered/glow.png",
      fx: "/assets/layered/fx.png",
    });
  }

  public getRenderingMode(): RenderingMode {
    return this.currentMode;
  }

  public getCurrentSkin(): string {
    return this.currentSkin;
  }

  /**
   * Automatically attempts to detect whether layered assets are present for the given skin
   * and configures the rendering mode accordingly.
   */
  public async loadSkin(skinName: string): Promise<void> {
    const skinAssets = this.skins.get(skinName);
    if (!skinAssets) {
      console.warn(`Skin "${skinName}" not found. Falling back to "default".`);
      return this.loadSkin("default");
    }

    this.currentSkin = skinName;
    const layers = Object.keys(skinAssets);

    // If it only has 'base', it is flat mode
    if (layers.length === 1 && layers[0] === "base") {
      this.currentMode = "flat";
      await this.preloadAsset("base", skinAssets.base);
      return;
    }

    // Try preloading layered assets. If we fail (e.g. 404), fallback to default flat skin.
    try {
      this.currentMode = "layered";
      const preloadPromises = layers.map((layer) =>
        this.preloadAsset(layer, skinAssets[layer])
      );
      await Promise.all(preloadPromises);
    } catch (error) {
      console.warn(
        `Failed to load layered assets for skin "${skinName}". Falling back to flat mode.`,
        error
      );
      this.currentMode = "flat";
      this.currentSkin = "default";
      await this.preloadAsset("base", this.skins.get("default")!.base);
    }
  }

  public async preloadSkin(skinName: string): Promise<void> {
    const skinAssets = this.skins.get(skinName);
    if (!skinAssets) return;

    const promises = Object.entries(skinAssets).map(([layer, url]) => {
      return this.preloadImage(url);
    });

    await Promise.all(promises);
  }

  public getAsset(layerName: string): string | null {
    const skinAssets = this.skins.get(this.currentSkin);
    if (!skinAssets) return null;

    const url = skinAssets[layerName];
    if (!url) return null;

    const img = this.cache.get(url);
    return img && this.loadingStates.get(url) === "loaded" ? url : null;
  }

  public getAssetElement(layerName: string): HTMLImageElement | null {
    const skinAssets = this.skins.get(this.currentSkin);
    if (!skinAssets) return null;

    const url = skinAssets[layerName];
    if (!url) return null;

    return this.cache.get(url) || null;
  }

  public hasLayer(layerName: string): boolean {
    const skinAssets = this.skins.get(this.currentSkin);
    return skinAssets ? !!skinAssets[layerName] : false;
  }

  public getLoadingState(): { loaded: boolean; progress: number; error: string | null } {
    const skinAssets = this.skins.get(this.currentSkin);
    if (!skinAssets) {
      return { loaded: false, progress: 0, error: "Skin not loaded" };
    }

    const urls = Object.values(skinAssets);
    let loadedCount = 0;
    let errorCount = 0;

    for (const url of urls) {
      const state = this.loadingStates.get(url);
      if (state === "loaded") loadedCount++;
      if (state === "error") errorCount++;
    }

    const total = urls.length;
    const progress = total > 0 ? (loadedCount + errorCount) / total : 0;
    const loaded = loadedCount === total;
    const error = errorCount > 0 ? `${errorCount} asset(s) failed to load` : null;

    return { loaded, progress, error };
  }

  public registerSkin(name: string, layers: Record<string, string>): void {
    this.skins.set(name, layers);
  }

  private async preloadAsset(layer: string, url: string): Promise<void> {
    this.loadingStates.set(url, "loading");
    try {
      const img = await this.preloadImage(url);
      this.cache.set(url, img);
      this.loadingStates.set(url, "loaded");
    } catch (error) {
      this.loadingStates.set(url, "error");
      throw error;
    }
  }

  private preloadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const cached = this.cache.get(url);
      if (cached && this.loadingStates.get(url) === "loaded") {
        resolve(cached);
        return;
      }

      const img = new Image();
      img.src = url;
      img.onload = () => resolve(img);
      img.onerror = (e) => reject(new Error(`Failed to load image at: ${url}`));
    });
  }
}
