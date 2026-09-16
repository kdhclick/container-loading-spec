"use client";

import { Edges, OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useMemo } from "react";
import * as THREE from "three";
import type { ContainerSpec, PlacedBox } from "@/lib/types";

interface PackingCanvasProps {
  container: ContainerSpec;
  boxes: PlacedBox[];
  visibleThrough: number;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

function m(mm: number) {
  return mm / 1000;
}

function ContainerShell({ container }: { container: ContainerSpec }) {
  const L = m(container.innerL);
  const W = m(container.innerW);
  const H = m(container.innerH);
  const orange = "#c2410c";
  const rust = "#9a3412";

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[L / 2, 0, W / 2]} receiveShadow>
        <planeGeometry args={[L, W]} />
        <meshStandardMaterial color="#3f3a36" roughness={0.85} metalness={0.15} />
      </mesh>
      <gridHelper
        args={[Math.max(L, W), 12, "#78716c", "#44403c"]}
        position={[L / 2, 0.002, W / 2]}
      />

      <mesh position={[0, H / 2, W / 2]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[W, H]} />
        <meshStandardMaterial color={rust} side={THREE.DoubleSide} roughness={0.7} />
      </mesh>

      <mesh position={[L / 2, H / 2, 0]}>
        <planeGeometry args={[L, H]} />
        <meshStandardMaterial
          color={orange}
          side={THREE.DoubleSide}
          transparent
          opacity={0.28}
          roughness={0.65}
        />
      </mesh>
      <mesh position={[L / 2, H / 2, W]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[L, H]} />
        <meshStandardMaterial
          color={orange}
          side={THREE.DoubleSide}
          transparent
          opacity={0.18}
          roughness={0.65}
        />
      </mesh>

      <mesh position={[L / 2, H, W / 2]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[L, W]} />
        <meshStandardMaterial
          color="#7c2d12"
          side={THREE.DoubleSide}
          transparent
          opacity={0.12}
        />
      </mesh>

      <group position={[L / 2, H / 2, W / 2]}>
        <mesh>
          <boxGeometry args={[L, H, W]} />
          <meshBasicMaterial transparent opacity={0} />
          <Edges color="#ffedd5" threshold={15} />
        </mesh>
      </group>

      <DoorFrame L={L} W={W} H={H} doorW={m(container.doorW)} doorH={m(container.doorH)} />
    </group>
  );
}

function DoorFrame({
  L,
  W,
  H,
  doorW,
  doorH,
}: {
  L: number;
  W: number;
  H: number;
  doorW: number;
  doorH: number;
}) {
  const side = Math.max(0.04, (W - doorW) / 2);
  const lintel = Math.max(0.04, H - doorH);
  return (
    <group>
      <mesh position={[L, doorH / 2, side / 2]}>
        <boxGeometry args={[0.05, doorH, side]} />
        <meshStandardMaterial color="#1c1917" />
      </mesh>
      <mesh position={[L, doorH / 2, W - side / 2]}>
        <boxGeometry args={[0.05, doorH, side]} />
        <meshStandardMaterial color="#1c1917" />
      </mesh>
      <mesh position={[L, doorH + lintel / 2, W / 2]}>
        <boxGeometry args={[0.05, lintel, W]} />
        <meshStandardMaterial color="#1c1917" />
      </mesh>
    </group>
  );
}

function CargoMesh({
  box,
  selected,
  onSelect,
}: {
  box: PlacedBox;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const sx = m(box.dx) * 0.99;
  const sy = m(box.dy) * 0.99;
  const sz = m(box.dz) * 0.99;
  const position: [number, number, number] = [
    m(box.x) + m(box.dx) / 2,
    m(box.y) + m(box.dy) / 2,
    m(box.z) + m(box.dz) / 2,
  ];

  return (
    <mesh
      position={position}
      castShadow
      receiveShadow
      onClick={(event) => {
        event.stopPropagation();
        onSelect(box.id);
      }}
    >
      <boxGeometry args={[sx, sy, sz]} />
      <meshStandardMaterial
        color={box.color}
        roughness={0.45}
        metalness={0.08}
        emissive={selected ? box.color : "#000000"}
        emissiveIntensity={selected ? 0.4 : 0}
      />
      <Edges color={selected ? "#ffffff" : "#111827"} threshold={15} />
    </mesh>
  );
}

function Scene({
  container,
  boxes,
  visibleThrough,
  selectedId,
  onSelect,
}: PackingCanvasProps) {
  const L = m(container.innerL);
  const W = m(container.innerW);
  const H = m(container.innerH);
  const visible = useMemo(
    () => boxes.filter((b) => b.sequence <= visibleThrough),
    [boxes, visibleThrough],
  );

  return (
    <>
      <color attach="background" args={["#1c1917"]} />
      <ambientLight intensity={0.55} />
      <hemisphereLight args={["#fff7ed", "#292524", 0.45]} />
      <directionalLight
        position={[L * 1.2, H * 2.2, W * 1.1]}
        intensity={1.15}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <ContainerShell container={container} />
      {visible.map((box) => (
        <CargoMesh
          key={box.id}
          box={box}
          selected={box.id === selectedId}
          onSelect={onSelect}
        />
      ))}
      <OrbitControls
        makeDefault
        target={[L / 2, H * 0.4, W / 2]}
        maxPolarAngle={Math.PI * 0.48}
        minDistance={2}
        maxDistance={Math.max(L, 8) * 2.4}
      />
    </>
  );
}

export default function PackingCanvas(props: PackingCanvasProps) {
  const L = m(props.container.innerL);
  const W = m(props.container.innerW);
  const H = m(props.container.innerH);

  return (
    <Canvas
      shadows
      camera={{
        position: [L + 3.4, H * 1.15, W + 3.2],
        fov: 42,
        near: 0.1,
        far: 80,
      }}
      onPointerMissed={() => props.onSelect(null)}
    >
      <Scene {...props} />
    </Canvas>
  );
}
