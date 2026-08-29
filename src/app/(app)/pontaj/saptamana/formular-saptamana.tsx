// src/app/(app)/pontaj/saptamana/formular-saptamana.tsx
"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Buton } from "@/components/ui/buton";
import { IntrareOra } from "@/components/ui/intrare-ora";
import { Tabel, type Coloana } from "@/components/ui/tabel";
import { formatOre } from "@/lib/format/ore";
import { oreleZilei, type ConfigZi, type OreleZilei } from "@/domain/attendance/calcul-ore";
import { INDICI_WEEKEND, intervalDeTrimis } from "@/domain/attendance/saptamana";
import { TIPURI_PREZENTA, type TipPrezenta } from "@/schemas/attendance";
import { ETICHETE_TIP_PREZENTA } from "../etichete";
import { trimiteSaptamanaPontaj } from "./actions";

/**
 * Un rând din descompunerea săptămânii: eticheta la stânga, cifra la dreapta.
 *
 * Aceeași formă ca `Rand` din rezumatul zilei individuale
 * (`portal/pontajul-meu/zi/[data]/formular-zi.tsx`) — cele două ecrane arată
 * aceleași mărimi și n-au voie să le prezinte diferit.
 */
function RandTotal({
  eticheta,
  valoare,
  accent = false,
  discret = false,
}: {
  readonly eticheta: string;
  readonly valoare: number;
  readonly accent?: boolean;
  readonly discret?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className={discret ? "text-muted-foreground" : "text-foreground"}>{eticheta}</dt>
      <dd
        className={`tabular-nums ${accent ? "text-foreground font-medium" : "text-muted-foreground"}`}
      >
        {formatOre(valoare)} h
      </dd>
    </div>
  );
}

export interface ZiFormular {
  readonly data: string;
  readonly tip_prezenta: TipPrezenta;
  /** `"08:30"` sau `""` pentru o zi nelucrată. */
  readonly ora_inceput: string;
  readonly ora_sfarsit: string;
  readonly observatii: string;
}

interface Proprietati {
  readonly saptamanaStart: string;
  readonly zileInitiale: readonly ZiFormular[];
  readonly poateEdita: boolean;
  /** Parametrii firmei după care se derivă orele — aceiași ca la ziua individuală. */
  readonly config: ConfigZi;
  /**
   * Regula după care ies cifrele din coloana „Ore”, scrisă în cuvinte —
   * `rezumatRegulaPontaj`. Vine gata compusă de pe server fiindcă numai acolo
   * se știe dacă firma are ÎNTR-ADEVĂR setări sau se merge pe valorile de
   * rezervă; `config` singur nu poate deosebi cele două cazuri.
   */
  readonly regulaFirmei: string;
  /** Starea inițială a casetei de weekend: din săptămână, sau din setările firmei. */
  readonly lucreazaWeekendInitial: boolean;
  /**
   * Fișa pentru care se completează; `null` sau lipsă = a celui care privește.
   *
   * OPȚIONALĂ deliberat: portalul (`/portal/pontajul-meu/saptamana`) folosește
   * același formular și e prin definiție „săptămâna mea" — n-are ce alege și
   * nu trebuie să afle că alegerea există.
   */
  readonly employeeId?: string | null;
}

const ETICHETE_ZI = ["Luni", "Marți", "Miercuri", "Joi", "Vineri", "Sâmbătă", "Duminică"] as const;

/** Eticheta zilei vine din poziție, deci indexul călătorește cu rândul. */
interface RandZi extends ZiFormular {
  readonly index: number;
}

