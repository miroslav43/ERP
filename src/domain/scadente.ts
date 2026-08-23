// src/domain/scadente.ts

/**
 * Vocabularul comun al scadențelor — cele șase trepte și ordinea lor.
 *
 * ── DE CE E ÎN `domain/`, NU ÎN `components/ui/` ──────────────────────────
 * Aici a stat mai întâi, greșit, lângă componentă. Consecința a apărut imediat
 * ce au fost migrate ecranele: șase pagini SSM și două de mentenanță importau
 * `type TreaptaScadenta` din `@/components/ui/scadenta` ca să exprime o regulă
 * de DOMENIU — „o instruire pe care angajatul n-a făcut-o niciodată e mai gravă
 * decât una expirată". Săgeata de dependență arăta invers: regula de afaceri
 * atârna de stratul de desen.
 *
 * Treptele sunt un vocabular de afaceri. Pastila e doar felul în care se văd.
 * Modulul ăsta n-are React, n-are Supabase și n-are clase CSS, deci se poate
 * testa în milisecunde și se poate folosi și acolo unde nu se desenează nimic —
 * într-un contor de panou, într-un export, într-un e-mail.
 *
 * ── DE CE `treaptaDinScadenta` CERE `laNull` ──────────────────────────────
 * Fiindcă `null` înseamnă lucruri DIFERITE în cele trei module: la SSM „tipul
 * n-are periodicitate legală, deci nu expiră niciodată" (`neaplicabil`), la
 * mentenanță neutru (`neaplicabil`), la flotă GRAV (`lipsa`) — vehiculul fără
 * niciun document n-are dată de la care să numere, deci nu se aprinde niciodată
 * singur. Un implicit unic ar fi schimbat tăcut severitatea în două module din
 * trei. Decizia e scrisă integral în `docs/design/redesign/0-decizii-de-pornire.md`, §B1.
 */

export type TreaptaScadenta =
  "neaplicabil" | "in_regula" | "curand" | "critic" | "expirat" | "lipsa";

/**
 * Rangul de gravitate, 0…5. Singurul loc din proiect care ordonează treptele.
 *
 * `lipsa` e DEASUPRA lui `expirat`, iar motivul e scris de mult în
 * `src/domain/ssm/scadente.ts`: „un tip de instruire obligatoriu pe care
 * angajatul nu l-a făcut NICIODATĂ e mai grav decât unul expirat de curând —
 * nu există măcar un istoric, deci nu se poate calcula o scadență.” Același
 * lucru e adevărat pentru un vehicul fără niciun document: nu are dată de la
 * care să numere, deci nu se va aprinde niciodată singur, oricât ar trece.
 * Cazul e real în baza de producție, nu ipotetic.
 */
export const RANG_SCADENTA: Readonly<Record<TreaptaScadenta, number>> = {
  neaplicabil: 0,
  in_regula: 1,
  curand: 2,
  critic: 3,
  expirat: 4,
  lipsa: 5,
};

/**
 * Cea mai gravă dintre două trepte — pentru entitățile cu mai multe scadențe
 * deodată (un vehicul cu ITP, RCA și rovinietă; un plan cu zile și contor).
 */
export function maiGravaScadenta(a: TreaptaScadenta, b: TreaptaScadenta): TreaptaScadenta {
  return RANG_SCADENTA[a] >= RANG_SCADENTA[b] ? a : b;
}

/**
 * Treptele care se pot deduce DINTR-O DATĂ. `neaplicabil` și `lipsa` nu sunt
 * aici, fiindcă niciuna nu se citește dintr-un calendar: prima e o proprietate
 * a tipului de document, a doua e absența înregistrării.
 */
export type TreaptaCalculabila = Extract<
  TreaptaScadenta,
  "in_regula" | "curand" | "critic" | "expirat"
>;

export type PraguriScadenta<T extends TreaptaScadenta> = Readonly<{
  /** Câte zile înainte de termen treapta devine `curand`. */
  avertizareZile: number;
  /** Pragul `critic`, dacă domeniul are unul. SSM da (7), flota și mentenanța nu. */
  criticZile?: number;
  /**
   * Ce înseamnă `null` ÎN DOMENIUL APELANTULUI. Obligatoriu și fără implicit:
   * exact aici s-ar fi strecurat tăcut severitatea greșită.
   */
  laNull: T;
}>;

/**
 * Treapta unei scadențe exprimate ca zi calendaristică (`date` în Postgres,
 * `"2026-12-01"` în TypeScript).
 *
 * Verificarea „a trecut?” e o comparație LEXICOGRAFICĂ pe ISO, deliberat: un
 * `new Date("2026-12-01")` înseamnă miezul nopții UTC, iar în București asta
 * cade deja în ziua precedentă — un document care expiră azi ar apărea expirat
 * de ieri. Numărul de zile rămase se calculează prin `Date.UTC` pe ambele
 * capete, deci fusul se simplifică și rămâne doar diferența.
 *
 * Ajutorul e pentru locurile care n-au decât o dată și un prag. Domeniile își
 * păstrează funcțiile proprii, fiindcă poartă reguli pe care o dată nu le
 * poate exprima: `areInregistrare` la SSM, scadența pe contor la mentenanță.
 */
export function treaptaDinScadenta<T extends TreaptaScadenta>(
  expiraLa: string | null,
  azi: string,
  praguri: PraguriScadenta<T>,
): TreaptaCalculabila | T {
  if (expiraLa === null) return praguri.laNull;
  if (expiraLa < azi) return "expirat";

  const zileRamase = zileIntre(azi, expiraLa);
  if (praguri.criticZile !== undefined && zileRamase <= praguri.criticZile) return "critic";
  if (zileRamase <= praguri.avertizareZile) return "curand";
  return "in_regula";
}

function zileIntre(azi: string, data: string): number {
  const [aY, aM, aD] = azi.split("-").map(Number);
  const [dY, dM, dD] = data.split("-").map(Number);
  const msAzi = Date.UTC(aY ?? 0, (aM ?? 1) - 1, aD ?? 1);
  const msData = Date.UTC(dY ?? 0, (dM ?? 1) - 1, dD ?? 1);
  return Math.round((msData - msAzi) / 86_400_000);
}
