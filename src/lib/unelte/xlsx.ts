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

  if (d.coloane.length > 0) {
    const antet = fila.addRow(d.coloane.map((c) => c.eticheta));
    antet.font = { bold: true };
    // Etichetele cu `\n` (ziua deasupra literei) se afișează pe două rânduri.
    antet.alignment = { wrapText: true, vertical: "top" };
    fila.views = [{ state: "frozen", ySplit: antet.number }];
    for (const r of d.randuri) {
      const rand = fila.addRow([...r]);
      d.coloane.forEach((_, i) => {
        const celula = rand.getCell(i + 1);
        celula.border = {
          top: { style: "hair" },
          left: { style: "hair" },
          bottom: { style: "hair" },
          right: { style: "hair" },
        };
        if (d.umbrite.includes(i)) {
          celula.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE6E9E6" } };
        }
      });
    }
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