export function FormularSaptamana({
  saptamanaStart,
  zileInitiale,
  poateEdita,
  config,
  regulaFirmei,
  lucreazaWeekendInitial,
  employeeId = null,
}: Proprietati) {
  const router = useRouter();
  const [inCurs, porneste] = useTransition();
  const [eroare, setEroare] = useState<string | null>(null);
  const [zile, setZile] = useState<readonly ZiFormular[]>(zileInitiale);
  const [lucreazaWeekend, setLucreazaWeekend] = useState(lucreazaWeekendInitial);
  const idBaza = useId();
  const idWeekend = useId();

  function actualizeazaZi(index: number, campuri: Partial<ZiFormular>): void {
    setZile((curent) => curent.map((zi, i) => (i === index ? { ...zi, ...campuri } : zi)));
  }

  /**
   * Intervalul primei zile completate, copiat pe restul zilelor VIZIBILE și
   * goale. Fără el, un program fix înseamnă zece câmpuri de oră tastate identic
   * în fiecare săptămână — iar ecranul ăsta se deschide de pe telefon.
   */
  function copiazaPeSaptamana(): void {
    const sursa = zile.find((z) => z.ora_inceput.length > 0 && z.ora_sfarsit.length > 0);
    if (sursa === undefined) return;
    setZile((curent) =>
      curent.map((zi, i) => {
        if (!lucreazaWeekend && INDICI_WEEKEND.has(i)) return zi;
        if (zi.ora_inceput.length > 0 || zi.ora_sfarsit.length > 0) return zi;
        return { ...zi, ora_inceput: sursa.ora_inceput, ora_sfarsit: sursa.ora_sfarsit };
      }),
    );
  }

  function trimite(status: "ciorna" | "trimisa"): void {
    setEroare(null);
    porneste(async () => {
      const rezultat = await trimiteSaptamanaPontaj({
        saptamana_start: saptamanaStart,
        status,
        lucreaza_weekend: lucreazaWeekend,
        // `null` = fișa mea. Diferit de null doar când patronul sau un manager
        // a ales pe altcineva din selectorul de sus (0084).
        employee_id: employeeId,
        // Zilele de weekend ascunse pleacă FĂRĂ interval, deci serverul le scrie
        // cu zero ore. Nu se omit din listă: rândul trebuie să existe, ca
        // aprobatorul să vadă săptămâna întreagă.
        zile: zile.map((zi, i) => ({
          data: zi.data,
          tip_prezenta: zi.tip_prezenta,
          ...intervalDeTrimis(zi, i, lucreazaWeekend),
          // Rescrisă pe server din interval; trimisă doar fiindcă schema o cere.
          ore_planificate: 0,
          observatii: zi.observatii.length === 0 ? null : zi.observatii,
        })),
      });
      if (!rezultat.ok) {
        setEroare(rezultat.error.message);
        return;
      }
      router.refresh();
    });
  }

  const randuri: readonly RandZi[] = zile
    .map((zi, index) => ({ ...zi, index }))
    .filter((rand) => lucreazaWeekend || !INDICI_WEEKEND.has(rand.index));

  /*
   * Omul introduce șapte intervale și, până acum, afla din ele o singură cifră:
   * „Total planificat". Nu și câte ore SUPLIMENTARE ies din ele — deși aia e
   * cifra care se plătește cu spor și singura pe care n-o poate socoti singur,
   * fiindcă depinde de norma zilnică și de pauza firmei.
   *
   * Suplimentarele se adună PE ZI, nu se derivă din totalul săptămânii: pragul
   * din `oreSuplimentareDinLucrate` e zilnic. O săptămână cu 40 de ore în care
   * o zi are 10 și alta 6 conține două ore suplimentare, nu zero.
   *
   * Se calculează aici, nu într-un `<tfoot>`: subsolul tabelului se randează
   * doar peste 768px, iar ecranul ăsta e singurul din modul deschis de pe
   * telefon.
   */
  const totaluri = randuri.reduce(
    (suma, rand) => {
      const zi = derivateZi(rand);
      if (zi === null) return suma;
      return {
        brut: suma.brut + zi.brut,
        pauza: suma.pauza + zi.pauza,
        lucrate: suma.lucrate + zi.lucrate,
        suplimentare: suma.suplimentare + zi.suplimentare,
        noapte: suma.noapte + zi.noapte,
      };
    },
    { brut: 0, pauza: 0, lucrate: 0, suplimentare: 0, noapte: 0 },
  );

  /** Cifrele unei zile, derivate — aceeași funcție pe care o rulează serverul. */
  function derivateZi(zi: ZiFormular): OreleZilei | null {
    if (zi.ora_inceput.length === 0 || zi.ora_sfarsit.length === 0) return null;
    return oreleZilei(zi.ora_inceput, zi.ora_sfarsit, config);
  }

  /** Doar orele lucrate, pentru coloana din tabel. */
  function oreZi(zi: ZiFormular): number | null {
    return derivateZi(zi)?.lucrate ?? null;
  }

  const coloane: readonly Coloana<RandZi>[] = [
    {
      cheie: "zi",
      antet: "Zi",
      latime: "ingusta",
      peTelefon: "titlu",
      celula: (rand) => (
        <>
          {ETICHETE_ZI[rand.index]}
          <span className="text-muted-foreground ml-1.5 font-normal">
            {new Date(`${rand.data}T00:00:00Z`).toLocaleDateString("ro-RO", {
              day: "2-digit",
              month: "2-digit",
            })}
          </span>
        </>
      ),
    },
    {
      cheie: "tip_prezenta",
      antet: "Cum vin la lucru",
      peTelefon: "meta",
      celula: (rand) => (
        <select
          aria-label={`Mod de prezență — ${ETICHETE_ZI[rand.index]}`}
          value={rand.tip_prezenta}
          disabled={!poateEdita || inCurs}
          onChange={(e) => {
            actualizeazaZi(rand.index, { tip_prezenta: e.target.value as TipPrezenta });
          }}
          className="border-foreground/60 disabled:bg-surface rounded-control text-corp border px-2 py-1.5 disabled:cursor-not-allowed"
        >
          {TIPURI_PREZENTA.map((t) => (
            <option key={t} value={t}>
              {ETICHETE_TIP_PREZENTA[t]}
            </option>
          ))}
        </select>
      ),
    },
    {
      cheie: "interval",
      antet: "De la – până la",
      peTelefon: "meta",
      /*
        `span`, nu `div`: pe telefon `Tabel` randează coloanele `meta` prin
        `CardRand`, ÎNTR-UN `<p>` (tabel.tsx §CardRand). Un `<div>` acolo e
        marcaj nevalid — browserul închide paragraful singur, arborele lui nu
        mai seamănă cu cel randat pe server, iar React raportează eroare de
        hidratare și rescrie nodul. Nimic nu se vede stricat; doar consola
        țipă și randarea se face de două ori.
      */
      celula: (rand) => (
        <span className="inline-flex items-center gap-1">
          <IntrareOra
            aria-label={`Ora de intrare — ${ETICHETE_ZI[rand.index]}`}
            valoare={rand.ora_inceput}
            disabled={!poateEdita || inCurs}
            onSchimba={(v) => {
              actualizeazaZi(rand.index, { ora_inceput: v });
            }}
            className="w-20 px-2"
          />
          <span aria-hidden="true" className="text-muted-foreground">
            –
          </span>
          <IntrareOra
            aria-label={`Ora de ieșire — ${ETICHETE_ZI[rand.index]}`}
            valoare={rand.ora_sfarsit}
            disabled={!poateEdita || inCurs}
            onSchimba={(v) => {
              actualizeazaZi(rand.index, { ora_sfarsit: v });
            }}
            className="w-20 px-2"
          />
        </span>
      ),
    },
    {
      /*
        Cifra e o OGLINDĂ, nu un câmp: serverul o recalculează din interval prin
        același `oreleZilei`, cu pauza de masă a firmei scăzută. Un câmp
        editabil aici ar lăsa cifra să se depărteze de interval, exact ce s-a
        închis pe ecranul zilei.
      */
      cheie: "ore_planificate",
      antet: "Ore",
      numeric: true,
      latime: "ingusta",
      peTelefon: "meta",
      celula: (rand) => {
        const ore = oreZi(rand);
        if (ore === null) {
          return (
            <span className="text-muted-foreground">
              {rand.ora_inceput.length > 0 || rand.ora_sfarsit.length > 0 ? "—" : "0:00"}
            </span>
          );
        }
        return <span>{formatOre(ore)}</span>;
      },
    },
    {
      cheie: "observatii",
      antet: "Observații",
      peTelefon: "meta",
      celula: (rand) => (
        <input
          aria-label={`Observații — ${ETICHETE_ZI[rand.index]}`}
          type="text"
          maxLength={500}
          value={rand.observatii}
          disabled={!poateEdita || inCurs}
          onChange={(e) => {
            actualizeazaZi(rand.index, { observatii: e.target.value });
          }}
          className="border-foreground/60 disabled:bg-surface rounded-control text-corp w-full min-w-32 border px-2 py-1.5 disabled:cursor-not-allowed"
        />
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {poateEdita ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">
            <input
              id={idWeekend}
              type="checkbox"
              checked={lucreazaWeekend}
              disabled={inCurs}
              onChange={(e) => {
                setLucreazaWeekend(e.target.checked);
              }}
              className="mt-1 size-4 shrink-0"
            />
            <label htmlFor={idWeekend} className="text-corp">
              Lucrez în weekend
              <span className="text-muted-foreground text-nota block">
                Debifat, sâmbăta și duminica nu apar în plan și pleacă spre aprobare cu zero ore.
              </span>
            </label>
          </div>
          <Buton varianta="tertiar" disabled={inCurs} onClick={copiazaPeSaptamana}>
            Copiază pe toată săptămâna
          </Buton>
        </div>
      ) : null}

      <Tabel
        caption="Planul de prezență pentru săptămâna selectată."
        coloane={coloane}
        randuri={randuri}
        cheieRand={(rand) => rand.data}
        densitate="compact"
        gol={null}
      />

      {/*
        REGIUNE VIE, ca rezumatul zilei individuale: cifrele se schimbă la
        fiecare interval tastat, iar cine completează cu cititorul de ecran
        trebuie să le audă fără să plece din câmp.
      */}
      <section
        aria-live="polite"
        aria-label="Totalul săptămânii"
        className="border-border bg-surface rounded-panou border px-4 py-3"
      >
        <h2 className="text-corp mb-2 font-medium">Totalul săptămânii</h2>
        <dl className="text-corp space-y-1">
          <RandTotal eticheta="Interval declarat" valoare={totaluri.brut} />
          {totaluri.pauza > 0 ? (
            <RandTotal eticheta="Pauză de masă" valoare={-totaluri.pauza} discret />
          ) : null}
          <div className="border-border mt-2 border-t pt-2">
            <RandTotal eticheta="Ore lucrate" valoare={totaluri.lucrate} accent />
          </div>
          <RandTotal eticheta="Din care suplimentare" valoare={totaluri.suplimentare} />
          {totaluri.noapte > 0 ? (
            <RandTotal eticheta="Din care de noapte" valoare={totaluri.noapte} />
          ) : null}
        </dl>
        {/*
          Regula stă lipită de cifre, nu într-un panou separat: e explicația
          lor. Coloana „Ore” scade pauza sau n-o scade după ea, iar când NU o
          scade nimic din tabel nu spune că există o pauză — două reguli
          complet diferite arată identic pe ecran.
        */}
        <p className="border-border text-muted-foreground text-nota mt-3 border-t pt-2">
          {regulaFirmei}
        </p>
      </section>

      <div aria-live="polite">
        {eroare === null ? null : <p className="text-danger text-corp">{eroare}</p>}
      </div>

      {poateEdita ? (
        <div className="flex flex-wrap gap-2">
          <Buton
            varianta="secundar"
            disabled={inCurs}
            onClick={() => {
              trimite("ciorna");
            }}
            id={idBaza}
          >
            Salvează ciornă
          </Buton>
          <Buton
            varianta="primar"
            inCurs={inCurs}
            textInCurs="Se trimite…"
            onClick={() => {
              trimite("trimisa");
            }}
          >
            Trimite spre aprobare
          </Buton>
        </div>
      ) : null}
    </div>
  );
}
