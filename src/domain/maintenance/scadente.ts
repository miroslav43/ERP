// src/domain/maintenance/scadente.ts
/**
 * Semaforul de scadență al mentenanței. Funcții pure, fără I/O — apelantul
 * aduce datele deja citite din `maintenance_plans` / `iscir_authorizations` /
 * `equipment_meters`, aici se decide doar culoarea.
 *
 * Un plan de mentenanță poate avea scadență pe ZILE (`urmatoarea_scadenta`),
 * pe CONTOR (`urmatoarea_scadenta_contor`) sau pe amândouă deodată — vezi
 * `maintenance_plans_periodicitate_ck` din 0011_ssm.sql, care cere cel puțin
 * una. Starea finală a planului este cea mai gravă dintre cele două.
 */

import type { TreaptaScadenta } from "@/domain/scadente";

export type StareScadentaMentenanta =
  "in_intarziere" | "scadenta_apropiata" | "in_regula" | "fara_scadenta";

/**
 * Câte zile înainte de scadență starea devine „apropiată”.
 *
 * Cincisprezece, nu treizeci ca la SSM și la flotă, iar diferența nu e o
 * scăpare: mentenanța se PROGRAMEAZĂ, nu se reînnoiește. O revizie se prinde în
 * graficul echipei în două săptămâni; o autorizație se reînnoiește la o
 * instituție, cu drum și termen de eliberare. Preavizul măsoară timpul până la
 * acțiune, iar acțiunile sunt de naturi diferite (decizia B1 din
 * `docs/design/redesign/0-decizii-de-pornire.md`, care i-a dat și numele cu
 * domeniu în față — se numeau toate trei `PRAG_AVERTIZARE_ZILE`).
 */
export const PRAG_MENTENANTA_AVERTIZARE_ZILE = 15;

/**
 * Cota din periodicitatea contorului sub care starea devine „apropiată”.
 * Ex.: periodicitate de 500 ore ⇒ avertizare cu 50 de ore înainte.
 */
export const COTA_AVERTIZARE_CONTOR = 0.1;

/** Prag absolut folosit când periodicitatea contorului nu e cunoscută. */
export const PRAG_AVERTIZARE_CONTOR_IMPLICIT = 50;

const RANG: Readonly<Record<StareScadentaMentenanta, number>> = {
  fara_scadenta: 0,
  in_regula: 1,
  scadenta_apropiata: 2,
  in_intarziere: 3,
};

/** Cea mai gravă dintre două stări — folosită la combinarea zile+contor. */
export function maiGravaDintre(
  a: StareScadentaMentenanta,
  b: StareScadentaMentenanta,
): StareScadentaMentenanta {
  return RANG[a] >= RANG[b] ? a : b;
}

/**
 * Starea unei scadențe exprimate ca dată calendaristică (`date` în Postgres,
 * `"2026-12-01"` în TypeScript). Comparație lexicografică pe ISO, deliberat:
 * un `Date` ar interpreta miezul nopții ca UTC, iar în București asta cade
 * deja în ziua precedentă — un plan scadent azi ar apărea „în întârziere”
 * de ieri. Vezi aceeași observație în `@/domain/fleet/scadente`.
 */
export function stareScadentaData(
  data: string | null,
  azi: string,
  pragZile: number = PRAG_MENTENANTA_AVERTIZARE_ZILE,
): StareScadentaMentenanta {
  if (data === null) return "fara_scadenta";
  if (data < azi) return "in_intarziere";

  const limita = new Date(`${azi}T00:00:00Z`);
  limita.setUTCDate(limita.getUTCDate() + pragZile);
  const limitaText = limita.toISOString().slice(0, 10);

  return data <= limitaText ? "scadenta_apropiata" : "in_regula";
}

export interface IntrareScadentaContor {
  /** `maintenance_plans.urmatoarea_scadenta_contor`. */
  readonly urmatoareaScadentaContor: number | null;
  /** `maintenance_plans.periodicitate_contor` — folosită pentru pragul de avertizare. */
  readonly periodicitateContor: number | null;
  /** Ultima citire cunoscută a contorului relevant (`tip_contor`) pentru echipament. */
  readonly ultimaCitireContor: number | null;
}

/**
 * Starea unei scadențe exprimate în unități de contor (ore, km, cicluri).
 * Fără scadență de contor sau fără nicio citire încă, „fara_scadenta” — nu
 * putem ști cât a mai rămas dacă nu știm de unde se pornește.
 */
export function stareScadentaContor(intrare: IntrareScadentaContor): StareScadentaMentenanta {
  const { urmatoareaScadentaContor, periodicitateContor, ultimaCitireContor } = intrare;
  if (urmatoareaScadentaContor === null || ultimaCitireContor === null) return "fara_scadenta";

  const ramas = urmatoareaScadentaContor - ultimaCitireContor;
  if (ramas <= 0) return "in_intarziere";

  const prag =
    periodicitateContor !== null && periodicitateContor > 0
      ? periodicitateContor * COTA_AVERTIZARE_CONTOR
      : PRAG_AVERTIZARE_CONTOR_IMPLICIT;

  return ramas <= prag ? "scadenta_apropiata" : "in_regula";
}

export interface IntrareScadentaPlan extends IntrareScadentaContor {
  /** `maintenance_plans.urmatoarea_scadenta`. */
  readonly urmatoareaScadenta: string | null;
}

/**
 * Starea combinată a unui plan de mentenanță: cea mai gravă dintre scadența
 * pe zile și scadența pe contor, fiecare calculată independent.
 */
export function stareScadentaPlan(
  intrare: IntrareScadentaPlan,
  azi: string,
  pragZile: number = PRAG_MENTENANTA_AVERTIZARE_ZILE,
): StareScadentaMentenanta {
  const dinZile = stareScadentaData(intrare.urmatoareaScadenta, azi, pragZile);
  const dinContor = stareScadentaContor(intrare);
  return maiGravaDintre(dinZile, dinContor);
}

/**
 * Traducerea vocabularului de mentenanță în cele șase trepte comune.
 *
 * Era scrisă de mână în două fișiere de pagină. `fara_scadenta` devine
 * `neaplicabil` (rang 0), NU `lipsa`: un plan fără scadență calculată e neutru
 * — spre deosebire de flotă, unde absența documentelor e cazul cel mai grav.
 * Exact tipul de diferență pe care un implicit unic ar fi șters-o tăcut.
 */
export const TREPTE_MENTENANTA: Readonly<Record<StareScadentaMentenanta, TreaptaScadenta>> = {
  in_intarziere: "expirat",
  scadenta_apropiata: "curand",
  in_regula: "in_regula",
  fara_scadenta: "neaplicabil",
};
