import React, { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import FxCanvas from "./FxCanvas.jsx";
import { useIsMobilePerf } from "./useReducedMotion.js";

/** Login atmosphere — calm horizon + soft core, brand-first beauty. */
function Mist({ count, color }) {
  const ref = useRef();
  const pos = useMemo(() => {
    const a = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      a[i * 3] = (Math.random() - 0.5) * 18;
      a[i * 3 + 1] = (Math.random() - 0.5) * 12;
      a[i * 3 + 2] = -2 - Math.random() * 10;
    }
    return a;
  }, [count]);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.rotation.y = clock.elapsedTime * 0.025;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={pos.length / 3} array={pos} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial
        color={color}
        size={0.05}
        sizeAttenuation
        transparent
        opacity={0.5}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

function SoftCore({ color, accent }) {
  const core = useRef();
  const ring = useRef();
  const glow = useRef();
  useFrame(({ clock, pointer }) => {
    const t = clock.elapsedTime;
    if (core.current) {
      core.current.rotation.y = t * 0.15;
      core.current.rotation.x = 0.25 + pointer.y * 0.08;
      core.current.position.x = pointer.x * 0.35;
    }
    if (ring.current) {
      ring.current.rotation.z = t * 0.12;
      ring.current.rotation.x = Math.PI / 2.6;
    }
    if (glow.current) {
      glow.current.material.opacity = 0.14 + Math.sin(t * 0.9) * 0.04;
      glow.current.scale.setScalar(2.2 + Math.sin(t * 0.7) * 0.12);
    }
  });

  return (
    <group position={[0, 0.15, 0]}>
      <mesh ref={core}>
        <icosahedronGeometry args={[0.95, 1]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.85}
          metalness={0.55}
          roughness={0.28}
          transparent
          opacity={0.92}
        />
      </mesh>
      <mesh ref={ring}>
        <torusGeometry args={[1.55, 0.018, 16, 96]} />
        <meshBasicMaterial color={accent} transparent opacity={0.45} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh ref={glow}>
        <sphereGeometry args={[1.2, 32, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.16} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
    </group>
  );
}

function PathLines({ color }) {
  const ref = useRef();
  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.position.z = (clock.elapsedTime * 0.4) % 1;
  });
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const pts = [];
    for (let i = 0; i < 14; i++) {
      const z = -i * 1.1;
      pts.push(-0.06, -2.2, z, 0.06, -2.2, z);
    }
    g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    return g;
  }, []);
  return (
    <group rotation={[-0.4, 0, 0]} position={[0, -0.3, 2]}>
      <lineSegments ref={ref} geometry={geo}>
        <lineBasicMaterial color={color} transparent opacity={0.28} blending={THREE.AdditiveBlending} />
      </lineSegments>
    </group>
  );
}

function LoginScene({ accent, lane }) {
  const mobile = useIsMobilePerf();
  const green = new THREE.Color(accent || "#2EF0A0");
  const gold = new THREE.Color(lane || "#FFC857");

  return (
    <>
      <ambientLight intensity={0.35} />
      <pointLight position={[2, 3, 4]} intensity={1.4} color={green} />
      <pointLight position={[-3, 0, 2]} intensity={0.6} color={gold} />
      <Mist count={mobile ? 120 : 240} color="#b8d4f0" />
      <SoftCore color={green} accent={gold} />
      <PathLines color={green} />
    </>
  );
}

export default function LoginFX({ accent, lane, blue }) {
  return (
    <FxCanvas
      className="dd-fx-login"
      style={{ position: "absolute", inset: 0, zIndex: 0 }}
      camera={{ position: [0, 0.2, 6.2], fov: 38 }}
      trackWindowPointer
    >
      <LoginScene accent={accent} lane={lane} blue={blue} />
    </FxCanvas>
  );
}
