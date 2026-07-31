import React, { Suspense, useEffect } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { useReducedMotion, useIsMobilePerf } from "./useReducedMotion.js";

function WindowPointerBridge({ enabled }) {
  const { pointer } = useThree();
  useEffect(() => {
    if (!enabled) return undefined;
    const onMove = (e) => {
      pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.y = -((e.clientY / window.innerHeight) * 2 - 1);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [enabled, pointer]);
  return null;
}

/** Shared WebGL canvas with sane defaults for battery + mobile. */
export default function FxCanvas({
  children,
  className,
  style,
  camera = { position: [0, 0, 8], fov: 45, near: 0.1, far: 80 },
  interactive = false,
  trackWindowPointer = false,
  dprMax,
}) {
  const reduced = useReducedMotion();
  const mobile = useIsMobilePerf();
  const maxDpr = dprMax ?? (mobile ? 1.25 : 1.75);

  if (reduced) return null;

  return (
    <div
      className={className}
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: interactive ? "auto" : "none",
        ...style,
      }}
    >
      <Canvas
        dpr={[1, maxDpr]}
        camera={camera}
        gl={{
          antialias: !mobile,
          alpha: true,
          powerPreference: "high-performance",
          stencil: false,
          depth: true,
        }}
        style={{ width: "100%", height: "100%", display: "block" }}
        frameloop="always"
      >
        <WindowPointerBridge enabled={trackWindowPointer && !interactive} />
        <Suspense fallback={null}>{children}</Suspense>
      </Canvas>
    </div>
  );
}
