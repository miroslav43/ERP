"use client";

import { useMemo, useState } from "react";

import { type TipZi } from "@/schemas/attendance";
import { CLASE_TIP_ZI, ETICHETE_TIP_ZI, esteZiLucratoare, tipZiAutomat } from "./etichete";
import type { IntervalNoapte } from "./interval-noapte";
import { CelulaZi } from "./celula-zi";

export interface IntrareZiClient {
  readonly id: string;
  readonly oraInceput: string | null;
  readonly oraSfarsit: string | null;
  readonly oreLucrate: number;
  readonly oreSuplimentare: number;
  readonly oreNoapte: number;
  readonly tipZi: TipZi;
  readonly esteDinConcediu: boolean;
  readonly aprobat: boolean;
  readonly respins: boolean;
  readonly motivRespingere: string | null;
  readonly observatii: string | null;
}

export interface RandFoaie {
  /** `null` = fișa proprie (scope „own”): `salveazaZiPontaj` o rezolvă server-side. */
  readonly angajatId: string | null;
  readonly eticheta: string;
  /** Cheia e ziua ISO (`"2026-03-09"`) — serializabil peste granița server/client. */
  readonly intrari: Readonly<Record<string, IntrareZiClient>>;
}

interface Proprietati {
  readonly dataInceput: string;
  readonly dataSfarsit: string;
  readonly statusPerioada: "deschisa" | "in_aprobare" | "blocata";
  readonly blocataLa: string | null;
  readonly randuri: readonly RandFoaie[];
  readonly sarbatoriNationale: Readonly<Record<string, string>>;
  readonly zileRecuperare: readonly string[];
  readonly liberSuplimentar: readonly string[];
  readonly poateEdita: boolean;
  readonly poateAproba: boolean;
  /** Pragul de ore/zi al organizației — trecut mai departe la `CelulaZi`. */
  readonly orePeZi: number;
  readonly intervalNoapte: IntervalNoapte;
  /**
   * Ore așteptate ale lunii (ore_pe_zi × zile lucrătoare) — aceeași valoare
   * pentru fiecare angajat, calculată o singură dată în pagină. Doar
   * raportare: pagina de pontaj NU calculează salariul sau tichetele, doar
   * arată baza pe care se sprijină acel calcul, făcut în modulul de salarizare.
   */
  readonly oreAsteptateLuna: number;
}

interface Selectie {
  readonly angajatId: string | null;
  readonly eticheta: string;
  readonly data: string;
}

function enumeraZile(dataInceput: string, dataSfarsit: string): readonly string[] {
  const zile: string[] = [];
  let curent = new Date(`${dataInceput}T00:00:00Z`);
  const limita = new Date(`${dataSfarsit}T00:00:00Z`);
  while (curent.getTime() <= limita.getTime()) {
    zile.push(curent.toISOString().slice(0, 10));
    curent = new Date(curent.getTime() + 24 * 60 * 60 * 1000);
  }
  return zile;
}

function ziuaDinIso(data: string): string {
  return data.slice(8, 10);
}

const CATEGORII_SPECIALE: readonly TipZi[] = [
  "concediu",
  "medical",
  "absenta_nemotivata",
  "delegatie",
];

/**
 * Matricea angajați × zile a lunii, cu totaluri pe rând și pe coloană.
 *
 * `<div class="overflow-x-auto">` + coloana „Angajat” sticky la stânga +
 * antet sticky sus, ca la fișele lungi. Totalurile din `<tfoot>` sunt
 * etichetate explicit „pe pagina curentă": PostgREST nu agregă, iar pagina
 * are cel mult 30 angajați.
 */
