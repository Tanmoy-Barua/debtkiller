import React, { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import FxCanvas from "./FxCanvas.jsx";

function Burst({ colors }) {
  const ref = useRef();
  const count = 140;
  const { positions, velocities, colorArr } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    const colorArr = new Float32Array(count * 3);
    const c = colors.map((h) => new THREE.Color(h));
    for (let i = 0; i < count; i++) {
      positions[i * 3] = 0;
      positions[i * 3 + 1] = 0;
      positions[i * 3 + 2] = 0;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const speed = 1.6 + Math.random() * 4.2;
      velocities[i * 3] = Math.sin(phi) * Math.cos(theta) * speed;
      velocities[i * 3 + 1] = Math.cos(phi) * speed + 1.2;
      velocities[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * speed;
      const col = c[i % c.length];
      colorArr[i * 3] = col.r;
      colorArr[i * 3 + 1] = col.g;
      colorArr[i * 3 + 2] = col.b;
    }
    return { positions, velocities, colorArr };
  }, [colors]);

  const life = useRef(0);

  useFrame((_, dt) => {
    if (!ref.current) return;
    life.current += dt;
    const arr = ref.current.geometry.attributes.position.array;
    for (let i = 0; i < count; i++) {
      velocities[i * 3 + 1] -= 5.2 * dt;
      arr[i * 3] += velocities[i * 3] * dt;
      arr[i * 3 + 1] += velocities[i * 3 + 1] * dt;
      arr[i * 3 + 2] += velocities[i * 3 + 2] * dt;
    }
    ref.current.geometry.attributes.position.needsUpdate = true;
    ref.current.material.opacity = Math.max(0, 1 - life.current / 2.1);
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={positions.length / 3} array={positions} itemSize={3} />
        <bufferAttribute attach="attributes-color" count={colorArr.length / 3} array={colorArr} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial
        size={0.09}
        vertexColors
        transparent
        opacity={1}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        sizeAttenuation
      />
    </points>
  );
}

function Shockwave({ color }) {
  const ref = useRef();
  useFrame((_, dt) => {
    if (!ref.current) return;
    ref.current.scale.x += dt * 3.2;
    ref.current.scale.y += dt * 3.2;
    ref.current.scale.z += dt * 3.2;
    ref.current.material.opacity = Math.max(0, ref.current.material.opacity - dt * 0.55);
  });
  return (
    <mesh ref={ref}>
      <ringGeometry args={[0.15, 0.28, 48]} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={0.55}
        side={THREE.DoubleSide}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </mesh>
  );
}

export default function CelebrateFX({ colors = ["#2EF0A0", "#FFC857", "#6BB8FF", "#ffffff"] }) {
  return (
    <FxCanvas
      className="dd-fx-celebrate"
      style={{ position: "fixed", inset: 0, zIndex: 58 }}
      camera={{ position: [0, 0, 8], fov: 48 }}
    >
      <Burst colors={colors} />
      <Shockwave color={colors[0]} />
    </FxCanvas>
  );
}
