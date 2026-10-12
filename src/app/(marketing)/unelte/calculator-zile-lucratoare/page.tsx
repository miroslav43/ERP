// src/app/(marketing)/unelte/calculator-zile-lucratoare/page.tsx
import type { Metadata } from "next";
import Link from "next/link";

import { LEGATURI_CONEXE } from "@/content/landing/legaturi";
import { RO } from "@/content/landing/ro";
import { metaUnealta } from "@/content/landing/seo-unelte";
import { ANTET_CALCULATOR_ZILE_LUCRATOARE } from "@/content/landing/unelte";
import { dataLunga } from "@/domain/calendar/interval-lucrator";
import { todayInBucharest } from "@/lib/format/date";

import { AntetSecundar } from "../../_componente/antet-secundar";
import { Banda } from "../../_componente/banda";
import { Cadru } from "../../_componente/cadru";
import { ContinuaInAplicatie, aGenerat } from "../../_componente/continua-in-aplicatie";
import { IntrebariUnealta } from "../../_componente/intrebari-unealta";
import { JsonLd } from "../../_componente/json-ld";
import { metadatePagina } from "../../_componente/metadate";
import { nodUnealta } from "../../_componente/noduri-json-ld";
import { PeAcelasiSubiect } from "../../_componente/pe-acelasi-subiect";
import { zileLucratoareText } from "../cerere-concediu-de-odihna/text-zile";
import { calculeaza, citesteCalculul, titluRezultat, type RezultatCalcul } from "./calcul";
import { intrebariZileLucratoare } from "./intrebari";

/**
 * Calculatorul de zile lucrătoare, gratuit, fără cont.
 *
 * Completarea automată Google, 8 oct 2026: „calculator zile lucratoare intre
 * doua date” e primul termen al familiei, iar „…de la data” al doilea. Pagina
 * răspunde la amândouă și, fără parametri, la a treia întrebare frecventă:
 * câte zile lucrătoare are luna asta.
 */
const CALE = "/unelte/calculator-zile-lucratoare";

export const metadata: Metadata = metadatePagina(metaUnealta(CALE));

type Proprietati = Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>;

const unul = (v: string | string[] | undefined): string | undefined =>
  Array.isArray(v) ? v[0] : v;

const CLASA_CAMP =
  "border-mk-rigla bg-mk-hartie focus:border-mk-text rounded w-full border px-3 py-2.5 text-base";

const CLASA_BUTON =
  "bg-mk-cerneala text-mk-text-inv inline-flex h-11 w-full items-center justify-center rounded px-5 text-[0.9375rem] font-medium transition-opacity hover:opacity-90";

