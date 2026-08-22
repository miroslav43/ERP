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
