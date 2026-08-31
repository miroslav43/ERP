"use client";

import { useMemo, useState } from "react";

import { type TipZi } from "@/schemas/attendance";
import { Callout } from "@/components/ui/callout";
import type { ConfigZi } from "@/domain/attendance/calcul-ore";
import { avertismenteLuna, type LimiteFirmei } from "@/domain/attendance/limite-legale";
import {
  CLASE_TIP_ZI,
  CODURI_TIP_ZI,
  ETICHETE_TIP_PREZENTA,
  ETICHETE_TIP_ZI,
  esteZiLucratoare,
  tipZiAutomat,
} from "./etichete";
import { CelulaZi } from "./celula-zi";
// Tipurile au plecat într-un `.ts` simplu: le importă și serverul, și clientul,
// iar maparea din `attendance_entries` are acolo teste. Vezi `intrare-client.ts`.
import type { RandFoaie } from "./intrare-client";
import { formatOre } from "@/lib/format/ore";

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
  /** Parametrii de derivare a orelor, pauza de masă inclusă. */
  readonly config: ConfigZi;
  /**
   * Limitele legale ale firmei, `null` dacă n-a configurat nimic.
   *
   * Verificarea se face pe zilele DEJA încărcate în ecran, fără nicio citire
   * nouă: luna întreagă e deja aici. Consecința, spusă pe față în panoul de
   * sus: repausul dintre ultima zi a lunii trecute și prima a acesteia nu se
   * vede, iar media pe perioada de referință lipsește — pentru ea ar trebui
   * aduse alte patru luni de pontaj pentru fiecare angajat din tabel. Pe alea
   * le calculează acțiunea, la salvarea zilei.
   */
  readonly limite: LimiteFirmei | null;
  /**
   * Ore așteptate ale lunii (ore_pe_zi × zile lucrătoare) — aceeași valoare
   * pentru fiecare angajat, calculată o singură dată în pagină. Doar
   * raportare: pagina de pontaj NU calculează salariul sau tichetele, doar
   * arată baza pe care se sprijină acel calcul, făcut în modulul de salarizare.
   */
  readonly oreAsteptateLuna: number;
  /**
   * Ziua curentă (ISO), calculată pe SERVER cu fusul București. Un `new Date()`
   * aici ar fi dat altă zi la server decât în browser și ar fi rupt hidratarea
   * exact la miezul nopții și pentru cine are ceasul pe alt fus.
   */
  readonly azi: string;
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

/**
 * Antetul purta o literă doar pentru weekend; cele ~22 de zile lucrătoare
 * aveau a doua linie goală. Într-o matrice de 31 de coloane omul caută
 * „miercurea trecută”, nu „ziua 17”, deci fiecare coloană își spune ziua.
 */
const INITIALE_ZI = ["L", "Ma", "Mi", "J", "V", "S", "D"] as const;

/** 0 = luni … 6 = duminică, ca index în `INITIALE_ZI`. */
function indiceZi(data: string): number {
  const ziuaJs = new Date(`${data}T00:00:00Z`).getUTCDay();
  return ziuaJs === 0 ? 6 : ziuaJs - 1;
}

const CATEGORII_SPECIALE: readonly TipZi[] = [
  "concediu",
  "medical",
  "absenta_nemotivata",
  "delegatie",
];

/** Ordinea din legendă: întâi calendarul, apoi categoriile introduse de om. */
const TIPURI_LEGENDA: readonly TipZi[] = [
  "weekend",
  "sarbatoare",
  "concediu",
  "medical",
  "delegatie",
  "absenta_nemotivata",
];

