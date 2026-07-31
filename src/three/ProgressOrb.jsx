import React, { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import FxCanvas from "./FxCanvas.jsx";

function RingProgress({ progress = 0, hit = false, color, trackColor }) {
  const fill = useRef();
  const core = useRef();
  const sparks = useRef();
  const pct = Math.max(0, Math.min(1, progress / 100));

  const sparkPos = useMemo(() => {
    const n = 24;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      arr[i * 3] = Math.cos(a) * 1.35;
      arr[i * 3 + 1] = Math.sin(a) * 1.35;
      arr[i * 3 + 2] = 0;
    }
    return arr;
  }, []);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (fill.current) {
      fill.current.rotation.z = -Math.PI / 2;
      // animate toward target
      const mat = fill.current.material;
      if (mat.uniforms) {
        mat.uniforms.uProgress.value = THREE.MathUtils.damp(mat.uniforms.uProgress.value, pct, 4, 0.016);
      }
    }
    if (core.current) {
      const pulse = hit ? 1 + Math.sin(t * 4) * 0.06 : 1 + Math.sin(t * 2) * 0.03;
      core.current.scale.setScalar(pulse);
      core.current.rotation.y = t * 0.6;
      core.current.rotation.x = t * 0.25;
    }
    if (sparks.current) {
      sparks.current.rotation.z = t * 0.4;
      sparks.current.material.opacity = 0.35 + Math.sin(t * 3) * 0.15;
    }
  });

  const shader = useMemo(
    () => ({
      transparent: true,
      uniforms: {
        uProgress: { value: 0 },
        uColor: { value: new THREE.Color(color) },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uProgress;
        uniform vec3 uColor;
        varying vec2 vUv;
        void main() {
          vec2 p = vUv * 2.0 - 1.0;
          float r = length(p);
          float ring = smoothstep(0.12, 0.08, abs(r - 0.78));
          float ang = atan(p.y, p.x);
          float a = (ang + 3.14159265) / (2.0 * 3.14159265);
          float mask = step(a, uProgress);
          float alpha = ring * mask;
          gl_FragColor = vec4(uColor, alpha * 0.95);
        }
      `,
    }),
    [color]
  );

  return (
    <group>
      {/* track */}
      <mesh rotation={[0, 0, 0]}>
        <ringGeometry args={[1.15, 1.4, 64]} />
        <meshBasicMaterial color={trackColor} transparent opacity={0.25} side={THREE.DoubleSide} />
      </mesh>

      {/* progress disc with shader */}
      <mesh ref={fill}>
        <planeGeometry args={[3.2, 3.2]} />
        <shaderMaterial {...shader} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>

      <mesh ref={core}>
        <icosahedronGeometry args={[0.55, 1]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={hit ? 1.6 : 0.9}
          metalness={0.4}
          roughness={0.2}
          transparent
          opacity={0.95}
        />
      </mesh>

      <points ref={sparks}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" count={sparkPos.length / 3} array={sparkPos} itemSize={3} />
        </bufferGeometry>
        <pointsMaterial
          color={color}
          size={0.08}
          transparent
          opacity={0.5}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  );
}

export default function ProgressOrb({
  progress = 0,
  hit = false,
  color = "#2EF0A0",
  trackColor = "#2A3542",
  height = 140,
}) {
  return (
    <div className="dd-fx-orb" style={{ position: "relative", width: "100%", height, borderRadius: 16, overflow: "hidden" }}>
      <FxCanvas
        style={{ position: "absolute", inset: 0 }}
        camera={{ position: [0, 0, 4.2], fov: 40 }}
        dprMax={1.5}
      >
        <ambientLight intensity={0.5} />
        <pointLight position={[2, 2, 3]} intensity={1.4} color={color} />
        <RingProgress progress={progress} hit={hit} color={color} trackColor={trackColor} />
      </FxCanvas>
    </div>
  );
}
