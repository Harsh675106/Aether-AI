import { createContext, useContext, useEffect, useState } from "react";
import { AvatarController } from "./AvatarController";
import { AvatarControllerState } from "./AvatarState";

const AvatarControllerContext = createContext<AvatarController | null>(null);

/**
   * Provides context for the AvatarController, facilitating mock injection in tests.
   */
export const useAvatarController = (): AvatarController => {
  const context = useContext(AvatarControllerContext);
  // Default to the singleton instance if provider is not present
  return context || AvatarController.getInstance();
};

/**
   * Subscribes a React component to the active AvatarController state updates,
   * driving 60 FPS visual outputs cleanly.
   */
export const useAvatarState = (): AvatarControllerState => {
  const controller = useAvatarController();
  const [avatarState, setAvatarState] = useState<AvatarControllerState>(() => {
    // Accessing private method via cast or accessing properties directly
    return (controller as any).resolveControllerState();
  });

  useEffect(() => {
    const unsubscribe = controller.subscribe((state) => {
      setAvatarState(state);
    });

    return () => {
      unsubscribe();
    };
  }, [controller]);

  return avatarState;
};
