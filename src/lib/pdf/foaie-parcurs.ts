// src/lib/pdf/foaie-parcurs.ts
// Foaia de parcurs zilnică, în PDF (0200).
//
// CE se scrie pe document decide `modelFoaieParcurs` din
// `src/domain/fleet/foaie.ts` — funcție pură, cu teste, cu temeiul legal în
// capul ei. Aici e doar AȘEZAREA: antetul firmei, rubricile, tabelul curselor,
// totalurile, alimentările, aprobarea, notele. Pagina e în PEISAJ: nouă coloane
// de cursă nu încap lizibil pe lățimea unui A4 în portret.
import "server-only";

import type { ModelFoaieParcurs } from "@/domain/fleet/foaie";

import {
  Cursor,
  deseneazaAntet,
  deseneazaSubsolFirma,
  numeroteazaPaginile,
  pornesteDocument,
  ACCENT,
  GRI,
  INALTIME_A4,
  LATIME_A4,
  MARGINE,
  type AntetOrganizatie,
} from "./document";
import { paragraf } from "./flux";

export interface ParametriFoaieParcurs {
  readonly organizatie: AntetOrganizatie;
  readonly model: ModelFoaieParcurs;
  readonly generatLa: string;
}

/** Coloanele tabelului de curse: eticheta, lățimea relativă, aliniere la dreapta. */
const COLOANE_CURSE: readonly (readonly [string, number, boolean])[] = [
  ["Nr.", 0.04, false],
  ["Plecare", 0.07, false],
  ["Sosire", 0.07, false],
  ["De la", 0.17, false],
  ["Până la", 0.17, false],
  ["Scopul deplasării", 0.24, false],
  ["Km plecare", 0.08, true],
  ["Km sosire", 0.08, true],
  ["Km", 0.08, true],
];

function titluSectiune(cursor: Cursor, titlu: string): void {
  cursor.asiguraSpatiu(40);
  cursor.text(titlu, { marime: 9, aldin: true, culoare: ACCENT, coboaraCu: 6 });
  cursor.linie();
  cursor.coboara(13);
}

function deseneazaRand(cursor: Cursor, celule: readonly string[], aldin: boolean): void {
  const latime = cursor.latimeUtila;
  let x = MARGINE;
  COLOANE_CURSE.forEach(([, parte, dreapta], i) => {
    const latimeColoana = latime * parte;
    const text = cursor.trunchiaza(celule[i] ?? "", latimeColoana - 6, 8, aldin);
    if (dreapta) cursor.textDreapta(text, x + latimeColoana - 4, { marime: 8, aldin });
    else cursor.text(text, { x, marime: 8, aldin });
    x += latimeColoana;
  });
  cursor.coboara(13);
}

