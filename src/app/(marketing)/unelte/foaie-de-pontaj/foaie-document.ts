import { cuDe } from "@/content/legal/zile-libere";
import { randAntetFirma } from "@/lib/unelte/antet-firma";
import { CODURI_ABSENTA, TEXT_LEGENDA } from "@/lib/unelte/coduri-pontaj";
import type { Coloana, DocumentTabelar } from "@/lib/unelte/document-tabelar";

import { oreFoaie, textNorma, type Foaie } from "./foaie";
import {
  angajatiPentruFise,
  etichetaProgram,
  normaLunara,
  oreScurt,
  rezumatNorma,
  type AngajatPontaj,
  type Pontaj,
} from "./pontaj";

/**
 * Foaia de pontaj ca `DocumentTabelar`, pentru PDF și Word.
 *
 * Excelul rămâne pe generatorul lui din `route.ts`: acolo totalurile sunt
 * FORMULE, iar modelul comun nu știe de formule. PDF-ul și Word-ul se tipăresc
 * și se completează de mână, deci totalul e o coloană goală.
 */
export function foaieCaDocument(foaie: Foaie, notaAngajati: string | null = null): DocumentTabelar {
  const sarbatori = foaie.zile.filter((z) => z.sarbatoare !== null);
  const listaSarbatori = sarbatori.map((z) => `${String(z.zi)} ${z.sarbatoare ?? ""}`).join("; ");
  return {
    titlu: `Foaie colectivă de prezență — ${foaie.eticheta}`,
    subtitlu: textNorma(foaie),
    campuri: [],
    paragrafe: [],
    coloane: [
      { eticheta: "Angajat", latime: 8 },
      ...foaie.zile.map((z) => ({ eticheta: `${String(z.zi)}\n${z.litera}`, latime: 1 })),
      { eticheta: "Total", latime: 2 },
    ],
    randuri: foaie.angajati.map((nume) => [nume, ...foaie.zile.map(() => ""), ""]),
    umbrite: foaie.zile.flatMap((z, i) => (z.weekend || z.sarbatoare !== null ? [i + 1] : [])),
    note: [
      `Sărbători legale în lună: ${listaSarbatori === "" ? "niciuna" : listaSarbatori}`,
      ...(notaAngajati === null ? [] : [notaAngajati]),
    ],
    semnaturi: ["Întocmit", "Verificat"],
    orientare: "peisaj",
    numeFisier: `pontaj-${String(foaie.an)}-${String(foaie.luna).padStart(2, "0")}`,
  };
}

/*
 * ── LĂȚIMILE, ÎN PUNCTE PDF ───────────────────────────────────────────────
 * Alese pe fontul real (DejaVu 8 pt, măsurat pe 8 oct 2026): „31” aldin are
 * 11,1 pt, „noapte” aldin 31,6 pt, „Țăranu Ioana-Maria” 77,9 pt; `taie` taie
 * la `w − 4`. Suma pe o lună de 31 de zile e 761,2 pt, lățimea utilă A4 peisaj
 * e 761,89 — deci zilele au 15,2 pt și nu se mai lățesc, iar testul
 * „nicio etichetă nu se taie” le apără. „Normă” e DOAR în Excel: în PDF ar fi
 * lăsat numelui 64 pt; norma omului se vede din „h/zi”, cea a lunii din subtitlu.
 */
const LATIME_NUME = 90;
const LATIME_ORE_ZI = 28;
const LATIME_ZI = 15.2;
const LATIME_COD: Readonly<Record<string, number>> = { CO: 17, CM: 18, CFS: 21.5, AN: 17.5, D: 11 };

/** Coloanele de după zile, aceleași în PDF, în Word și pe ecran. */
export const COLOANE_TOTAL_COLECTIVA: readonly Coloana[] = [
  { eticheta: "Ore\nlucr.", latime: 24.5 },
  { eticheta: "Ore\nsupl.", latime: 26.5 },
  { eticheta: "Ore\nnoapte", latime: 36 },
  ...CODURI_ABSENTA.map((c) => ({ eticheta: c.cod, latime: LATIME_COD[c.cod] ?? 18 })),
];

/** Fișa individuală, A4 portret: suma e exact lățimea utilă (515,28 pt). */
export const COLOANE_FISA: readonly Coloana[] = [
  { eticheta: "Data", latime: 28 },
  { eticheta: "Ziua", latime: 25 },
  { eticheta: "Ora\nînceput", latime: 39 },
  { eticheta: "Ora\nsfârșit", latime: 34 },
  { eticheta: "Pauză\n(min)", latime: 32 },
  { eticheta: "Ore\nlucrate", latime: 37 },
  { eticheta: "Ore\nsupl.", latime: 27 },
  { eticheta: "Ore\nnoapte", latime: 37 },
  { eticheta: "Cod", latime: 22 },
  { eticheta: "Semnătura", latime: 70 },
  { eticheta: "Observații", latime: 164.28 },
];

export const NOTA_COLECTIVA_119 =
  "Foaia colectivă ține orele pe zi. Ora de început și cea de sfârșit, cerute zilnic de art. 119 alin. (1) din Codul muncii, se țin în fișa individuală sau în condica de prezență.";

