"use client";

import { Edges, Html, Instance, Instances, OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { colorForKey } from "@/lib/colors";
import type { ContainerSpec, PlacedBox } from "@/lib/types";

function boxColor(box: PlacedBox) {
  return colorForKey(box.cargoId);
}

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
  const wall = "#E8EDF2";
  const wallSoft = "#F4F7FA";

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[L / 2, 0, W / 2]} receiveShadow>
        <planeGeometry args={[L, W]} />
        <meshStandardMaterial color="#EEF2F6" roughness={0.9} metalness={0.04} />
      </mesh>
      <gridHelper
        args={[Math.max(L, W), 12, "#C5CDD6", "#E2E8F0"]}
        position={[L / 2, 0.002, W / 2]}
      />

      <mesh position={[0, H / 2, W / 2]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[W, H]} />
        <meshStandardMaterial color="#D9E0E8" side={THREE.DoubleSide} roughness={0.75} />
      </mesh>

      <mesh position={[L / 2, H / 2, 0]}>
        <planeGeometry args={[L, H]} />
        <meshStandardMaterial
          color={wall}
          side={THREE.DoubleSide}
          transparent
          opacity={0.22}
          roughness={0.7}
        />
      </mesh>
      <mesh position={[L / 2, H / 2, W]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[L, H]} />
        <meshStandardMaterial
          color={wallSoft}
          side={THREE.DoubleSide}
          transparent
          opacity={0.14}
          roughness={0.7}
        />
      </mesh>

      <mesh position={[L / 2, H, W / 2]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[L, W]} />
        <meshStandardMaterial
          color="#F8FAFC"
          side={THREE.DoubleSide}
          transparent
          opacity={0.1}
        />
      </mesh>

      <group position={[L / 2, H / 2, W / 2]}>
        <mesh>
          <boxGeometry args={[L, H, W]} />
          <meshBasicMaterial transparent opacity={0} />
          <Edges color="#64748B" threshold={15} />
        </mesh>
      </group>

      <DoorFrame L={L} W={W} H={H} doorW={m(container.doorW)} doorH={m(container.doorH)} />
      <Html position={[0.08, H + 0.18, W / 2]} center occlude={false}>
        <div className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-medium whitespace-nowrap text-white">
          안쪽
        </div>
      </Html>
      <Html position={[L, H + 0.18, W / 2]} center occlude={false}>
        <div className="rounded bg-amber-600 px-1.5 py-0.5 text-[10px] font-medium whitespace-nowrap text-white">
          도어
        </div>
      </Html>
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
        <meshStandardMaterial color="#94A3B8" />
      </mesh>
      <mesh position={[L, doorH / 2, W - side / 2]}>
        <boxGeometry args={[0.05, doorH, side]} />
        <meshStandardMaterial color="#94A3B8" />
      </mesh>
      <mesh position={[L, doorH + lintel / 2, W / 2]}>
        <boxGeometry args={[0.05, lintel, W]} />
        <meshStandardMaterial color="#94A3B8" />
      </mesh>
    </group>
  );
}

const EDGE = "#111111";
const INNER_SCALE = 0.99;
const ARROW_GEO = makeArrowGeometry();

