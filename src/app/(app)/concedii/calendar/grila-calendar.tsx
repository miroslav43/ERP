// src/app/(app)/concedii/calendar/grila-calendar.tsx
import Link from "next/link";

import type { StatusCerere } from "@/schemas/leave";

export interface EvenimentZiCalendar {
  readonly employeeLabel: string;
  readonly tipDenumire: string;
  readonly tipCuloare: string;
  readonly status: StatusCerere;
}

interface LunaTinta {
  readonly an: number;
  readonly luna: number;
}

interface Proprietati {
  readonly an: number;
  readonly luna: number;
  /** Cheia e ziua ISO (`"2026-03-09"`); serializabil peste granița server/client. */
  readonly zileHarta: Readonly<Record<string, readonly EvenimentZiCalendar[]>>;
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

const ZILE_SAPTAMANA = [
  "Luni",
  "Marți",
  "Miercuri",
  "Joi",
  "Vineri",
  "Sâmbătă",
  "Duminică",
] as const;

function ziIso(an: number, luna: number, zi: number): string {
  return `${String(an)}-${String(luna).padStart(2, "0")}-${String(zi).padStart(2, "0")}`;
}

/** ISO-dow al primei zile a lunii: luni = 1 … duminică = 7. */
function isoDowPrimaZi(an: number, luna: number): number {
  const dow = new Date(Date.UTC(an, luna - 1, 1)).getUTCDay();
  return dow === 0 ? 7 : dow;
}

function numarZileLuna(an: number, luna: number): number {
  return new Date(Date.UTC(an, luna, 0)).getUTCDate();
}

/** Grila săptămânilor lunii, cu `null` pentru zilele de umplutură din afara lunii. */
function construiesteSaptamani(an: number, luna: number): readonly (number | null)[][] {
  const zilePad = isoDowPrimaZi(an, luna) - 1;
  const totalZile = numarZileLuna(an, luna);
  const celule: (number | null)[] = [
    ...Array.from({ length: zilePad }, () => null),
    ...Array.from({ length: totalZile }, (_, index) => index + 1),
  ];
  while (celule.length % 7 !== 0) celule.push(null);

  const saptamani: (number | null)[][] = [];
  for (let index = 0; index < celule.length; index += 7) {
    saptamani.push(celule.slice(index, index + 7));
  }
  return saptamani;
}

export function GrilaCalendar({ an, luna, zileHarta, lunaAnterioara, lunaUrmatoare }: Proprietati) {
  const saptamani = construiesteSaptamani(an, luna);
  const areEvenimente = Object.keys(zileHarta).length > 0;

  return (
    <div className="space-y-3">
      <nav
        aria-label="Navigare lunară"
        className="flex flex-wrap items-center justify-between gap-3 text-sm"
      >
        <Link
          href={`/concedii/calendar?an=${String(lunaAnterioara.an)}&luna=${String(lunaAnterioara.luna)}`}
          className="border-foreground/60 hover:bg-surface rounded-md border px-3 py-1.5"
        >
          ← Luna anterioară
        </Link>

        {/*
          Luna la care te uiți, SCRISĂ, plus salt direct.
          Cu doar două săgeți, ajungeai din martie în octombrie prin șapte
          clicuri și nu vedeai nicăieri unde ai ajuns — reclamația „îți e foarte
          greu să îți dai seama la ce lună te uiți". Formularul e un GET simplu:
          nu are nevoie de `useState`, iar luna rămâne în URL, ca până acum.
        */}
        <form method="get" action="/concedii/calendar" className="flex items-center gap-2">
          <label htmlFor="calendar-luna" className="sr-only">
            Luna afișată
          </label>
          <select
            id="calendar-luna"
            name="luna"
            defaultValue={String(luna)}
            className="border-foreground/60 rounded-md border px-2 py-1.5 text-sm"
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
            className="border-foreground/60 w-20 rounded-md border px-2 py-1.5 text-sm"
          />
          <button
            type="submit"
            className="border-foreground/60 hover:bg-surface rounded-md border px-3 py-1.5"
          >
            Mergi
          </button>
        </form>

        <Link
          href={`/concedii/calendar?an=${String(lunaUrmatoare.an)}&luna=${String(lunaUrmatoare.luna)}`}
          className="border-foreground/60 hover:bg-surface rounded-md border px-3 py-1.5"
        >
          Luna următoare →
        </Link>
      </nav>

      {!areEvenimente ? (
        <p className="border-foreground/60 text-muted-foreground rounded-lg border border-dashed p-4 text-center text-sm">
          Nicio absență de echipă înregistrată în această lună.
        </p>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[56rem] table-fixed border-collapse text-left text-sm">
          <caption className="sr-only">Grila lunară a absențelor de echipă</caption>
          <thead>
            <tr>
              {ZILE_SAPTAMANA.map((zi) => (
                <th
                  key={zi}
                  scope="col"
                  className="border-border bg-surface text-muted-foreground border px-2 py-1.5 text-xs font-medium"
                >
                  {zi}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {saptamani.map((saptamana, indexSaptamana) => (
              <tr key={indexSaptamana}>
                {saptamana.map((zi, indexZi) => {
                  if (zi === null) {
                    return (
                      <td
                        key={indexZi}
                        className="border-border bg-surface h-24 border align-top"
                      />
                    );
                  }
                  const iso = ziIso(an, luna, zi);
                  const evenimente = zileHarta[iso] ?? [];
                  return (
                    <td key={iso} className="border-border h-24 border align-top">
                      <div className="p-1.5">
                        <span className="text-muted-foreground text-xs font-medium">{zi}</span>
                        <ul className="mt-1 space-y-0.5">
                          {evenimente.slice(0, 3).map((eveniment, indexEveniment) => (
                            <li
                              key={indexEveniment}
                              title={`${eveniment.employeeLabel} · ${eveniment.tipDenumire} (${
                                eveniment.status === "aprobata" ? "aprobată" : "în aprobare"
                              })`}
                              className={`text-primary-foreground truncate rounded px-1 py-0.5 text-xs ${
                                eveniment.status === "aprobata" ? "" : "opacity-60"
                              }`}
                              style={{ backgroundColor: eveniment.tipCuloare }}
                            >
                              {eveniment.employeeLabel}
                            </li>
                          ))}
                          {evenimente.length > 3 ? (
                            <li className="text-muted-foreground text-xs">
                              +{evenimente.length - 3} altele
                            </li>
                          ) : null}
                        </ul>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