export function FoaieColectiva({
  dataInceput,
  dataSfarsit,
  statusPerioada,
  blocataLa,
  randuri,
  sarbatoriNationale,
  zileRecuperare,
  liberSuplimentar,
  poateEdita,
  poateAproba,
  orePeZi,
  intervalNoapte,
  oreAsteptateLuna,
}: Proprietati) {
  const [selectie, setSelectie] = useState<Selectie | null>(null);

  const zile = useMemo(() => enumeraZile(dataInceput, dataSfarsit), [dataInceput, dataSfarsit]);
  const setNationale = useMemo(
    () => new Set(Object.keys(sarbatoriNationale)),
    [sarbatoriNationale],
  );
  const setRecuperare = useMemo(() => new Set(zileRecuperare), [zileRecuperare]);
  const setLiber = useMemo(() => new Set(liberSuplimentar), [liberSuplimentar]);

  const perioadaBlocata = statusPerioada === "blocata";

  const infoZile = useMemo(
    () =>
      new Map(
        zile.map((zi) => {
          const lucratoare = esteZiLucratoare(zi, setNationale, setRecuperare, setLiber);
          const tip = tipZiAutomat(zi, setNationale, setRecuperare, setLiber);
          return [zi, { lucratoare, tip, denumireSarbatoare: sarbatoriNationale[zi] ?? null }];
        }),
      ),
    [zile, setNationale, setRecuperare, setLiber, sarbatoriNationale],
  );

  const totaluriColoana = useMemo(() => {
    const harta = new Map<string, number>();
    for (const zi of zile) harta.set(zi, 0);
    for (const rand of randuri) {
      for (const [zi, intrare] of Object.entries(rand.intrari)) {
        harta.set(zi, (harta.get(zi) ?? 0) + intrare.oreLucrate);
      }
    }
    return harta;
  }, [randuri, zile]);

  const totalGeneral = [...totaluriColoana.values()].reduce((a, b) => a + b, 0);

  const randSelectat =
    selectie === null ? undefined : randuri.find((r) => r.angajatId === selectie.angajatId);
  const intrareSelectata =
    selectie === null || randSelectat === undefined
      ? null
      : (randSelectat.intrari[selectie.data] ?? null);

  return (
    <div className="space-y-3">
      {perioadaBlocata ? (
        <p className="border-foreground/60 bg-surface text-foreground rounded-lg border p-3 text-sm">
          Perioada este <strong>blocată</strong>
          {blocataLa === null ? "" : ` din ${new Date(blocataLa).toLocaleDateString("ro-RO")}`} —
          foaia nu mai poate fi modificată. Redeschideți luna din „Perioade” dacă aveți nevoie de
          corecții.
        </p>
      ) : null}

      <div className="border-border overflow-x-auto rounded-lg border">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">Pontajul angajaților pentru zilele lunii selectate.</caption>
          <thead className="bg-surface sticky top-0 z-20">
            <tr>
              <th
                scope="col"
                className="border-border bg-surface sticky left-0 z-30 min-w-40 border-b px-3 py-2 text-left font-medium"
              >
                Angajat
              </th>
              {zile.map((zi) => {
                const info = infoZile.get(zi);
                const esteWeekend = info?.tip === "weekend";
                const esteSarbatoare = info?.tip === "sarbatoare";
                return (
                  <th
                    key={zi}
                    scope="col"
                    title={info?.denumireSarbatoare ?? undefined}
                    aria-label={
                      info?.denumireSarbatoare !== null && info?.denumireSarbatoare !== undefined
                        ? `${ziuaDinIso(zi)} — ${info.denumireSarbatoare}`
                        : undefined
                    }
                    className={`border-border min-w-11 border-b px-1 py-2 text-center text-xs font-medium ${
                      esteWeekend ? "bg-surface" : esteSarbatoare ? "bg-warning/12" : ""
                    }`}
                  >
                    <div>{ziuaDinIso(zi)}</div>
                    <div className="text-muted-foreground text-[10px]">
                      {esteWeekend
                        ? new Date(`${zi}T00:00:00Z`).getUTCDay() === 6
                          ? "S"
                          : "D"
                        : null}
                      {esteSarbatoare ? "*" : null}
                    </div>
                  </th>
                );
              })}
              <th
                scope="col"
                title="Ore/zi ale organizației × zile lucrătoare din lună — aceeași bază pentru toți angajații."
                className="border-border border-b px-2 py-2 text-right font-medium"
              >
                Așteptate
              </th>
              <th scope="col" className="border-border border-b px-2 py-2 text-right font-medium">
                Ore
              </th>
              <th scope="col" className="border-border border-b px-2 py-2 text-right font-medium">
                Supl.
              </th>
              <th scope="col" className="border-border border-b px-2 py-2 text-right font-medium">
                Noapte
              </th>
              <th scope="col" className="border-border border-b px-2 py-2 text-left font-medium">
                Zile speciale
              </th>
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {randuri.map((rand) => {
              const intrari = Object.values(rand.intrari);
              const totalOre = intrari.reduce((s, i) => s + i.oreLucrate, 0);
              const totalSuplimentar = intrari.reduce((s, i) => s + i.oreSuplimentare, 0);
              const totalNoapte = intrari.reduce((s, i) => s + i.oreNoapte, 0);
              const speciale = CATEGORII_SPECIALE.map((tip) => ({
                tip,
                numar: intrari.filter((i) => i.tipZi === tip).length,
              })).filter((s) => s.numar > 0);

              return (
                <tr key={rand.angajatId ?? "own"}>
                  <th
                    scope="row"
                    className="border-border bg-background sticky left-0 z-10 border-r px-3 py-2 text-left font-normal whitespace-nowrap"
                  >
                    {rand.eticheta}
                  </th>
                  {zile.map((zi) => {
                    const intrare = rand.intrari[zi] ?? null;
                    const info = infoZile.get(zi);
                    const tipEfectiv = intrare?.tipZi ?? info?.tip ?? "lucratoare";
                    const needitabilaDinConcediu = intrare?.esteDinConcediu === true;
                    const needitabilaAprobata = intrare?.aprobat === true && !poateAproba;
                    const needitabila =
                      !poateEdita ||
                      perioadaBlocata ||
                      needitabilaDinConcediu ||
                      needitabilaAprobata;

                    const titlu = needitabilaDinConcediu
                      ? "Completat din concediul aprobat — se modifică din modulul Concedii"
                      : needitabilaAprobata
                        ? "Ziua a fost deja aprobată"
                        : perioadaBlocata
                          ? "Perioada este blocată"
                          : undefined;

                    const continut =
                      intrare === null ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <span className="tabular-nums">
                          {intrare.oreLucrate > 0
                            ? intrare.oreLucrate
                            : ETICHETE_TIP_ZI[intrare.tipZi].slice(0, 3)}
                        </span>
                      );

                    const clasaFundal = CLASE_TIP_ZI[tipEfectiv];

                    if (needitabila) {
                      return (
                        <td
                          key={zi}
                          aria-disabled="true"
                          title={titlu}
                          className={`border-border border-r px-1 py-2 text-center text-xs ${clasaFundal}`}
                        >
                          {continut}
                        </td>
                      );
                    }

                    return (
                      <td
                        key={zi}
                        className={`border-border border-r p-0 text-center text-xs ${clasaFundal}`}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setSelectie({
                              angajatId: rand.angajatId,
                              eticheta: rand.eticheta,
                              data: zi,
                            });
                          }}
                          className="hover:outline-ring w-full px-1 py-2 hover:outline-2 hover:-outline-offset-2"
                        >
                          {continut}
                        </button>
                      </td>
                    );
                  })}
                  <td className="text-muted-foreground px-2 py-2 text-right tabular-nums">
                    {oreAsteptateLuna}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">{totalOre}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{totalSuplimentar}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{totalNoapte}</td>
                  <td className="text-muted-foreground px-2 py-2 text-left text-xs">
                    {speciale.length === 0
                      ? "—"
                      : speciale.map((s) => `${ETICHETE_TIP_ZI[s.tip]}: ${s.numar}`).join(", ")}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="bg-surface font-medium">
            <tr>
              <th scope="row" className="bg-surface sticky left-0 z-10 px-3 py-2 text-left">
                Total pe pagina curentă ({randuri.length} angajați)
              </th>
              {zile.map((zi) => (
                <td key={zi} className="px-1 py-2 text-center text-xs tabular-nums">
                  {totaluriColoana.get(zi) ?? 0}
                </td>
              ))}
              <td className="text-muted-foreground px-2 py-2 text-right tabular-nums">
                {oreAsteptateLuna * randuri.length}
              </td>
              <td className="px-2 py-2 text-right tabular-nums">{totalGeneral}</td>
              <td />
              <td />
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs">
        <span>
          <span
            aria-hidden="true"
            className="bg-surface mr-1 inline-block size-3 rounded align-middle"
          />
          Weekend (S/D)
        </span>
        <span>
          <span
            aria-hidden="true"
            className="bg-warning/12 mr-1 inline-block size-3 rounded align-middle"
          />
          Sărbătoare legală (*)
        </span>
        <span>
          <span
            aria-hidden="true"
            className="bg-surface mr-1 inline-block size-3 rounded align-middle"
          />
          Concediu
        </span>
        <span>
          <span
            aria-hidden="true"
            className="mr-1 inline-block size-3 rounded bg-purple-50 align-middle"
          />
          Medical
        </span>
      </p>

      {selectie === null ? null : (
        <CelulaZi
          key={`${selectie.angajatId ?? "own"}-${selectie.data}`}
          angajatId={selectie.angajatId}
          data={selectie.data}
          eticheta={`${selectie.eticheta} · ${new Date(`${selectie.data}T00:00:00Z`).toLocaleDateString("ro-RO")}`}
          intrare={intrareSelectata}
          poateAproba={poateAproba}
          orePeZi={orePeZi}
          intervalNoapte={intervalNoapte}
          poateSterge={
            intrareSelectata !== null &&
            !intrareSelectata.esteDinConcediu &&
            (!intrareSelectata.aprobat || poateAproba)
          }
          onInchide={() => {
            setSelectie(null);
          }}
        />
      )}
    </div>
  );
}