function Explicatie({ r }: { r: RezultatCalcul }) {
  if (r.mod === "interval") {
    const i = r.interval;
    return (
      <div className="mt-4 max-w-[68ch] space-y-3 text-[0.9375rem] leading-[1.7]">
        <p>
          Între {dataLunga(i.deLa)} și {dataLunga(i.panaLa)}, inclusiv: {i.zileCalendaristice}{" "}
          {i.zileCalendaristice === 1 ? "zi calendaristică" : "zile calendaristice"}, dintre care{" "}
          {i.zileWeekend} în weekend și {i.sarbatoriScazute.length}{" "}
          {i.sarbatoriScazute.length === 1 ? "sărbătoare legală" : "sărbători legale"} în timpul
          săptămânii.
        </p>
        {i.sarbatoriScazute.length > 0 && (
          <ul className="list-disc space-y-1 pl-5">
            {i.sarbatoriScazute.map((s) => (
              <li key={s.data}>
                {dataLunga(s.data)}: {s.denumire}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }
  return (
    <div className="mt-4 max-w-[68ch] space-y-3 text-[0.9375rem] leading-[1.7]">
      <p>
        {r.zile === 0
          ? `Fără zile adăugate, termenul e chiar ${dataLunga(r.deLa)}.`
          : `${r.zile === 1 ? "Prima zi lucrătoare" : `A ${String(r.zile)}-a zi lucrătoare`} după ${dataLunga(r.deLa)}. Numărătoarea începe a doua zi și sare peste sâmbete, duminici și sărbătorile legale.`}
      </p>
      {r.sarite.length > 0 && (
        <ul className="list-disc space-y-1 pl-5">
          {r.sarite.map((s) => (
            <li key={s.data}>
              {dataLunga(s.data)}: {s.denumire}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default async function PaginaCalculatorZileLucratoare({ searchParams }: Proprietati) {
  const p = await searchParams;
  const q = new URLSearchParams();
  for (const cheie of ["mod", "de_la", "pana_la", "zile"]) {
    const v = unul(p[cheie]);
    if (v !== undefined && v !== "") q.set(cheie, v);
  }
  const azi = todayInBucharest();
  const citire = citesteCalculul(q, azi);
  let rezultat: RezultatCalcul | null = null;
  let problema: string | null = citire.probleme[0] ?? null;
  if (problema === null) {
    try {
      rezultat = calculeaza(citire);
    } catch (eroare) {
      if (!(eroare instanceof RangeError)) throw eroare;
      problema = eroare.message;
    }
  }
  const an = Number(azi.slice(0, 4));

  return (
    <Cadru text={RO}>
      <JsonLd
        date={nodUnealta({
          cale: CALE,
          nume: ANTET_CALCULATOR_ZILE_LUCRATOARE.titlu,
          descriere: ANTET_CALCULATOR_ZILE_LUCRATOARE.lead,
        })}
      />
      <AntetSecundar
        text={ANTET_CALCULATOR_ZILE_LUCRATOARE}
        firimituri={[
          { eticheta: "Acasă", href: "/" },
          { eticheta: "Unelte", href: "/unelte" },
          { eticheta: "Calculator zile lucrătoare", href: CALE },
        ]}
      />

      <Banda inaltime="scurta" supratitlu="Între două date" titlu="Câte zile lucrătoare sunt">
        <form method="get" action="#rezultat" className="mt-6 grid gap-4 sm:grid-cols-3">
          <input type="hidden" name="mod" value="interval" />
          <label className="flex flex-col gap-1.5">
            <span className="text-[0.875rem] font-medium">De la (inclusiv)</span>
            <input type="date" name="de_la" defaultValue={citire.deLa} className={CLASA_CAMP} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[0.875rem] font-medium">Până la (inclusiv)</span>
            <input type="date" name="pana_la" defaultValue={citire.panaLa} className={CLASA_CAMP} />
          </label>
          <div className="flex items-end">
            <button
              type="submit"
              data-umami-event="zile-lucratoare-interval"
              className={CLASA_BUTON}
            >
              Numără zilele
            </button>
          </div>
        </form>
      </Banda>

      <Banda
        inaltime="scurta"
        supratitlu="Peste un număr de zile"
        titlu="Ce dată e peste N zile lucrătoare"
      >
        <form method="get" action="#rezultat" className="mt-6 grid gap-4 sm:grid-cols-3">
          <input type="hidden" name="mod" value="adauga" />
          <label className="flex flex-col gap-1.5">
            <span className="text-[0.875rem] font-medium">Data de pornire</span>
            <input type="date" name="de_la" defaultValue={citire.deLa} className={CLASA_CAMP} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[0.875rem] font-medium">Zile lucrătoare de adăugat</span>
            <input
              type="number"
              name="zile"
              min={0}
              max={400}
              inputMode="numeric"
              defaultValue={String(citire.zile)}
              className={CLASA_CAMP}
            />
          </label>
          <div className="flex items-end">
            <button type="submit" data-umami-event="zile-lucratoare-adauga" className={CLASA_BUTON}>
              Află data
            </button>
          </div>
        </form>
      </Banda>

      <Banda
        id="rezultat"
        inaltime="scurta"
        supratitlu="Rezultatul"
        titlu={rezultat === null ? "De corectat" : titluRezultat(rezultat)}
      >
        {problema !== null && (
          <p
            role="status"
            className="border-mk-rigla mt-4 max-w-[68ch] border-l-2 pl-4 text-[0.9375rem]"
          >
            {problema}
          </p>
        )}
        {rezultat !== null && <Explicatie r={rezultat} />}
        <p className="text-mk-text-slab mt-6 max-w-[68ch] text-[0.875rem] leading-[1.6]">
          Doar sărbătorile legale se scad; zilele libere din contractul colectiv sau din
          regulamentul intern, nu. Pentru un concediu, zilele le numără direct{" "}
          <Link href="/unelte/cerere-concediu-de-odihna" className="underline underline-offset-4">
            cererea de concediu
          </Link>
          ; pentru o demisie, ultima zi de preaviz o calculează{" "}
          <Link href="/unelte/cerere-demisie" className="underline underline-offset-4">
            cererea de demisie
          </Link>
          .
        </p>
      </Banda>

      <ContinuaInAplicatie unealta="calculator-zile-lucratoare" generat={aGenerat(p)} />

      <IntrebariUnealta
        titlu="Ce se mai întreabă despre zilele lucrătoare"
        intrebari={intrebariZileLucratoare(an)}
      />

      <Banda
        inaltime="scurta"
        supratitlu="Fără calcule de mână"
        titlu="Zilele lucrătoare, direct în pontaj"
      >
        <p className="text-mk-text-slab mt-4 max-w-[68ch] text-[0.9375rem] leading-[1.7]">
          În aplicație, norma fiecărei luni ({zileLucratoareText(22)} în octombrie 2026, de exemplu)
          și concediile se calculează pe același calendar, cu zilele libere ale firmei adăugate o
          dată.{" "}
          <Link href="/module/pontaj" className="underline underline-offset-4">
            Cum arată modulul de pontaj
          </Link>
          .
        </p>
        <PeAcelasiSubiect legaturi={LEGATURI_CONEXE["/unelte/calculator-zile-lucratoare"]} />
      </Banda>
    </Cadru>
  );
}
