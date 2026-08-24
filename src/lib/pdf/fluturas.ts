// src/lib/pdf/fluturas.ts
// Fluturașul de salariu, în PDF.
//
// Angajatorul e obligat să dea fiecărui salariat un document din care să reiasă
// cum s-a ajuns la net: brutul, ce s-a reținut, ce deduceri s-au aplicat.
// Componenta `src/components/payroll/fluturas.tsx` îl arată deja pe ecran —
// asta produce fișierul care se atașează la un e-mail.
//
// Un PDF per angajat, nu un document cu toți: fluturașul e o dată personală,
// iar un fișier care conține salariile tuturor nu se poate trimite nimănui.
import "server-only";

import {
  Cursor,
  deseneazaAntet,
  numeroteazaPaginile,
  pornesteDocument,
  ACCENT,
  GRI,
  LATIME_A4,
  MARGINE,
  type AntetOrganizatie,
} from "./document";
import { numeLuna } from "./stat-plata";

export interface LinieFluturas {
  readonly eticheta: string;
  readonly valoare: number;
  /** Rândurile de total se scriu aldin, cu linie deasupra. */
  readonly total?: boolean;
  /** Reținerile se scriu cu semnul minus, ca să se vadă că scad. */
  readonly scade?: boolean;
}

export interface ParametriFluturas {
  readonly organizatie: AntetOrganizatie;
  readonly an: number;
  readonly luna: number;
  readonly angajatNume: string;
  readonly angajatMarca: string;
  readonly functie: string | null;
  readonly zileLucratoareLuna: number;
  readonly zileLucrate: number;
  readonly zileConcediuOdihna: number;
  readonly zileConcediuMedical: number;
  readonly oreLucrate: number;
  readonly oreSuplimentare: number;
  readonly oreNoapte: number;
  readonly castiguri: readonly LinieFluturas[];
  readonly retineri: readonly LinieFluturas[];
  readonly restDePlata: number;
  readonly avertismente: readonly string[];
  readonly generatLa: string;
}

function lei(valoare: number): string {
  return new Intl.NumberFormat("ro-RO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(valoare);
}

const X_VALOARE = LATIME_A4 - MARGINE;

function deseneazaSectiune(cursor: Cursor, titlu: string, linii: readonly LinieFluturas[]): void {
  if (linii.length === 0) return;
  cursor.asiguraSpatiu(30 + linii.length * 14);
  cursor.text(titlu, { marime: 9, aldin: true, culoare: ACCENT, coboaraCu: 6 });
  cursor.linie();
  cursor.coboara(13);

  for (const linie of linii) {
    if (linie.total === true) {
      cursor.coboara(2);
      cursor.linie();
      cursor.coboara(12);
    }
    cursor.text(cursor.trunchiaza(linie.eticheta, 300, 9, linie.total === true), {
      marime: 9,
      aldin: linie.total === true,
    });
    const semn = linie.scade === true && linie.valoare > 0 ? "−" : "";
    cursor.textDreapta(`${semn}${lei(linie.valoare)} lei`, X_VALOARE, {
      marime: 9,
      aldin: linie.total === true,
    });
    cursor.coboara(14);
  }
  cursor.coboara(8);
}

export async function genereazaFluturas(parametri: ParametriFluturas): Promise<Uint8Array> {
  const titlu = `Fluturaș ${numeLuna(parametri.luna)} ${String(parametri.an)} — ${parametri.angajatNume}`;
  const context = await pornesteDocument(titlu, parametri.organizatie.denumire);
  const cursor = new Cursor(context);

  deseneazaAntet(
    cursor,
    parametri.organizatie,
    "FLUTURAȘ DE SALARIU",
    `${numeLuna(parametri.luna)} ${String(parametri.an)}`,
  );

  // Identificarea salariatului.
  cursor.text(parametri.angajatNume, { marime: 11, aldin: true, coboaraCu: 13 });
  const identificare = [
    `Marca ${parametri.angajatMarca}`,
    parametri.functie === null ? null : parametri.functie,
  ].filter((v): v is string => v !== null);
  cursor.text(identificare.join(" · "), { marime: 8, culoare: GRI, coboaraCu: 22 });

  // Timpul lucrat — baza tuturor cifrelor de mai jos.
  cursor.text("TIMP LUCRAT", { marime: 9, aldin: true, culoare: ACCENT, coboaraCu: 6 });
  cursor.linie();
  cursor.coboara(13);
  const timp: readonly (readonly [string, string])[] = [
    ["Zile lucrătoare în lună", String(parametri.zileLucratoareLuna)],
    ["Zile lucrate", String(parametri.zileLucrate)],
    ["Zile concediu de odihnă", String(parametri.zileConcediuOdihna)],
    ["Zile concediu medical", String(parametri.zileConcediuMedical)],
    ["Ore lucrate", String(parametri.oreLucrate)],
    ["Ore suplimentare", String(parametri.oreSuplimentare)],
    ["Ore de noapte", String(parametri.oreNoapte)],
  ];
  for (const [eticheta, valoare] of timp) {
    cursor.text(eticheta, { marime: 9 });
    cursor.textDreapta(valoare, X_VALOARE, { marime: 9 });
    cursor.coboara(14);
  }
  cursor.coboara(8);

  deseneazaSectiune(cursor, "CÂȘTIGURI", parametri.castiguri);
  deseneazaSectiune(cursor, "REȚINERI ȘI CONTRIBUȚII", parametri.retineri);

  // Restul de plată — cifra pe care angajatul o caută prima.
  cursor.asiguraSpatiu(46);
  cursor.linie({ grosime: 1, culoare: ACCENT });
  cursor.coboara(17);
  cursor.text("REST DE PLATĂ", { marime: 11, aldin: true });
  cursor.textDreapta(`${lei(parametri.restDePlata)} lei`, X_VALOARE, { marime: 11, aldin: true });
  cursor.coboara(24);

  if (parametri.avertismente.length > 0) {
    cursor.asiguraSpatiu(20 + parametri.avertismente.length * 12);
    cursor.text("Observații la calcul", { marime: 8, aldin: true, culoare: GRI, coboaraCu: 12 });
    for (const avertisment of parametri.avertismente) {
      cursor.text(`• ${cursor.trunchiaza(avertisment, cursor.latimeUtila - 10, 7)}`, {
        marime: 7,
        culoare: GRI,
        coboaraCu: 11,
      });
    }
    cursor.coboara(8);
  }

  cursor.asiguraSpatiu(30);
  cursor.text(`Document generat la ${parametri.generatLa}.`, {
    marime: 7,
    culoare: GRI,
    coboaraCu: 10,
  });
  cursor.text(
    "Sumele sunt exprimate în lei. Pentru lămuriri asupra calculului, adresați-vă departamentului de resurse umane.",
    { marime: 7, culoare: GRI },
  );

  numeroteazaPaginile(context, `Fluturaș ${numeLuna(parametri.luna)} ${String(parametri.an)}`);
  return context.doc.save();
}
