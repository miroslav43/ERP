import ExcelJS from "exceljs";
import type { NextRequest } from "next/server";

import {
  construiesteFoaie,
  normalizeazaAn,
  normalizeazaAngajati,
  normalizeazaLuna,
  normalizeazaOre,
} from "@/app/(marketing)/unelte/foaie-de-pontaj/foaie";

/**
 * Exportul în format de calcul al foii de pontaj gratuite.
 *
 * ── DE CE E RUTĂ DE API, NU SERVER ACTION ─────────────────────────────────
 * Rezultatul e un FIȘIER, iar o Server Action întoarce date, nu un răspuns cu
 * antete proprii. Aici sunt necesare și `content-type`, și
 * `content-disposition` — altfel browserul deschide un binar în filă în loc
 * să-l salveze.
 *
 * Ca rută de API, exportul e și un simplu `<a href>`: merge fără JavaScript și
 * se poate pune la favorite, exact ca pagina care îl generează.
 *
 * ── DE CE NU CERE SESIUNE ─────────────────────────────────────────────────
 * E o unealtă publică. `src/proxy.ts` lasă `/api/` să treacă neatins, cu nota
 * că rutele „își verifică singure sesiunea" — asta o verifică pe a ei și decide
 * că n-are nevoie de una: nu citește și nu scrie nimic din baza de date.
 * Singurele intrări sunt patru parametri din adresă, toți normalizați în
 * `foaie.ts`, cu limite de an, de lună și de număr de nume.
 *
 * Nu există limitare de rată fiindcă nu există nimic de epuizat în afară de CPU,
 * iar generarea e mărginită prin construcție: cel mult 60 de rânduri și 31 de
 * coloane, fără nicio interogare.
 */

export const dynamic = "force-dynamic";

/** Lățimile în „caractere" ale ExcelJS, alese ca foaia să încapă pe A4 lat. */
const LATIME_NUME = 24;
const LATIME_ZI = 3.4;
const LATIME_TOTAL = 9;

export async function GET(cerere: NextRequest): Promise<Response> {
  const q = cerere.nextUrl.searchParams;
  const acum = new Date();
  const an = normalizeazaAn(q.get("an") ?? undefined, acum.getUTCFullYear());
  const luna = normalizeazaLuna(q.get("luna") ?? undefined, acum.getUTCMonth() + 1);
  const oreZi = normalizeazaOre(q.get("ore") ?? undefined);
  const angajati = normalizeazaAngajati(q.get("angajati") ?? undefined);
  const foaie = construiesteFoaie(an, luna, angajati, oreZi);

  const registru = new ExcelJS.Workbook();
  registru.creator = "Administrativo";
  const fila = registru.addWorksheet(foaie.eticheta, {
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });

  fila.columns = [
    { width: LATIME_NUME },
    ...foaie.zile.map(() => ({ width: LATIME_ZI })),
    { width: LATIME_TOTAL },
  ];

  const titlu = fila.addRow([`Foaie colectivă de prezență — ${foaie.eticheta}`]);
  titlu.font = { bold: true, size: 13 };
  fila.addRow([
    `${foaie.zileLucratoare} zile lucrătoare × ${foaie.oreZi} h = ${foaie.normaLunara} h normă`,
  ]);
  fila.addRow([]);

  const capZile = fila.addRow(["Angajat", ...foaie.zile.map((z) => z.zi), "Total"]);
  const capLitere = fila.addRow(["", ...foaie.zile.map((z) => z.litera), ""]);
  for (const rand of [capZile, capLitere]) {
    rand.font = { bold: true, size: 9 };
    rand.alignment = { horizontal: "center", vertical: "middle" };
  }
  capZile.getCell(1).alignment = { horizontal: "left" };

  /** Gri pentru weekend, nisipiu pentru sărbătoare — aceleași tonuri ca pe ecran. */
  const umple = (rand: ExcelJS.Row) => {
    foaie.zile.forEach((z, i) => {
      const celula = rand.getCell(i + 2);
      if (z.sarbatoare !== null) {
        celula.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF0E6D2" } };
      } else if (z.weekend) {
        celula.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE6E9E6" } };
      }
      celula.border = {
        top: { style: "hair" },
        left: { style: "hair" },
        bottom: { style: "hair" },
        right: { style: "hair" },
      };
    });
  };
  umple(capZile);
  umple(capLitere);

  const primulRand = fila.rowCount + 1;
  for (const nume of foaie.angajati) {
    const rand = fila.addRow([nume, ...foaie.zile.map(() => null), null]);
    rand.height = 18;
    umple(rand);
    // Totalul e o FORMULĂ, nu o cifră: cine completează pe calculator vede suma
    // crescând. Un total scris ca text ar fi trebuit recalculat de mână, adică
    // exact obiceiul pe care unealta ar trebui să-l scoată din uz.
    const coloanaFinala = foaie.zile.length + 2;
    const prima = fila.getRow(rand.number).getCell(2).address;
    const ultima = fila.getRow(rand.number).getCell(coloanaFinala - 1).address;
    rand.getCell(coloanaFinala).value = { formula: `SUM(${prima}:${ultima})`, date1904: false };
    rand.getCell(coloanaFinala).font = { bold: true };
  }

  const randTotal = fila.addRow(["TOTAL", ...foaie.zile.map(() => null), null]);
  randTotal.font = { bold: true };
  foaie.zile.forEach((_, i) => {
    const coloana = i + 2;
    const sus = fila.getRow(primulRand).getCell(coloana).address;
    const jos = fila.getRow(randTotal.number - 1).getCell(coloana).address;
    randTotal.getCell(coloana).value = { formula: `SUM(${sus}:${jos})`, date1904: false };
  });

  /*
   * Celula din colț — totalul general — nu e o podoabă.
   *
   * E locul în care suma pe rânduri întâlnește suma pe coloane, adică exact
   * afirmația pe care se sprijină toată pagina de start: „adunate pe cele opt
   * rânduri sau pe cele treizeci de coloane, aceeași cifră". Lăsată goală, foaia
   * generată contrazicea în tăcere argumentul pentru care există.
   *
   * Se însumează COLOANELE rândului de total, nu totalurile pe angajat: ambele
   * dau același număr, dar așa greșeala se vede — dacă cele două nu se închid,
   * cifra din colț nu se potrivește cu suma coloanei de total, iar cel care
   * completează observă imediat.
   */
  const coloanaTotal = foaie.zile.length + 2;
  const primaZi = randTotal.getCell(2).address;
  const ultimaZi = randTotal.getCell(coloanaTotal - 1).address;
  randTotal.getCell(coloanaTotal).value = {
    formula: `SUM(${primaZi}:${ultimaZi})`,
    date1904: false,
  };
  umple(randTotal);

  // Antetul rămâne vizibil la derulare, ca la orice foaie lungă.
  fila.views = [{ state: "frozen", xSplit: 1, ySplit: 5 }];

  const legenda = fila.addRow([]);
  fila.addRow([
    "Sărbători legale în lună: " +
      (foaie.zile
        .filter((z) => z.sarbatoare !== null)
        .map((z) => `${z.zi} ${z.sarbatoare ?? ""}`)
        .join("; ") || "niciuna"),
  ]);
  fila.addRow(["Generat cu administrativo.ro/unelte/foaie-de-pontaj"]);
  legenda.height = 8;

  const continut = await registru.xlsx.writeBuffer();
  const nume = `pontaj-${foaie.an}-${String(foaie.luna).padStart(2, "0")}.xlsx`;

  return new Response(continut as ArrayBuffer, {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="${nume}"`,
      "cache-control": "public, max-age=3600",
    },
  });
}
