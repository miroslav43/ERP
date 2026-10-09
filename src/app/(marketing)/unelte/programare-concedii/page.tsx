// src/app/(marketing)/unelte/programare-concedii/page.tsx
import type { Metadata } from "next";
import Link from "next/link";

import { exempluPentru, imagineExemplu } from "@/content/landing/exemple-unelte";
import { LEGATURI_CONEXE } from "@/content/landing/legaturi";
import { RO } from "@/content/landing/ro";
import { metaUnealta } from "@/content/landing/seo-unelte";
import { ANTET_PROGRAMARE_CONCEDII } from "@/content/landing/unelte";
import { AN_MAX_INTERVAL, AN_MIN_INTERVAL } from "@/domain/calendar/interval-lucrator";
import { todayInBucharest } from "@/lib/format/date";

import { AntetSecundar } from "../../_componente/antet-secundar";
import { Banda } from "../../_componente/banda";
import { Cadru } from "../../_componente/cadru";
import { Descarcari } from "../../_componente/descarcari";
import { ExempluCompletat } from "../../_componente/exemplu-completat";
import { IntrebariUnealta } from "../../_componente/intrebari-unealta";
import { JsonLd } from "../../_componente/json-ld";
import { metadatePagina } from "../../_componente/metadate";
import { nodUnealta } from "../../_componente/noduri-json-ld";
import { PeAcelasiSubiect } from "../../_componente/pe-acelasi-subiect";
import { PrevizualizareDocument } from "../../_componente/previzualizare-document";
import { INTREBARI_PROGRAMARE } from "./intrebari";
import { citesteProgramare, construiesteProgramare, ZILE_MAXIME, ZILE_MINIME } from "./model";

/**
 * Programarea concediilor de odihnă, gratuită.
 *
 * Completarea automată Google, 8 oct 2026: „programare concedii de odihna 2026
 * excel” și „planificare concedii odihna excel” sunt primele forme ale celor
 * două familii. Anul din titlu e anul care se programează (din octombrie, cel
 * următor), deci metadatele se calculează la cerere.
 */
const CALE = "/unelte/programare-concedii";

export function generateMetadata(): Metadata {
  return metadatePagina(metaUnealta(CALE));
}

type Proprietati = Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>;

const unul = (v: string | string[] | undefined): string | undefined =>
  Array.isArray(v) ? v[0] : v;

const CLASA_CAMP =
  "border-mk-rigla bg-mk-hartie focus:border-mk-text rounded w-full border px-3 py-2.5 text-base";

const ANI = Array.from(
  { length: AN_MAX_INTERVAL - AN_MIN_INTERVAL + 1 },
  (_, i) => AN_MIN_INTERVAL + i,
);

