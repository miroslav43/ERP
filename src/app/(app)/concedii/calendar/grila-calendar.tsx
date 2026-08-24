// src/app/(app)/concedii/calendar/grila-calendar.tsx
import Link from "next/link";

import { Buton, buton } from "@/components/ui/buton";
import { celMaiBunContrast, cernealaPentruFundal, PRAG_TEXT_MIC } from "@/domain/leave/contrast";
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

/**
 * Aspectul unei pastile de eveniment — calculat, nu estimat.
 *
 * ── PROBLEMA ──────────────────────────────────────────────────────────────
 * Culoarea vine din `leave_types.culoare`, aleasă de administrator dintr-un
 * `<input type="color">` fără nicio constrângere, și era pusă ca fundal sub o
 * cerneală FIXĂ, `text-primary-foreground` (cremul #faf7f0). Pe navy-ul
 * produsului raportul e 15,4:1; pe galbenul implicit al oricărui selector de
 * culoare e 1,00:1 și numele angajatului dispare de pe ecran. Nimic nu avertiza.
 *
 * ── CE FACE ACUM ──────────────────────────────────────────────────────────
 * Cerneala se alege per culoare, dintre cele două ale produsului, după raportul
 * WCAG 2.1 mai mare. Când nici cea mai bună nu atinge 4,5:1 (griurile de
 * mijloc), culoarea NU mai poartă text deloc: pastila devine crem, cu o bară de
 * 3px în culoarea tipului la stânga. Culoarea rămâne semnalul, fără să fie
 * suport de text.
 *
 * ── STAREA E FORMĂ, NU TRANSPARENȚĂ ───────────────────────────────────────
 * Distincția „aprobată / în aprobare” era purtată exclusiv de `opacity-60`.
 * Opacitatea peste un hex arbitrar nu produce un raport previzibil — e exact
 * motivul pentru care `disabled:opacity-*` e interzis în produs. Acum:
 * aprobată = umplută, în aprobare = contur ÎNTRERUPT, ambele cu bara de
 * culoare. Forma se vede și pe o listă tipărită alb-negru.
 */
interface StilEveniment {
  readonly clasa: string;
  readonly stil: Readonly<Record<string, string>>;
}

function stilEveniment(culoare: string, aprobata: boolean): StilEveniment {
  const culoareaTineText = celMaiBunContrast(culoare) >= PRAG_TEXT_MIC;

  if (aprobata && culoareaTineText) {
    return {
      clasa:
        cernealaPentruFundal(culoare) === "crem" ? "text-primary-foreground" : "text-foreground",
      stil: { backgroundColor: culoare },
    };
  }

  // Contur: pentru cererile neaprobate ȘI pentru culorile care n-ar ține text.
  // Conturul întrerupt rămâne rezervat stării „în aprobare”, ca să nu se
  // confunde cele două motive.
  return {
    clasa: `bg-background text-foreground border ${aprobata ? "border-border" : "border-foreground/60 border-dashed"}`,
    stil: { borderLeft: `3px solid ${culoare}` },
  };
}

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

/**
 * Tipurile care apar EFECTIV în luna afișată, în ordinea denumirii.
 *
 * Legenda se construiește din evenimente, nu din nomenclator: o firmă are 6-10
 * tipuri configurate și, într-o lună obișnuită, două apar. O legendă cu opt
 * rânduri din care șase nu sunt pe ecran e zgomot.
 */
function tipuriDinLuna(
  zileHarta: Readonly<Record<string, readonly EvenimentZiCalendar[]>>,
): readonly Readonly<{ denumire: string; culoare: string }>[] {
  const harta = new Map<string, string>();
  for (const evenimente of Object.values(zileHarta)) {
    for (const eveniment of evenimente) {
      if (!harta.has(eveniment.tipDenumire)) harta.set(eveniment.tipDenumire, eveniment.tipCuloare);
    }
  }
  return [...harta.entries()]
    .map(([denumire, culoare]) => ({ denumire, culoare }))
    .sort((a, b) => a.denumire.localeCompare(b.denumire, "ro"));
}

export function GrilaCalendar({ an, luna, zileHarta, lunaAnterioara, lunaUrmatoare }: Proprietati) {
  const saptamani = construiesteSaptamani(an, luna);
  const areEvenimente = Object.keys(zileHarta).length > 0;
  const legenda = tipuriDinLuna(zileHarta);

  return (
    <div className="space-y-3">
      <nav
        aria-label="Navigare lunară"
        className="text-corp flex flex-wrap items-center justify-between gap-3"
      >
        <Link
          href={`/concedii/calendar?an=${String(lunaAnterioara.an)}&luna=${String(lunaAnterioara.luna)}`}
          className={buton({ varianta: "secundar" })}
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

        <Link
          href={`/concedii/calendar?an=${String(lunaUrmatoare.an)}&luna=${String(lunaUrmatoare.luna)}`}
          className={buton({ varianta: "secundar" })}
        >
          Luna următoare →
        </Link>
      </nav>

      {!areEvenimente ? (
        <p className="border-foreground/60 text-muted-foreground rounded-panou text-corp border border-dashed p-4 text-center">
          Nicio absență de echipă înregistrată în această lună.
        </p>
      ) : null}

      <div className="overflow-x-auto">
        <table className="text-corp w-full min-w-[56rem] table-fixed border-collapse text-left">
          <caption className="sr-only">Grila lunară a absențelor de echipă</caption>
          <thead>
            <tr>
              {ZILE_SAPTAMANA.map((zi) => (
                <th
                  key={zi}
                  scope="col"
                  className="border-border bg-surface text-muted-foreground text-nota border px-2 py-1.5 font-medium"
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
                        <span className="text-muted-foreground text-nota font-medium">{zi}</span>
                        <ul className="mt-1 space-y-0.5">
                          {evenimente.slice(0, 3).map((eveniment, indexEveniment) => {
                            const aprobata = eveniment.status === "aprobata";
                            const stare = aprobata ? "aprobată" : "în aprobare";
                            const { clasa, stil } = stilEveniment(eveniment.tipCuloare, aprobata);
                            return (
                              <li
                                key={indexEveniment}
                                title={`${eveniment.employeeLabel} · ${eveniment.tipDenumire} (${stare})`}
                                className={`text-nota truncate rounded px-1 py-0.5 ${clasa}`}
                                style={stil}
                              >
                                {eveniment.employeeLabel}
                                {/* `title` nu apare la atingere și nu se citește
                                    la tastatură: pe telefon, tipul și starea
                                    erau pur și simplu inaccesibile. Textul
                                    complet intră în numele accesibil al
                                    rândului. */}
                                <span className="sr-only">
                                  {" "}
                                  · {eveniment.tipDenumire} ({stare})
                                </span>
                              </li>
                            );
                          })}
                          {evenimente.length > 3 ? (
                            <li className="text-muted-foreground text-nota">
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

      {/* Legenda lipsea cu totul: culorile din grilă nu erau explicate nicăieri
          pe ecran, iar singura lor traducere stătea în `title`. */}
      {legenda.length === 0 ? null : (
        <div className="text-muted-foreground text-nota flex flex-wrap items-center gap-x-4 gap-y-2">
          {legenda.map((tip) => (
            <span key={tip.denumire} className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="inline-block size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: tip.culoare }}
              />
              {tip.denumire}
            </span>
          ))}
          <span className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="border-foreground/60 inline-block h-3 w-5 shrink-0 rounded border border-dashed"
            />
            În aprobare
          </span>
        </div>
      )}
    </div>
  );
}
