// src/lib/pdf/proces-verbal-vehicul.ts
//
// Procesul-verbal de predare-primire a vehiculului, în PDF A4 (0215, F12c).
//
// CE se scrie decide `modelPv` din `src/domain/fleet/proces-verbal.ts` —
// aceleași rânduri pe care le arată ecranul PV-ului, ca hârtia și ecranul să nu
// poată diverge. Aici e doar AȘEZAREA: antetul firmei, banda „ANULAT”,
// secțiunile etichetă → valoare, daunele, observațiile, formula și două sau trei
// rubrici de semnătură. Ordinea finală e cea din comentariul lui
// `deseneazaSubsolFirma`: conținutul, apoi subsolul firmei, apoi numerotarea.
//
// PDF-ul NU afirmă că confirmarea din aplicație ține loc de semnătură: o
// consemnează sub rubrică, ca urmă de identificare (OMFP 2634/2015, anexa 1
// pct. 11), iar hârtia semnată rămâne documentul (decizia I-c1, ⚠ jurist).
import "server-only";

import { rgb } from "pdf-lib";

import type { ModelPv, RandModel } from "@/domain/fleet/proces-verbal";

import {
  Cursor,
  deseneazaAntet,
  deseneazaSubsolFirma,
  numeroteazaPaginile,
  pornesteDocument,
  GRI,
  LINIE,
  MARGINE,
  NEGRU,
  type AntetOrganizatie,
  type ContextPdf,
} from "./document";
import { paragraf, rupeInRanduri, titluSectiune } from "./flux";

export interface IntrarePvVehicul {
  readonly organizatie: AntetOrganizatie;
  readonly model: ModelPv;
  /** Numărul PV-ului, pentru titlul fișierului și numerotarea paginilor. */
  readonly numar: string;
  readonly generatLa: string;
}

const ROSU = rgb(0.72, 0.11, 0.11);
const LATIME_ETICHETA = 210;
const MARIME = 9;
const INTERLINIE = MARIME * 1.35;

/** Un rând etichetă → valoare; valoarea se rupe pe rânduri, nu se taie. */
function rand(cursor: Cursor, r: RandModel): void {
  const latimeValoare = cursor.latimeUtila - LATIME_ETICHETA;
  const randuri = rupeInRanduri(cursor, r.valoare, latimeValoare, MARIME, false);
  const eticheta = rupeInRanduri(cursor, r.eticheta, LATIME_ETICHETA - 8, 8.5, false);
  const total = Math.max(randuri.length, eticheta.length, 1);
  cursor.asiguraSpatiu(total * INTERLINIE);
  for (let i = 0; i < total; i += 1) {
    const textEticheta = eticheta[i];
    if (textEticheta !== undefined) cursor.text(textEticheta, { marime: 8.5, culoare: GRI });
    const textValoare = randuri[i];
    if (textValoare !== undefined) {
      cursor.text(textValoare, {
        x: MARGINE + LATIME_ETICHETA,
        marime: MARIME,
        aldin: r.atentie === true,
        culoare: r.atentie === true ? ROSU : NEGRU,
      });
    }
    cursor.coboara(INTERLINIE);
  }
}

/** Un text roșu, rupt pe rânduri (banda PV-ului anulat). */
function textRosu(cursor: Cursor, continut: string, marime: number): void {
  for (const r of rupeInRanduri(cursor, continut, cursor.latimeUtila, marime, true)) {
    cursor.asiguraSpatiu(marime * 1.35);
    cursor.text(r, { marime, aldin: true, culoare: ROSU, coboaraCu: marime * 1.35 });
  }
}

/** Rubricile de semnătură, una lângă alta: două la predare/restituire, trei la transfer. */
function semnaturi(cursor: Cursor, context: ContextPdf, model: ModelPv): void {
  const n = model.semnaturi.length;
  const latime = cursor.latimeUtila / n;
  cursor.asiguraSpatiu(110);
  cursor.coboara(12);
  const yStart = cursor.yCurent;
  const pagina = cursor.paginaCurenta;
  let celMaiJos = yStart;

  model.semnaturi.forEach((s, i) => {
    const x = MARGINE + i * latime;
    let y = yStart;
    const scrie = (text: string, marime: number, aldin: boolean, culoare = NEGRU): void => {
      pagina.drawText(text, {
        x,
        y,
        size: marime,
        font: aldin ? context.fonturi.aldin : context.fonturi.normal,
        color: culoare,
      });
    };
    scrie(s.rol, 9, true);
    y -= 13;
    scrie(cursor.trunchiaza(s.nume, latime - 10, 9), 9, false);
    y -= 32;
    pagina.drawLine({
      start: { x, y },
      end: { x: x + latime - 16, y },
      thickness: 0.5,
      color: GRI,
    });
    y -= 10;
    scrie("Semnătura", 7, false, GRI);
    if (s.confirmare !== null) {
      for (const r of rupeInRanduri(cursor, s.confirmare, latime - 12, 7, false)) {
        y -= 9;
        scrie(r, 7, false, GRI);
      }
    }
    celMaiJos = Math.min(celMaiJos, y);
  });
  cursor.coboara(yStart - celMaiJos + 14);
}

export async function genereazaPvVehicul(intrare: IntrarePvVehicul): Promise<Uint8Array> {
  const { model } = intrare;
  const context = await pornesteDocument(
    `${model.titlu} ${intrare.numar}`,
    intrare.organizatie.denumire,
  );
  const cursor = new Cursor(context);

  await deseneazaAntet(cursor, context, intrare.organizatie, model.titlu, model.subtitlu);
  if (model.banda !== null) {
    textRosu(cursor, model.banda, 10);
    cursor.coboara(4);
  }

  paragraf(cursor, model.operatiunea, { marime: 10, aldin: true, spatiuDupa: 4 });

  for (const sectiune of model.sectiuni) {
    titluSectiune(cursor, sectiune.titlu);
    for (const r of sectiune.randuri) rand(cursor, r);
  }

  titluSectiune(cursor, "Daune vizibile");
  for (const dauna of model.daune) paragraf(cursor, `• ${dauna}`, { marime: MARIME });

  titluSectiune(cursor, "Observații");
  paragraf(cursor, model.observatii, { marime: MARIME });

  cursor.coboara(6);
  paragraf(cursor, model.formula, { marime: MARIME, spatiuDupa: 4 });

  semnaturi(cursor, context, model);

  paragraf(cursor, `Document generat la ${intrare.generatLa}.`, { marime: 7, gri: true });

  // Banda „ANULAT” pe FIECARE pagină: o foaie scoasă din teanc trebuie să spună
  // singură că documentul nu mai e valabil.
  if (model.banda !== null) {
    for (const pagina of context.doc.getPages()) {
      const text = "ANULAT";
      const latime = context.fonturi.aldin.widthOfTextAtSize(text, 11);
      pagina.drawText(text, {
        x: pagina.getWidth() - MARGINE - latime,
        y: pagina.getHeight() - MARGINE / 2 - 6,
        size: 11,
        font: context.fonturi.aldin,
        color: ROSU,
      });
      pagina.drawLine({
        start: { x: MARGINE, y: pagina.getHeight() - MARGINE / 2 - 10 },
        end: { x: pagina.getWidth() - MARGINE, y: pagina.getHeight() - MARGINE / 2 - 10 },
        thickness: 0.5,
        color: LINIE,
      });
    }
  }

  await deseneazaSubsolFirma(context, intrare.organizatie);
  numeroteazaPaginile(context, `${intrare.numar} · Administrativo`);
  return context.doc.save();
}
