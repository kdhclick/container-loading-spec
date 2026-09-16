import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { specFilename } from "@/lib/pdf-name";
import type { PackingPlan } from "@/lib/types";

export { specFilename };

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 42;
const TEXT = rgb(0.12, 0.12, 0.14);
const MUTED = rgb(0.38, 0.38, 0.42);
const LINE = rgb(0.82, 0.82, 0.84);
const ACCENT = rgb(0.72, 0.33, 0.1);
const HEADER_BG = rgb(0.18, 0.16, 0.14);

function fmt(n: number, digits = 0): string {
  return n.toLocaleString("ko-KR", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}

function wrapText(font: PDFFont, text: string, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  const paragraphs = text.split(/\n+/);
  for (const para of paragraphs) {
    let current = "";
    for (const ch of para) {
      const trial = current + ch;
      if (font.widthOfTextAtSize(trial, size) > maxWidth && current) {
        lines.push(current);
        current = ch;
      } else {
        current = trial;
      }
    }
    lines.push(current || " ");
  }
  return lines;
}

class PdfWriter {
  doc: PDFDocument;
  font: PDFFont;
  page: PDFPage;
  y: number;
  pageNo = 1;

  constructor(doc: PDFDocument, font: PDFFont) {
    this.doc = doc;
    this.font = font;
    this.page = doc.addPage([PAGE_W, PAGE_H]);
    this.y = PAGE_H - MARGIN;
  }

  ensure(space: number) {
    if (this.y - space < MARGIN + 28) {
      this.footer();
      this.page = this.doc.addPage([PAGE_W, PAGE_H]);
      this.pageNo += 1;
      this.y = PAGE_H - MARGIN;
    }
  }

  footer() {
    this.page.drawLine({
      start: { x: MARGIN, y: 28 },
      end: { x: PAGE_W - MARGIN, y: 28 },
      thickness: 0.5,
      color: LINE,
    });
    this.page.drawText("컨테이너 적재 시방서", {
      x: MARGIN,
      y: 16,
      size: 8,
      font: this.font,
      color: MUTED,
    });
    const label = `${this.pageNo}`;
    this.page.drawText(label, {
      x: PAGE_W - MARGIN - this.font.widthOfTextAtSize(label, 8),
      y: 16,
      size: 8,
      font: this.font,
      color: MUTED,
    });
  }

  title(text: string) {
    this.page.drawRectangle({
      x: 0,
      y: PAGE_H - 72,
      width: PAGE_W,
      height: 72,
      color: HEADER_BG,
    });
    this.page.drawRectangle({
      x: 0,
      y: PAGE_H - 76,
      width: PAGE_W,
      height: 4,
      color: ACCENT,
    });
    this.page.drawText(text, {
      x: MARGIN,
      y: PAGE_H - 40,
      size: 20,
      font: this.font,
      color: rgb(1, 1, 1),
    });
    this.y = PAGE_H - 96;
  }

  heading(text: string) {
    this.ensure(28);
    this.page.drawText(text, {
      x: MARGIN,
      y: this.y,
      size: 12,
      font: this.font,
      color: ACCENT,
    });
    this.y -= 8;
    this.page.drawLine({
      start: { x: MARGIN, y: this.y },
      end: { x: PAGE_W - MARGIN, y: this.y },
      thickness: 0.8,
      color: ACCENT,
    });
    this.y -= 16;
  }

  line(text: string, size = 10, color = TEXT) {
    const lines = wrapText(this.font, text, size, PAGE_W - MARGIN * 2);
    for (const l of lines) {
      this.ensure(14);
      this.page.drawText(l, {
        x: MARGIN,
        y: this.y,
        size,
        font: this.font,
        color,
      });
      this.y -= 14;
    }
  }

  kv(rows: Array<[string, string]>) {
    for (const [k, v] of rows) {
      this.ensure(14);
      this.page.drawText(k, {
        x: MARGIN,
        y: this.y,
        size: 10,
        font: this.font,
        color: MUTED,
      });
      this.page.drawText(v, {
        x: MARGIN + 150,
        y: this.y,
        size: 10,
        font: this.font,
        color: TEXT,
      });
      this.y -= 14;
    }
  }

  table(headers: string[], rows: string[][], widths: number[]) {
    const rowH = 16;
    const drawHeader = () => {
      this.ensure(rowH + 4);
      let x = MARGIN;
      this.page.drawRectangle({
        x: MARGIN,
        y: this.y - 4,
        width: PAGE_W - MARGIN * 2,
        height: rowH,
        color: rgb(0.95, 0.93, 0.9),
      });
      headers.forEach((h, i) => {
        this.page.drawText(h, {
          x: x + 3,
          y: this.y,
          size: 8,
          font: this.font,
          color: TEXT,
        });
        x += widths[i];
      });
      this.y -= rowH;
    };

    drawHeader();
    rows.forEach((row, idx) => {
      if (this.y < MARGIN + 48) {
        this.footer();
        this.page = this.doc.addPage([PAGE_W, PAGE_H]);
        this.pageNo += 1;
        this.y = PAGE_H - MARGIN;
        drawHeader();
      }
      if (idx % 2 === 1) {
        this.page.drawRectangle({
          x: MARGIN,
          y: this.y - 4,
          width: PAGE_W - MARGIN * 2,
          height: rowH,
          color: rgb(0.98, 0.98, 0.97),
        });
      }
      let x = MARGIN;
      row.forEach((cell, i) => {
        let text = cell;
        while (text.length > 1 && this.font.widthOfTextAtSize(text, 8) > widths[i] - 6) {
          text = text.slice(0, -1);
        }
        this.page.drawText(text, {
          x: x + 3,
          y: this.y,
          size: 8,
          font: this.font,
          color: TEXT,
        });
        x += widths[i];
      });
      this.y -= rowH;
    });
    this.y -= 10;
  }
}

export async function buildSpecPdf(
  plan: PackingPlan,
  fontBytes: ArrayBuffer | Uint8Array,
  commentary?: string | null,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const font = await doc.embedFont(fontBytes, { subset: false });
  const w = new PdfWriter(doc, font);
  const c = plan.container;

  w.title("컨테이너 적재 시방서");
  w.line(`작성일  ${fmtDate(plan.createdAt)}`, 10, MUTED);
  w.line(`파일명  ${specFilename(plan)}`, 9, MUTED);
  w.y -= 6;

  w.heading("1. 컨테이너 제원");
  w.kv([
    ["종류", `${c.nameKo} (${c.nameEn}, ISO ${c.isoCode})`],
    ["내부 치수 L×W×H", `${fmt(c.innerL)} × ${fmt(c.innerW)} × ${fmt(c.innerH)} mm`],
    ["내부 용적", `${c.volumeM3.toFixed(1)} m³ (계산값 ${(plan.containerVolumeMm3 / 1e9).toFixed(2)} m³)`],
    ["도어 개구", `${fmt(c.doorW)} × ${fmt(c.doorH)} mm`],
    ["최대 적재중량", `${fmt(c.maxPayloadKg)} kg (타어 ${fmt(c.tareKg)} kg)`],
  ]);
  w.y -= 4;

  w.heading("2. 적재 요약");
  w.kv([
    ["용적 활용률", `${(plan.utilization * 100).toFixed(1)}%`],
    ["화물 적재율", `${(plan.cargoUtilization * 100).toFixed(1)}% (${plan.packedPieces}/${plan.totalPieces}개)`],
    [
      "적재 중량",
      `${fmt(plan.packedWeightKg, 1)} kg` +
        (plan.payloadExceeded ? "  ※ 최대 적재중량 초과" : ""),
    ],
    [
      "솔버",
      plan.solver === "extreme-point"
        ? "익스트림 포인트 (Extreme Point)"
        : "최대잔여공간 (Maximal Space)",
    ],
  ]);
  w.y -= 4;

  w.heading("3. 화물 목록");
  w.table(
    ["품명", "L×W×H (mm)", "수량", "중량(kg)", "적재/미적재"],
    plan.cargo.map((row) => {
      const packed = plan.placed.filter((p) => p.cargoId === row.id).length;
      const missed = plan.unpacked.find((u) => u.cargoId === row.id)?.count ?? 0;
      const weight =
        row.weightKg == null ? "—" : `${fmt(row.weightKg, 1)} × ${row.quantity}`;
      return [
        row.name,
        `${fmt(row.length)}×${fmt(row.width)}×${fmt(row.height)}`,
        String(row.quantity),
        weight,
        missed ? `${packed} / 미적재 ${missed}` : `${packed}`,
      ];
    }),
    [120, 150, 50, 80, 111],
  );

  if (plan.unpacked.length > 0) {
    w.line(
      `미적재: ${plan.unpacked.map((u) => `${u.name} ${u.count}개`).join(", ")}. ${plan.unpacked[0]?.reason ?? ""}`,
      9,
      rgb(0.7, 0.15, 0.12),
    );
    w.y -= 4;
  }

  w.heading("4. 적재 순서 (선적 우선 · 하단부터)");
  w.line(
    "원점 (0,0,0)은 컨테이너 안쪽 좌측 하단(도어 반대편)입니다. X=길이, Y=높이, Z=너비. 순번 1이 가장 먼저 넣는 화물입니다.",
    8,
    MUTED,
  );
  w.y -= 4;
  w.table(
    ["순번", "품명", "위치 X,Y,Z (mm)", "치수 dx,dy,dz", "회전"],
    plan.placed.map((b) => [
      String(b.sequence),
      `${b.name} #${b.pieceIndex}`,
      `${fmt(b.x)}, ${fmt(b.y)}, ${fmt(b.z)}`,
      `${fmt(b.dx)}×${fmt(b.dy)}×${fmt(b.dz)}`,
      b.rotationLabel,
    ]),
    [36, 120, 140, 130, 85],
  );

  w.heading("5. 층별 메모");
  if (plan.layers.length === 0) {
    w.line("적재된 화물이 없습니다.");
  } else {
    for (const layer of plan.layers) {
      w.line(`제${layer.layer}층  ${layer.note}`, 9);
    }
  }
  w.y -= 6;

  w.heading("6. 적재 시 유의사항");
  w.line("· 중량화물은 하단·안쪽에 두고, 도어 쪽은 가벼운 화물로 마감하세요.");
  w.line("· 도어 개구는 내부 단면보다 작습니다. 마지막 열은 개구 폭·높이를 확인하세요.");
  w.line("· 공백은 에어백·완충재로 고정하고, 라싱 포인트를 사용해 수평 이동을 막으세요.");
  w.line("· 본 계획은 직육면체 화물 기준의 기하 적재안이며, 현장 검수 후 확정하세요.");

  if (commentary && commentary.trim()) {
    w.y -= 6;
    w.heading("7. 적재 계획 해설");
    w.line(commentary.trim(), 10);
  }

  w.footer();
  doc.setTitle(`컨테이너 적재 시방서 — ${c.nameKo}`);
  doc.setAuthor("컨테이너 적재 시방서");
  doc.setLanguage("ko");
  return doc.save();
}

