import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getContainer } from "../lib/containers";
import { exampleCargo } from "../lib/examples";
import {
  boxInContainer,
  boxesOverlap,
  packCargo,
  validateCargo,
} from "../lib/packing";
import { buildSpecPdf, specFilename } from "../lib/pdf";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

const container = getContainer("20ft-dry");
const cargo = exampleCargo();
const issues = validateCargo(cargo, container);
assert(issues.length === 0, `example cargo should validate: ${issues.map((i) => i.message).join(", ")}`);

const plan = packCargo(cargo, container);
assert(plan.placed.length > 0, "solver placed no boxes");
assert(
  plan.packedPieces === plan.totalPieces,
  `expected all cargo packed, got ${plan.packedPieces}/${plan.totalPieces}`,
);

for (const box of plan.placed) {
  assert(boxInContainer(box, container), `box ${box.sequence} ${box.name} is outside`);
}

for (let i = 0; i < plan.placed.length; i += 1) {
  for (let j = i + 1; j < plan.placed.length; j += 1) {
    assert(
      !boxesOverlap(plan.placed[i], plan.placed[j]),
      `overlap between ${plan.placed[i].sequence} and ${plan.placed[j].sequence}`,
    );
  }
}

assert(plan.utilization > 0.05, `utilization too low: ${plan.utilization}`);
assert(plan.layers.length > 0, "missing layer notes");

const cubes = [
  {
    id: "cube",
    name: "테스트 큐브",
    length: 400,
    width: 400,
    height: 400,
    quantity: 40,
    weightKg: 5,
  },
];
const cubePlan = packCargo(cubes, container);
assert(cubePlan.packedPieces === 40, `cubes packed ${cubePlan.packedPieces}/40`);
for (let i = 0; i < cubePlan.placed.length; i += 1) {
  assert(boxInContainer(cubePlan.placed[i], container), `cube ${i} out of bounds`);
  for (let j = i + 1; j < cubePlan.placed.length; j += 1) {
    assert(!boxesOverlap(cubePlan.placed[i], cubePlan.placed[j]), `cube overlap ${i}/${j}`);
  }
}

async function writePdf() {
  const font = readFileSync(join(process.cwd(), "public/fonts/NanumGothic-Regular.ttf"));
  const pdf = await buildSpecPdf(plan, font, null);
  assert(pdf.byteLength > 2000, `PDF too small: ${pdf.byteLength}`);
  assert(pdf[0] === 0x25 && pdf[1] === 0x50 && pdf[2] === 0x44 && pdf[3] === 0x46, "not a PDF");

  const name = specFilename(plan);
  assert(name.startsWith("적재시방서-20ft-dry-"), name);
  assert(name.endsWith(".pdf"), name);

  const out = join("/tmp", name);
  writeFileSync(out, pdf);

  console.log("packing ok");
  console.log(
    `  solver=${plan.solver} packed=${plan.packedPieces} util=${(plan.utilization * 100).toFixed(1)}%`,
  );
  console.log(`  cubes=${cubePlan.packedPieces} util=${(cubePlan.utilization * 100).toFixed(1)}%`);
  console.log(`  pdf=${out} bytes=${pdf.byteLength} name=${name}`);
}

writePdf().catch((error) => {
  console.error(error);
  process.exit(1);
});
