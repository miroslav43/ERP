// src/lib/excel/foaie-colectiva.ts
//
// Generatorul de Excel al arhivei lunare de pontaj (migrarea 0134).
//
// ── DE CE CITEȘTE DIN INSTANTANEU, NU DIN BAZĂ ──────────────────────────────
// Toate funcțiile de aici pornesc de la `continut`-ul unui rând din
// `pontaj_arhive_lunare` — jsonul înghețat la arhivare. Nimic nu recitește
// `attendance_entries`. Dacă ar face-o, fișierul „din arhivă" s-ar schimba
// odată cu datele vii, iar amprenta SHA-256 de pe el n-ar mai dovedi nimic.
//
// ── DE CE EXCELJS, ȘI NU PDF ────────────────────────────────────────────────
// `pdf-lib` e în proiect și ar fi produs un document mai oficial la vedere. S-a
// cerut Excel: foaia colectivă se verifică la control coloană cu coloană, iar
// un inspector care vrea să însumeze altfel decât am însumat noi are nevoie de
// celule, nu de o imagine a lor.
//
// ── DE CE SCHEMA ZOD PESTE PROPRIUL NOSTRU JSON ─────────────────────────────
// `continut` vine din bază ca `Json`, adică `unknown` cu pași mărunți. E scris
// de o funcție SQL din altă migrare decât fișierul ăsta; peste un an cele două
// pot diverge fără ca `tsc` să spună un cuvânt. `versiune_format` plus schema
// transformă divergența într-o eroare la citire, nu într-o coloană goală în
// fișierul dus la ITM.
import "server-only";

import ExcelJS from "exceljs";
import { z } from "zod";

import { CODURI_TIP_ZI } from "@/domain/attendance/coduri-zi";
import type { TipZi } from "@/schemas/attendance";

/** Tipul MIME al unui XLSX. Stă aici, nu în rute: `route.ts` n-are voie să
 * exporte decât handlere și configurația de rută — orice altă constantă
 * exportată de acolo pică la `next build`, nu la `tsc`. */
export const TIP_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** Formatul pe care îl scrie `internal.pontaj_instantaneu_luna` azi. */
export const VERSIUNE_FORMAT = 1;

const ziSchema = z.object({
  z: z.number().int().min(1).max(31),
  t: z.string(),
  i: z.string().nullable(),
  s: z.string().nullable(),
  o: z.coerce.number(),
  sup: z.coerce.number(),
  n: z.coerce.number(),
  obs: z.string().nullable().default(null),
});

const angajatSchema = z.object({
  marca: z.string(),
  nume: z.string(),
  functie: z.string().nullable(),
  departament: z.string().nullable(),
  zile: z.array(ziSchema),
  total: z.object({
    ore: z.coerce.number(),
    sup: z.coerce.number(),
    noapte: z.coerce.number(),
    zile_lucrate: z.coerce.number(),
  }),
});

export const instantaneuSchema = z.object({
  versiune_format: z.number().int(),
  firma: z.object({
    denumire: z.string().nullable(),
    denumire_legala: z.string().nullable(),
    cui: z.string().nullable(),
    reg_com: z.string().nullable(),
  }),
  perioada: z.object({
    an: z.number().int(),
    luna: z.number().int().min(1).max(12),
    zile_in_luna: z.number().int().min(28).max(31),
  }),
  angajati: z.array(angajatSchema),
  total_general: z.object({
    angajati: z.coerce.number(),
    ore: z.coerce.number(),
    sup: z.coerce.number(),
    noapte: z.coerce.number(),
  }),
});

export type InstantaneuLuna = z.infer<typeof instantaneuSchema>;

/**
 * Citește instantaneul, sau aruncă.
 *
 * Un format mai NOU decât știe codul ăsta e o eroare, nu o degradare elegantă:
 * un fișier construit din jumătate din coloane arată complet și e greșit.
 */
export function citesteInstantaneu(brut: unknown): InstantaneuLuna {
  const inst = instantaneuSchema.parse(brut);
  if (inst.versiune_format > VERSIUNE_FORMAT) {
    throw new Error(
      `Arhiva e scrisă în formatul ${String(inst.versiune_format)}, iar aplicația știe până la ${String(VERSIUNE_FORMAT)}.`,
    );
  }
  return inst;
}

export const NUME_LUNI = [
  "ianuarie",
  "februarie",
  "martie",
  "aprilie",
  "mai",
  "iunie",
  "iulie",
  "august",
  "septembrie",
  "octombrie",
  "noiembrie",
  "decembrie",
] as const;

export function numeLuna(luna: number): string {
  return NUME_LUNI[luna - 1] ?? String(luna);
}

