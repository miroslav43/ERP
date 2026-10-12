// src/lib/pdf/scrisoare-desemnare.ts
// Scrisoarea prin care firma comunică autorității cine conducea vehiculul
// (OUG 195/2002 art. 39 alin. (1)–(2)), în PDF (0203).
//
// CE se scrie decide `modelScrisoareDesemnare` din `src/domain/fleet/amenzi.ts`
// — funcție pură, cu teste, cu temeiul legal în capul ei. Aici e doar AȘEZAREA:
// antetul firmei, destinatarul, textul, rubricile datelor șoferului (cu linie
// de completat unde fișa nu le are), semnătura. Pagina e în portret, ca orice
// scrisoare oficială.
import "server-only";

import type { ModelScrisoare } from "@/domain/fleet/amenzi";

import {
  Cursor,
  deseneazaAntet,
  deseneazaSubsolFirma,
  numeroteazaPaginile,
  pornesteDocument,
  GRI,
  MARGINE,
  type AntetOrganizatie,
} from "./document";
import { paragraf } from "./flux";

export interface ParametriScrisoare {
  readonly organizatie: AntetOrganizatie;
  readonly model: ModelScrisoare;
  readonly generatLa: string;
}

/** Linia de completat, pentru ce lipsește din fișa angajatului. */
const LINIE_DE_COMPLETAT = "______________________________";

export async function genereazaScrisoareDesemnare(p: ParametriScrisoare): Promise<Uint8Array> {
  const { model } = p;
  const context = await pornesteDocument(
    `${model.titlu} ${model.subtitlu ?? ""}`.trim(),
    p.organizatie.denumire,
  );
  const cursor = new Cursor(context);
  const xValoare = MARGINE + 170;

  await deseneazaAntet(cursor, context, p.organizatie, model.titlu, model.subtitlu);

  // Ce lipsește se vede SUS: o scrisoare incompletă trebuie să se vadă ca atare,
  // înainte de semnare.
  if (model.lipsuri.length > 0) {
    paragraf(
      cursor,
      `Atenție: din fișa angajatului lipsesc ${model.lipsuri.join(", ")}. Completați de mână, înainte de semnare.`,
      { marime: 9, aldin: true, spatiuDupa: 8 },
    );
  }

  cursor.text(model.destinatar, { marime: 10, aldin: true, coboaraCu: 16 });
  paragraf(cursor, model.referinta, { marime: 9, spatiuDupa: 10 });

  const [introducere, incheiere] = model.paragrafe;
  if (introducere !== undefined) paragraf(cursor, introducere, { marime: 10, spatiuDupa: 8 });

  // Rubricile datelor șoferului: valoarea goală rămâne linie de completat.
  for (const [eticheta, valoare] of model.rubriciSofer) {
    cursor.asiguraSpatiu(18);
    cursor.text(eticheta, { marime: 9, culoare: GRI });
    cursor.text(valoare === "" ? LINIE_DE_COMPLETAT : cursor.trunchiaza(valoare, 330, 10), {
      x: xValoare,
      marime: 10,
      aldin: valoare !== "",
    });
    cursor.coboara(16);
  }
  cursor.coboara(6);

  if (incheiere !== undefined) paragraf(cursor, incheiere, { marime: 10, spatiuDupa: 16 });

  // Semnătura: firma, reprezentantul, ștampila.
  cursor.asiguraSpatiu(90);
  cursor.text("Reprezentant legal / persoană împuternicită", {
    marime: 9,
    culoare: GRI,
    coboaraCu: 28,
  });
  cursor.text(LINIE_DE_COMPLETAT, { marime: 10, coboaraCu: 14 });
  cursor.text("Nume, funcție, semnătură și ștampilă", { marime: 8, culoare: GRI, coboaraCu: 26 });

  // Temeiul și nota GDPR se rup pe rânduri (`paragraf`), nu se taie: un temei
  // legal tăiat la jumătate ar fi mai rău decât lipsa lui.
  for (const nota of model.note) {
    paragraf(cursor, nota, { marime: 7, gri: true, spatiuDupa: 3 });
  }
  cursor.text(`Document generat la ${p.generatLa}.`, { marime: 7, culoare: GRI });

  await deseneazaSubsolFirma(context, p.organizatie);
  numeroteazaPaginile(context, `${model.titlu} ${model.subtitlu ?? ""}`.trim());
  return context.doc.save();
}
