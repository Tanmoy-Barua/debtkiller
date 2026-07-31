import React, { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import FxCanvas from "./FxCanvas.jsx";
import { useIsMobilePerf } from "./useReducedMotion.js";

/** Soft atmospheric backdrop — road-to-freedom mood, not toy FX. */
function DriftDust({ count, color, speed = 0.2 }) {
  const ref = useRef();
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 30;
      arr[i * 3 + 1] = (Math.random() - 0.5) * 16;
      arr[i * 3 + 2] = -2 - Math.random() * 18;
    }
    return arr;
  }, [count]);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.rotation.y = clock.elapsedTime * speed * 0.04;
    ref.current.position.y = Math.sin(clock.elapsedTime * 0.15) * 0.15;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={positions.length / 3} array={positions} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial
        color={color}
        size={0.035}
        sizeAttenuation
        transparent
        opacity={0.45}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

function HorizonGlow({ color, y = -1.6 }) {
  const ref = useRef();
  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.material.opacity = 0.12 + Math.sin(clock.elapsedTime * 0.4) * 0.03;
  });
  return (
    <mesh ref={ref} position={[0, y, -6]} rotation={[-Math.PI / 2.4, 0, 0]}>
      <planeGeometry args={[28, 10]} />
      <meshBasicMaterial color={color} transparent opacity={0.14} depthWrite={false} blending={THREE.AdditiveBlending} />
    </mesh>
  );
}

function SoftRoad({ color }) {
  const ref = useRef();
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const pts = [];
    for (let z = 0; z <= 20; z += 1.2) {
      pts.push(-0.08, -2.8, -z, 0.08, -2.8, -z);
    }
    // side rails
    for (let z = 0; z <= 20; z += 2) {
      pts.push(-3.2, -2.85, -z, -3.05, -2.85, -z);
      pts.push(3.05, -2.85, -z, 3.2, -2.85, -z);
    }
    g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    return g;
  }, []);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.position.z = (clock.elapsedTime * 0.55) % 1.2;
  });

  return (
    <group rotation={[-0.28, 0, 0]} position={[0, -0.2, 1.5]}>
      <lineSegments ref={ref} geometry={geo}>
        <lineBasicMaterial color={color} transparent opacity={0.22} blending={THREE.AdditiveBlending} />
      </lineSegments>
    </group>
  );
}

function DistantBeacon({ color, position }) {
  const ref = useRef();
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.elapsedTime;
    ref.current.material.opacity = 0.35 + Math.sin(t * 1.1 + position[0]) * 0.12;
    ref.current.scale.setScalar(1 + Math.sin(t * 0.8) * 0.08);
  });
  return (
    <mesh ref={ref} position={position}>
      <sphereGeometry args={[0.22, 24, 24]} />
      <meshBasicMaterial color={color} transparent opacity={0.4} depthWrite={false} blending={THREE.AdditiveBlending} />
    </mesh>
  );
}

function SceneRig({ mode, accent, lane, blue }) {
  const mobile = useIsMobilePerf();
  const group = useRef();
  const { pointer } = useThree();
  const green = new THREE.Color(accent || "#2EF0A0");
  const gold = new THREE.Color(lane || "#FFC857");
  const sky = new THREE.Color(blue || "#6BB8FF");
  const dust = mode === "light" ? "#5a7a9a" : "#9ec9ff";

  useFrame((_, dt) => {
    if (!group.current) return;
    group.current.rotation.y = THREE.MathUtils.damp(group.current.rotation.y, pointer.x * 0.12, 2, dt);
    group.current.rotation.x = THREE.MathUtils.damp(group.current.rotation.x, -pointer.y * 0.06, 2, dt);
  });

  return (
    <>
      <ambientLight intensity={mode === "light" ? 0.5 : 0.3} />
      <pointLight position={[0, 2, 4]} intensity={0.6} color={green} />
      <pointLight position={[-4, 1, 1]} intensity={0.35} color={gold} />
      <group ref={group}>
        <DriftDust count={mobile ? 140 : 280} color={dust} />
        <DriftDust count={mobile ? 40 : 80} color={green} speed={0.12} />
        <HorizonGlow color={green} y={-1.4} />
        <HorizonGlow color={gold} y={-1.9} />
        <SoftRoad color={mode === "light" ? "#3d6a8a" : green} />
        {!mobile && (
          <>
            <DistantBeacon color={green} position={[4.5, 1.8, -5]} />
            <DistantBeacon color={sky} position={[-5.2, 0.6, -7]} />
            <DistantBeacon color={gold} position={[2.2, -0.4, -8]} />
          </>
        )}
      </group>
    </>
  );
}

export default function BackgroundFX({ mode = "dark", accent = "#2EF0A0", lane = "#FFC857", blue = "#6BB8FF" }) {
  return (
    <FxCanvas
      className="dd-fx-bg"
      style={{ position: "fixed", inset: 0, zIndex: 0 }}
      camera={{ position: [0, 0.3, 9], fov: 40, near: 0.1, far: 60 }}
      trackWindowPointer
    >
      <SceneRig mode={mode} accent={accent} lane={lane} blue={blue} />
    </FxCanvas>
  );
}
