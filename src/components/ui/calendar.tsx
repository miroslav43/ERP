// src/components/ui/calendar.tsx
"use client";

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactElement } from "react";

import {
  adaugaZileIso,
  construiesteSaptamani,
  deplaseazaLuna,
  numarZileLuna,
  ziIso,
} from "@/domain/calendar/grila-lunara";
import { sarbatoriDupaZi } from "@/domain/calendar/sarbatori";
import { formatMonthYear, todayInBucharest, type DateString } from "@/lib/format/date";
import { cn } from "@/lib/ui/cn";

/**
 * Panoul de calendar. O lună pe ecran, o zi de ales.
 *
 * ── DE CE EXISTĂ ──────────────────────────────────────────────────────────
 * Aceeași fundătură ca la `<input type="time">`, documentată în
 * `intrare-ora.tsx`: selectorul nativ al lui `<input type="date">` își alege
 * limba după INTERFAȚA browserului, nu după `lang`-ul documentului. Pe un
 * Chrome în engleză, o aplicație românească afișa „August 2026”, capul de
 * săptămână `M T W T F S S` — cu duminica prima — și butoanele „Clear”/„Today”.
 * Nu există atribut, CSS sau opțiune care să schimbe ceva din toate astea.
 *
 * Ce se câștigă dincolo de limbă: weekendul hașurat și sărbătorile legale
 * marcate CHIAR ÎN CLIPA ALEGERII. Într-un ERP de HR asta nu e decor — cine
 * pune data de început a unui concediu vede pe loc că a nimerit peste Crăciun.
 *
 * ── DE CE UN `<table>` SIMPLU, FĂRĂ `role="grid"` ─────────────────────────
 * Un calendar CHIAR e un tabel: zilele au coloane care înseamnă ceva, iar
 * `<th scope="col">` face cititorul de ecran să anunțe „vineri, 14” fără niciun
 * ARIA scris de mână. `role="grid"` ar transforma `<td>` în `gridcell` și ar
 * cere modelul complet de navigare al unei grile de date — pe care oricum îl
 * implementăm cu butoane și tabindex rulant.
 *
 * ── TABINDEX RULANT ───────────────────────────────────────────────────────
 * O singură zi din panou e în ordinea de tabulare. Fără asta, Tab ar parcurge
 * treizeci și una de butoane înainte să iasă din calendar. Săgețile mută
 * cursorul, iar cursorul care iese din lună ADUCE luna următoare — altfel
 * capătul grilei ar fi un zid și 1 septembrie n-ar fi accesibil de la tastatură.
 *
 * ── DE CE `azi` E O PROPRIETATE ───────────────────────────────────────────
 * Ca să poată fi injectată în teste. O componentă care își citește singură
 * ceasul dă teste care încep să pice la miezul nopții — sau peste un an, când
 * „azi” nu mai e în luna scrisă în așteptare.
 */

/** Capul de săptămână, de luni până duminică. Scurt pe ecran, întreg pentru cititorul de ecran. */
const ZILE_SAPTAMANA: readonly (readonly [string, string])[] = [
  ["Lu", "luni"],
  ["Ma", "marți"],
  ["Mi", "miercuri"],
  ["Jo", "joi"],
  ["Vi", "vineri"],
  ["Sâ", "sâmbătă"],
  ["Du", "duminică"],
];

/** Indicii coloanelor de weekend, în săptămâna care începe luni. */
const COLOANE_WEEKEND = new Set([5, 6]);

/** Cât mută fiecare săgeată cursorul, în zile. */
const PAS_SAGEATA: Readonly<Record<string, number>> = {
  ArrowLeft: -1,
  ArrowRight: 1,
  ArrowUp: -7,
  ArrowDown: 7,
};

