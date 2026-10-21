import ExcelJS from "exceljs";

import { ADRESA_SITE } from "@/content/landing/contact";

import {
  adresaDinFisier,
  curataDocument,
  curataText,
  SEMNATURA_FISIER,
  type Coloana,
  type DocumentTabelar,
} from "./document-tabelar";

/**
 * O celulă scrisă ca NUMĂR în Excel, cu formatul ei de afișare.
 *
 * ── DE CE AICI, ȘI NU ÎN `DocumentTabelar` ────────────────────────────────
 * Modelul comun are celule text, ca să arate la fel în PDF, Word și Excel; îl
 * citesc peste o sută de locuri (randări, previzualizări, unelte). Numărul are
 * sens doar în foaia de calcul: un export al aplicației (raportul flotei, F8)
 * vrea coloane care se adună. De aceea `DocumentXlsx` lărgește DOAR celulele
 * tabelelor, iar orice `DocumentTabelar` rămâne un `DocumentXlsx` valid: uneltele
 * publice trec neschimbate.
 *
 * `format` e un cod Excel (`#,##0.00`): separatorii din cod sunt ai Excelului,
 * iar Excelul în limba română îi afișează `1.002,50`. Text deja formatat
 * („1.002,50”) nu se mai poate aduna — exact defectul pe care îl repară.
 */
export type CelulaNumerica = Readonly<{ numar: number; format: string }>;

export type CelulaXlsx = string | CelulaNumerica;

/** Lei, cu două zecimale și separator de mii. */
export const FORMAT_LEI = "#,##0.00";
/** Kilometri, foi, zile: întreg, cu separator de mii. */
export const FORMAT_NUMAR_INTREG = "#,##0";
/** Procent cu semn: valoarea e FRACȚIA (0,286 → „+28,6%”), ca în Excel. */
export const FORMAT_PROCENT_CU_SEMN = "+0.0%;-0.0%;0.0%";

/** Formatul unei cantități cu unitatea ei afișată după număr („36,00 l”). */
export function formatCuUnitate(unitate: string): string {
  return `#,##0.00" ${unitate.replace(/"/gu, "")}"`;
}

/** O celulă numerică. Aruncă pe `NaN`/`Infinity`: Excelul le-ar arăta „#NUM!”. */
export function numar(valoare: number, format: string): CelulaNumerica {
  if (!Number.isFinite(valoare)) {
    throw new Error(
      `Valoarea unei celule numerice trebuie să fie un număr finit (${String(valoare)}).`,
    );
  }
  return { numar: valoare, format };
}

export type TabelXlsx = Readonly<{
  titlu: string;
  coloane: readonly Coloana[];
  randuri: readonly (readonly CelulaXlsx[])[];
}>;

/** `DocumentTabelar` cu celule de tabel care pot fi și numere. */
export type DocumentXlsx = Readonly<
  Omit<DocumentTabelar, "randuri" | "tabeleSuplimentare"> & {
    randuri: readonly (readonly CelulaXlsx[])[];
    tabeleSuplimentare?: readonly TabelXlsx[];
  }
>;

export type OptiuniXlsx = Readonly<{
  /**
   * Ultimul rând al fișierului.
   * - `unealta`: „Generat gratuit cu administrativo.ro”, cu legătură spre unealtă
   *   (uneltele publice de la `/unelte`).
   * - `aplicatie`: nimic. Un export din aplicația plătită nu face reclamă pe
   *   fișierul clientului (constatarea F8).
   * Obligatorie: un export nou alege, nu moștenește semnătura tăcut.
   */
  subsol: "unealta" | "aplicatie";
}>;

const curataCelule = (
  randuri: readonly (readonly CelulaXlsx[])[],
): readonly (readonly CelulaXlsx[])[] =>
  randuri.map((r) => r.map((c) => (typeof c === "string" ? curataText(c) : c)));

/**
 * `curataDocument` pentru un `DocumentXlsx`: fiecare text trece prin
 * `curataText`, numerele rămân neschimbate. Funcție pură.
 */
export function curataDocumentXlsx(d: DocumentXlsx): DocumentXlsx {
  const { randuri, tabeleSuplimentare, ...rest } = d;
  const text = curataDocument({ ...rest, randuri: [] });
  return {
    ...text,
    randuri: curataCelule(randuri),
    // `exactOptionalPropertyTypes`: cheia lipsește, nu e `undefined`.
    ...(tabeleSuplimentare === undefined
      ? {}
      : {
          tabeleSuplimentare: tabeleSuplimentare.map((t) => ({
            titlu: curataText(t.titlu),
            coloane: t.coloane.map((c) => ({ ...c, eticheta: curataText(c.eticheta) })),
            randuri: curataCelule(t.randuri),
          })),
        }),
  };
}

/**
 * `DocumentXlsx` (deci și orice `DocumentTabelar`) → .xlsx, pe o singură filă,
 * cu antetul tabelului înghețat.
 *
 * Secțiunile (`sectiuni`, fișa SSM) NU au formă de foaie de calcul: casetele de
 * viză și cele șapte tabele cu lățimi diferite nu încap pe o grilă de coloane.
 * Unealta care le are se descarcă doar în PDF și Word (`formatePentru` din
 * `registru.ts`); aici se aruncă, ca o unealtă nouă să nu piardă tăcut jumătate
 * din document într-un Excel.
 */
export async function randeazaXlsx(d: DocumentXlsx, o: OptiuniXlsx): Promise<Uint8Array> {
  if ((d.sectiuni?.length ?? 0) > 0) {
    throw new Error("Documentul are secțiuni, iar Excelul nu le randează.");
  }
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
    randuri: readonly (readonly CelulaXlsx[])[],
    umbrite: readonly number[],
  ) => {
    const antet = fila.addRow([...etichete]);
    antet.font = { bold: true };
    // Etichetele cu `\n` (ziua deasupra literei) se afișează pe două rânduri.
    antet.alignment = { wrapText: true, vertical: "top" };
    for (const r of randuri) {
      const rand = fila.addRow(r.map((c) => (typeof c === "string" ? c : c.numar)));
      etichete.forEach((_, i) => {
        const celula = rand.getCell(i + 1);
        const sursa = r[i];
        if (sursa !== undefined && typeof sursa !== "string") celula.numFmt = sursa.format;
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
  for (const rubrica of d.rubrici ?? []) {
    fila.addRow([]);
    fila.addRow([rubrica.titlu]).font = { bold: true };
    const paragrafeRubrica = rubrica.text.split("\n").filter((p) => p.trim() !== "");
    for (const p of paragrafeRubrica) fila.addRow([p]);
    const goale = paragrafeRubrica.length > 0 ? 1 : rubrica.randuriGoale;
    for (let k = 0; k < goale; k += 1) {
      const rand = fila.addRow([]);
      rand.height = 20;
      d.coloane.forEach((_, i) => {
        rand.getCell(i + 1).border = { bottom: { style: "hair" } };
      });
    }
  }
  if (d.semnaturi.length > 0) fila.addRow(d.semnaturi.map((s) => `${s}: ______________`));
  if (d.semnaturi.length > 0 && d.dataLaSemnaturi === true) {
    fila.addRow(d.semnaturi.map(() => "Data: ______________"));
  }
  if (o.subsol === "unealta") {
    const semnatura = fila.addRow([
      { text: SEMNATURA_FISIER, hyperlink: adresaDinFisier(d, "xlsx", ADRESA_SITE) },
    ]);
    semnatura.getCell(1).font = { color: { argb: "FF6B7280" }, underline: true };
  }

  return new Uint8Array(await registru.xlsx.writeBuffer());
}