/**
 * Matricea angajați × zile a lunii, cu totaluri pe rând și pe coloană.
 *
 * `<div class="overflow-x-auto">` + coloana „Angajat” sticky la stânga +
 * antet sticky sus, ca la fișele lungi. Totalurile din `<tfoot>` sunt
 * etichetate explicit „pe pagina curentă”: PostgREST nu agregă, iar pagina
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
  config,
  limite,
  oreAsteptateLuna,
  azi,
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

  /*
    Ce e în neregulă cu luna, pe angajat.

    Se arată DOAR severitatea `avertisment`. Pe o foaie cu 25 de oameni,
    „săptămâna peste normă" — adică orele suplimentare, care sunt legale — ar
    apărea de zeci de ori și ar îneca cele câteva depășiri reale. Ele rămân
    vizibile acolo unde privește un singur om: formularul zilei și cel al
    săptămânii.
  */
  const avertismentePeAngajat = useMemo(() => {
    if (limite === null) return [];
    return randuri
      .map((rand) => ({
        eticheta: rand.eticheta,
        avertismente: avertismenteLuna({
          zile: Object.entries(rand.intrari).map(([data, intrare]) => ({
            data,
            oraInceput: intrare.oraInceput,
            oraSfarsit: intrare.oraSfarsit,
            oreLucrate: intrare.oreLucrate,
            oreSuplimentare: intrare.oreSuplimentare,
            oreNoapte: intrare.oreNoapte,
            esteSarbatoare: intrare.tipZi === "sarbatoare",
          })),
          limite,
        }).filter((a) => a.severitate === "avertisment"),
      }))
      .filter((rand) => rand.avertismente.length > 0);
  }, [randuri, limite]);

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

  /*
   * `<tfoot>` avea trei `<td />` goale exact sub „Supl.”, „Noapte” și „Zile
   * speciale”, deși sumele pe rând erau deja calculate mai jos și aruncate.
   * Suplimentarele lunii sunt cifra pentru care se deschide ecranul ăsta la
   * închiderea lunii — a le lăsa necalculate înseamnă a cere adunarea de mână
   * a 25 de rânduri.
   */
  const totaluriGenerale = useMemo(() => {
    let suplimentare = 0;
    let noapte = 0;
    const speciale = new Map<TipZi, number>();
    for (const rand of randuri) {
      for (const intrare of Object.values(rand.intrari)) {
        suplimentare += intrare.oreSuplimentare;
        noapte += intrare.oreNoapte;
        if (CATEGORII_SPECIALE.includes(intrare.tipZi)) {
          speciale.set(intrare.tipZi, (speciale.get(intrare.tipZi) ?? 0) + 1);
        }
      }
    }
    return { suplimentare, noapte, speciale };
  }, [randuri]);

  const specialeGenerale = CATEGORII_SPECIALE.map((tip) => ({
    tip,
    numar: totaluriGenerale.speciale.get(tip) ?? 0,
  })).filter((s) => s.numar > 0);

  const randSelectat =
    selectie === null ? undefined : randuri.find((r) => r.angajatId === selectie.angajatId);
  const intrareSelectata =
    selectie === null || randSelectat === undefined
      ? null
      : (randSelectat.intrari[selectie.data] ?? null);

  return (
    <div className="space-y-3">
      {perioadaBlocata ? (
        <p className="border-foreground/60 bg-surface text-foreground rounded-panou text-corp border p-3">
          Perioada este <strong>blocată</strong>
          {blocataLa === null ? "" : ` din ${new Date(blocataLa).toLocaleDateString("ro-RO")}`} —
          foaia nu mai poate fi modificată. Redeschideți luna din „Perioade” dacă aveți nevoie de
          corecții.
        </p>
      ) : null}

      {/*
        Panoul stă DEASUPRA matricei, nu în celule: cine aprobă o lună are în
        față 25 × 31 de căsuțe, iar un semn într-una din ele n-ar fi găsit
        niciodată. Aici scrie cine și ce, iar cifra din text spune unde să se
        uite în tabel.
      */}
      {avertismentePeAngajat.length === 0 ? null : (
        <Callout fel="atentie" titlu="Luna depășește regulile firmei">
          <ul className="space-y-2">
            {avertismentePeAngajat.map((rand) => (
              <li key={rand.eticheta}>
                <span className="font-medium">{rand.eticheta}</span>
                <ul className="list-disc space-y-1 pl-4">
                  {rand.avertismente.map((a) => (
                    <li key={`${a.cod}-${a.zi}`}>{a.mesaj}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
          <p className="text-muted-foreground text-nota mt-2">
            Pontajul rămâne cum a fost înregistrat — avertismentele nu blochează aprobarea. Media pe
            perioada de referință și repausul de la granița lunii nu se verifică aici: se calculează
            la salvarea fiecărei zile.
          </p>
        </Callout>
      )}

      {/* `overflow-x-auto` singur nu ajungea: din regula CSS de calcul, un
          element cu `overflow-x: auto` primește `overflow-y: auto`, deci divul
          DEVENEA scrollport pe verticală — dar fără înălțime mărginită era
          exact cât conținutul și nu derula niciodată. `sticky top-0` de pe
          `<thead>` se raporta la scrollport-ul ăla imobil, deci antetul nu se
          lipea nicăieri: la 25 de angajați derulai pagina și pierdeai numerele
          zilelor, singurul reper al unei matrice de 36 de coloane. Cu
          `max-h` + `overflow-auto`, derulează cutia, iar antetul se lipește. */}
      <div className="border-border rounded-panou max-h-[calc(100vh-16rem)] overflow-auto border">
        <table className="text-corp w-full border-collapse">
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
                const esteSarbatoare = info?.tip === "sarbatoare";
                const esteAzi = zi === azi;
                return (
                  <th
                    key={zi}
                    scope="col"
                    title={info?.denumireSarbatoare ?? undefined}
                    aria-label={
                      info?.denumireSarbatoare !== null && info?.denumireSarbatoare !== undefined
                        ? `${INITIALE_ZI[indiceZi(zi)] ?? ""} ${ziuaDinIso(zi)} — ${info.denumireSarbatoare}`
                        : `${INITIALE_ZI[indiceZi(zi)] ?? ""} ${ziuaDinIso(zi)}`
                    }
                    // `bg-surface` pe TOATE zilele, nu doar pe weekend: cu
                    // `border-collapse`, fundalul de pe `<thead>` nu se pictează
                    // sub `<th>`, deci cele ~22 de zile lucrătoare rămâneau
                    // transparente și conținutul derula prin ele.
                    className={`border-border bg-surface text-nota min-w-11 border-b px-1 py-2 text-center font-medium ${
                      esteAzi ? "border-x-primary border-x-2" : ""
                    }`}
                  >
                    <div className="text-muted-foreground text-[10px] uppercase">
                      {INITIALE_ZI[indiceZi(zi)]}
                      {esteSarbatoare ? "*" : null}
                    </div>
                    <div>{ziuaDinIso(zi)}</div>
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
                // Urmărirea rândului nu e cosmetică la 36 de coloane: fără ea,
                // ajuns la coloana 27 nu mai știi al cui e rândul. Coloana
                // lipită trebuie să prindă aceeași nuanță (`group-hover/rand`),
                // altfel exact reperul rămâne în urmă.
                <tr key={rand.angajatId ?? "own"} className="group/rand hover:bg-surface">
                  <th
                    scope="row"
                    className="border-border bg-background group-hover/rand:bg-surface sticky left-0 z-10 border-r px-3 py-2 text-left font-normal whitespace-nowrap"
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

                    const motivBlocare = needitabilaDinConcediu
                      ? "Completat din concediul aprobat — se modifică din modulul Concedii"
                      : needitabilaAprobata
                        ? "Ziua a fost deja aprobată"
                        : perioadaBlocata
                          ? "Perioada este blocată"
                          : null;

                    /*
                     * Locul de muncă (0118) în titlul celulei — singurul spațiu
                     * care există: căsuța poartă o cifră de patru caractere pe
                     * un ecran cu 31 de coloane. Doar EXCEPȚIA se scrie; „La
                     * birou” pe fiecare zi ar fi un tooltip pe toată luna care
                     * nu spune nimic. Cine vrea să vadă locul fără să treacă cu
                     * mausul deschide ziua, sau privește săptămâna pe ore, unde
                     * blocul îl scrie pe el.
                     */
                    const locMunca =
                      intrare === null ||
                      intrare.tipPrezenta === null ||
                      intrare.tipPrezenta === "birou"
                        ? null
                        : ETICHETE_TIP_PREZENTA[intrare.tipPrezenta];

                    const titlu =
                      [motivBlocare, locMunca].filter((t) => t !== null).join(" · ") || undefined;

                    /*
                     * `ETICHETE_TIP_ZI[tip].slice(0, 3)` tăia eticheta oarbă și
                     * scria în celulă „Wee” (nu e un cuvânt românesc), „Săr”,
                     * „Con” — iar pentru o zi lucrătoare cu 0 ore înregistrate
                     * scria „Luc”, imposibil de deosebit de o categorie. Acum
                     * ziua lucrătoare fără ore arată cifra `0`, iar categoriile
                     * poartă codurile de pontaj consacrate (CO, CM, AN, D, SL).
                     */
                    /*
                     * Ziua deschisă cu ceasul din portal și neînchisă încă are
                     * `oreLucrate = 0`, deci ar apărea aici ca o zi lucrătoare
                     * cu zero ore — imposibil de deosebit de un angajat absent.
                     * Responsabilul de pontaj e singurul care poate observa că
                     * cineva a uitat să apese „Am ieșit"; celula trebuie să i-o
                     * spună, nu s-o ascundă sub o cifră plauzibilă.
                     */
                    const inCurs =
                      intrare !== null &&
                      intrare.oraInceput !== null &&
                      intrare.oraSfarsit === null;

                    const continut =
                      intrare === null ? (
                        <span className="text-muted-foreground">—</span>
                      ) : inCurs ? (
                        <span className="text-warning font-medium" title="Zi deschisă, neîncheiată">
                          ⧗
                        </span>
                      ) : (
                        <span className="tabular-nums">
                          {intrare.oreLucrate > 0
                            ? formatOre(intrare.oreLucrate)
                            : CODURI_TIP_ZI[intrare.tipZi]}
                        </span>
                      );

                    const clasaFundal = CLASE_TIP_ZI[tipEfectiv];

                    if (needitabila) {
                      return (
                        <td
                          key={zi}
                          aria-disabled="true"
                          title={titlu}
                          className={`border-border text-nota border-r px-1 py-2 text-center ${clasaFundal}`}
                        >
                          {continut}
                        </td>
                      );
                    }

                    return (
                      <td
                        key={zi}
                        className={`border-border text-nota border-r p-0 text-center ${clasaFundal}`}
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
                    {formatOre(oreAsteptateLuna)}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">{formatOre(totalOre)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    {formatOre(totalSuplimentar)}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">{formatOre(totalNoapte)}</td>
                  <td className="text-muted-foreground text-nota px-2 py-2 text-left">
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
                <td key={zi} className="text-nota px-1 py-2 text-center tabular-nums">
                  {formatOre(totaluriColoana.get(zi) ?? 0)}
                </td>
              ))}
              <td className="text-muted-foreground px-2 py-2 text-right tabular-nums">
                {formatOre(oreAsteptateLuna * randuri.length)}
              </td>
              <td className="px-2 py-2 text-right tabular-nums">{formatOre(totalGeneral)}</td>
              <td className="px-2 py-2 text-right tabular-nums">
                {formatOre(totaluriGenerale.suplimentare)}
              </td>
              <td className="px-2 py-2 text-right tabular-nums">
                {formatOre(totaluriGenerale.noapte)}
              </td>
              <td className="text-muted-foreground text-nota px-2 py-2 text-left">
                {specialeGenerale.length === 0
                  ? "—"
                  : specialeGenerale.map((s) => `${ETICHETE_TIP_ZI[s.tip]}: ${s.numar}`).join(", ")}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Legenda se GENEREAZĂ din cele trei hărți, nu se mai scrie de mână:
          scrisă de mână, contrazicea deja tabelul — două intrări aveau aceeași
          nuanță și două tipuri de zi lipseau cu totul. Fiecare intrare poartă
          ACELAȘI element ca celula: codul, pe fundalul tipului. Culoarea nu e
          niciodată singurul purtător, fiindcă la tipărire alb-negru se pierde. */}
      <p className="text-muted-foreground text-nota flex flex-wrap gap-x-4 gap-y-1">
        {TIPURI_LEGENDA.map((tip) => (
          <span key={tip}>
            <code
              className={`${CLASE_TIP_ZI[tip]} border-border text-foreground mr-1 rounded border px-1 tabular-nums`}
            >
              {CODURI_TIP_ZI[tip]}
            </code>
            {ETICHETE_TIP_ZI[tip]}
          </span>
        ))}
        <span>
          <code className="border-border text-foreground mr-1 rounded border px-1 tabular-nums">
            —
          </code>
          Nicio intrare înregistrată
        </span>
        <span>
          <code className="border-border text-foreground mr-1 rounded border px-1 tabular-nums">
            0
          </code>
          Zi lucrătoare înregistrată cu 0 ore
        </span>
        <span>
          <code className="border-border text-warning mr-1 rounded border px-1">⧗</code>
          Zi deschisă din portal, neîncheiată
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
          config={config}
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
