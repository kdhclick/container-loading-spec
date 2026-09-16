const PALETTE = [
  "#FFE7A3",
  "#CDE8FF",
  "#D8F5C8",
  "#FFE0C2",
  "#E4D7FF",
  "#C8F4F0",
  "#FFD6E0",
  "#E8F2B8",
  "#D6E4FF",
  "#FFF1B8",
];

export function colorForKey(key: string): string {
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return PALETTE[hash % PALETTE.length];
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const n = hex.replace("#", "");
  return {
    r: parseInt(n.slice(0, 2), 16),
    g: parseInt(n.slice(2, 4), 16),
    b: parseInt(n.slice(4, 6), 16),
  };
}
