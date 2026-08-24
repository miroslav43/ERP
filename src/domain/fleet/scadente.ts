// src/domain/fleet/scadente.ts

/**
 * Semaforul de scadență al flotei: ITP, RCA, rovinietă, asigurare CASCO,
 * licență de transport. Funcții pure, fără I/O — apelantul aduce rândurile deja
 * citite din `vehicle_documents`, aici se decide doar treapta.
 *
 * Logica stătea până acum în `src/app/(app)/flota/etichete.ts`, adică într-un
 * fișier de rută, lângă hărțile de culori — deci netestabilă și invizibilă
 * pentru portal, care importă același `etichete.ts`. Mutarea e decizia B1 din
 * `docs/design/redesign/0-decizii-de-pornire.md`; fișierul de rută păstrează
 * doar maparea treaptă → etichetă și ton.
 *
 * ── DE CE PRAGUL E 30, NU 15 CA LA MENTENANȚĂ ─────────────────────────────
 * ITP-ul, RCA-ul și asigurarea se reînnoiesc LA UN TERȚ, cu drum și cu termen
 * de eliberare — aceeași natură ca documentele SSM, deci același preaviz.
 * Mentenanța, în schimb, se programează în graficul echipei și se prinde în
 * două săptămâni. Preavizul măsoară timpul până la acțiune, iar acțiunile sunt
 * de naturi diferite. Numele constantei o spune de-acum explicit: cele trei
 * praguri se numeau toate `PRAG_AVERTIZARE_ZILE`, în 8 fișiere.
 *
 * ── DE CE `lipsa` E MAI GRAVĂ DECÂT `expirat` ─────────────────────────────
 * Un document care nu există deloc nu are nicio dată de la care să se numere,
 * deci nu se va aprinde NICIODATĂ singur în „expiră curând”. Un RCA absent
 * rămâne absent tăcut până când îl vede cineva pe listă. Cazul e real în baza
 * de producție: există vehicule fără niciun document înregistrat.
 */

/** Câte zile înainte de expirare scadența devine „curând”. */
export const PRAG_FLOTA_AVERTIZARE_ZILE = 30;

/**
 * Vocabularul flotei — patru dintre cele șase trepte unificate, cu aceleași
 * nume. Flota nu produce niciodată `critic` (n-are al doilea prag) și nici
 * `neaplicabil` (orice document de vehicul are termen). O treaptă neatinsă nu
 * strică nimic; o treaptă lipsă ar fi obligat modulul să mintă.
 */
export type StareScadentaFlota = "expirat" | "curand" | "in_regula" | "lipsa";

const RANG: Readonly<Record<StareScadentaFlota, number>> = {
  in_regula: 1,
  curand: 2,
  expirat: 4,
  lipsa: 5,
};

/**
 * Starea unei scadențe, comparând DOAR șiruri de zile calendaristice.
 *
 * `expira_la` e `date` în Postgres, deci vine ca „2026-12-01”. Convertit în
 * `Date`, ar deveni miezul nopții UTC, iar în București asta e deja ziua
 * precedentă la ora 02:00 — un document care expiră azi ar apărea expirat de
 * ieri. Comparația lexicografică pe ISO e exactă și nu are fus orar.
 *
 * @param expiraLa `vehicle_documents.expira_la`, sau `null` dacă documentul nu
 *   există deloc. În flotă `null` NU înseamnă „nu expiră” — înseamnă „lipsește”.
 * @param azi Ziua curentă (Europe/Bucharest), din `todayInBucharest()`.
 */
export function stareScadentaFlota(expiraLa: string | null, azi: string): StareScadentaFlota {
  if (expiraLa === null) return "lipsa";
  if (expiraLa < azi) return "expirat";

  const prag = new Date(`${azi}T00:00:00Z`);
  prag.setUTCDate(prag.getUTCDate() + PRAG_FLOTA_AVERTIZARE_ZILE);
  const pragText = prag.toISOString().slice(0, 10);

  return expiraLa <= pragText ? "curand" : "in_regula";
}

/**
 * Starea unui vehicul întreg: cea mai gravă dintre scadențele documentelor lui
 * obligatorii.
 *
 * Lista GOALĂ întoarce `lipsa`, nu `in_regula`. Un vehicul fără niciun document
 * înregistrat e cazul cel mai grav, nu cel mai liniștit: nu are de unde să
 * numere, deci n-ar urca niciodată singur nicio treaptă. Un `Math.min` peste
 * date, sau un `.some(expirat)` peste o listă goală, l-ar fi arătat verde la
 * nesfârșit.
 *
 * @param expirari Câte o intrare pentru fiecare document OBLIGATORIU al
 *   vehiculului: data lui de expirare, sau `null` dacă documentul lipsește.
 */
export function stareScadentaVehicul(
  expirari: readonly (string | null)[],
  azi: string,
): StareScadentaFlota {
  if (expirari.length === 0) return "lipsa";

  return expirari.reduce<StareScadentaFlota>((ceaMaiGrava, expiraLa) => {
    const stare = stareScadentaFlota(expiraLa, azi);
    return RANG[stare] > RANG[ceaMaiGrava] ? stare : ceaMaiGrava;
  }, "in_regula");
}