/** „08.2026" — cheia scurtă, folosită și ca nume de filă. */
export function etichetaLuna(an: number, luna: number): string {
  return `${String(luna).padStart(2, "0")}.${String(an)}`;
}

export function numeFisierArhiva(an: number, luna: number): string {
  return `foaie-colectiva-${String(an)}-${String(luna).padStart(2, "0")}.xlsx`;
}

// ── Partea pură, testabilă fără ExcelJS ──────────────────────────────────────

export interface RandFoaie {
  readonly marca: string;
  readonly nume: string;
  readonly functie: string;
  readonly departament: string;
  /** Câte o valoare pe zi din lună, în ordine. `null` = zi fără intrare. */
  readonly celule: readonly (string | number | null)[];
  readonly totalOre: number;
  readonly totalSuplimentare: number;
  readonly totalNoapte: number;
  readonly zileLucrate: number;
}

export interface FoaieColectiva {
  readonly eticheta: string;
  readonly titlu: string;
  readonly zile: readonly number[];
  readonly randuri: readonly RandFoaie[];
  readonly totalOre: number;
  readonly totalSuplimentare: number;
  readonly totalNoapte: number;
}

/**
 * Ce scrie într-o celulă de zi.
 *
 * Ore lucrate → cifra. Zero ore → codul consacrat (CO, CM, AN, L, SL, D), ca pe
 * ecran și ca pe hârtie. O zi lucrătoare cu zero ore ÎNREGISTRATE dă „0", care e
 * altceva decât o zi fără nicio intrare — aia rămâne goală.
 */
export function celulaZi(zi: { readonly t: string; readonly o: number }): string | number {
  if (zi.o > 0) return zi.o;
  return CODURI_TIP_ZI[zi.t as TipZi] ?? "?";
}

export function construiesteFoaie(inst: InstantaneuLuna): FoaieColectiva {
  const zile = Array.from({ length: inst.perioada.zile_in_luna }, (_, i) => i + 1);

  const randuri: RandFoaie[] = inst.angajati.map((a) => {
    const dupaZi = new Map(a.zile.map((z) => [z.z, z]));
    return {
      marca: a.marca,
      nume: a.nume,
      functie: a.functie ?? "",
      departament: a.departament ?? "",
      celule: zile.map((z) => {
        const intrare = dupaZi.get(z);
        return intrare === undefined ? null : celulaZi(intrare);
      }),
      totalOre: a.total.ore,
      totalSuplimentare: a.total.sup,
      totalNoapte: a.total.noapte,
      zileLucrate: a.total.zile_lucrate,
    };
  });

  return {
    eticheta: etichetaLuna(inst.perioada.an, inst.perioada.luna),
    titlu: `Foaie colectivă de prezență — ${numeLuna(inst.perioada.luna)} ${String(inst.perioada.an)}`,
    zile,
    randuri,
    totalOre: inst.total_general.ore,
    totalSuplimentare: inst.total_general.sup,
    totalNoapte: inst.total_general.noapte,
  };
}

// ── Partea cu ExcelJS ────────────────────────────────────────────────────────

const LATIME_MARCA = 8;
const LATIME_NUME = 26;
const LATIME_TEXT = 18;
const LATIME_ZI = 4.2;
const LATIME_TOTAL = 9;

/** Datele de identitate scrise sub titlu, ca documentul să se poată citi singur. */
export interface AntetArhiva {
  readonly numarAfisat: string | null;
  readonly checksum: string;
  readonly generatLa: string;
  readonly versiune: number;
  readonly faraBlocare: boolean;
}

