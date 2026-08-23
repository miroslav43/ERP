// src/components/ui/scadenta.tsx
import { AlertTriangle, Check, CircleSlash, Clock, Minus, OctagonAlert } from "lucide-react";
import type { ReactElement, ReactNode } from "react";

import { cn } from "@/lib/ui/cn";

/**
 * Pastila de scadență — una singură pentru SSM, mentenanță și flotă.
 *
 * Până aici, cele trei module aveau TREI vocabulare pentru același înțeles:
 * `niciodata·expirat·critic·atentie·ok` (SSM),
 * `in_intarziere·scadenta_apropiata·in_regula·fara_scadenta` (mentenanță),
 * `expirat·curand·in_regula·lipsa` (flotă). Treisprezece stări, trei perechi de
 * hărți `ETICHETE_*`/`TONURI_*`, 13 locuri de randare în 11 fișiere — plus un
 * `PRAG_AVERTIZARE_ZILE` scris de trei ori, cu ACELAȘI nume și două valori.
 * Vocabularul se unifică în șase trepte; valorile pragurilor rămân diferite și
 * își iau nume care nu se mai pot confunda
 * (`docs/design/redesign/0-decizii-de-pornire.md` §B1).
 *
 * ── REGULA CARE FACE COMPONENTA POSIBILĂ: `null` NU SE GHICEȘTE ───────────
 * Același `expiraLa === null` înseamnă trei severități incompatibile: în SSM
 * „nu expiră niciodată, odată efectuat” (fără niciun semnal), în mentenanță
 * „fără scadență” (neutru, sub «în regulă»), în flotă „documentul lipsește”
 * (mai grav decât expirat). O primitivă cu un singur comportament implicit
 * pentru `null` ar fi schimbat TĂCUT severitatea în două module din trei —
 * asta, nu numărul 30 sau 15, era capcana.
 *
 * De aceea `treapta` vine ca prop, calculată de domeniul apelantului
 * (`@/domain/ssm/scadente`, `@/domain/maintenance/scadente`,
 * `@/domain/fleet/scadente`), iar ajutorul `treaptaDinScadenta` de mai jos NU
 * are valoare implicită pentru `null`: `laNull` e obligatoriu și intră în tipul
 * rezultatului.
 *
 * ── DE CE FIECARE TREAPTĂ ARE PICTOGRAMA EI ───────────────────────────────
 * `expirat` și `lipsa` sunt amândouă roșii, `curand` și `critic` amândouă
 * chihlimbar. Fără o formă proprie, patru trepte din șase ar fi arătat identic
 * pe o listă tipărită alb-negru și pentru cine nu distinge roșul de verde
 * (WCAG 1.4.1). Forma e a doua marcă, cuvântul e a treia. `neaplicabil`
 * primește o linie — a doua marcă, dar niciun semnal de alarmă: „nu e cazul”
 * nu e o problemă de rezolvat.
 *
 * Contrastele sunt calculate pe tokenii din `globals.css`, nu estimate — pe
 * crem (`--color-background`) și pe rândul la hover (`--color-surface`):
 * cerneala 14,93:1 / 13,67:1, cerneala stinsă 5,55 / 5,08, roșul 6,11 / 5,60.
 * Chihlimbarul dă 3,40 / 3,12, deci nu atinge NICIODATĂ textul; rămâne al
 * pictogramei, unde pragul e 3:1 (WCAG 1.4.11) și trece în ambele stări.
 * Auriul nu apare deloc: 2,26:1.
 *
 * Fișierul n-are `"use client"` și nu are ce căuta: nicio stare, niciun efect,
 * niciun handler. Se compilează în graful care îl importă, deci cele 94 de
 * pagini Server Component din `(app)` îl folosesc fără nicio graniță.
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

/** Cerneala pastilei. Chihlimbarul lipsește deliberat — vezi contrastele de sus. */
const TEXT: Readonly<Record<TreaptaScadenta, string>> = {
  neaplicabil: "text-muted-foreground",
  in_regula: "text-foreground",
  curand: "text-foreground",
  critic: "text-foreground",
  expirat: "text-danger",
  lipsa: "text-danger",
};

const CULOARE_PICTOGRAMA: Readonly<Record<TreaptaScadenta, string>> = {
  neaplicabil: "text-muted-foreground",
  in_regula: "text-success",
  curand: "text-warning",
  critic: "text-warning",
  expirat: "text-danger",
  lipsa: "text-danger",
};

/**
 * Șase forme distincte, una per treaptă — nu șase culori. Octogonul („stop”) și
 * cercul tăiat („nu există”) sunt amândouă roșii, dar nu se confundă nici la
 * imprimantă; ceasul și triunghiul separă „se apropie” de „e pe muchie”.
 */
const PICTOGRAMA = {
  neaplicabil: Minus,
  in_regula: Check,
  curand: Clock,
  critic: AlertTriangle,
  expirat: OctagonAlert,
  lipsa: CircleSlash,
} as const;

export type PropsScadenta = Readonly<{
  treapta: TreaptaScadenta;
  /**
   * Textul, compus de apelant: „Expiră în 12 zile”, „Expirat de 3 zile”,
   * „Niciodată efectuată”. Trei propoziții pot împărți aceeași treaptă, iar
   * marketingul bilingv importă aceleași primitive — deci pastila nu-și scrie
   * niciodată singură conținutul.
   */
  children: ReactNode;
  className?: string;
}>;

export function Scadenta({ treapta, children, className }: PropsScadenta): ReactElement {
  const Pictograma = PICTOGRAMA[treapta];

  return (
    // `data-treapta` rămâne în DOM ca să se poată verifica severitatea din
    // afară — test sau Playwright — fără să se citească o culoare, și ca o
    // foaie de tipar să poată prinde treapta pe care cerneala o pierde.
    <span
      data-treapta={treapta}
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap",
        "border-foreground/30 rounded-full border px-2 py-0.5",
        "text-nota font-medium",
        TEXT[treapta],
        className,
      )}
    >
      <Pictograma
        aria-hidden="true"
        className={cn("size-3 shrink-0", CULOARE_PICTOGRAMA[treapta])}
      />
      {children}
    </span>
  );
}
