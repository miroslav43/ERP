import ExcelJS from "exceljs";

import { ADRESA_SITE } from "@/content/landing/contact";

import { adresaDinFisier, SEMNATURA_FISIER, type DocumentTabelar } from "./document-tabelar";

/** `DocumentTabelar` → .xlsx, pe o singură filă, cu antetul tabelului înghețat. */
export async function randeazaXlsx(d: DocumentTabelar): Promise<Uint8Array> {
  const registru = new ExcelJS.Workbook();
  registru.creator = "Administrativo";
  registru.title = d.titlu;
  const fila = registru.addWorksheet("Document", {
    pageSetup: {
      orientation: d.orientare === "peisaj" ? "landscape" : "portrait",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
    },
  });
  fila.columns = d.coloane.map((c) => ({ width: Math.max(6, c.latime * 6) }));

  fila.addRow([d.titlu]).font = { bold: true, size: 13 };
  if (d.subtitlu !== null) fila.addRow([d.subtitlu]);
  for (const c of d.campuri) fila.addRow([`${c.eticheta}:`, c.valoare]);
  for (const p of d.paragrafe) fila.addRow([p]);
  fila.addRow([]);

  /** Antet aldin, cu rând nou la `\n`, apoi rândurile cu chenar subțire. */
  const tabel = (
    etichete: readonly string[],
    randuri: readonly (readonly string[])[],
    umbrite: readonly number[],
  ) => {
    const antet = fila.addRow([...etichete]);
    antet.font = { bold: true };
    // Etichetele cu `\n` (ziua deasupra literei) se afișează pe două rânduri.
    antet.alignment = { wrapText: true, vertical: "top" };
    for (const r of randuri) {
      const rand = fila.addRow([...r]);
      etichete.forEach((_, i) => {
        const celula = rand.getCell(i + 1);
        celula.border = {
          top: { style: "hair" },
          left: { style: "hair" },
          bottom: { style: "hair" },
          right: { style: "hair" },
        };
        if (umbrite.includes(i)) {
          celula.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE6E9E6" } };
        }
      });
    }
    return antet;
  };

  if (d.coloane.length > 0) {
    const antet = tabel(
      d.coloane.map((c) => c.eticheta),
      d.randuri,
      d.umbrite,
    );
    fila.views = [{ state: "frozen", ySplit: antet.number }];
  }
  for (const t of d.tabeleSuplimentare ?? []) {
    if (t.coloane.length === 0) continue;
    fila.addRow([]);
    fila.addRow([t.titlu]).font = { bold: true };
    tabel(
      t.coloane.map((c) => c.eticheta),
      t.randuri,
      [],
    );
  }
  fila.addRow([]);
  for (const n of d.note) fila.addRow([n]);
  if (d.semnaturi.length > 0) fila.addRow(d.semnaturi.map((s) => `${s}: ______________`));
  const semnatura = fila.addRow([
    { text: SEMNATURA_FISIER, hyperlink: adresaDinFisier(d, "xlsx", ADRESA_SITE) },
  ]);
  semnatura.getCell(1).font = { color: { argb: "FF6B7280" }, underline: true };

  return new Uint8Array(await registru.xlsx.writeBuffer());
}
