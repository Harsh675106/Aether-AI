import { describe, it, expect, vi, beforeEach } from "vitest";
import { AvatarAssetManager } from "./AvatarAssetManager";

describe("AvatarAssetManager", () => {
  beforeEach(() => {
    // Mock global Image constructor for jsdom test environments
    vi.stubGlobal("Image", class {
      onload: () => void = () => {};
      onerror: (e: any) => void = () => {};
      _src = "";
      set src(url: string) {
        this._src = url;
        // Trigger onload asynchronously to simulate image fetch success
        setTimeout(() => {
          if (url.includes("fail")) {
            this.onerror(new Error("Mock Load Error"));
          } else {
            this.onload();
          }
        }, 10);
      }
      get src() {
        return this._src;
      }
    });
  });

  it("should initialize default skin in flat mode", () => {
    const manager = new AvatarAssetManager();
    expect(manager.getCurrentSkin()).toBe("default");
    expect(manager.getRenderingMode()).toBe("flat");
  });

  it("should load flat skin successfully", async () => {
    const manager = new AvatarAssetManager();
    await manager.loadSkin("default");
    expect(manager.getRenderingMode()).toBe("flat");
    expect(manager.getLoadingState().loaded).toBe(true);
  });

  it("should attempt loading layered skin and fallback to flat on load error", async () => {
    const manager = new AvatarAssetManager();
    // Register a mock layered skin that fails to load
    manager.registerSkin("broken_layered", {
      hair: "/assets/fail_hair.png",
      face: "/assets/fail_face.png",
    });

    await manager.loadSkin("broken_layered");
    
    // Should fall back to default flat skin on error
    expect(manager.getCurrentSkin()).toBe("default");
    expect(manager.getRenderingMode()).toBe("flat");
  });
});
