import { newId } from "@/lib/ids";
import type { CargoRow } from "@/lib/types";

export function emptyCargoRow(): CargoRow {
  return {
    id: newId(),
    name: "",
    length: 0,
    width: 0,
    height: 0,
    quantity: 1,
    weightKg: null,
  };
}

export function exampleCargo(): CargoRow[] {
  return [
    {
      id: newId(),
      name: "골판지 상자 A",
      length: 400,
      width: 300,
      height: 250,
      quantity: 36,
      weightKg: 3.2,
    },
    {
      id: newId(),
      name: "팔레트 박스",
      length: 1100,
      width: 1100,
      height: 900,
      quantity: 2,
      weightKg: 85,
    },
    {
      id: newId(),
      name: "부품 상자",
      length: 600,
      width: 400,
      height: 350,
      quantity: 16,
      weightKg: 12,
    },
  ];
}
