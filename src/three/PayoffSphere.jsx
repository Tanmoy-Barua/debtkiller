import React, { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import FxCanvas from "./FxCanvas.jsx";

function DestroySphere({ progress = 0 }) {
  const crust = useRef();
  const core = useRef();
  const shards = useRef();
  const pct = Math.max(0, Math.min(1, progress / 100));

  const shardGeo = useMemo(() => {
    const n = 36;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const b = Math.acos(2 * Math.random() - 1);
      const r = 1.1 + Math.random() * 0.4;
      pos[i * 3] = Math.sin(b) * Math.cos(a) * r;
      pos[i * 3 + 1] = Math.cos(b) * r;
      pos[i * 3 + 2] = Math.sin(b) * Math.sin(a) * r;
    }
    return pos;
  }, []);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (crust.current) {
      crust.current.rotation.y = t * 0.25;
      crust.current.rotation.x = Math.sin(t * 0.4) * 0.15;
      // dissolve crust as progress rises
      crust.current.material.opacity = 0.55 * (1 - pct * 0.85);
      crust.current.scale.setScalar(1.05 - pct * 0.25);
    }
    if (core.current) {
      const s = 0.55 + pct * 0.55 + Math.sin(t * 2.5) * 0.03;
      core.current.scale.setScalar(s);
      core.current.rotation.y = -t * 0.7;
      core.current.material.emissiveIntensity = 0.6 + pct * 1.4;
    }
    if (shards.current) {
      shards.current.rotation.y = t * 0.5;
      const arr = shards.current.geometry.attributes.position.array;
      for (let i = 0; i < arr.length; i += 3) {
        const push = 1 + pct * 0.8;
        // expand shards outward with progress
        const len = Math.hypot(arr[i], arr[i + 1], arr[i + 2]) || 1;
        const target = (1.1 + (i % 7) * 0.05) * push;
        const f = target / len;
        // gently lerp by rewriting from unit * target - actually keep rotating only
      }
      shards.current.material.opacity = 0.25 + pct * 0.55;
      shards.current.scale.setScalar(1 + pct * 0.6);
    }
  });

  return (
    <group>
      <mesh ref={core}>
        <icosahedronGeometry args={[0.7, 1]} />
        <meshStandardMaterial
          color="#2EF0A0"
          emissive="#2EF0A0"
          emissiveIntensity={1}
          metalness={0.5}
          roughness={0.2}
        />
      </mesh>
      <mesh ref={crust}>
        <icosahedronGeometry args={[1.15, 1]} />
        <meshStandardMaterial
          color="#FF6B7A"
          emissive="#FF6B7A"
          emissiveIntensity={0.35}
          metalness={0.3}
          roughness={0.45}
          transparent
          opacity={0.5}
          wireframe
        />
      </mesh>
      <points ref={shards}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" count={shardGeo.length / 3} array={shardGeo} itemSize={3} />
        </bufferGeometry>
        <pointsMaterial
          color="#FFC857"
          size={0.07}
          transparent
          opacity={0.5}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  );
}

export default function PayoffSphere({ progress = 0, height = 120 }) {
  return (
    <div className="dd-fx-orb" style={{ position: "relative", width: "100%", height, borderRadius: 16, overflow: "hidden" }}>
      <FxCanvas style={{ position: "absolute", inset: 0 }} camera={{ position: [0, 0, 4], fov: 40 }} dprMax={1.5}>
        <ambientLight intensity={0.45} />
        <pointLight position={[2, 2, 3]} intensity={1.5} color="#2EF0A0" />
        <pointLight position={[-2, -1, 2]} intensity={0.8} color="#FF6B7A" />
        <DestroySphere progress={progress} />
      </FxCanvas>
    </div>
  );
}