export async function genereazaFoaieParcurs(p: ParametriFoaieParcurs): Promise<Uint8Array> {
  const { model } = p;
  const context = await pornesteDocument(
    `${model.titlu} ${model.subtitlu}`,
    p.organizatie.denumire,
  );
  // Peisaj: lățimea și înălțimea A4 inversate.
  const cursor = new Cursor(context, INALTIME_A4, LATIME_A4);
  const xValoare = MARGINE + 170;

  await deseneazaAntet(cursor, context, p.organizatie, model.titlu, model.subtitlu);

  // Rubricile antetului, pe două coloane. Golul rămâne linie de completat.
  const jumatate = Math.ceil(model.rubrici.length / 2);
  const stanga = model.rubrici.slice(0, jumatate);
  const dreapta = model.rubrici.slice(jumatate);
  const xDoi = MARGINE + cursor.latimeUtila / 2;
  for (let i = 0; i < jumatate; i += 1) {
    const [es, vs] = stanga[i] ?? ["", ""];
    cursor.text(es, { marime: 8, culoare: GRI });
    cursor.text(vs === "" ? "______________________" : cursor.trunchiaza(vs, 200, 9), {
      x: xValoare,
      marime: 9,
    });
    const perecheDreapta = dreapta[i];
    if (perecheDreapta !== undefined) {
      const [ed, vd] = perecheDreapta;
      cursor.text(ed, { x: xDoi, marime: 8, culoare: GRI });
      cursor.text(vd === "" ? "______________________" : cursor.trunchiaza(vd, 200, 9), {
        x: xDoi + 150,
        marime: 9,
      });
    }
    cursor.coboara(13);
  }
  cursor.coboara(8);

  // Avertismentele stau SUS: un document incomplet trebuie să se vadă ca atare.
  if (model.avertismente.length > 0) {
    cursor.asiguraSpatiu(14 + model.avertismente.length * 11);
    for (const a of model.avertismente) {
      cursor.text(`! ${cursor.trunchiaza(a, cursor.latimeUtila - 10, 8)}`, {
        marime: 8,
        aldin: true,
        coboaraCu: 11,
      });
    }
    cursor.coboara(6);
  }

  titluSectiune(cursor, "CURSELE ZILEI");
  deseneazaRand(
    cursor,
    COLOANE_CURSE.map(([e]) => e),
    true,
  );
  if (model.curse.length === 0) {
    cursor.text("Nicio cursă înregistrată.", { marime: 8, culoare: GRI, coboaraCu: 13 });
  }
  for (const c of model.curse) {
    const areETransport = c.eTransport !== null || c.uituri.length > 0;
    // Rândul și linia lui e-Transport stau pe aceeași pagină.
    cursor.asiguraSpatiu(areETransport ? 26 : 14);
    deseneazaRand(
      cursor,
      [c.nr, c.plecare, c.sosire, c.deLa, c.panaLa, c.scop, c.kmPlecare, c.kmSosire, c.km],
      false,
    );
    if (areETransport) {
      // Sub traseu (0217, F12f): încadrarea și codurile UIT ale cursei.
      const linie = [
        c.eTransport === null ? null : `e-Transport: ${c.eTransport}`,
        `UIT: ${c.uituri.length === 0 ? "—" : c.uituri.join(", ")}`,
      ]
        .filter((v): v is string => v !== null)
        .join(" · ");
      const x = MARGINE + cursor.latimeUtila * (COLOANE_CURSE[0]?.[1] ?? 0);
      cursor.text(cursor.trunchiaza(linie, cursor.latimeUtila - (x - MARGINE) - 6, 7), {
        x,
        marime: 7,
        culoare: GRI,
        coboaraCu: 11,
      });
    }
  }
  cursor.coboara(6);

  // Totalurile pe două coloane, ca rubricile: o zi obișnuită încape pe o pagină.
  titluSectiune(cursor, "TOTALURI");
  const jumatateTotal = Math.ceil(model.totaluri.length / 2);
  for (let i = 0; i < jumatateTotal; i += 1) {
    cursor.asiguraSpatiu(14);
    const [es, vs] = model.totaluri[i] ?? ["", ""];
    cursor.text(es, { marime: 8 });
    cursor.text(vs === "" ? "—" : vs, { x: xValoare, marime: 8, aldin: true });
    const perecheDreapta = model.totaluri[i + jumatateTotal];
    if (perecheDreapta !== undefined) {
      const [ed, vd] = perecheDreapta;
      cursor.text(ed, { x: xDoi, marime: 8 });
      cursor.text(vd === "" ? "—" : vd, { x: xDoi + 150, marime: 8, aldin: true });
    }
    cursor.coboara(12);
  }
  cursor.coboara(4);

  if (model.alimentari.length > 0) {
    titluSectiune(cursor, "ALIMENTĂRI");
    for (const [cand, unde, cantitate, cost] of model.alimentari) {
      cursor.asiguraSpatiu(14);
      cursor.text(cand, { marime: 8 });
      cursor.text(cursor.trunchiaza(unde, 300, 8), { x: MARGINE + 110, marime: 8 });
      cursor.textDreapta(cantitate, MARGINE + 520, { marime: 8 });
      cursor.textDreapta(cost, MARGINE + 620, { marime: 8 });
      cursor.coboara(12);
    }
    cursor.coboara(6);
  }

  // Semnăturile: conducătorul auto și aprobarea, consemnată din audit.
  cursor.asiguraSpatiu(60);
  cursor.text("Conducător auto", { marime: 8, culoare: GRI });
  cursor.text("Verificat și aprobat", { x: xDoi, marime: 8, culoare: GRI });
  cursor.coboara(13);
  cursor.text(model.rubrici.find(([e]) => e === "Conducător auto")?.[1] ?? "", { marime: 9 });
  cursor.text(cursor.trunchiaza(model.aprobare, cursor.latimeUtila / 2 - 10, 9), {
    x: xDoi,
    marime: 9,
  });
  cursor.coboara(24);

  // Notele se rup pe rânduri (`paragraf`), nu se taie: temeiul legal tăiat
  // la jumătate ar fi mai rău decât lipsa lui.
  for (const nota of model.note) {
    paragraf(cursor, nota, { marime: 7, gri: true, spatiuDupa: 3 });
  }
  cursor.text(`Document generat la ${p.generatLa}.`, { marime: 7, culoare: GRI });

  await deseneazaSubsolFirma(context, p.organizatie);
  numeroteazaPaginile(context, `${model.titlu} ${model.subtitlu}`);
  return context.doc.save();
}
