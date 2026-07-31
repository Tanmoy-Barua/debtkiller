import React, { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import FxCanvas from "./FxCanvas.jsx";
import { useIsMobilePerf } from "./useReducedMotion.js";

function hexToColor(hex, fallback = "#2EF0A0") {
  try {
    return new THREE.Color(hex || fallback);
  } catch {
    return new THREE.Color(fallback);
  }
}

function StarField({ count, color, speed = 1 }) {
  const ref = useRef();
  const { positions, velocities } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 28;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 18;
      positions[i * 3 + 2] = -2 - Math.random() * 16;
      velocities[i] = 0.15 + Math.random() * 0.55;
    }
    return { positions, velocities };
  }, [count]);

  useFrame((_, dt) => {
    const mesh = ref.current;
    if (!mesh) return;
    const arr = mesh.geometry.attributes.position.array;
    for (let i = 0; i < count; i++) {
      arr[i * 3 + 2] += velocities[i] * speed * dt * 1.4;
      if (arr[i * 3 + 2] > 4) {
        arr[i * 3] = (Math.random() - 0.5) * 28;
        arr[i * 3 + 1] = (Math.random() - 0.5) * 18;
        arr[i * 3 + 2] = -16 - Math.random() * 4;
      }
    }
    mesh.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={positions.length / 3} array={positions} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial
        color={color}
        size={0.045}
        sizeAttenuation
        transparent
        opacity={0.85}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

function AuroraRibbon({ color, phase = 0, amp = 1.2, y = 0 }) {
  const ref = useRef();
  const geo = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3(
      Array.from({ length: 12 }, (_, i) => {
        const t = i / 11;
        return new THREE.Vector3((t - 0.5) * 16, y + Math.sin(t * Math.PI * 2) * 0.4, -4 - t * 2);
      })
    );
    return new THREE.TubeGeometry(curve, 64, 0.08, 8, false);
  }, [y]);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.elapsedTime * 0.35 + phase;
    ref.current.rotation.z = Math.sin(t) * 0.12 * amp;
    ref.current.position.y = Math.sin(t * 0.7) * 0.35 * amp;
    ref.current.material.opacity = 0.22 + Math.sin(t * 1.4) * 0.08;
  });

  return (
    <mesh ref={ref} geometry={geo}>
      <meshBasicMaterial
        color={color}
        transparent
        opacity={0.28}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

function RoadGrid({ color }) {
  const ref = useRef();
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const pts = [];
    const w = 10;
    const depth = 24;
    for (let z = 0; z <= depth; z++) {
      pts.push(-w, -3.2, -z, w, -3.2, -z);
    }
    for (let x = -w; x <= w; x += 1) {
      pts.push(x, -3.2, 0, x, -3.2, -depth);
    }
    g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    return g;
  }, []);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.position.z = (clock.elapsedTime * 1.8) % 1;
  });

  return (
    <group rotation={[-0.35, 0, 0]} position={[0, -0.4, 2]}>
      <lineSegments ref={ref} geometry={geo}>
        <lineBasicMaterial color={color} transparent opacity={0.18} blending={THREE.AdditiveBlending} />
      </lineSegments>
    </group>
  );
}

function FloatingCrystal({ position, color, scale = 1, speed = 1 }) {
  const ref = useRef();
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.elapsedTime * speed;
    ref.current.rotation.x = t * 0.4;
    ref.current.rotation.y = t * 0.55;
    ref.current.position.y = position[1] + Math.sin(t + position[0]) * 0.25;
  });
  return (
    <mesh ref={ref} position={position} scale={scale}>
      <octahedronGeometry args={[0.35, 0]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={0.85}
        metalness={0.6}
        roughness={0.2}
        transparent
        opacity={0.7}
      />
    </mesh>
  );
}

