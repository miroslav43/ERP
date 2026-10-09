import { antetFirmaDinParametri, randAntetFirma, type AntetFirma } from "@/lib/unelte/antet-firma";
import { COD_REPAUS, COD_SARBATOARE, TEXT_LEGENDA } from "@/lib/unelte/coduri-pontaj";
import type { Coloana, DocumentTabelar } from "@/lib/unelte/document-tabelar";

import { LUNI, normalizeazaAn, normalizeazaLuna, notaOmisi } from "../foaie-de-pontaj/foaie";
import {
  etichetaProgram,
  liniiAngajati,
  normalizeazaProgram,
  zileDinLuna,
  type Program,
} from "../foaie-de-pontaj/pontaj";

/**
 * Condica de prezență: pe fiecare zi, câte un rând pe om, cu ora sosirii, ora
 * plecării, pauza, orele lucrate și observațiile.
 *
 * ── DE CE NU E FOAIA DE PONTAJ CU ALT TITLU ───────────────────────────────
 * Foaia de pontaj are o celulă pe zi, în care se scrie „8” sau „CO”. Art. 119
 * cere însă ora de ÎNCEPERE și ora de SFÂRȘIT, zilnic — exact ce poartă o
 * condică. Zilele vin din `zileDinLuna`, deci sărbătorile (inclusiv Paștele
 * ortodox) sunt aceleași ca pe foaia de pontaj.
 *
 * ── DE CE TOATE ZILELE LUNII ──────────────────────────────────────────────
 * Până la 8 oct 2026 condica păstra doar zilele de luni până vineri fără
 * sărbători (auditul: MAJOR). Art. 119 cere orele prestate ZILNIC, iar art.
 * 141–142 prevăd munca de sărbători. Acum: la programul luni–vineri sau
 * luni–sâmbătă, o zi din afara programului e UN rând marcat L sau SL — condica
 * nu are goluri, dar nici pagini de rânduri pe care nu le semnează nimeni; la
 * „ture”, fiecare zi are rânduri pe om, iar sărbătoarea mai are un rând SL
 * deasupra (contează la spor, art. 142).
 */

export type ParametriCondica = Readonly<{
  an: number;
  luna: number;
  angajati: readonly string[];
  program: Program;
  antet: AntetFirma;
  /** Nota pentru document când lista a trecut de 60 de nume; `null` altfel (B4). */
  notaAngajati: string | null;
  /** Egal cu `antet.firma`. Rămâne doar cât pagina îl citește direct (până la E14). */
  firma: string;
}>;

/** Intrările din adresă, cu aceleași limite ca foaia de pontaj. */
export function parametriCondica(q: URLSearchParams): ParametriCondica {
  const acum = new Date();
  const antet = antetFirmaDinParametri(q);
  // Aceleași linii ca la foaia de pontaj (deci aceleași reguli de nume ale lui B):
  // „Ilie Maria | 4” dă „Ilie Maria”, norma n-are ce căuta într-o condică.
  const linii = liniiAngajati(q.get("angajati") ?? undefined, 8);
  return {
    an: normalizeazaAn(q.get("an") ?? undefined, acum.getUTCFullYear()),
    luna: normalizeazaLuna(q.get("luna") ?? undefined, acum.getUTCMonth() + 1),
    angajati: linii.angajati.map((a) => a.nume),
    program: normalizeazaProgram(q.get("program")),
    antet,
    notaAngajati: notaOmisi(linii.lista),
    firma: antet.firma,
  };
}

export type RandCondica =
  | Readonly<{ fel: "om"; zi: number; data: string; nume: string }>
  | Readonly<{ fel: "marcaj"; zi: number; data: string; eticheta: string; cod: string }>;