export type PropsCalendar = Readonly<{
  /** Ziua aleasă, ISO. `null` sau lipsă: niciuna. */
  valoare?: DateString | null | undefined;
  /** Prima zi selectabilă, ISO. Zilele dinainte apar stinse. */
  min?: DateString | undefined;
  /** Ultima zi selectabilă, ISO. Zilele de după apar stinse. */
  max?: DateString | undefined;
  /** Ziua considerată „azi”. Implicit ceasul României. */
  azi?: DateString | undefined;
  /** Primește ziua aleasă, ISO. */
  onAlege: (zi: DateString) => void;
  /** Chemat la Escape. Panoul nu se închide singur — părintele decide. */
  onInchide?: (() => void) | undefined;
  className?: string | undefined;
}>;

const clasaNavigare = cn(
  "rounded-control text-muted-foreground hover:text-foreground hover:bg-surface",
  "grid size-7 place-items-center transition-colors",
);

export function Calendar({
  valoare,
  min,
  max,
  azi,
  onAlege,
  onInchide,
  className,
}: PropsCalendar): ReactElement {
  const ziDeAzi = azi ?? todayInBucharest();
  const ancora = valoare ?? ziDeAzi;

  const [an, setAn] = useState(() => Number(ancora.slice(0, 4)));
  const [luna, setLuna] = useState(() => Number(ancora.slice(5, 7)));
  const [cursor, setCursor] = useState<DateString>(ancora);

  const refGrila = useRef<HTMLTableElement>(null);
  /*
    Focusul se mută în DOM numai după o TASTĂ, niciodată la randare. Fără
    steagul ăsta, panoul ar fura focusul din pagină de fiecare dată când
    părintele se re-randează — inclusiv pe un formular pe care omul tocmai
    scrie în alt câmp.
  */
  const cereFocus = useRef(false);

  useEffect(() => {
    if (!cereFocus.current) return;
    cereFocus.current = false;
    refGrila.current?.querySelector<HTMLButtonElement>(`[data-zi="${cursor}"]`)?.focus();
  }, [cursor]);

  const sarbatori = useMemo(() => sarbatoriDupaZi(an), [an]);
  const saptamani = useMemo(() => construiesteSaptamani(an, luna), [an, luna]);

  /** Mută luna afișată și trage cursorul după ea, plafonat la ultima zi reală. */
  function schimbaLuna(luni: number): void {
    const dupa = deplaseazaLuna(an, luna, luni);
    setAn(dupa.an);
    setLuna(dupa.luna);
    const ziCursor = Math.min(Number(cursor.slice(8, 10)), numarZileLuna(dupa.an, dupa.luna));
    setCursor(ziIso(dupa.an, dupa.luna, ziCursor));
  }

  function laTasta(eveniment: KeyboardEvent<HTMLTableElement>): void {
    if (eveniment.key === "Escape") {
      /*
        Panoul ajunge în `dialog-cerere-noua.tsx`, care e un `<dialog>` deschis
        cu `showModal()`. Escape acolo e o „cerere de închidere” a browserului,
        iar specificația spune că NU se procesează dacă `keydown` a fost anulat.
        Fără `preventDefault()`, prima apăsare ar închide dialogul cu formularul
        completat cu tot. Capcana e plătită o dată, în `combobox.tsx`.
      */
      eveniment.preventDefault();
      onInchide?.();
      return;
    }

    const pas = PAS_SAGEATA[eveniment.key];
    if (pas === undefined) return;
    eveniment.preventDefault();

    const noua = adaugaZileIso(cursor, pas);
    const anNou = Number(noua.slice(0, 4));
    const lunaNoua = Number(noua.slice(5, 7));
    if (anNou !== an) setAn(anNou);
    if (lunaNoua !== luna) setLuna(lunaNoua);
    cereFocus.current = true;
    setCursor(noua);
  }

  return (
    <div className={cn("bg-background text-corp p-3", className)}>
      <div className="mb-2 flex items-center justify-between gap-1">
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            aria-label="Anul precedent"
            className={clasaNavigare}
            onClick={() => {
              schimbaLuna(-12);
            }}
          >
            <ChevronsLeft aria-hidden="true" className="size-4" />
          </button>
          <button
            type="button"
            aria-label="Luna precedentă"
            className={clasaNavigare}
            onClick={() => {
              schimbaLuna(-1);
            }}
          >
            <ChevronLeft aria-hidden="true" className="size-4" />
          </button>
        </div>

        {/* `aria-live`: săgețile schimbă luna fără să mute focusul, deci
            altfel un cititor de ecran n-ar afla niciodată unde a ajuns. */}
        <h2 aria-live="polite" className="text-foreground font-medium">
          {formatMonthYear(an, luna)}
        </h2>

        <div className="flex items-center gap-0.5">
          <button
            type="button"
            aria-label="Luna următoare"
            className={clasaNavigare}
            onClick={() => {
              schimbaLuna(1);
            }}
          >
            <ChevronRight aria-hidden="true" className="size-4" />
          </button>
          <button
            type="button"
            aria-label="Anul următor"
            className={clasaNavigare}
            onClick={() => {
              schimbaLuna(12);
            }}
          >
            <ChevronsRight aria-hidden="true" className="size-4" />
          </button>
        </div>
      </div>

      <table
        ref={refGrila}
        onKeyDown={laTasta}
        className="w-full border-separate border-spacing-0.5"
      >
        <thead>
          <tr>
            {ZILE_SAPTAMANA.map(([scurt, intreg], coloana) => (
              <th
                key={intreg}
                scope="col"
                className={cn(
                  "text-eticheta pb-1 font-medium tracking-wide uppercase",
                  COLOANE_WEEKEND.has(coloana) ? "text-muted-foreground" : "text-foreground",
                )}
              >
                <span aria-hidden="true">{scurt}</span>
                <span className="sr-only">{intreg}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {saptamani.map((saptamana, index) => (
            <tr key={`${String(an)}-${String(luna)}-${String(index)}`}>
              {saptamana.map((numar, coloana) => {
                if (numar === null) {
                  // Cheia e poziția: căsuțele goale n-au identitate proprie și
                  // nu se reordonează niciodată în interiorul unui rând.
                  return <td key={`gol-${String(coloana)}`} />;
                }

                const zi = ziIso(an, luna, numar);
                const sarbatoare = sarbatori.get(zi);
                const aleasa = zi === valoare;
                const inafara = (min !== undefined && zi < min) || (max !== undefined && zi > max);

                return (
                  <td key={zi}>
                    <button
                      type="button"
                      data-zi={zi}
                      {...(zi === ziDeAzi ? { "data-azi": "true" } : {})}
                      disabled={inafara}
                      tabIndex={zi === cursor ? 0 : -1}
                      aria-pressed={aleasa}
                      aria-label={
                        sarbatoare === undefined
                          ? `${String(numar)} ${formatMonthYear(an, luna)}`
                          : `${String(numar)} ${formatMonthYear(an, luna)}, ${sarbatoare}`
                      }
                      {...(sarbatoare === undefined ? {} : { title: sarbatoare })}
                      onClick={() => {
                        setCursor(zi);
                        onAlege(zi);
                      }}
                      className={cn(
                        "rounded-control relative grid size-9 place-items-center tabular-nums",
                        "text-corp transition-colors pointer-coarse:size-11",
                        COLOANE_WEEKEND.has(coloana) && "hasura",
                        aleasa
                          ? "bg-primary text-primary-foreground font-medium"
                          : "hover:bg-surface text-foreground",
                        // Ziua de azi poartă un contur, ca să rămână de găsit
                        // și când altă zi e aleasă.
                        zi === ziDeAzi && !aleasa && "ring-primary/40 ring-1 ring-inset",
                        inafara &&
                          "text-muted-foreground/40 cursor-not-allowed hover:bg-transparent",
                      )}
                    >
                      {numar}
                      {sarbatoare === undefined ? null : (
                        // Punct auriu, nu doar o culoare de text: sărbătoarea
                        // trebuie să se distingă și fără percepția culorii
                        // (WCAG 1.4.1). Denumirea întreagă e în `title` și în
                        // numele accesibil.
                        <span
                          aria-hidden="true"
                          className={cn(
                            "absolute bottom-1 size-1 rounded-full",
                            aleasa ? "bg-primary-foreground" : "bg-accent",
                          )}
                        />
                      )}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
