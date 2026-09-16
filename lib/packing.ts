import { colorForKey } from "@/lib/colors";
import type {
  CargoRow,
  ContainerSpec,
  LayerNote,
  Orientation,
  PackingPlan,
  PlacedBox,
  UnpackedItem,
  ValidationIssue,
} from "@/lib/types";
import { MAX_PIECES } from "@/lib/types";

const EPS = 0.05;
const SUPPORT_RATIO = 0.55;

export function orientations(l: number, w: number, h: number): Orientation[] {
  const candidates: Orientation[] = [
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

function canFitContainer(row: CargoRow, container: ContainerSpec): boolean {
  return orientations(row.length, row.width, row.height).some(
    (o) =>
      o.dx <= container.innerL + EPS &&
      o.dy <= container.innerH + EPS &&
      o.dz <= container.innerW + EPS,
  );
}

export function validateCargo(
  rows: CargoRow[],
  container: ContainerSpec,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const filled = rows.filter((r) => r.name.trim() || r.length || r.width || r.height);

  if (filled.length === 0) {
    issues.push({ message: "화물을 한 줄 이상 입력하세요." });
    return issues;
  }

  let totalPieces = 0;
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
    } else if (!canFitContainer(row, container)) {
      issues.push({
        rowId: row.id,
        message: `${n}행: 「${row.name || "이름 없음"}」은(는) 어떤 회전으로도 컨테이너에 들어가지 않습니다.`,
      });
    }
    if (!Number.isInteger(row.quantity) || row.quantity < 1) {
      issues.push({ rowId: row.id, message: `${n}행: 수량은 1 이상의 정수여야 합니다.` });
    } else {
      totalPieces += row.quantity;
    }
    if (row.weightKg != null && row.weightKg < 0) {
      issues.push({ rowId: row.id, message: `${n}행: 중량은 0 이상이어야 합니다.` });
    }
  });

  if (totalPieces > MAX_PIECES) {
    issues.push({
      message: `한 번에 ${MAX_PIECES}개까지만 계산합니다. 현재 ${totalPieces}개입니다.`,
    });
  }

  return issues;
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
): Candidate | null {
  let best: Candidate | null = null;
  for (const o of orientations(item.length, item.width, item.height)) {
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
  const ordered = assignSequence(result.placed);
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
  const containerVolumeMm3 = container.innerL * container.innerW * container.innerH;
  const cargoVolume = cargo.reduce(
    (s, r) => s + r.length * r.width * r.height * Math.max(0, r.quantity),
    0,
  );
  const packedWeightKg = placed.reduce((s, b) => s + (b.weightKg ?? 0), 0);
  const totalWeightKg = cargo.reduce(
    (s, r) => s + (r.weightKg ?? 0) * Math.max(0, r.quantity),
    0,
  );
  const totalPieces = cargo.reduce((s, r) => s + Math.max(0, r.quantity), 0);

  return {
    container,
    placed,
    unpacked: [...unpackedMap.values()],
    cargo,
    packedVolumeMm3,
    containerVolumeMm3,
    utilization: containerVolumeMm3 > 0 ? packedVolumeMm3 / containerVolumeMm3 : 0,
    cargoUtilization: cargoVolume > 0 ? packedVolumeMm3 / cargoVolume : 0,
    totalPieces,
    packedPieces: placed.length,
    totalWeightKg,
    packedWeightKg,
    payloadExceeded: packedWeightKg > container.maxPayloadKg,
    layers: buildLayers(placed),
    solver,
    createdAt: new Date().toISOString(),
  };
}

function scorePlan(plan: PackingPlan): number {
  return plan.packedVolumeMm3 + plan.packedPieces * 1e6;
}

export function packCargo(rows: CargoRow[], container: ContainerSpec): PackingPlan {
  const cargo = rows.filter((r) => r.name.trim() || r.length || r.width || r.height);
  const pieces = expandPieces(cargo);
  const ep = packExtremePoint(pieces, container);
  const ms = packMaximalSpace(pieces, container);
  const epPlan = toPlan(container, cargo, ep, "extreme-point");
  const msPlan = toPlan(container, cargo, ms, "maximal-space");
  return scorePlan(msPlan) > scorePlan(epPlan) ? msPlan : epPlan;
}

export function boxesOverlap(a: PlacedBox, b: PlacedBox): boolean {
  return aabbOverlap(a, b);
}

export function boxInContainer(box: PlacedBox, container: ContainerSpec): boolean {
  return inBounds(box, container);
}
