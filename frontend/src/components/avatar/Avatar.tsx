import React, { useEffect } from "react";
import { useAvatarController, useAvatarState } from "./AvatarHooks";
import "./AvatarStyles.css";

interface AvatarProps { className?: string; size?: number; }

/** A lightweight robotic identity driven by the existing avatar controller. */
export const Avatar: React.FC<AvatarProps> = ({ className = "", size = 110 }) => {
  const state = useAvatarState();
  const controller = useAvatarController();

  useEffect(() => {
    const move = (event: MouseEvent) => controller.setCursorPosition(event.clientX, event.clientY);
    const leave = () => controller.clearCursorPosition();
    window.addEventListener("mousemove", move);
    document.addEventListener("mouseleave", leave);
    return () => {
      window.removeEventListener("mousemove", move);
      document.removeEventListener("mouseleave", leave);
    };
  }, [controller]);

  const faceTransform = [
    "perspective(600px)",
    `rotateX(${state.headPitch}deg)`,
    `rotateY(${state.headYaw}deg)`,
    `rotateZ(${state.headRoll}deg)`,
    `scale(${state.breathOffset})`,
    `translateY(${state.floatOffset}px)`,
  ].join(" ");
  const visualStyle = {
    "--aether-accent": state.glowColor,
    "--aether-glow": String(state.glowIntensity),
    "--eye-x": `${state.eyeX * 5}px`,
    "--eye-y": `${state.eyeY * 3}px`,
    "--blink": String(state.blink),
    "--mouth-open": String(Math.max(0.06, state.mouthOpen)),
    "--mouth-width": String(Math.max(0.36, state.mouthWidth)),
  } as React.CSSProperties;

  return (
    <div
      aria-label={`Aether avatar, ${state.state}`}
      className={`aether-avatar-container ${className}`}
      data-state={state.state}
      data-expression={state.expression}
      data-mouth={state.mouthShape}
      style={{ ...visualStyle, width: size, height: size }}
    >
      <div className="aether-avatar-aura" />
      <div className="aether-avatar-orbit aether-avatar-orbit--outer" />
      <div className="aether-avatar-orbit aether-avatar-orbit--inner" />
      <div className="aether-avatar-hud aether-avatar-hud--top" />
      <div className="aether-avatar-hud aether-avatar-hud--bottom" />
      {state.state === "listening" && <div className="aether-avatar-listening-pulse" />}
      <div className="aether-avatar-head" style={{ transform: faceTransform }}>
        <div className="aether-avatar-cranium" />
        <div className="aether-avatar-crown-node"><span /></div>
        <div className="aether-avatar-temple aether-avatar-temple--left" />
        <div className="aether-avatar-temple aether-avatar-temple--right" />
        <div className="aether-avatar-forehead-mark"><span /></div>
        <div className="aether-avatar-scanline" />
        <div className="aether-avatar-brow aether-avatar-brow--left" />
        <div className="aether-avatar-brow aether-avatar-brow--right" />
        <div className="aether-avatar-eyes">
          {["left", "right"].map((side) => (
            <div className={`aether-avatar-eye aether-avatar-eye--${side}`} key={side}>
              <div className="aether-avatar-eye-housing" />
              <div className="aether-avatar-eye-rings" />
              <div className="aether-avatar-eye-light"><span className="aether-avatar-eye-core" /><span className="aether-avatar-eye-glint" /></div>
              <div className="aether-avatar-eyelid" />
            </div>
          ))}
        </div>
        <div className="aether-avatar-nose-bridge" />
        <div className="aether-avatar-cheek aether-avatar-cheek--left" />
        <div className="aether-avatar-cheek aether-avatar-cheek--right" />
        <div className="aether-avatar-mouth" aria-hidden="true"><div className="aether-avatar-mouth-cavity"><div className="aether-avatar-mouth-light" /><span className="aether-avatar-mouth-segment" /><span className="aether-avatar-mouth-segment" /><span className="aether-avatar-mouth-segment" /></div></div>
        <div className="aether-avatar-chin-light" />
      </div>
    </div>
  );
};