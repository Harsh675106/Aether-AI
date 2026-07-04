import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

const STARTUP_VIDEO_URL = "/assets/StartingVideo.mp4";

interface StartupAnimationProps {
  onComplete: () => void;
}

export default function StartupAnimation({
  onComplete,
}: StartupAnimationProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const [videoLoaded, setVideoLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const video = videoRef.current;

    if (!video) return;

    const handleCanPlay = () => {
      console.log("✓ Startup video ready");
      setVideoLoaded(true);
    };

    const handleEnded = () => {
      console.log("✓ Startup completed");
      onComplete();
    };

    const handleError = () => {
      console.error("✗ Startup video failed");

      setHasError(true);

      /*
       * If the video cannot play,
       * continue booting after a short delay.
       */

      setTimeout(() => {
        onComplete();
      }, 1200);
    };

    video.addEventListener("canplay", handleCanPlay);
    video.addEventListener("ended", handleEnded);
    video.addEventListener("error", handleError);

    const playPromise = video.play();

    if (playPromise) {
      playPromise.catch((err) => {
        console.warn("Autoplay blocked", err);
      });
    }

    return () => {
      video.removeEventListener("canplay", handleCanPlay);
      video.removeEventListener("ended", handleEnded);
      video.removeEventListener("error", handleError);
    };
  }, [onComplete]);


  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{
        opacity: 0,
        transition: {
          duration: 0.7,
        },
      }}
      className="fixed inset-0 z-[9999] bg-black"
    >
      {!hasError && (
        <video
          ref={videoRef}
          src={STARTUP_VIDEO_URL}
          autoPlay
          muted={false}
          playsInline
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}

      {/* Dark cinematic overlay */}

      <div className="absolute inset-0 bg-black/20" />

      {/* Loading Indicator */}

      <motion.div
        initial={{
          opacity: 0,
          y: 12,
        }}
        animate={{
          opacity: videoLoaded ? 1 : 0,
          y: videoLoaded ? 0 : 12,
        }}
        transition={{
          duration: 0.6,
        }}
        className="
          absolute
          bottom-12
          left-1/2
          -translate-x-1/2
          text-center
        "
      >
        <p
          className="
            text-sm
            tracking-[0.35em]
            uppercase
            text-cyan-300/90
          "
        >
          Initializing Aether
        </p>

        <div
          className="
            mt-4
            h-[2px]
            w-56
            overflow-hidden
            rounded-full
            bg-white/10
          "
        >
          <motion.div
            initial={{
              x: "-100%",
            }}
            animate={{
              x: "100%",
            }}
            transition={{
              repeat: Infinity,
              duration: 1.4,
              ease: "linear",
            }}
            className="
              h-full
              w-1/2
              bg-cyan-400
              shadow-[0_0_20px_#22d3ee]
            "
          />
        </div>
      </motion.div>

      {/* Error Fallback */}

      {hasError && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="
            absolute
            inset-0
            flex
            items-center
            justify-center
          "
        >
          <div className="text-center">
            <p className="text-lg text-red-400">
              Startup video unavailable
            </p>

            <p className="mt-2 text-white/60">
              Launching Aether...
            </p>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}