import type { DocumentTabelar } from "@/lib/unelte/document-tabelar";

import {
  citesteAngajati,
  construiesteFoaie,
  normalizeazaAn,
  normalizeazaLuna,
  notaOmisi,
} from "../foaie-de-pontaj/foaie";

/**
 * Condica de prezență: pe fiecare zi lucrătoare, câte un rând pe om, cu ora
 * sosirii și a plecării.
 *
 * ── DE CE NU E FOAIA DE PONTAJ CU ALT TITLU ───────────────────────────────
 * Foaia de pontaj are o celulă pe zi, în care se scrie „8” sau „CO”. Art. 119
 * cere însă ora de ÎNCEPERE și ora de SFÂRȘIT, zilnic — exact ce poartă o
 * condică. Zilele vin totuși din `construiesteFoaie`, deci sărbătorile
 * (inclusiv Paștele ortodox) se scot la fel ca pe foaia de pontaj.
 */

export type ParametriCondica = Readonly<{
  an: number;
  luna: number;
  angajati: readonly string[];
  firma: string;
  /** Nota pentru document când lista a trecut de 60 de nume; `null` altfel. */
  notaAngajati: string | null;
}>;

/** Intrările din adresă, normalizate cu aceleași limite ca foaia de pontaj. */
export function parametriCondica(q: URLSearchParams): ParametriCondica {
  const acum = new Date();
  const lista = citesteAngajati(q.get("angajati") ?? undefined);
  return {
    an: normalizeazaAn(q.get("an") ?? undefined, acum.getUTCFullYear()),
    luna: normalizeazaLuna(q.get("luna") ?? undefined, acum.getUTCMonth() + 1),
    angajati: lista.nume,
    firma: (q.get("firma") ?? "").trim().slice(0, 120),
    notaAngajati: notaOmisi(lista),
  };
}

export function construiesteCondica(
  an: number,
  luna: number,
  angajati: readonly string[],
  firma: string,
  notaAngajati: string | null = null,
): DocumentTabelar {
  const foaie = construiesteFoaie(an, luna, angajati, 8);
  const ll = String(luna).padStart(2, "0");
  const lucratoare = foaie.zile.filter((z) => !z.weekend && z.sarbatoare === null);
  return {
    titlu: `Condica de prezență — ${foaie.eticheta}`,
    subtitlu: firma === "" ? null : firma,
    campuri: [],
    paragrafe: [],
    coloane: [
      { eticheta: "Data", latime: 2 },
      { eticheta: "Nume și prenume", latime: 6 },
      { eticheta: "Ora sosirii", latime: 2 },
      { eticheta: "Semnătura", latime: 3 },
      { eticheta: "Ora plecării", latime: 2 },
      { eticheta: "Semnătura", latime: 3 },
    ],
    randuri: lucratoare.flatMap((z) =>
      angajati.map((nume) => [
        `${String(z.zi).padStart(2, "0")}.${ll}.${String(an)}`,
        nume,
        "",
        "",
        "",
        "",
      ]),
    ),
    umbrite: [],
    note: [
      "Art. 119 alin. (1) din Codul muncii cere evidența orelor prestate zilnic de fiecare salariat, cu ora de începere și ora de sfârșit a programului.",
      `Zile scoase (weekend și sărbători legale): ${String(foaie.zile.length - lucratoare.length)}.`,
      ...(notaAngajati === null ? [] : [notaAngajati]),
    ],
    semnaturi: ["Verificat (conducătorul locului de muncă)"],
    orientare: "portret",
    numeFisier: `condica-prezenta-${String(an)}-${ll}`,
  };
}

export function condicaDinParametri(q: URLSearchParams): DocumentTabelar {
  const p = parametriCondica(q);
  return construiesteCondica(p.an, p.luna, p.angajati, p.firma, p.notaAngajati);
}