export default async function PaginaProgramareConcedii({ searchParams }: Proprietati) {
  const p = await searchParams;
  const q = new URLSearchParams();
  for (const cheie of ["an", "firma", "compartiment", "zile", "angajati"]) {
    const v = unul(p[cheie]);
    if (v !== undefined && v !== "") q.set(cheie, v);
  }
  const { parametri, avertismente } = citesteProgramare(q, todayInBucharest());
  const document = construiesteProgramare(parametri);
  const exemplu = exempluPentru(CALE);

  return (
    <Cadru text={RO}>
      <JsonLd
        date={nodUnealta({
          cale: CALE,
          nume: ANTET_PROGRAMARE_CONCEDII.titlu,
          descriere: ANTET_PROGRAMARE_CONCEDII.lead,
          ...(exemplu === undefined ? {} : { imagine: imagineExemplu(exemplu) }),
        })}
      />
      <div data-tipar="ascunde">
        <AntetSecundar
          text={ANTET_PROGRAMARE_CONCEDII}
          firimituri={[
            { eticheta: "Acasă", href: "/" },
            { eticheta: "Unelte", href: "/unelte" },
            { eticheta: "Programarea concediilor", href: CALE },
          ]}
        />
      </div>

      <div data-tipar="ascunde">
        <Banda inaltime="scurta" supratitlu="Pe scurt" titlu="Ce cere Codul muncii">
          <div className="mt-4 max-w-[68ch] space-y-3 text-[0.9375rem] leading-[1.7]">
            <p>
              Concediile de odihnă se programează până la sfârșitul anului, pentru anul următor:
              colectiv, cu consultarea sindicatului sau a reprezentanților salariaților, ori
              individual, cu consultarea fiecărui om (art. 148 alin. (1)).
            </p>
            <p>
              Codul nu impune un formular. Tabelul de aici are un rând pe om și o coloană pe lună,
              cu zilele lucrătoare ale fiecărei luni în antet, ca să vezi dintr-o privire cât
              consumă un interval.
            </p>
          </div>
        </Banda>
      </div>

      <Banda inaltime="scurta">
        <form
          action="#documentul"
          method="get"
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
          data-tipar="ascunde"
        >
          <label className="flex flex-col gap-1.5">
            <span className="text-[0.875rem] font-medium">Anul programat</span>
            <select name="an" defaultValue={String(parametri.an)} className={CLASA_CAMP}>
              {ANI.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[0.875rem] font-medium">Zile cuvenite pe an</span>
            <input
              type="number"
              name="zile"
              min={ZILE_MINIME}
              max={ZILE_MAXIME}
              inputMode="numeric"
              defaultValue={String(parametri.zileCuvenite)}
              className={CLASA_CAMP}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[0.875rem] font-medium">Firma (opțional)</span>
            <input
              type="text"
              name="firma"
              maxLength={120}
              defaultValue={parametri.firma}
              className={CLASA_CAMP}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[0.875rem] font-medium">Compartimentul (opțional)</span>
            <input
              type="text"
              name="compartiment"
              maxLength={120}
              defaultValue={parametri.compartiment}
              className={CLASA_CAMP}
            />
          </label>
          <label className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-4">
            <span className="text-[0.875rem] font-medium">Angajații, câte unul pe rând</span>
            <textarea
              name="angajati"
              rows={4}
              maxLength={6000}
              defaultValue={parametri.angajati.join("\n")}
              placeholder={"Popa Ion\nIlie Maria\nRadu Andrei"}
              className={CLASA_CAMP}
            />
          </label>
          <div className="flex items-end">
            <button
              type="submit"
              data-umami-event="programare-genereaza"
              className="bg-mk-cerneala text-mk-text-inv inline-flex h-11 w-full items-center justify-center rounded px-5 text-[0.9375rem] font-medium transition-opacity hover:opacity-90"
            >
              Completează tabelul
            </button>
          </div>
          <Descarcari
            actiune="/api/unelte/programare-concedii"
            eveniment="programare"
            formate={["xlsx", "pdf", "docx"]}
          />
        </form>
        {avertismente.length > 0 && (
          <ul
            role="status"
            className="border-mk-rigla mt-6 max-w-[68ch] space-y-1 border-l-2 pl-4 text-[0.9375rem]"
            data-tipar="ascunde"
          >
            {avertismente.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        )}
      </Banda>

      <Banda id="documentul" inaltime="scurta">
        <PrevizualizareDocument document={document} />
      </Banda>

      <ExempluCompletat exemplu={exemplu} />

      <div data-tipar="ascunde">
        <IntrebariUnealta
          titlu="Ce se mai întreabă despre programarea concediilor"
          intrebari={INTREBARI_PROGRAMARE}
        />

        <Banda
          inaltime="scurta"
          supratitlu="Fără hârtie"
          titlu="Programarea, devenită calendarul echipei"
        >
          <p className="text-mk-text-slab mt-4 max-w-[68ch] text-[0.9375rem] leading-[1.7]">
            În aplicație, concediile apar pe planificator, un rând pe om și o coloană pe zi, iar
            suprapunerile se văd înainte de aprobare.{" "}
            <Link href="/module/concedii" className="underline underline-offset-4">
              Cum arată modulul de concedii
            </Link>
            .
          </p>
          <PeAcelasiSubiect legaturi={LEGATURI_CONEXE["/unelte/programare-concedii"]} />
        </Banda>
      </div>
    </Cadru>
  );
}
