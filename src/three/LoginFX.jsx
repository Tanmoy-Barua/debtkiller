import React, { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import FxCanvas from "./FxCanvas.jsx";
import { useIsMobilePerf } from "./useReducedMotion.js";

function OrbitRing({ radius, color, speed, tilt }) {
  const ref = useRef();
  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.rotation.z = clock.elapsedTime * speed;
    ref.current.rotation.x = tilt + Math.sin(clock.elapsedTime * 0.4) * 0.15;
  });
  return (
    <mesh ref={ref}>
      <torusGeometry args={[radius, 0.035, 16, 96]} />
      <meshBasicMaterial color={color} transparent opacity={0.65} blending={THREE.AdditiveBlending} depthWrite={false} />
    </mesh>
  );
}

function PulseCore({ color }) {
  const core = useRef();
  const glow = useRef();
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const s = 1 + Math.sin(t * 2.4) * 0.08;
    if (core.current) core.current.scale.setScalar(s);
    if (glow.current) {
      glow.current.scale.setScalar(1.6 + Math.sin(t * 1.8) * 0.2);
      glow.current.material.opacity = 0.18 + Math.sin(t * 2) * 0.06;
    }
  });
  return (
    <group>
      <mesh ref={core}>
        <icosahedronGeometry args={[0.85, 1]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={1.8}
          metalness={0.45}
          roughness={0.15}
        />
      </mesh>
      <mesh ref={glow}>
        <sphereGeometry args={[1.1, 32, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.2} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
    </group>
  );
}

function Swarm({ count, color }) {
  const ref = useRef();
  const data = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const seeds = [];
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const b = (Math.random() - 0.5) * Math.PI;
      const r = 1.6 + Math.random() * 2.4;
      pos[i * 3] = Math.cos(a) * Math.cos(b) * r;
      pos[i * 3 + 1] = Math.sin(b) * r;
      pos[i * 3 + 2] = Math.sin(a) * Math.cos(b) * r;
      seeds.push({ a, b, r, s: 0.4 + Math.random() * 1.2 });
    }
    return { pos, seeds };
  }, [count]);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const arr = ref.current.geometry.attributes.position.array;
    const t = clock.elapsedTime;
    data.seeds.forEach((s, i) => {
      const a = s.a + t * s.s * 0.35;
      const b = s.b + Math.sin(t * 0.5 + i) * 0.15;
      const r = s.r + Math.sin(t + i) * 0.12;
      arr[i * 3] = Math.cos(a) * Math.cos(b) * r;
      arr[i * 3 + 1] = Math.sin(b) * r;
      arr[i * 3 + 2] = Math.sin(a) * Math.cos(b) * r;
    });
    ref.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={data.pos.length / 3} array={data.pos} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial
        color={color}
        size={0.06}
        sizeAttenuation
        transparent
        opacity={0.9}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

function LoginScene({ accent, lane, blue }) {
  const mobile = useIsMobilePerf();
  const group = useRef();
  const stars = useRef();
  const green = new THREE.Color(accent || "#2EF0A0");
  const gold = new THREE.Color(lane || "#FFC857");
  const sky = new THREE.Color(blue || "#6BB8FF");

  const starPos = useMemo(() => {
    const n = mobile ? 180 : 360;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 24;
      arr[i * 3 + 1] = (Math.random() - 0.5) * 16;
      arr[i * 3 + 2] = -4 - Math.random() * 12;
    }
    return arr;
  }, [mobile]);

  useFrame(({ clock, pointer }) => {
    if (!group.current) return;
    group.current.rotation.y = clock.elapsedTime * 0.12 + pointer.x * 0.25;
    group.current.rotation.x = pointer.y * 0.15;
    if (stars.current) {
      stars.current.rotation.y = clock.elapsedTime * 0.03;
      stars.current.rotation.x = Math.sin(clock.elapsedTime * 0.1) * 0.05;
    }
  });

  return (
    <>
      <ambientLight intensity={0.4} />
      <pointLight position={[3, 2, 4]} intensity={2} color={green} />
      <pointLight position={[-3, -1, 2]} intensity={1.2} color={gold} />
      <pointLight position={[0, 4, -2]} intensity={0.8} color={sky} />
      <points ref={stars}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" count={starPos.length / 3} array={starPos} itemSize={3} />
        </bufferGeometry>
        <pointsMaterial
          color="#cfe8ff"
          size={0.04}
          sizeAttenuation
          transparent
          opacity={0.75}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
      <group ref={group}>
        <PulseCore color={green} />
        <OrbitRing radius={1.5} color={gold} speed={0.55} tilt={0.6} />
        <OrbitRing radius={1.95} color={green} speed={-0.35} tilt={1.1} />
        <OrbitRing radius={2.4} color={sky} speed={0.22} tilt={0.3} />
        <OrbitRing radius={2.85} color={gold} speed={-0.15} tilt={1.5} />
        <Swarm count={mobile ? 80 : 180} color={green} />
      </group>
    </>
  );
}

export default function LoginFX({ accent, lane, blue }) {
  return (
    <FxCanvas
      className="dd-fx-login"
      style={{ position: "absolute", inset: 0, zIndex: 0 }}
      camera={{ position: [0, 0, 6.5], fov: 40 }}
      trackWindowPointer
    >
      <LoginScene accent={accent} lane={lane} blue={blue} />
    </FxCanvas>
  );
}