function majuscula(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Rândurile condicii, în ordine. Le citesc și documentul, și Excelul (`condica-xlsx.ts`). */
export function randuriCondica(
  p: Pick<ParametriCondica, "an" | "luna" | "angajati" | "program">,
): readonly RandCondica[] {
  const randuri: RandCondica[] = [];
  for (const z of zileDinLuna(p.an, p.luna, p.program)) {
    if (!z.inProgram || z.sarbatoare !== null) {
      randuri.push({
        fel: "marcaj",
        zi: z.zi,
        data: z.data,
        eticheta: z.sarbatoare ?? `${majuscula(z.numeZi)} — zi de repaus`,
        cod: z.sarbatoare !== null ? COD_SARBATOARE : COD_REPAUS,
      });
    }
    if (z.inProgram) {
      for (const nume of p.angajati) randuri.push({ fel: "om", zi: z.zi, data: z.data, nume });
    }
  }
  return randuri;
}

/*
 * Lățimile, în puncte PDF, pe A4 portret: suma e exact lățimea utilă (515,28).
 * Alese pe fontul real (DejaVu 8 pt): „01.12.2026” are 45,8 pt, „plecării”
 * aldin 33,5, „Observații” aldin 46,6; `taie` taie la `w − 4`.
 */
export const COLOANE_CONDICA: readonly Coloana[] = [
  { eticheta: "Data", latime: 51 },
  { eticheta: "Nume și prenume", latime: 128.28 },
  { eticheta: "Ora\nsosirii", latime: 33 },
  { eticheta: "Semnătura", latime: 72 },
  { eticheta: "Ora\nplecării", latime: 39 },
  { eticheta: "Semnătura", latime: 72 },
  { eticheta: "Pauză\n(min)", latime: 32 },
  { eticheta: "Ore\nlucrate", latime: 37 },
  { eticheta: "Observații", latime: 51 },
];

export function condicaDocument(p: ParametriCondica): DocumentTabelar {
  const randuri = randuriCondica(p);
  const marcate = randuri.filter((r) => r.fel === "marcaj").length;
  return {
    titlu: `Condica de prezență — ${LUNI[p.luna - 1] ?? ""} ${String(p.an)}`,
    subtitlu: randAntetFirma(p.antet),
    campuri: [],
    paragrafe: [],
    coloane: COLOANE_CONDICA,
    randuri: randuri.map((r) =>
      r.fel === "om"
        ? [r.data, r.nume, "", "", "", "", "", "", ""]
        : [r.data, r.eticheta, "", "", "", "", "", "", r.cod],
    ),
    umbrite: [],
    note: [
      "Art. 119 alin. (1) din Codul muncii cere evidența orelor prestate zilnic de fiecare salariat, cu ora de începere și ora de sfârșit a programului.",
      `Program: ${etichetaProgram(p.program)}. Zile marcate cu L (repaus) sau SL (sărbătoare legală): ${String(marcate)}.`,
      TEXT_LEGENDA,
      // Nota lui B4 la urmă: fișierul circulă fără pagină.
      ...(p.notaAngajati === null ? [] : [p.notaAngajati]),
    ],
    semnaturi: ["Verificat (conducătorul locului de muncă)"],
    orientare: "portret",
    numeFisier: `condica-prezenta-${String(p.an)}-${String(p.luna).padStart(2, "0")}`,
    // Se semnează de mână pe fiecare rând: 16 pt (5,6 mm) era prea puțin.
    inaltimeRand: 22,
  };
}

export function condicaDinParametri(q: URLSearchParams): DocumentTabelar {
  return condicaDocument(parametriCondica(q));
}

/** Semnătura lui B4, pe care o mai cheamă pagina până la E14. */
export function construiesteCondica(
  an: number,
  luna: number,
  angajati: readonly string[],
  firma: string,
  notaAngajati: string | null = null,
): DocumentTabelar {
  return condicaDocument({
    an,
    luna,
    angajati,
    program: "lv",
    antet: { firma, cui: "", compartiment: "" },
    notaAngajati,
    firma,
  });
}
