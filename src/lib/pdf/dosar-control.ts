// src/lib/pdf/dosar-control.ts
//
// „Dosarul de control” al mentenanței (M7), ca PDF: autorizațiile ISCIR curente
// și verificările legale programate, pentru un control ITM, ISCIR sau ISU.
//
// Bloc pe rând, nu tabel: zece coloane nu încap lizibil pe A4, iar temeiul și
// observațiile sunt fraze, nu celule. Liniile vin GATA compuse (aceleași ca în
// CSV — `src/app/(app)/mentenanta/iscir/dosar-control.ts`), deci cele două
// formate nu pot spune lucruri diferite despre același utilaj.
//
// Nu e un document care pleacă din firmă cu număr de ieșire (ca statul de
// plată): e o situație internă la zi, arătată inspectorului. Fără registru.
import "server-only";

import { rgb } from "pdf-lib";

import { formatDate } from "@/lib/format/date";

import {
  ACCENT,
  Cursor,
  GRI,
  deseneazaAntet,
  deseneazaSubsolFirma,
  numeroteazaPaginile,
  pornesteDocument,
  type AntetOrganizatie,
} from "./document";
import { paragraf, semnaturi, titluSectiune } from "./flux";

const ROSU = rgb(0.72, 0.11, 0.11);

/** Forma unei linii a dosarului; `LinieDosarControl` din modul o satisface. */
export type RandDosarControl = Readonly<{
  echipament: string;
  ce: string;
  categorie: string;
  temei: string;
  numar: string;
  emisa: string;
  valabilaPana: string;
  urmatoareaVerificare: string;
  stare: string;
  rosu: boolean;
  observatii: string;
}>;

export type ParametriDosarControl = Readonly<{
  organizatie: AntetOrganizatie;
  /** Ziua la care e valabilă situația (ISO). */
  azi: string;
  autorizatii: readonly RandDosarControl[];
  verificari: readonly RandDosarControl[];
  /** „3 autorizații ISCIR · 2 verificări legale · 1 de rezolvat”, numărat de apelant. */
  rezumat: string;
  intocmitDe: string;
  generatLa: string;
}>;

const data = (iso: string): string => (iso === "" ? "" : formatDate(iso));

/** Rândul de termene, fără bucățile goale. */
function termene(r: RandDosarControl): string {
  return [
    r.numar === "" ? null : r.numar,
    r.emisa === "" ? null : `emisă / executată la ${data(r.emisa)}`,
    r.valabilaPana === "" ? null : `valabilă până la ${data(r.valabilaPana)}`,
    r.urmatoareaVerificare === ""
      ? null
      : `următoarea verificare la ${data(r.urmatoareaVerificare)}`,
  ]
    .filter((v): v is string => v !== null)
    .join(" · ");
}

function deseneazaRand(cursor: Cursor, r: RandDosarControl): void {
  // Titlul și starea pe același rând; restul încadrat dedesubt.
  cursor.asiguraSpatiu(40);
  const stare = r.stare;
  const latimeStare = cursor.latimeText(stare, 8, true);
  const xDreapta = cursor.latimeUtila + 40;
  const titlu = [r.echipament, r.ce, r.categorie].filter((v) => v !== "").join(" · ");
  cursor.text(cursor.trunchiaza(titlu, cursor.latimeUtila - latimeStare - 12, 9, true), {
    marime: 9,
    aldin: true,
  });
  cursor.textDreapta(stare, xDreapta, { marime: 8, aldin: true, culoare: r.rosu ? ROSU : GRI });
  cursor.coboara(13);

  const detalii = termene(r);
  if (detalii !== "") paragraf(cursor, detalii, { marime: 8, indent: 10 });
  if (r.temei !== "") paragraf(cursor, `Temei: ${r.temei}`, { marime: 8, indent: 10, gri: true });
  if (r.observatii !== "") {
    paragraf(cursor, `Observații: ${r.observatii}`, { marime: 8, indent: 10, gri: true });
  }
  cursor.coboara(4);
  cursor.linie();
  cursor.coboara(12);
}

function sectiune(
  cursor: Cursor,
  titlu: string,
  randuri: readonly RandDosarControl[],
  gol: string,
): void {
  titluSectiune(cursor, `${titlu} (${String(randuri.length)})`, 11);
  cursor.linie({ grosime: 0.7, culoare: ACCENT });
  cursor.coboara(13);
  if (randuri.length === 0) {
    paragraf(cursor, gol, { marime: 8, gri: true, spatiuDupa: 6 });
    return;
  }
  for (const r of randuri) deseneazaRand(cursor, r);
}

export async function genereazaDosarControl(parametri: ParametriDosarControl): Promise<Uint8Array> {
  const titlu = `Dosar de control — verificări legale, ${formatDate(parametri.azi)}`;
  const context = await pornesteDocument(titlu, parametri.organizatie.denumire);
  const cursor = new Cursor(context);

  await deseneazaAntet(
    cursor,
    context,
    parametri.organizatie,
    "DOSAR DE CONTROL — VERIFICĂRI LEGALE",
    `Situația la ${formatDate(parametri.azi)} · ${parametri.rezumat}`,
  );

  paragraf(
    cursor,
    "Autorizațiile ISCIR curente (fără cele înlocuite prin reînnoire) și planurile active de verificare legală. " +
      "Scadența din documentul emis de inspector are prioritate față de periodicitatea calculată. " +
      "Temeiurile marcate ⚠ sunt de confirmat cu RSVTI sau cu juristul.",
    { marime: 8, gri: true, spatiuDupa: 8 },
  );

  sectiune(
    cursor,
    "Autorizații ISCIR",
    parametri.autorizatii,
    "Nicio autorizație ISCIR curentă înregistrată.",
  );
  sectiune(
    cursor,
    "Verificări legale programate",
    parametri.verificari,
    "Niciun plan activ de verificare legală.",
  );

  cursor.coboara(6);
  paragraf(cursor, `Întocmit de ${parametri.intocmitDe}, la ${parametri.generatLa}.`, {
    marime: 8,
    gri: true,
  });
  semnaturi(cursor, "Întocmit", "RSVTI / Administrator");

  await deseneazaSubsolFirma(context, parametri.organizatie);
  numeroteazaPaginile(context, `Dosar de control · ${parametri.organizatie.denumire}`);
  return context.doc.save();
}