function makeArrowGeometry() {
  const shape = new THREE.Shape();
  shape.moveTo(0.02, -0.07);
  shape.lineTo(0.28, -0.07);
  shape.lineTo(0.28, -0.16);
  shape.lineTo(0.48, 0);
  shape.lineTo(0.28, 0.16);
  shape.lineTo(0.28, 0.07);
  shape.lineTo(0.02, 0.07);
  shape.closePath();
  const geometry = new THREE.ShapeGeometry(shape);
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

function boxCenter(box: PlacedBox): [number, number, number] {
  return [
    m(box.x) + m(box.dx) / 2,
    m(box.y) + m(box.dy) / 2,
    m(box.z) + m(box.dz) / 2,
  ];
}

function arrowYaw(box: PlacedBox) {
  return box.dx >= box.dz ? 0 : Math.PI / 2;
}

function arrowScale(box: PlacedBox) {
  return Math.min(m(box.dx), m(box.dz)) * 0.85;
}

function ArrowMark({
  position,
  yaw,
  scale,
}: {
  position: [number, number, number];
  yaw: number;
  scale: number;
}) {
  return (
    <mesh
      geometry={ARROW_GEO}
      position={position}
      rotation={[0, yaw, 0]}
      scale={[scale, 1, scale]}
    >
      <meshBasicMaterial color="#111111" toneMapped={false} />
    </mesh>
  );
}

function BoxEdgeLines({ boxes }: { boxes: PlacedBox[] }) {
  const geometry = useMemo(() => {
    const positions: number[] = [];
    const pad = 0.0008;
    for (const box of boxes) {
      const x0 = m(box.x) - pad;
      const x1 = m(box.x + box.dx) + pad;
      const y0 = m(box.y) - pad;
      const y1 = m(box.y + box.dy) + pad;
      const z0 = m(box.z) - pad;
      const z1 = m(box.z + box.dz) + pad;
      const c: [number, number, number][] = [
        [x0, y0, z0],
        [x1, y0, z0],
        [x1, y0, z1],
        [x0, y0, z1],
        [x0, y1, z0],
        [x1, y1, z0],
        [x1, y1, z1],
        [x0, y1, z1],
      ];
      const edges: [number, number][] = [
        [0, 1],
        [1, 2],
        [2, 3],
        [3, 0],
        [4, 5],
        [5, 6],
        [6, 7],
        [7, 4],
        [0, 4],
        [1, 5],
        [2, 6],
        [3, 7],
      ];
      for (const [a, b] of edges) {
        positions.push(...c[a], ...c[b]);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    return geo;
  }, [boxes]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <lineSegments geometry={geometry} renderOrder={2}>
      <lineBasicMaterial color={EDGE} depthTest linewidth={1} />
    </lineSegments>
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
  return (
    <group
      position={boxCenter(box)}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(box.id);
      }}
    >
      <mesh>
        <boxGeometry
          args={[
            m(box.dx) * INNER_SCALE,
            m(box.dy) * INNER_SCALE,
            m(box.dz) * INNER_SCALE,
          ]}
        />
        <meshStandardMaterial
          color={selected ? "#FFF6D6" : boxColor(box)}
          roughness={0.42}
          metalness={0.02}
        />
        <Edges color={EDGE} threshold={1} />
      </mesh>
      <ArrowMark
        position={[0, m(box.dy) / 2 + 0.004, 0]}
        yaw={arrowYaw(box)}
        scale={arrowScale(box)}
      />
    </group>
  );
}

function CargoBatch({
  boxes,
  visibleThrough,
  selectedId,
  onSelect,
}: {
  boxes: PlacedBox[];
  visibleThrough: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const groups = useMemo(() => {
    const map = new Map<string, PlacedBox[]>();
    for (const box of boxes) {
      const tint = boxColor(box);
      const key = `${box.dx}|${box.dy}|${box.dz}|${tint}`;
      const list = map.get(key);
      if (list) list.push(box);
      else map.set(key, [box]);
    }
    return [...map.values()];
  }, [boxes]);

  const revealed = useMemo(
    () => boxes.filter((box) => box.sequence <= visibleThrough),
    [boxes, visibleThrough],
  );

  return (
    <>
      {groups.map((group) => {
        const sample = group[0];
        const tint = boxColor(sample);
        return (
          <group key={`${sample.dx}-${sample.dy}-${sample.dz}-${tint}`}>
            <Instances limit={group.length} range={group.length}>
              <boxGeometry
                args={[
                  m(sample.dx) * INNER_SCALE,
                  m(sample.dy) * INNER_SCALE,
                  m(sample.dz) * INNER_SCALE,
                ]}
              />
              <meshStandardMaterial color={tint} roughness={0.42} metalness={0.02} />
              {group.map((box) => {
                const show = box.sequence <= visibleThrough;
                return (
                  <Instance
                    key={box.id}
                    position={boxCenter(box)}
                    scale={show ? 1 : 0.0001}
                    color={box.id === selectedId ? "#FFF6D6" : tint}
                    onClick={(event) => {
                      event.stopPropagation();
                      onSelect(box.id);
                    }}
                  />
                );
              })}
            </Instances>
          </group>
        );
      })}
      <BoxEdgeLines boxes={revealed} />
      {revealed.map((box) => (
        <ArrowMark
          key={`${box.id}-arrow`}
          position={[
            m(box.x) + m(box.dx) / 2,
            m(box.y) + m(box.dy) + 0.004,
            m(box.z) + m(box.dz) / 2,
          ]}
          yaw={arrowYaw(box)}
          scale={arrowScale(box)}
        />
      ))}
    </>
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
  const useBatch = boxes.length > 80;

  return (
    <>
      <color attach="background" args={["#F4F6F8"]} />
      <ambientLight intensity={0.92} />
      <hemisphereLight args={["#FFFFFF", "#D7DEE6", 0.55]} />
      <directionalLight
        position={[L * 1.2, H * 2.2, W * 1.1]}
        intensity={0.95}
        castShadow={!useBatch}
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <ContainerShell container={container} />
      {useBatch ? (
        <CargoBatch
          boxes={boxes}
          visibleThrough={visibleThrough}
          selectedId={selectedId}
          onSelect={onSelect}
        />
      ) : (
        visible.map((box) => (
          <CargoMesh
            key={box.id}
            box={box}
            selected={box.id === selectedId}
            onSelect={onSelect}
          />
        ))
      )}
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
        position: [L + 3.2, H * 1.7, W + 3.4],
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
