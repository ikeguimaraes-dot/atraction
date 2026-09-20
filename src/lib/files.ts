import Papa from "papaparse";
import { csvSafe } from "./domain";
export function downloadFile(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function exportCsv(name: string, rows: Record<string, unknown>[]) {
  downloadFile(
    name,
    new Blob(
      [
        "\uFEFF" +
          Papa.unparse(
            rows.map((r) =>
              Object.fromEntries(
                Object.entries(r).map(([k, v]) => [k, csvSafe(v)]),
              ),
            ),
            { delimiter: ";" },
          ),
      ],
      { type: "text/csv;charset=utf-8" },
    ),
  );
}
export async function spreadsheetText(file: File) {
  if (!file.name.toLowerCase().endsWith(".xlsx")) return file.text();
  // Reject oversized expansion using ZIP central-directory lengths before parsing.
  const bytes = await file.arrayBuffer();
  const v = new DataView(bytes);
  let expanded = 0,
    files = 0;
  for (let i = 0; i + 46 < v.byteLength; i++) {
    if (v.getUint32(i, true) === 0x02014b50) {
      expanded += v.getUint32(i + 24, true);
      files++;
      i +=
        45 +
        v.getUint16(i + 28, true) +
        v.getUint16(i + 30, true) +
        v.getUint16(i + 32, true);
    }
  }
  if (!files || expanded > 30 * 1024 * 1024 || files > 200)
    throw new Error(
      "Planilha grande ou inválida. Exporte apenas a aba de contatos.",
    );
  const { readSheet } = await import("read-excel-file/browser");
  const rows = await readSheet(file);
  if (rows.length > 10001)
    throw new Error("Importe até 10.000 pessoas por vez.");
  return Papa.unparse(
    rows.map((row) =>
      row.map((v) =>
        v instanceof Date ? v.toISOString().slice(0, 10) : String(v ?? ""),
      ),
    ),
  );
}
export async function makePdf(title: string, body: string) {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const clean = (s: string) =>
    Array.from(s)
      .map((c) => {
        try {
          font.encodeText(c);
          return c;
        } catch {
          return "?";
        }
      })
      .join("");
  let page = doc.addPage([595.28, 841.89]);
  let y = 785;
  let count = 1;
  function heading() {
    const headingText = clean(title).slice(0, 120);
    page.drawText(headingText, {
      x: 48,
      y,
      font: bold,
      size: Math.min(
        17,
        490 / Math.max(1, bold.widthOfTextAtSize(headingText, 1)),
      ),
      color: rgb(0.3, 0.2, 0.5),
    });
    y -= 35;
  }
  heading();
  for (const paragraph of body.split("\n")) {
    let line = "";
    for (const word of clean(paragraph).split(/\s+/)) {
      for (const part of word.match(/.{1,65}/g) || [""]) {
        const next = line ? line + " " + part : part;
        if (font.widthOfTextAtSize(next, 11) > 490 && line) {
          draw(line);
          line = part;
        } else line = next;
      }
    }
    draw(line);
    y -= 6;
  }
  function draw(line: string) {
    if (y < 65) {
      page = doc.addPage([595.28, 841.89]);
      y = 785;
      count++;
    }
    page.drawText(line, { x: 48, y, font, size: 11 });
    y -= 16;
  }
  for (const [i, p] of doc.getPages().entries())
    p.drawText(`Atraction | ${i + 1}/${count}`, {
      x: 48,
      y: 30,
      font,
      size: 9,
      color: rgb(0.5, 0.5, 0.5),
    });
  return new Blob([new Uint8Array(await doc.save()).buffer], {
    type: "application/pdf",
  });
}
