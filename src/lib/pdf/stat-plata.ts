// src/lib/pdf/stat-plata.ts
// Statul de plată (statul de salarii) — documentul central al lunii.
//
// Detaliază, per angajat: zilele lucrate, brutul, contribuțiile reținute,
// impozitul, netul și restul de plată, plus totalurile pe organizație și costul
// total al angajatorului. Se întocmește lunar, se semnează de angajator și se
// arhivează. Când plata se face prin bancă, semnătura angajatului nu mai e
// obligatorie, dar statul trebuie să existe în contabilitate.
//
// Orientare LANDSCAPE: are unsprezece coloane de cifre. În portret, coloanele
// ar fi ajuns la 35 de puncte lățime, adică un nume trunchiat la trei litere.
import "server-only";

import {
  Cursor,
  deseneazaAntet,
  numeroteazaPaginile,
  pornesteDocument,
  ACCENT,
  GRI,
  INALTIME_A4,
  LATIME_A4,
  MARGINE,
  type AntetOrganizatie,
} from "./document";

/** Un rând de stat de plată — exact coloanele care apar pe hârtie. */
export interface RandStatPlata {
  readonly marca: string;
  readonly nume: string;
  readonly zileLucrate: number;
  readonly zileConcediu: number;
  readonly brut: number;
  readonly cas: number;
  readonly cass: number;
  readonly impozit: number;
  readonly net: number;
  readonly retineri: number;
  readonly restDePlata: number;
  readonly costAngajator: number;
}

export interface ParametriStatPlata {
  readonly organizatie: AntetOrganizatie;
  readonly an: number;
  readonly luna: number;
  readonly randuri: readonly RandStatPlata[];
  /** Numele celui care generează documentul — apare la rubrica de întocmire. */
  readonly intocmitDe: string;
  readonly generatLa: string;
}

const LUNI = [
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
  return LUNI[luna - 1] ?? String(luna);
}

/**
 * Sumele se scriu cu separator de mii și DOUĂ zecimale, în format românesc.
 *
 * `Intl.NumberFormat("ro-RO")` folosește spațiu îngust neîntrerupt (U+202F) ca
 * separator de mii — o glifă pe care fontul o are, dar care într-un PDF apare
 * ca spațiu normal la copiere. E acceptabil: cifrele rămân corecte.
 */
function lei(valoare: number): string {
  return new Intl.NumberFormat("ro-RO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(valoare);
}

function zile(valoare: number): string {
  return new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 2 }).format(valoare);
}

/**
 * Coloanele, cu poziția lor de capăt DREAPTA.
 *
 * Sumele se aliniază la dreapta, altfel cifrele nu se citesc pe verticală și
 * un stat de plată devine imposibil de verificat cu ochiul.
 */
const LATIME = INALTIME_A4; // landscape: A4 rotit
const X_MARCA = MARGINE;
const X_NUME = MARGINE + 48;
const X_DUPA_NUME = MARGINE + 200;
const COLOANE = [
  { titlu: "Zile lucr.", x: X_DUPA_NUME + 44 },
  { titlu: "Zile CO", x: X_DUPA_NUME + 92 },
  { titlu: "Brut", x: X_DUPA_NUME + 158 },
  { titlu: "CAS", x: X_DUPA_NUME + 218 },
  { titlu: "CASS", x: X_DUPA_NUME + 274 },
  { titlu: "Impozit", x: X_DUPA_NUME + 334 },
  { titlu: "Net", x: X_DUPA_NUME + 398 },
  { titlu: "Rețineri", x: X_DUPA_NUME + 458 },
  { titlu: "Rest plată", x: X_DUPA_NUME + 528 },
  { titlu: "Cost firmă", x: X_DUPA_NUME + 598 },
] as const;

function deseneazaCapTabel(cursor: Cursor): void {
  cursor.text("Marca", { x: X_MARCA, marime: 7, aldin: true, culoare: GRI });
  cursor.text("Nume și prenume", { x: X_NUME, marime: 7, aldin: true, culoare: GRI });
  for (const coloana of COLOANE) {
    cursor.textDreapta(coloana.titlu, coloana.x, { marime: 7, aldin: true, culoare: GRI });
  }
  cursor.coboara(6);
  cursor.linie({ grosime: 0.7, culoare: ACCENT });
  cursor.coboara(11);
}

