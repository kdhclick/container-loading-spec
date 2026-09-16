export type LengthUnit = "mm" | "cm";

export interface ContainerSpec {
  id: string;
  isoCode: string;
  nameKo: string;
  nameEn: string;
  innerL: number;
  innerW: number;
  innerH: number;
  volumeM3: number;
  doorW: number;
  doorH: number;
  maxPayloadKg: number;
  tareKg: number;
}

export interface CargoRow {
  id: string;
  name: string;
  length: number;
  width: number;
  height: number;
  quantity: number;
  weightKg: number | null;
}

export interface Orientation {
  dx: number;
  dy: number;
  dz: number;
  rotation: { x: number; y: number; z: number };
  label: string;
}

export interface PlacedBox {
  id: string;
  cargoId: string;
  name: string;
  x: number;
  y: number;
  z: number;
  dx: number;
  dy: number;
  dz: number;
  rotation: { x: number; y: number; z: number };
  rotationLabel: string;
  sequence: number;
  color: string;
  weightKg: number | null;
  pieceIndex: number;
}

export interface LayerNote {
  layer: number;
  yMin: number;
  yMax: number;
  boxCount: number;
  names: string[];
  note: string;
}

export interface UnpackedItem {
  cargoId: string;
  name: string;
  reason: string;
  count: number;
}

export interface PackingPlan {
  container: ContainerSpec;
  placed: PlacedBox[];
  unpacked: UnpackedItem[];
  cargo: CargoRow[];
  packedVolumeMm3: number;
  containerVolumeMm3: number;
  utilization: number;
  cargoUtilization: number;
  totalPieces: number;
  packedPieces: number;
  totalWeightKg: number;
  packedWeightKg: number;
  payloadExceeded: boolean;
  layers: LayerNote[];
  solver: "extreme-point" | "maximal-space";
  createdAt: string;
}

export interface ValidationIssue {
  rowId?: string;
  message: string;
}

export const MAX_PIECES = 240;