function adaugaFila(registru: ExcelJS.Workbook, inst: InstantaneuLuna, antet: AntetArhiva): void {
  const foaie = construiesteFoaie(inst);
  const fila = registru.addWorksheet(foaie.eticheta, {
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    views: [{ state: "frozen", xSplit: 2, ySplit: 6 }],
  });

  fila.columns = [
    { width: LATIME_MARCA },
    { width: LATIME_NUME },
    { width: LATIME_TEXT },
    { width: LATIME_TEXT },
    ...foaie.zile.map(() => ({ width: LATIME_ZI })),
    { width: LATIME_TOTAL },
    { width: LATIME_TOTAL },
    { width: LATIME_TOTAL },
  ];

  const titlu = fila.addRow([foaie.titlu]);
  titlu.font = { bold: true, size: 13 };

  const firma = inst.firma.denumire_legala ?? inst.firma.denumire ?? "";
  fila.addRow([
    [firma, inst.firma.cui === null ? null : `CUI ${inst.firma.cui}`, inst.firma.reg_com]
      .filter((x) => x !== null && x !== "")
      .join(" · "),
  ]);

  // Numărul de registru și amprenta stau ÎN fișier, nu doar pe ecranul din care
  // s-a descărcat: un XLSX ajuns pe un stick trebuie să spună singur din ce
  // document provine și cum se verifică.
  fila.addRow([
    [
      antet.numarAfisat === null ? "fără număr de registru" : `Nr. ${antet.numarAfisat}`,
      `versiunea ${String(antet.versiune)}`,
      `arhivat la ${antet.generatLa}`,
      antet.faraBlocare ? "luna NU era blocată la arhivare" : "luna era blocată la arhivare",
    ].join(" · "),
  ]);
  fila.addRow([`Amprentă SHA-256: ${antet.checksum}`]).font = { size: 8 };
  fila.addRow([]);

  const cap = fila.addRow([
    "Marca",
    "Angajat",
    "Funcția",
    "Departament",
    ...foaie.zile.map((z) => z),
    "Ore",
    "Supl.",
    "Noapte",
  ]);
  cap.font = { bold: true, size: 9 };
  cap.alignment = { horizontal: "center", vertical: "middle" };
  for (const coloana of [1, 2, 3, 4]) {
    cap.getCell(coloana).alignment = { horizontal: "left", vertical: "middle" };
  }

  const contur = (rand: ExcelJS.Row): void => {
    for (let i = 1; i <= 4 + foaie.zile.length + 3; i += 1) {
      rand.getCell(i).border = {
        top: { style: "hair" },
        left: { style: "hair" },
        bottom: { style: "hair" },
        right: { style: "hair" },
      };
    }
  };
  contur(cap);

  for (const r of foaie.randuri) {
    const rand = fila.addRow([
      r.marca,
      r.nume,
      r.functie,
      r.departament,
      ...r.celule,
      r.totalOre,
      r.totalSuplimentare,
      r.totalNoapte,
    ]);
    rand.alignment = { horizontal: "center" };
    for (const coloana of [1, 2, 3, 4]) {
      rand.getCell(coloana).alignment = { horizontal: "left" };
    }
    contur(rand);
  }

  if (foaie.randuri.length > 0) {
    const total = fila.addRow([
      "",
      "TOTAL",
      "",
      "",
      ...foaie.zile.map(() => null),
      foaie.totalOre,
      foaie.totalSuplimentare,
      foaie.totalNoapte,
    ]);
    total.font = { bold: true };
    contur(total);
  }
}

/** Un singur XLSX pentru o singură lună. */
export async function registruLunar(continut: unknown, antet: AntetArhiva): Promise<ArrayBuffer> {
  const registru = new ExcelJS.Workbook();
  registru.creator = "Administrativo";
  adaugaFila(registru, citesteInstantaneu(continut), antet);
  return registru.xlsx.writeBuffer();
}

export interface LunaDeDosar {
  readonly continut: unknown;
  readonly antet: AntetArhiva;
  readonly an: number;
  readonly luna: number;
  readonly numarAngajati: number;
  readonly totalOre: number;
}

/**
 * Dosarul de control: o filă de cuprins plus câte o filă pe lună.
 *
 * Cuprinsul e prima filă și nu e ornament — e lista pe care o parcurge
 * inspectorul: ce luni sunt acoperite, cu ce număr de înregistrare și cu ce
 * amprentă. Fără el, treizeci de file numite „08.2026" nu spun nimic despre
 * ce lipsește dintre ele.
 */
export async function registruDosar(luni: readonly LunaDeDosar[]): Promise<ArrayBuffer> {
  const registru = new ExcelJS.Workbook();
  registru.creator = "Administrativo";

  const cuprins = registru.addWorksheet("Cuprins");
  cuprins.columns = [
    { width: 14 },
    { width: 18 },
    { width: 12 },
    { width: 12 },
    { width: 14 },
    { width: 22 },
    { width: 70 },
  ];
  const titlu = cuprins.addRow(["Dosar de pontaj — cuprins"]);
  titlu.font = { bold: true, size: 13 };
  cuprins.addRow([`${String(luni.length)} luni arhivate`]);
  cuprins.addRow([]);
  const cap = cuprins.addRow([
    "Luna",
    "Nr. registru",
    "Versiunea",
    "Angajați",
    "Total ore",
    "Arhivat la",
    "Amprentă SHA-256",
  ]);
  cap.font = { bold: true };

  for (const l of luni) {
    cuprins.addRow([
      etichetaLuna(l.an, l.luna),
      l.antet.numarAfisat ?? "—",
      l.antet.versiune,
      l.numarAngajati,
      l.totalOre,
      l.antet.generatLa,
      l.antet.checksum,
    ]);
  }

  for (const l of luni) {
    adaugaFila(registru, citesteInstantaneu(l.continut), l.antet);
  }

  return registru.xlsx.writeBuffer();
}