export async function genereazaStatDePlata(parametri: ParametriStatPlata): Promise<Uint8Array> {
  const titlu = `Stat de plată ${numeLuna(parametri.luna)} ${String(parametri.an)}`;
  const context = await pornesteDocument(titlu, parametri.organizatie.denumire);
  const cursor = new Cursor(context, LATIME, LATIME_A4);

  deseneazaAntet(
    cursor,
    parametri.organizatie,
    "STAT DE PLATĂ",
    `Perioada: ${numeLuna(parametri.luna)} ${String(parametri.an)} · ${String(parametri.randuri.length)} salariați`,
  );

  deseneazaCapTabel(cursor);

  const totaluri = {
    brut: 0,
    cas: 0,
    cass: 0,
    impozit: 0,
    net: 0,
    retineri: 0,
    restDePlata: 0,
    costAngajator: 0,
  };

  for (const rand of parametri.randuri) {
    // 24 de puncte = rândul plus antetul redesenat, dacă se schimbă pagina.
    const inaltePagina = cursor.yCurent;
    cursor.asiguraSpatiu(24);
    if (cursor.yCurent > inaltePagina) deseneazaCapTabel(cursor);

    cursor.text(rand.marca, { x: X_MARCA, marime: 8 });
    cursor.text(cursor.trunchiaza(rand.nume, X_DUPA_NUME - X_NUME - 8, 8), {
      x: X_NUME,
      marime: 8,
    });

    const valori = [
      zile(rand.zileLucrate),
      zile(rand.zileConcediu),
      lei(rand.brut),
      lei(rand.cas),
      lei(rand.cass),
      lei(rand.impozit),
      lei(rand.net),
      lei(rand.retineri),
      lei(rand.restDePlata),
      lei(rand.costAngajator),
    ];
    valori.forEach((valoare, index) => {
      const coloana = COLOANE[index];
      if (coloana !== undefined) cursor.textDreapta(valoare, coloana.x, { marime: 8 });
    });

    totaluri.brut += rand.brut;
    totaluri.cas += rand.cas;
    totaluri.cass += rand.cass;
    totaluri.impozit += rand.impozit;
    totaluri.net += rand.net;
    totaluri.retineri += rand.retineri;
    totaluri.restDePlata += rand.restDePlata;
    totaluri.costAngajator += rand.costAngajator;

    cursor.coboara(13);
  }

  cursor.asiguraSpatiu(40);
  cursor.coboara(3);
  cursor.linie({ grosime: 0.7, culoare: ACCENT });
  cursor.coboara(13);
  cursor.text("TOTAL", { x: X_NUME, marime: 8, aldin: true });
  const totale = [
    "",
    "",
    lei(totaluri.brut),
    lei(totaluri.cas),
    lei(totaluri.cass),
    lei(totaluri.impozit),
    lei(totaluri.net),
    lei(totaluri.retineri),
    lei(totaluri.restDePlata),
    lei(totaluri.costAngajator),
  ];
  totale.forEach((valoare, index) => {
    const coloana = COLOANE[index];
    if (coloana !== undefined && valoare.length > 0) {
      cursor.textDreapta(valoare, coloana.x, { marime: 8, aldin: true });
    }
  });

  // Rubricile de semnătură. Statul se semnează de angajator și se arhivează;
  // semnătura salariatului nu mai e obligatorie când plata trece prin bancă.
  cursor.coboara(36);
  cursor.text(`Întocmit: ${parametri.intocmitDe}`, { marime: 8, coboaraCu: 13 });
  cursor.text(`Data întocmirii: ${parametri.generatLa}`, {
    marime: 8,
    culoare: GRI,
    coboaraCu: 26,
  });
  cursor.text("Aprobat (administrator): ______________________", { marime: 8, coboaraCu: 20 });
  cursor.text(
    "Plata se face prin virament bancar; semnătura salariatului pe stat nu este obligatorie.",
    { marime: 7, culoare: GRI },
  );

  numeroteazaPaginile(context, `${titlu} · ${parametri.organizatie.denumire}`);
  return context.doc.save();
}
