import { colorForKey } from "@/lib/colors";
import type {
  CargoRow,
  ContainerSpec,
  LayerNote,
  Orientation,
  PackOptions,
  PackingPlan,
  PlacedBox,
  UnpackedItem,
  ValidationIssue,
} from "@/lib/types";
import { LARGE_PACK_THRESHOLD } from "@/lib/types";

const EPS = 0.05;
const SUPPORT_RATIO = 0.55;

export function orientations(
  l: number,
  w: number,
  h: number,
  keepUpright = true,
): Orientation[] {
  const candidates: Orientation[] = keepUpright
    ? [
        { dx: l, dy: h, dz: w, rotation: { x: 0, y: 0, z: 0 }, label: "정방향" },
        { dx: w, dy: h, dz: l, rotation: { x: 0, y: 90, z: 0 }, label: "좌우 90°" },
      ]
    : [
        { dx: l, dy: h, dz: w, rotation: { x: 0, y: 0, z: 0 }, label: "회전 없음" },
        { dx: l, dy: w, dz: h, rotation: { x: 90, y: 0, z: 0 }, label: "길이 방향 눕힘" },
        { dx: w, dy: h, dz: l, rotation: { x: 0, y: 90, z: 0 }, label: "좌우 90°" },
        { dx: w, dy: l, dz: h, rotation: { x: 90, y: 90, z: 0 }, label: "좌우 90° 후 눕힘" },
        { dx: h, dy: l, dz: w, rotation: { x: 0, y: 0, z: 90 }, label: "세움 → 길이" },
        { dx: h, dy: w, dz: l, rotation: { x: 90, y: 0, z: 90 }, label: "세움 → 너비" },
      ];
  const seen = new Set<string>();
  return candidates.filter((o) => {
    const key = `${o.dx}|${o.dy}|${o.dz}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function canFitContainer(
  row: CargoRow,
  container: ContainerSpec,
  keepUpright: boolean,
): boolean {
  return orientations(row.length, row.width, row.height, keepUpright).some(
    (o) =>
      o.dx <= container.innerL + EPS &&
      o.dy <= container.innerH + EPS &&
      o.dz <= container.innerW + EPS,
  );
}

export function validateCargo(
  rows: CargoRow[],
  container: ContainerSpec,
  keepUpright = true,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const filled = rows.filter((r) => r.name.trim() || r.length || r.width || r.height);

  if (filled.length === 0) {
    issues.push({ message: "화물을 한 줄 이상 입력하세요." });
    return issues;
  }

  filled.forEach((row, index) => {
    const n = index + 1;
    if (!row.name.trim()) {
      issues.push({ rowId: row.id, message: `${n}행: 품명을 입력하세요.` });
    }
    if (!(row.length > 0) || !(row.width > 0) || !(row.height > 0)) {
      issues.push({
        rowId: row.id,
        message: `${n}행: 길이·너비·높이는 0보다 커야 합니다.`,
      });
    } else if (!canFitContainer(row, container, keepUpright)) {
      issues.push({
        rowId: row.id,
        message: keepUpright
          ? `${n}행: 「${row.name || "이름 없음"}」은(는) 입력 높이를 유지하면 컨테이너에 들어가지 않습니다.`
          : `${n}행: 「${row.name || "이름 없음"}」은(는) 어떤 회전으로도 컨테이너에 들어가지 않습니다.`,
      });
    }
    if (!Number.isInteger(row.quantity) || row.quantity < 1) {
      issues.push({ rowId: row.id, message: `${n}행: 수량은 1 이상의 정수여야 합니다.` });
    }
    if (row.weightKg != null && row.weightKg < 0) {
      issues.push({ rowId: row.id, message: `${n}행: 중량은 0 이상이어야 합니다.` });
    }
  });

  return issues;
}

export interface VolumeCapacity {
  containerMm3: number;
  cargoMm3: number;
  volumeExceeded: boolean;
  volumeFitCount: number;
  volumeOverflowCount: number;
  note: string | null;
}

export function estimateVolumeCapacity(
  rows: CargoRow[],
  container: ContainerSpec,
): VolumeCapacity {
  const filled = rows.filter(
    (r) => r.length > 0 && r.width > 0 && r.height > 0 && r.quantity > 0,
  );
  const containerMm3 = container.innerL * container.innerW * container.innerH;
  const cargoMm3 = filled.reduce(
    (s, r) => s + r.length * r.width * r.height * r.quantity,
    0,
  );
  const totalPieces = filled.reduce((s, r) => s + r.quantity, 0);
  const volumeFitCount =
    cargoMm3 > 0
      ? Math.min(totalPieces, Math.floor((containerMm3 / cargoMm3) * totalPieces + 1e-9))
      : 0;
  const volumeOverflowCount = Math.max(0, totalPieces - volumeFitCount);
  const volumeExceeded = cargoMm3 > containerMm3 + 1;

  let note: string | null = null;
  if (filled.length === 1 && filled[0].length * filled[0].width * filled[0].height > 0) {
    const piece = filled[0].length * filled[0].width * filled[0].height;
    const maxByVolume = Math.floor(containerMm3 / piece);
    const overflow = Math.max(0, filled[0].quantity - maxByVolume);
    if (overflow > 0) {
      note = `부피상 최대 ${maxByVolume.toLocaleString("ko-KR")}개까지 들어갑니다. 입력 ${filled[0].quantity.toLocaleString("ko-KR")}개 중 ${overflow.toLocaleString("ko-KR")}개는 용적을 넘습니다.`;
    }
  } else if (volumeExceeded) {
    const cargoM3 = cargoMm3 / 1e9;
    const boxM3 = containerMm3 / 1e9;
    note = `화물 부피 ${cargoM3.toFixed(2)} m³가 컨테이너 용적 ${boxM3.toFixed(2)} m³를 넘습니다. 부피상 약 ${volumeOverflowCount.toLocaleString("ko-KR")}개는 들어가지 않습니다.`;
  }

  return {
    containerMm3,
    cargoMm3,
    volumeExceeded,
    volumeFitCount,
    volumeOverflowCount,
    note,
  };
}

interface BoxGeom {
  x: number;
  y: number;
  z: number;
  dx: number;
  dy: number;
  dz: number;
}

interface Point3 {
  x: number;
  y: number;
  z: number;
}

type FreeSpace = BoxGeom;

function overlap1d(a0: number, ad: number, b0: number, bd: number): number {
  return Math.max(0, Math.min(a0 + ad, b0 + bd) - Math.max(a0, b0));
}

function aabbOverlap(a: BoxGeom, b: BoxGeom): boolean {
  return (
    a.x + EPS < b.x + b.dx &&
    a.x + a.dx > b.x + EPS &&
    a.y + EPS < b.y + b.dy &&
    a.y + a.dy > b.y + EPS &&
    a.z + EPS < b.z + b.dz &&
    a.z + a.dz > b.z + EPS
  );
}

function inBounds(box: BoxGeom, c: ContainerSpec): boolean {
  return (
    box.x >= -EPS &&
    box.y >= -EPS &&
    box.z >= -EPS &&
    box.x + box.dx <= c.innerL + EPS &&
    box.y + box.dy <= c.innerH + EPS &&
    box.z + box.dz <= c.innerW + EPS
  );
}

function collides(box: BoxGeom, placed: BoxGeom[]): boolean {
  for (const p of placed) {
    if (aabbOverlap(box, p)) return true;
  }
  return false;
}

function supportRatio(box: BoxGeom, placed: BoxGeom[]): number {
  if (box.y <= EPS) return 1;
  const footprint = box.dx * box.dz;
  if (footprint <= 0) return 0;
  let area = 0;
  for (const p of placed) {
    if (Math.abs(p.y + p.dy - box.y) > 1) continue;
    const ox = overlap1d(box.x, box.dx, p.x, p.dx);
    const oz = overlap1d(box.z, box.dz, p.z, p.dz);
    if (ox > 0 && oz > 0) area += ox * oz;
  }
  return area / footprint;
}

function pointInside(p: Point3, box: BoxGeom): boolean {
  return (
    p.x > box.x + EPS &&
    p.x < box.x + box.dx - EPS &&
    p.y > box.y + EPS &&
    p.y < box.y + box.dy - EPS &&
    p.z > box.z + EPS &&
    p.z < box.z + box.dz - EPS
  );
}

function keyPoint(p: Point3): string {
  return `${p.x.toFixed(1)}|${p.y.toFixed(1)}|${p.z.toFixed(1)}`;
}

function prunePoints(points: Point3[], placed: BoxGeom[], c: ContainerSpec): Point3[] {
  const seen = new Set<string>();
  const next: Point3[] = [];
  for (const p of points) {
    if (p.x < -EPS || p.y < -EPS || p.z < -EPS) continue;
    if (p.x > c.innerL - EPS || p.y > c.innerH - EPS || p.z > c.innerW - EPS) continue;
    if (placed.some((b) => pointInside(p, b))) continue;
    const k = keyPoint(p);
    if (seen.has(k)) continue;
    seen.add(k);
    next.push(p);
  }
  next.sort((a, b) => a.y - b.y || a.x - b.x || a.z - b.z);
  return next.slice(0, 900);
}

function placementScore(box: BoxGeom): number {
  // Bottom, then first-in (rear / small X), then left (small Z), then compact.
  return box.y * 1e13 + box.x * 1e8 + box.z * 1e3 + box.dx + box.dz;
}

interface Candidate {
  geom: BoxGeom;
  orientation: Orientation;
  score: number;
}

function findCandidate(
  item: { length: number; width: number; height: number },
  origins: Point3[],
  placed: BoxGeom[],
  container: ContainerSpec,
  requireSupport: boolean,
  keepUpright = true,
): Candidate | null {
  let best: Candidate | null = null;
  for (const o of orientations(item.length, item.width, item.height, keepUpright)) {
    for (const p of origins) {
      const geom: BoxGeom = { x: p.x, y: p.y, z: p.z, dx: o.dx, dy: o.dy, dz: o.dz };
      if (!inBounds(geom, container)) continue;
      if (collides(geom, placed)) continue;
      if (requireSupport && supportRatio(geom, placed) < SUPPORT_RATIO) continue;
      const score = placementScore(geom);
      if (!best || score < best.score) {
        best = { geom, orientation: o, score };
      }
    }
  }
  return best;
}

function extremePointsAfter(box: BoxGeom): Point3[] {
  return [
    { x: box.x + box.dx, y: box.y, z: box.z },
    { x: box.x, y: box.y + box.dy, z: box.z },
    { x: box.x, y: box.y, z: box.z + box.dz },
    { x: box.x + box.dx, y: box.y, z: box.z + box.dz },
    { x: box.x + box.dx, y: box.y + box.dy, z: box.z },
    { x: box.x, y: box.y + box.dy, z: box.z + box.dz },
  ];
}

function packExtremePoint(
  pieces: Piece[],
  container: ContainerSpec,
): { placed: InternalPlaced[]; unpacked: Piece[] } {
  const placed: InternalPlaced[] = [];
  const geoms: BoxGeom[] = [];
  let points: Point3[] = [{ x: 0, y: 0, z: 0 }];
  const unpacked: Piece[] = [];

  for (const piece of pieces) {
    let cand = findCandidate(piece, points, geoms, container, true);
    if (!cand) cand = findCandidate(piece, points, geoms, container, false);
    if (!cand) {
      unpacked.push(piece);
      continue;
    }
    const rec: InternalPlaced = { piece, ...cand.geom, orientation: cand.orientation };
    placed.push(rec);
    geoms.push(cand.geom);
    points = prunePoints([...points, ...extremePointsAfter(cand.geom)], geoms, container);
  }

  return { placed, unpacked };
}

function spaceFits(space: FreeSpace, o: Orientation): boolean {
  return o.dx <= space.dx + EPS && o.dy <= space.dy + EPS && o.dz <= space.dz + EPS;
}

function splitSpace(space: FreeSpace, box: BoxGeom): FreeSpace[] {
  if (!aabbOverlap(space, box)) return [space];
  const leftover: FreeSpace[] = [];
  if (box.x > space.x + EPS) {
    leftover.push({
      x: space.x,
      y: space.y,
      z: space.z,
      dx: box.x - space.x,
      dy: space.dy,
      dz: space.dz,
    });
  }
  if (box.x + box.dx < space.x + space.dx - EPS) {
    leftover.push({
      x: box.x + box.dx,
      y: space.y,
      z: space.z,
      dx: space.x + space.dx - (box.x + box.dx),
      dy: space.dy,
      dz: space.dz,
    });
  }
  if (box.y > space.y + EPS) {
    leftover.push({
      x: space.x,
      y: space.y,
      z: space.z,
      dx: space.dx,
      dy: box.y - space.y,
      dz: space.dz,
    });
  }
  if (box.y + box.dy < space.y + space.dy - EPS) {
    leftover.push({
      x: space.x,
      y: box.y + box.dy,
      z: space.z,
      dx: space.dx,
      dy: space.y + space.dy - (box.y + box.dy),
      dz: space.dz,
    });
  }
  if (box.z > space.z + EPS) {
    leftover.push({
      x: space.x,
      y: space.y,
      z: space.z,
      dx: space.dx,
      dy: space.dy,
      dz: box.z - space.z,
    });
  }
  if (box.z + box.dz < space.z + space.dz - EPS) {
    leftover.push({
      x: space.x,
      y: space.y,
      z: box.z + box.dz,
      dx: space.dx,
      dy: space.dy,
      dz: space.z + space.dz - (box.z + box.dz),
    });
  }
  return leftover.filter((s) => s.dx > 1 && s.dy > 1 && s.dz > 1);
}

function containsSpace(outer: FreeSpace, inner: FreeSpace): boolean {
  return (
    inner.x >= outer.x - EPS &&
    inner.y >= outer.y - EPS &&
    inner.z >= outer.z - EPS &&
    inner.x + inner.dx <= outer.x + outer.dx + EPS &&
    inner.y + inner.dy <= outer.y + outer.dy + EPS &&
    inner.z + inner.dz <= outer.z + outer.dz + EPS
  );
}

function pruneSpaces(spaces: FreeSpace[]): FreeSpace[] {
  const cleaned = spaces.filter((s) => s.dx > 1 && s.dy > 1 && s.dz > 1);
  return cleaned.filter((a, i) => {
    return !cleaned.some((b, j) => {
      if (i === j) return false;
      if (containsSpace(b, a)) {
        if (
          Math.abs(a.dx - b.dx) < EPS &&
          Math.abs(a.dy - b.dy) < EPS &&
          Math.abs(a.dz - b.dz) < EPS &&
          Math.abs(a.x - b.x) < EPS &&
          Math.abs(a.y - b.y) < EPS &&
          Math.abs(a.z - b.z) < EPS
        ) {
          return j < i;
        }
        return true;
      }
      return false;
    });
  });
}

function packMaximalSpace(
  pieces: Piece[],
  container: ContainerSpec,
): { placed: InternalPlaced[]; unpacked: Piece[] } {
  const placed: InternalPlaced[] = [];
  const geoms: BoxGeom[] = [];
  let spaces: FreeSpace[] = [
    {
      x: 0,
      y: 0,
      z: 0,
      dx: container.innerL,
      dy: container.innerH,
      dz: container.innerW,
    },
  ];
  const unpacked: Piece[] = [];

  for (const piece of pieces) {
    let best: Candidate | null = null;
    for (const o of orientations(piece.length, piece.width, piece.height)) {
      for (const space of spaces) {
        if (!spaceFits(space, o)) continue;
        const geom: BoxGeom = {
          x: space.x,
          y: space.y,
          z: space.z,
          dx: o.dx,
          dy: o.dy,
          dz: o.dz,
        };
        if (collides(geom, geoms)) continue;
        const supported = supportRatio(geom, geoms) >= SUPPORT_RATIO || geom.y <= EPS;
        const score = placementScore(geom) + (supported ? 0 : 1e16);
        if (!best || score < best.score) best = { geom, orientation: o, score };
      }
    }
    if (!best) {
      unpacked.push(piece);
      continue;
    }
    placed.push({ piece, ...best.geom, orientation: best.orientation });
    geoms.push(best.geom);
    const next: FreeSpace[] = [];
    for (const space of spaces) {
      next.push(...splitSpace(space, best.geom));
    }
    spaces = pruneSpaces(next).slice(0, 700);
  }

  return { placed, unpacked };
}

interface Piece {
  cargoId: string;
  name: string;
  length: number;
  width: number;
  height: number;
  weightKg: number | null;
  pieceIndex: number;
}

interface InternalPlaced extends BoxGeom {
  piece: Piece;
  orientation: Orientation;
}

function expandPieces(rows: CargoRow[]): Piece[] {
  const pieces: Piece[] = [];
  for (const row of rows) {
    if (!row.name.trim() && !row.length && !row.width && !row.height) continue;
    for (let i = 0; i < row.quantity; i += 1) {
      pieces.push({
        cargoId: row.id,
        name: row.name.trim(),
        length: row.length,
        width: row.width,
        height: row.height,
        weightKg: row.weightKg,
        pieceIndex: i + 1,
      });
    }
  }
  pieces.sort((a, b) => {
    const va = a.length * a.width * a.height;
    const vb = b.length * b.width * b.height;
    if (vb !== va) return vb - va;
    return Math.max(b.length, b.width, b.height) - Math.max(a.length, a.width, a.height);
  });
  return pieces;
}

function assignSequence(placed: InternalPlaced[]): InternalPlaced[] {
  return [...placed].sort((a, b) => a.x - b.x || a.y - b.y || a.z - b.z);
}

function pinLoadToInside(placed: InternalPlaced[]): InternalPlaced[] {
  if (placed.length === 0) return placed;
  const minX = Math.min(...placed.map((item) => item.x));
  if (Math.abs(minX) <= EPS) return placed;
  return placed.map((item) => ({ ...item, x: item.x - minX }));
}

function buildLayers(placed: PlacedBox[]): LayerNote[] {
  if (placed.length === 0) return [];
  const sorted = [...placed].sort((a, b) => a.y - b.y);
  const layers: LayerNote[] = [];
  for (const box of sorted) {
    const last = layers[layers.length - 1];
    if (last && Math.abs(box.y - last.yMin) <= 25) {
      last.boxCount += 1;
      last.yMax = Math.max(last.yMax, box.y + box.dy);
      if (!last.names.includes(box.name)) last.names.push(box.name);
    } else {
      layers.push({
        layer: layers.length + 1,
        yMin: box.y,
        yMax: box.y + box.dy,
        boxCount: 1,
        names: [box.name],
        note: "",
      });
    }
  }
  for (const layer of layers) {
    const from = Math.round(layer.yMin);
    const to = Math.round(layer.yMax);
    layer.note = `바닥에서 ${from.toLocaleString("ko-KR")}–${to.toLocaleString("ko-KR")} mm. ${layer.names.join(", ")} ${layer.boxCount}개. 아래층부터 밀착하고 틈새는 완충재로 고정하세요.`;
  }
  return layers;
}

function toPlan(
  container: ContainerSpec,
  cargo: CargoRow[],
  result: { placed: InternalPlaced[]; unpacked: Piece[] },
  solver: PackingPlan["solver"],
): PackingPlan {
  const shifted = pinLoadToInside(result.placed);
  const ordered = assignSequence(shifted);
  const placed: PlacedBox[] = ordered.map((item, index) => ({
    id: `${item.piece.cargoId}-${item.piece.pieceIndex}-${index}`,
    cargoId: item.piece.cargoId,
    name: item.piece.name,
    x: item.x,
    y: item.y,
    z: item.z,
    dx: item.dx,
    dy: item.dy,
    dz: item.dz,
    rotation: item.orientation.rotation,
    rotationLabel: item.orientation.label,
    sequence: index + 1,
    color: colorForKey(item.piece.cargoId),
    weightKg: item.piece.weightKg,
    pieceIndex: item.piece.pieceIndex,
  }));

  const unpackedMap = new Map<string, UnpackedItem>();
  for (const piece of result.unpacked) {
    const prev = unpackedMap.get(piece.cargoId);
    if (prev) prev.count += 1;
    else {
      unpackedMap.set(piece.cargoId, {
        cargoId: piece.cargoId,
        name: piece.name,
        reason: "남은 공간에 충돌 없이 넣을 수 없습니다.",
        count: 1,
      });
    }
  }

  const packedVolumeMm3 = placed.reduce((s, b) => s + b.dx * b.dy * b.dz, 0);
  const volume = estimateVolumeCapacity(cargo, container);
  const packedWeightKg = placed.reduce((s, b) => s + (b.weightKg ?? 0), 0);
  const totalWeightKg = cargo.reduce(
    (s, r) => s + (r.weightKg ?? 0) * Math.max(0, r.quantity),
    0,
  );
  const totalPieces = cargo.reduce((s, r) => s + Math.max(0, r.quantity), 0);

  if (volume.volumeExceeded) {
    for (const item of unpackedMap.values()) {
      item.reason = "부피가 컨테이너 용적을 넘습니다.";
    }
  }

  return {
    container,
    placed,
    unpacked: [...unpackedMap.values()],
    cargo,
    packedVolumeMm3,
    containerVolumeMm3: volume.containerMm3,
    utilization: volume.containerMm3 > 0 ? packedVolumeMm3 / volume.containerMm3 : 0,
    cargoUtilization: volume.cargoMm3 > 0 ? packedVolumeMm3 / volume.cargoMm3 : 0,
    totalPieces,
    packedPieces: placed.length,
    totalWeightKg,
    packedWeightKg,
    payloadExceeded: packedWeightKg > container.maxPayloadKg,
    cargoVolumeMm3: volume.cargoMm3,
    volumeExceeded: volume.volumeExceeded,
    volumeFitCount: volume.volumeFitCount,
    volumeOverflowCount: volume.volumeOverflowCount,
    volumeNote: volume.note,
    layers: buildLayers(placed),
    solver,
    keepUpright: true,
    stackLayers: buildLayers(placed).length,
    stackHeightMm: placed[0]?.dy ?? 0,
    createdAt: new Date().toISOString(),
  };
}

function scorePlan(plan: PackingPlan): number {
  return plan.packedVolumeMm3 + plan.packedPieces * 1e6;
}

function sameOuterSize(pieces: Piece[]): boolean {
  if (pieces.length === 0) return false;
  const a = pieces[0];
  return pieces.every(
    (p) => p.length === a.length && p.width === a.width && p.height === a.height,
  );
}

function makeOrient(dx: number, dy: number, dz: number, label: string): Orientation {
  return { dx, dy, dz, rotation: { x: 0, y: 0, z: 0 }, label };
}

function fillBlock(
  pieces: Piece[],
  start: number,
  origin: { x: number; y: number; z: number },
  o: Orientation,
  nx: number,
  ny: number,
  nz: number,
): { placed: InternalPlaced[]; next: number } {
  const placed: InternalPlaced[] = [];
  let index = start;
  for (let iy = 0; iy < ny && index < pieces.length; iy += 1) {
    for (let iz = 0; iz < nz && index < pieces.length; iz += 1) {
      for (let ix = 0; ix < nx && index < pieces.length; ix += 1) {
        placed.push({
          piece: pieces[index],
          x: origin.x + ix * o.dx,
          y: origin.y + iy * o.dy,
          z: origin.z + iz * o.dz,
          dx: o.dx,
          dy: o.dy,
          dz: o.dz,
          orientation: o,
        });
        index += 1;
      }
    }
  }
  return { placed, next: index };
}

function fillRegion(
  pieces: Piece[],
  start: number,
  origin: { x: number; y: number; z: number },
  size: { dx: number; dy: number; dz: number },
  orients: Orientation[],
): { placed: InternalPlaced[]; next: number } {
  let best: { placed: InternalPlaced[]; next: number } = { placed: [], next: start };
  for (const o of orients) {
    const nx = Math.floor((size.dx + EPS) / o.dx);
    const ny = Math.floor((size.dy + EPS) / o.dy);
    const nz = Math.floor((size.dz + EPS) / o.dz);
    if (nx < 1 || ny < 1 || nz < 1) continue;
    const filled = fillBlock(pieces, start, origin, o, nx, ny, nz);
    if (filled.placed.length > best.placed.length) best = filled;
  }
  return best;
}

function packUniform(
  pieces: Piece[],
  container: ContainerSpec,
  o: Orientation,
): { placed: InternalPlaced[]; unpacked: Piece[] } {
  const nx = Math.floor((container.innerL + EPS) / o.dx);
  const ny = Math.floor((container.innerH + EPS) / o.dy);
  const nz = Math.floor((container.innerW + EPS) / o.dz);
  const main = fillBlock(pieces, 0, { x: 0, y: 0, z: 0 }, o, nx, ny, nz);
  const leftoverOrients = orientations(
    pieces[0].length,
    pieces[0].width,
    pieces[0].height,
    false,
  );
  let index = main.next;
  const placed = [...main.placed];

  const usedW = nz * o.dz;
  const usedL = nx * o.dx;
  const side = fillRegion(
    pieces,
    index,
    { x: 0, y: 0, z: usedW },
    { dx: container.innerL, dy: container.innerH, dz: container.innerW - usedW },
    leftoverOrients,
  );
  placed.push(...side.placed);
  index = side.next;

  const end = fillRegion(
    pieces,
    index,
    { x: usedL, y: 0, z: 0 },
    { dx: container.innerL - usedL, dy: container.innerH, dz: usedW },
    leftoverOrients,
  );
  placed.push(...end.placed);
  return { placed, unpacked: pieces.slice(end.next) };
}

/** 좌우 295×5 + 395×2. 안쪽 벽(x=0) 한 단을 가로로 먼저 채운 뒤 문 쪽으로 진행. */
function packFivePlusTwo(
  pieces: Piece[],
  container: ContainerSpec,
): { placed: InternalPlaced[]; unpacked: Piece[] } | null {
  const sample = pieces[0];
  const dims = [...new Set([sample.length, sample.width, sample.height])].sort(
    (a, b) => b - a,
  );
  if (dims.length < 2) return null;
  const wide = dims.find((d) => Math.abs(d - 395) < 0.5) ?? dims[0];
  const mid = dims.find((d) => Math.abs(d - 295) < 0.5) ?? dims[1];
  const slim =
    dims.find((d) => Math.abs(d - 185) < 0.5) ??
    dims.find((d) => d !== wide && d !== mid) ??
    dims[dims.length - 1];

  const midCols = 5;
  const wideCols = 2;
  const usedW = midCols * mid + wideCols * wide;
  if (usedW > container.innerW + EPS) return null;

  const height = slim;
  const ny = Math.floor((container.innerH + EPS) / height);
  if (ny < 1) return null;

  const mainO = makeOrient(wide, height, mid, "정방향 · 295면");
  const rotO = makeOrient(mid, height, wide, "좌우 회전 · 395면");
  const nxMain = Math.floor((container.innerL + EPS) / mainO.dx);
  const nxRot = Math.floor((container.innerL + EPS) / rotO.dx);

  const placed: InternalPlaced[] = [];
  let index = 0;

  const pushBox = (o: Orientation, x: number, y: number, z: number) => {
    if (index >= pieces.length) return;
    placed.push({
      piece: pieces[index],
      x,
      y,
      z,
      dx: o.dx,
      dy: o.dy,
      dz: o.dz,
      orientation: o,
    });
    index += 1;
  };

  for (let iy = 0; iy < ny && index < pieces.length; iy += 1) {
    const originY = iy * height;
    let mainIx = 0;
    let rotIx = 0;
    while (index < pieces.length && (mainIx < nxMain || rotIx < nxRot)) {
      const mainX = mainIx * mainO.dx;
      const rotX = rotIx * rotO.dx;
      const takeMain =
        mainIx < nxMain && (rotIx >= nxRot || mainX <= rotX + EPS);
      if (takeMain) {
        for (let iz = 0; iz < midCols && index < pieces.length; iz += 1) {
          pushBox(mainO, mainX, originY, iz * mid);
        }
        mainIx += 1;
      } else {
        for (let iz = 0; iz < wideCols && index < pieces.length; iz += 1) {
          pushBox(rotO, rotX, originY, midCols * mid + iz * wide);
        }
        rotIx += 1;
      }
    }
  }
  return { placed, unpacked: pieces.slice(index) };
}

function packSameSizeGrid(
  pieces: Piece[],
  container: ContainerSpec,
): { placed: InternalPlaced[]; unpacked: Piece[] } {
  const sample = pieces[0];
  let best: { placed: InternalPlaced[]; unpacked: Piece[] } = {
    placed: [],
    unpacked: [...pieces],
  };

  const mixed = packFivePlusTwo(pieces, container);
  if (mixed && mixed.placed.length > 0) return mixed;

  for (const o of orientations(sample.length, sample.width, sample.height, false)) {
    const candidate = packUniform(pieces, container, o);
    if (candidate.placed.length > best.placed.length) best = candidate;
  }

  return best;
}

export function packCargo(rows: CargoRow[], container: ContainerSpec): PackingPlan {
  const cargo = rows.filter((r) => r.name.trim() || r.length || r.width || r.height);
  const pieces = expandPieces(cargo);

  if (sameOuterSize(pieces)) {
    const gridPlan = toPlan(container, cargo, packSameSizeGrid(pieces, container), "grid");
    if (pieces.length > LARGE_PACK_THRESHOLD) return gridPlan;
    const epPlan = toPlan(container, cargo, packExtremePoint(pieces, container), "extreme-point");
    return scorePlan(epPlan) > scorePlan(gridPlan) ? epPlan : gridPlan;
  }

  const epPlan = toPlan(container, cargo, packExtremePoint(pieces, container), "extreme-point");
  if (pieces.length > LARGE_PACK_THRESHOLD) return epPlan;
  const msPlan = toPlan(container, cargo, packMaximalSpace(pieces, container), "maximal-space");
  return scorePlan(msPlan) > scorePlan(epPlan) ? msPlan : epPlan;
}

export function boxesOverlap(a: PlacedBox, b: PlacedBox): boolean {
  return aabbOverlap(a, b);
}

export function boxInContainer(box: PlacedBox, container: ContainerSpec): boolean {
  return inBounds(box, container);
}
