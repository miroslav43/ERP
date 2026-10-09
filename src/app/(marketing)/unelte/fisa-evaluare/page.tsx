// src/app/(marketing)/unelte/fisa-evaluare/page.tsx
import type { Metadata } from "next";
import Link from "next/link";

import { LEGATURI_CONEXE } from "@/content/landing/legaturi";
import { RO } from "@/content/landing/ro";
import { ANTET_FISA_EVALUARE } from "@/content/landing/unelte";

import { AntetSecundar } from "../../_componente/antet-secundar";
import { Banda } from "../../_componente/banda";
import { Cadru } from "../../_componente/cadru";
import { JsonLd } from "../../_componente/json-ld";
import { nodUnealta } from "../../_componente/noduri-json-ld";
import { Descarcari } from "../../_componente/descarcari";
import { metadatePagina } from "../../_componente/metadate";
import { PeAcelasiSubiect } from "../../_componente/pe-acelasi-subiect";
import { PrevizualizareDocument } from "../../_componente/previzualizare-document";
import { CRITERII_IMPLICITE, construiesteFisaEvaluare, parametriFisaEvaluare } from "./model";

/**
 * Fișa de evaluare a angajaților, gratuită.
 *
 * „evaluare angajați codul muncii” e printre cele mai sugerate forme: banda „Ce
 * spune Codul muncii” răspunde la ea înainte de formular, cu cele două articole
 * verificate pe forma consolidată la 2 oct 2026.
 */
export const metadata: Metadata = metadatePagina({
  titlu: "Fișa de evaluare a angajaților: model Word, PDF",
  descriere:
    "Fișa de evaluare a performanțelor profesionale, cu criteriile firmei, pondere și notă pe fiecare. Ce cere Codul muncii. Model gratuit în Word, PDF sau Excel.",
  cale: "/unelte/fisa-evaluare",
});

type Proprietati = Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>;

const unul = (v: string | string[] | undefined): string | undefined =>
  Array.isArray(v) ? v[0] : v;

const CLASA_CAMP =
  "border-mk-rigla bg-mk-hartie focus:border-mk-text rounded w-full border px-3 py-2.5 text-base";

const CAMPURI = [
  { nume: "nume", eticheta: "Angajat", exemplu: "Ilie Maria" },
  { nume: "functie", eticheta: "Funcția", exemplu: "Contabil" },
  { nume: "perioada", eticheta: "Perioada evaluată", exemplu: "ianuarie – decembrie 2026" },
  { nume: "evaluator", eticheta: "Evaluator", exemplu: "Popa Ion, director" },
  { nume: "firma", eticheta: "Firma (opțional)", exemplu: "" },
] as const;

export default async function PaginaFisaEvaluare({ searchParams }: Proprietati) {
  const p = await searchParams;
  const q = new URLSearchParams();
  for (const cheie of ["nume", "functie", "perioada", "evaluator", "firma", "criterii"]) {
    const v = unul(p[cheie]);
    if (v !== undefined && v !== "") q.set(cheie, v);
  }
  const ales = parametriFisaEvaluare(q);
  const document = construiesteFisaEvaluare(ales);
  const valori: Readonly<Record<(typeof CAMPURI)[number]["nume"], string>> = {
    nume: ales.nume,
    functie: ales.functie,
    perioada: ales.perioada,
    evaluator: ales.evaluator,
    firma: ales.firma,
  };

  return (
    <Cadru text={RO}>
      <JsonLd
        date={nodUnealta({
          cale: "/unelte/fisa-evaluare",
          nume: ANTET_FISA_EVALUARE.titlu,
          descriere: ANTET_FISA_EVALUARE.lead,
        })}
      />
      <div data-tipar="ascunde">
        <AntetSecundar
          text={ANTET_FISA_EVALUARE}
          firimituri={[
            { eticheta: "Acasă", href: "/" },
            { eticheta: "Unelte", href: "/unelte" },
            { eticheta: "Fișa de evaluare", href: "/unelte/fisa-evaluare" },
          ]}
        />
      </div>

      <div data-tipar="ascunde">
        <Banda
          inaltime="scurta"
          supratitlu="Pe scurt"
          titlu="Ce spune Codul muncii despre evaluare"
        >
          <div className="mt-4 max-w-[68ch] space-y-3 text-[0.9375rem] leading-[1.7]">
            <p>
              Codul muncii nu impune un model de fișă. Îi dă angajatorului dreptul să stabilească
              obiectivele de performanță individuală și criteriile de evaluare a realizării lor —
              art. 40 alin. (1) lit. f).
            </p>
            <p>
              Criteriile trebuie însă comunicate salariatului: sunt printre elementele despre care
              acesta e informat la angajare — art. 17 alin. (3) lit. e). O evaluare după criterii pe
              care omul nu le-a primit e greu de susținut.
            </p>
          </div>
        </Banda>
      </div>

      {/* Toată banda formularului rămâne pe ecran: altfel umplutura și rigla ei
          se tipăreau goale deasupra documentului. */}
      <Banda inaltime="scurta" data-tipar="ascunde">
        <form
          action="#documentul"
          method="get"
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          data-tipar="ascunde"
        >
          {CAMPURI.map((c) => (
            <label key={c.nume} className="flex flex-col gap-1.5">
              <span className="text-[0.875rem] font-medium">{c.eticheta}</span>
              <input
                type="text"
                name={c.nume}
                maxLength={120}
                defaultValue={valori[c.nume]}
                placeholder={c.exemplu}
                className={CLASA_CAMP}
              />
            </label>
          ))}
          <label className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-3">
            <span className="text-[0.875rem] font-medium">Criteriile firmei (opțional)</span>
            <span className="text-mk-text-slab text-[0.8125rem]">
              Câte unul pe rând, cel mult 15. Gol = lista de mai jos.
            </span>
            <textarea
              name="criterii"
              rows={4}
              defaultValue={unul(p.criterii) ?? ""}
              placeholder={CRITERII_IMPLICITE.join("\n")}
              className={CLASA_CAMP}
            />
          </label>
          <div className="flex items-end">
            <button
              type="submit"
              data-umami-event="evaluare-genereaza"
              className="bg-mk-cerneala text-mk-text-inv inline-flex h-11 w-full items-center justify-center rounded px-5 text-[0.9375rem] font-medium transition-opacity hover:opacity-90"
            >
              Completează fișa
            </button>
          </div>
          <Descarcari
            actiune="/api/unelte/fisa-evaluare"
            eveniment="evaluare"
            formate={["docx", "pdf", "xlsx"]}
          />
        </form>
      </Banda>

      <Banda id="documentul" inaltime="scurta">
        <PrevizualizareDocument document={document} />
      </Banda>

      <div data-tipar="ascunde">
        <Banda
          inaltime="scurta"
          supratitlu="Fără hârtie"
          titlu="Evaluările, cu istoric pe fiecare om"
        >
          <p className="text-mk-text-slab mt-4 max-w-[68ch] text-[0.9375rem] leading-[1.7]">
            Criteriile firmei, evaluările de la an la an și cine le-a semnat, într-un singur loc.{" "}
            <Link href="/module/evaluari" className="underline underline-offset-4">
              Cum arată modulul de evaluări
            </Link>
            .
          </p>
          <PeAcelasiSubiect legaturi={LEGATURI_CONEXE["/unelte/fisa-evaluare"]} />
        </Banda>
      </div>
    </Cadru>
  );
}
