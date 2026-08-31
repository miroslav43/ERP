// src/app/(app)/concedii/calendar/navigare-luna.tsx
//
// Navigarea lunară și comutatorul de vedere, comune celor două forme ale
// calendarului.
//
// Stăteau în corpul lui `GrilaCalendar`, ceea ce era corect cât timp exista o
// singură vedere. Cu planificatorul alături, o copie a lor ar fi însemnat două
// formulare care trimit la aceeași rută cu parametri ușor diferiți — iar
// divergența s-ar fi văzut abia când cineva ar fi sărit de pe o vedere pe alta
// și ar fi aterizat în altă lună.
import Link from "next/link";

import { Buton, buton } from "@/components/ui/buton";

import { VEDERI_CALENDAR, type VedereCalendar } from "./vedere";

interface LunaTinta {
  readonly an: number;
  readonly luna: number;
}

interface Proprietati {
  readonly an: number;
  readonly luna: number;
  readonly vedere: VedereCalendar;
  readonly lunaAnterioara: LunaTinta;
  readonly lunaUrmatoare: LunaTinta;
}

const LUNI_AN = [
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

function adresa(tinta: LunaTinta, vedere: VedereCalendar): string {
  return `/concedii/calendar?an=${String(tinta.an)}&luna=${String(tinta.luna)}&vedere=${vedere}`;
}

export function NavigareLuna({ an, luna, vedere, lunaAnterioara, lunaUrmatoare }: Proprietati) {
  return (
    <div className="space-y-3">
      <nav
        aria-label="Navigare lunară"
        className="text-corp flex flex-wrap items-center justify-between gap-3"
      >
        <Link href={adresa(lunaAnterioara, vedere)} className={buton({ varianta: "secundar" })}>
          ← Luna anterioară
        </Link>

        {/*
          Luna la care te uiți, SCRISĂ, plus salt direct.
          Cu doar două săgeți, ajungeai din martie în octombrie prin șapte
          clicuri și nu vedeai nicăieri unde ai ajuns — reclamația „îți e foarte
          greu să îți dai seama la ce lună te uiți". Formularul e un GET simplu:
          nu are nevoie de `useState`, iar luna rămâne în URL, ca până acum.

          `vedere` intră ca input ascuns: un GET trimite DOAR câmpurile
          formularului, deci fără el saltul la altă lună te-ar fi întors tăcut
          pe vederea implicită.
        */}
        <form method="get" action="/concedii/calendar" className="flex items-center gap-2">
          <input type="hidden" name="vedere" value={vedere} />
          <label htmlFor="calendar-luna" className="sr-only">
            Luna afișată
          </label>
          <select
            id="calendar-luna"
            name="luna"
            defaultValue={String(luna)}
            className="border-foreground/60 rounded-control text-corp border px-2 py-1.5"
          >
            {LUNI_AN.map((eticheta, index) => (
              <option key={eticheta} value={String(index + 1)}>
                {eticheta}
              </option>
            ))}
          </select>
          <label htmlFor="calendar-an" className="sr-only">
            Anul afișat
          </label>
          <input
            id="calendar-an"
            name="an"
            type="number"
            min={2000}
            max={2199}
            defaultValue={String(an)}
            className="border-foreground/60 rounded-control text-corp w-20 border px-2 py-1.5"
          />
          <Buton type="submit" varianta="secundar">
            Mergi
          </Buton>
        </form>

        <Link href={adresa(lunaUrmatoare, vedere)} className={buton({ varianta: "secundar" })}>
          Luna următoare →
        </Link>
      </nav>

      {/*
        Comutatorul de vedere. Legături, nu butoane cu stare: vederea trăiește
        în URL, deci se poate pune la favorite, se poate trimite pe chat și
        supraviețuiește lui „înapoi" — exact ca luna de deasupra.
      */}
      <nav aria-label="Forma calendarului" className="flex flex-wrap items-center gap-2">
        {VEDERI_CALENDAR.map((optiune) => {
          const activ = optiune.cheie === vedere;
          return (
            <Link
              key={optiune.cheie}
              href={adresa({ an, luna }, optiune.cheie)}
              aria-current={activ ? "page" : undefined}
              className={buton({ varianta: activ ? "primar" : "secundar" })}
            >
              {optiune.eticheta}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
