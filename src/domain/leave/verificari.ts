// src/domain/leave/verificari.ts

/**
 * Interval de concediu simplu, folosit doar pentru comparații de date —
 * fără stare de bază de date (fără id, status etc.).
 */
export interface IntervalConcediu {
  readonly dataInceput: Date;
  readonly dataSfarsit: Date;
}

function valideazaInterval(interval: IntervalConcediu, etichetaEroare: string): void {
  if (interval.dataSfarsit.getTime() < interval.dataInceput.getTime()) {
    throw new RangeError(`${etichetaEroare}: data de sfârșit este anterioară datei de început.`);
  }
}

function seSuprapun(a: IntervalConcediu, b: IntervalConcediu): boolean {
  return (
    a.dataInceput.getTime() <= b.dataSfarsit.getTime() &&
    b.dataInceput.getTime() <= a.dataSfarsit.getTime()
  );
}

/**
 * Verifică dacă intervalul unei cereri noi se suprapune cu oricare dintre
 * intervalele deja existente (comparație de interval închis, echivalentă
 * cu `daterange(..., '[]')` din constrângerea EXCLUDE a tabelei
 * `leave_requests`).
 *
 * Apelantul e responsabil să filtreze `cereriExistente` la statusurile
 * relevante (trimisă / în aprobare / aprobată) și să excludă tipurile de
 * concediu care „întrerup” alte concedii (medical, maternitate) — exact
 * cum face predicatul `where` al constrângerii din baza de date.
 */
export function verificaSuprapunere(
  cerereNoua: IntervalConcediu,
  cereriExistente: readonly IntervalConcediu[],
): boolean {
  valideazaInterval(cerereNoua, "Intervalul cererii noi este invalid");
  return cereriExistente.some((existenta) => seSuprapun(cerereNoua, existenta));
}

export interface RezultatVerificareSold {
  /** true dacă soldul disponibil acoperă zilele solicitate. */
  readonly areSoldSuficient: boolean;
  /** Zilele care lipsesc din sold; 0 dacă soldul e suficient. */
  readonly zileLipsa: number;
}

/**
 * Compară zilele solicitate cu soldul disponibil (`leave_balances.ramase`).
 * Nu decide DACĂ tipul de concediu scade din sold — asta ține de
 * `leave_types.scade_din_sold` și e responsabilitatea apelantului.
 */
export function verificaSold(
  zileSolicitate: number,
  zileDisponibile: number,
): RezultatVerificareSold {
  if (!Number.isFinite(zileSolicitate) || zileSolicitate < 0) {
    throw new RangeError("Numărul de zile solicitate nu poate fi negativ.");
  }
  const diferenta = Math.round((zileSolicitate - zileDisponibile) * 100) / 100;
  const zileLipsa = diferenta > 0 ? diferenta : 0;
  return { areSoldSuficient: zileLipsa === 0, zileLipsa };
}

export interface RezultatVerificarePlafon {
  /** true dacă plafonul anual acoperă zilele deja consumate plus cele cerute. */
  readonly seIncadreaza: boolean;
  /** Zilele cu care cererea depășește plafonul; 0 dacă se încadrează. */
  readonly zileDepasire: number;
  /** Ce ar mai fi rămas disponibil după cerere; 0 dacă plafonul e depășit. */
  readonly zileRamase: number;
}

/**
 * Plafonul anual legal al unui tip de concediu (`leave_types.plafon_anual_zile`).
 *
 * Nu e același lucru cu soldul, și de-aia are funcție proprie. `scade_din_sold`
 * înseamnă „consumă dreptul acumulat lunar, reportabil în anul următor" — adevărat
 * DOAR pentru concediul de odihnă. Plafonul înseamnă „legea nu-ți dă mai mult de
 * atât într-un an", și e adevărat pentru concediul paternal (10 zile), cel de
 * îngrijitor (5 zile), cel de căsătorie și celelalte.
 *
 * Până în 0064 cele două erau confundate într-o singură coloană, iar consecința
 * era că NOUĂ tipuri din zece nu aveau nicio limită: `zile_implicite` era text
 * decorativ, iar o cerere de 300 de zile de concediu paternal trecea fără o vorbă.
 *
 * `plafonAnual = null` înseamnă „fără plafon" — concediul medical, a cărui durată
 * o decide medicul prin certificat, și cel fără plată, negociat între părți.
 */
export function verificaPlafonAnual(
  zileSolicitate: number,
  zileDejaConsumate: number,
  plafonAnual: number | null,
): RezultatVerificarePlafon {
  if (!Number.isFinite(zileSolicitate) || zileSolicitate < 0) {
    throw new RangeError("Numărul de zile solicitate nu poate fi negativ.");
  }
  if (!Number.isFinite(zileDejaConsumate) || zileDejaConsumate < 0) {
    throw new RangeError("Numărul de zile deja consumate nu poate fi negativ.");
  }
  if (plafonAnual === null) {
    return { seIncadreaza: true, zileDepasire: 0, zileRamase: Number.POSITIVE_INFINITY };
  }
  const total = Math.round((zileDejaConsumate + zileSolicitate) * 100) / 100;
  const diferenta = Math.round((total - plafonAnual) * 100) / 100;
  return diferenta > 0
    ? { seIncadreaza: false, zileDepasire: diferenta, zileRamase: 0 }
    : { seIncadreaza: true, zileDepasire: 0, zileRamase: Math.abs(diferenta) };
}

export interface CerereEchipa extends IntervalConcediu {
  readonly angajatId: string;
}

function acopera(interval: IntervalConcediu, ziua: Date): boolean {
  return (
    interval.dataInceput.getTime() <= ziua.getTime() &&
    ziua.getTime() <= interval.dataSfarsit.getTime()
  );
}

function normalizeazaZi(data: Date): Date {
  return new Date(Date.UTC(data.getUTCFullYear(), data.getUTCMonth(), data.getUTCDate()));
}

function adaugaOZi(data: Date): Date {
  return new Date(Date.UTC(data.getUTCFullYear(), data.getUTCMonth(), data.getUTCDate() + 1));
}

/**
 * Verifică dacă aprobarea cererii noi ar duce numărul de absenți simultani
 * din aceeași echipă peste pragul acceptat, în oricare zi a intervalului
 * cerut. `cereriEchipa` conține DOAR cererile deja aprobate/în aprobare
 * ale colegilor din aceeași echipă/departament — filtrarea după echipă e
 * responsabilitatea apelantului, funcția aici doar numără suprapunerile
 * pe zi.
 *
 * Întoarce `true` dacă există conflict (pragul e depășit în cel puțin o zi).
 */
export function conflictDeEchipa(
  cerereNoua: IntervalConcediu,
  cereriEchipa: readonly CerereEchipa[],
  pragMaximSimultan: number,
): boolean {
  valideazaInterval(cerereNoua, "Intervalul cererii noi este invalid");
  if (!Number.isInteger(pragMaximSimultan) || pragMaximSimultan < 1) {
    throw new RangeError(
      "Pragul maxim de absențe simultane trebuie să fie un număr întreg de cel puțin 1.",
    );
  }

  let ziua = normalizeazaZi(cerereNoua.dataInceput);
  const limita = normalizeazaZi(cerereNoua.dataSfarsit);

  while (ziua.getTime() <= limita.getTime()) {
    const numarAbsenti = cereriEchipa.filter((cerere) => acopera(cerere, ziua)).length + 1;
    if (numarAbsenti > pragMaximSimultan) {
      return true;
    }
    ziua = adaugaOZi(ziua);
  }
  return false;
}