export const NOTA_FISA_119 =
  "Ora de început și ora de sfârșit, zilnic, pentru fiecare salariat: art. 119 alin. (1) din Codul muncii.";

/** „Sărbători legale în lună: 1 Ziua Națională a României; 25 Crăciunul.” */
export function notaSarbatori(p: Pontaj): string {
  const lista = p.zile
    .filter((z) => z.sarbatoare !== null)
    .map((z) => `${String(z.zi)} ${z.sarbatoare ?? ""}`)
    .join("; ");
  return `Sărbători legale în lună: ${lista === "" ? "niciuna" : lista}.`;
}

/**
 * Foaia colectivă: un rând pe om, o celulă pe zi. Zilele din afara programului
 * poartă dinainte L sau SL — o literă rezistă la tipărirea alb-negru, nuanța nu
 * (auditul din 8 oct 2026: weekendul și sărbătoarea aveau aceeași nuanță).
 */
export function pontajColectivCaDocument(p: Pontaj): DocumentTabelar {
  const antet = randAntetFirma(p.antet);
  return {
    titlu: `Foaie colectivă de prezență — ${p.eticheta}`,
    subtitlu: antet === null ? rezumatNorma(p) : `${antet} — ${rezumatNorma(p)}`,
    campuri: [],
    paragrafe: [],
    coloane: [
      { eticheta: "Angajat", latime: LATIME_NUME },
      { eticheta: "h/zi", latime: LATIME_ORE_ZI },
      ...p.zile.map((z) => ({ eticheta: `${String(z.zi)}\n${z.litera}`, latime: LATIME_ZI })),
      ...COLOANE_TOTAL_COLECTIVA,
    ],
    randuri: p.angajati.map((a) => [
      a.nume,
      a.nume === "" ? "" : oreScurt(a.oreZi),
      ...p.zile.map((z) => z.codImplicit),
      ...COLOANE_TOTAL_COLECTIVA.map(() => ""),
    ]),
    umbrite: p.zile.flatMap((z, i) => (z.inProgram ? [] : [i + 2])),
    // Nota lui B4 la urmă: fișierul circulă fără pagină și spune singur că lista e tăiată.
    note: [
      notaSarbatori(p),
      TEXT_LEGENDA,
      NOTA_COLECTIVA_119,
      ...(p.notaAngajati === null ? [] : [p.notaAngajati]),
    ],
    semnaturi: ["Întocmit", "Verificat"],
    orientare: "peisaj",
    numeFisier: `pontaj-${String(p.an)}-${String(p.luna).padStart(2, "0")}`,
  };
}

/**
 * Fișa individuală: o pagină A4 pe om, cu ora de început și de sfârșit pe
 * fiecare zi — conținutul cerut de art. 119 alin. (1), pe care foaia colectivă
 * nu-l are. Rândurile rămân de 16 pt: la 17 pt, o lună de 31 de zile cu antetul
 * cel mai lung trecea semnăturile pe pagina a doua (calculat pe `pdf.ts`).
 */
export function fisaIndividualaCaDocument(
  p: Pontaj,
  a: AngajatPontaj,
  notaAngajati: string | null = null,
): DocumentTabelar {
  const norma = oreFoaie(normaLunara(p.zileLucratoare, a.oreZi));
  return {
    titlu: `Fișă individuală de pontaj — ${p.eticheta}`,
    subtitlu: randAntetFirma(p.antet),
    campuri: [
      { eticheta: "Angajat", valoare: a.nume },
      {
        eticheta: "Normă",
        valoare: `${oreScurt(a.oreZi)} h/zi × ${cuDe(p.zileLucratoare, "zile lucrătoare")} = ${norma} · program ${etichetaProgram(p.program)}`,
      },
    ],
    paragrafe: [],
    coloane: COLOANE_FISA,
    randuri: [
      ...p.zile.map((z) => [
        z.dataScurta,
        z.ziScurta,
        "",
        "",
        "",
        "",
        "",
        "",
        z.codImplicit,
        "",
        z.sarbatoare ?? "",
      ]),
      ["Total", "", "", "", "", "", "", "", "", "", ""],
    ],
    umbrite: [],
    note: [TEXT_LEGENDA, NOTA_FISA_119, ...(notaAngajati === null ? [] : [notaAngajati])],
    semnaturi: ["Salariat", "Întocmit", "Verificat"],
    orientare: "portret",
    numeFisier: `fisa-pontaj-${String(p.an)}-${String(p.luna).padStart(2, "0")}`,
  };
}

/** Documentele de descărcat: foaia colectivă, sau câte o fișă pe om. Niciodată zero. */
export function documenteleFoii(p: Pontaj): readonly [DocumentTabelar, ...DocumentTabelar[]] {
  if (p.varianta === "colectiva") return [pontajColectivCaDocument(p)];
  const [primul, ...restul] = angajatiPentruFise(p);
  // Nota de listă tăiată stă pe prima fișă: e prima foaie din teanc.
  return [
    fisaIndividualaCaDocument(p, primul, p.notaAngajati),
    ...restul.map((a) => fisaIndividualaCaDocument(p, a)),
  ];
}