function EnergyCore({ green, amber, intensity = 1 }) {
  const core = useRef();
  const ringA = useRef();
  const ringB = useRef();
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (core.current) {
      core.current.scale.setScalar(0.85 + Math.sin(t * 2.2) * 0.08 * intensity);
    }
    if (ringA.current) {
      ringA.current.rotation.x = t * 0.55;
      ringA.current.rotation.z = t * 0.35;
    }
    if (ringB.current) {
      ringB.current.rotation.y = -t * 0.45;
      ringB.current.rotation.x = t * 0.25;
    }
  });
  return (
    <group position={[3.2, 1.4, -1]}>
      <mesh ref={core}>
        <icosahedronGeometry args={[0.55, 1]} />
        <meshStandardMaterial
          color={green}
          emissive={green}
          emissiveIntensity={1.4 * intensity}
          metalness={0.3}
          roughness={0.25}
          transparent
          opacity={0.9}
        />
      </mesh>
      <mesh ref={ringA}>
        <torusGeometry args={[1.05, 0.03, 12, 64]} />
        <meshBasicMaterial color={amber} transparent opacity={0.55} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh ref={ringB}>
        <torusGeometry args={[1.35, 0.02, 12, 64]} />
        <meshBasicMaterial color={green} transparent opacity={0.4} blending={THREE.AdditiveBlending} />
      </mesh>
    </group>
  );
}

function SceneRig({ mode, accent, lane, blue }) {
  const mobile = useIsMobilePerf();
  const group = useRef();
  const { pointer, viewport } = useThree();
  const green = hexToColor(accent);
  const gold = hexToColor(lane);
  const sky = hexToColor(blue);

  useFrame((_, dt) => {
    if (!group.current) return;
    const tx = pointer.x * (mobile ? 0.15 : 0.35);
    const ty = pointer.y * (mobile ? 0.1 : 0.22);
    group.current.rotation.y = THREE.MathUtils.damp(group.current.rotation.y, tx, 2.5, dt);
    group.current.rotation.x = THREE.MathUtils.damp(group.current.rotation.x, -ty, 2.5, dt);
  });

  const stars = mobile ? 220 : 480;

  return (
    <>
      <color attach="background" args={["#00000000"]} />
      <ambientLight intensity={mode === "light" ? 0.55 : 0.35} />
      <pointLight position={[4, 3, 4]} intensity={1.2} color={green} />
      <pointLight position={[-5, -2, 2]} intensity={0.7} color={gold} />
      <pointLight position={[0, 4, -4]} intensity={0.5} color={sky} />

      <group ref={group}>
        <StarField count={stars} color={mode === "light" ? "#1a3a55" : "#b8e8ff"} speed={mode === "light" ? 0.55 : 1} />
        <StarField count={Math.floor(stars * 0.35)} color={green} speed={0.7} />
        <AuroraRibbon color={green} phase={0} amp={1.1} y={1.2} />
        <AuroraRibbon color={gold} phase={1.4} amp={0.9} y={-0.4} />
        <AuroraRibbon color={sky} phase={2.6} amp={1.0} y={0.5} />
        <RoadGrid color={mode === "light" ? "#3a5a7a" : "#2EF0A0"} />
        {!mobile && (
          <>
            <FloatingCrystal position={[-3.5, 1.2, -2]} color={green} scale={0.9} speed={0.9} />
            <FloatingCrystal position={[-2.2, -0.8, -3]} color={gold} scale={0.55} speed={1.2} />
            <FloatingCrystal position={[1.5, -1.4, -2.5]} color={sky} scale={0.7} speed={0.75} />
          </>
        )}
        <EnergyCore green={green} amber={gold} intensity={mode === "light" ? 0.7 : 1} />
      </group>

      {/* subtle vignette plane */}
      <mesh position={[0, 0, -8]} scale={[viewport.width * 1.4, viewport.height * 1.4, 1]}>
        <planeGeometry />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>
    </>
  );
}

export default function BackgroundFX({ mode = "dark", accent = "#2EF0A0", lane = "#FFC857", blue = "#6BB8FF" }) {
  return (
    <FxCanvas
      className="dd-fx-bg"
      style={{ position: "fixed", inset: 0, zIndex: 0 }}
      camera={{ position: [0, 0.4, 9], fov: 42, near: 0.1, far: 60 }}
      trackWindowPointer
    >
      <SceneRig mode={mode} accent={accent} lane={lane} blue={blue} />
    </FxCanvas>
  );
}
