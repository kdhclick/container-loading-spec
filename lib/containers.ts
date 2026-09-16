import type { ContainerSpec } from "@/lib/types";

/**
 * Typical ISO dry-van internals (manufacturer variation exists).
 * Values follow common carrier published figures (e.g. HZ / Hapag-Lloyd class).
 */
export const CONTAINERS: ContainerSpec[] = [
  {
    id: "20ft-dry",
    isoCode: "22G1",
    nameKo: "20ft 드라이",
    nameEn: "20ft Dry",
    innerL: 5898,
    innerW: 2350,
    innerH: 2390,
    volumeM3: 33.1,
    doorW: 2340,
    doorH: 2280,
    maxPayloadKg: 28200,
    tareKg: 2230,
  },
  {
    id: "40ft-dry",
    isoCode: "42G1",
    nameKo: "40ft 드라이",
    nameEn: "40ft Dry",
    innerL: 12032,
    innerW: 2352,
    innerH: 2393,
    volumeM3: 67.7,
    doorW: 2340,
    doorH: 2280,
    maxPayloadKg: 26700,
    tareKg: 3780,
  },
  {
    id: "40ft-hc",
    isoCode: "45G1",
    nameKo: "40ft 하이큐브",
    nameEn: "40ft HC",
    innerL: 12032,
    innerW: 2350,
    innerH: 2695,
    volumeM3: 76.2,
    doorW: 2340,
    doorH: 2585,
    maxPayloadKg: 26460,
    tareKg: 3900,
  },
  {
    id: "45ft-hc",
    isoCode: "L5G1",
    nameKo: "45ft 하이큐브",
    nameEn: "45ft HC",
    innerL: 13556,
    innerW: 2352,
    innerH: 2697,
    volumeM3: 86.0,
    doorW: 2340,
    doorH: 2585,
    maxPayloadKg: 25780,
    tareKg: 4700,
  },
];

export function getContainer(id: string): ContainerSpec {
  return CONTAINERS.find((c) => c.id === id) ?? CONTAINERS[0];
}

export function formatMm(mm: number): string {
  return `${Math.round(mm).toLocaleString("ko-KR")} mm`;
}

export function formatInnerDims(c: ContainerSpec): string {
  return `${formatMm(c.innerL)} × ${formatMm(c.innerW)} × ${formatMm(c.innerH)}`;
}

export function computedVolumeM3(c: ContainerSpec): number {
  return (c.innerL * c.innerW * c.innerH) / 1e9;
}
