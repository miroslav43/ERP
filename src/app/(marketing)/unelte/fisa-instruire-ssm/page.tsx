// src/app/(marketing)/unelte/fisa-instruire-ssm/page.tsx
import type { Metadata } from "next";
import Link from "next/link";

import { LEGATURI_CONEXE } from "@/content/landing/legaturi";
import { RO } from "@/content/landing/ro";
import { ANTET_FISA_SSM } from "@/content/landing/unelte";

import { AntetSecundar } from "../../_componente/antet-secundar";
import { Banda } from "../../_componente/banda";
import { Cadru } from "../../_componente/cadru";
import { Descarcari } from "../../_componente/descarcari";
import { metadatePagina } from "../../_componente/metadate";
import { PeAcelasiSubiect } from "../../_componente/pe-acelasi-subiect";
import { PrevizualizareDocument } from "../../_componente/previzualizare-document";
import { construiesteFisaSsm, parametriFisaSsm } from "./model";

/**
 * Fișa individuală de instruire SSM, gratuită.
 *
 * Fiecare rând din banda „Când se face fiecare instruire” are articolul lui din
 * normele aprobate prin HG 1425/2006, citite pe 2 oct 2026 în Portalul
 * Legislativ (doc. 134138). Instruirea la locul de muncă nu are durată sau
 * interval scris aici: normele le lasă în instrucțiunile proprii ale firmei.
 */
export const metadata: Metadata = metadatePagina({
  titlu: "Fișa de instruire SSM: model completabil",
  descriere:
    "Fișa individuală de instruire SSM după anexa 11 la HG 1425/2006: instruirea la angajare, periodică și suplimentară, cu cele trei semnături. Model gratuit în Word sau PDF.",
  cale: "/unelte/fisa-instruire-ssm",
});

type Proprietati = Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>;

const unul = (v: string | string[] | undefined): string | undefined =>
  Array.isArray(v) ? v[0] : v;

const CLASA_CAMP =
  "border-mk-rigla bg-mk-hartie focus:border-mk-text rounded w-full border px-3 py-2 text-[0.9375rem]";

const CAMPURI = [
  { nume: "nume", eticheta: "Numele și prenumele", exemplu: "Popa Ion" },
  { nume: "functie", eticheta: "Funcția", exemplu: "Electrician" },
  { nume: "loc", eticheta: "Locul de muncă", exemplu: "Atelier întreținere" },
  { nume: "firma", eticheta: "Întreprinderea/unitatea", exemplu: "" },
] as const;

const INSTRUIRI = [
  {
    tip: "Cele trei faze",
    regula: "Instruirea SSM are trei faze: introductiv-generală, la locul de muncă și periodică.",
    temei: "art. 77",
  },
  {
    tip: "Introductiv-generală",
    regula:
      "La angajare, cu o durată stabilită prin instrucțiuni proprii, dar nu mai mică de 8 ore.",
    temei: "art. 87 alin. (2)",
  },
  {
    tip: "Periodică",
    regula:
      "Intervalul dintre două instruiri periodice nu va fi mai mare de 6 luni; pentru personalul tehnico-administrativ, de cel mult 12 luni.",
    temei: "art. 96 alin. (2¹) și (3)",
  },
  {
    tip: "Suplimentară",
    regula:
      "În plus față de cea programată: când lucrătorul a lipsit peste 30 de zile lucrătoare, la reluarea activității după un accident de muncă, la schimbarea echipamentului, a tehnologiei sau a procedurilor de lucru, la lucrări speciale.",
    temei: "art. 98",
  },
  {
    tip: "Consemnarea",
    regula:
      "Obligatoriu în fișa individuală, cu materialul predat, durata și data; fișa se păstrează de la angajare până la încetarea raporturilor de muncă.",
    temei: "art. 81",
  },
] as const;

export default async function PaginaFisaSsm({ searchParams }: Proprietati) {
  const p = await searchParams;
  const q = new URLSearchParams();
  for (const c of CAMPURI) {
    const v = unul(p[c.nume]);
    if (v !== undefined && v !== "") q.set(c.nume, v);
  }
  const ales = parametriFisaSsm(q);
  const document = construiesteFisaSsm(ales);
  const valori: Readonly<Record<(typeof CAMPURI)[number]["nume"], string>> = {
    nume: ales.nume,
    functie: ales.functie,
    loc: ales.locMunca,
    firma: ales.firma,
  };

  return (
    <Cadru text={RO}>
      <div data-tipar="ascunde">
        <AntetSecundar
          text={ANTET_FISA_SSM}
          firimituri={[
            { eticheta: "Acasă", href: "/" },
            { eticheta: "Unelte", href: "/unelte" },
            { eticheta: "Fișa de instruire SSM", href: "/unelte/fisa-instruire-ssm" },
          ]}
        />
      </div>

      <div data-tipar="ascunde">
        <Banda
          inaltime="scurta"
          supratitlu="Ce spun normele"
          titlu="Când se face fiecare instruire"
          lead="Articolele sunt din normele metodologice aprobate prin HG 1425/2006."
        >
          <dl className="border-mk-rigla/40 mt-6 border-t">
            {INSTRUIRI.map((r) => (
              <div
                key={r.tip}
                className="border-mk-rigla/40 grid gap-1 border-b py-4 md:grid-cols-12 md:gap-8"
              >
                <dt className="font-mk-display text-[1rem] font-semibold md:col-span-3">{r.tip}</dt>
                <dd className="text-mk-text-slab text-[0.9375rem] leading-[1.65] md:col-span-7">
                  {r.regula}
                </dd>
                <dd className="font-mk-date text-mk-text-slab text-[0.75rem] tracking-[0.04em] md:col-span-2">
                  {r.temei}
                </dd>
              </div>
            ))}
          </dl>
        </Banda>
      </div>

      <Banda inaltime="scurta">
        <form
          method="get"
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
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
          <div className="flex items-end sm:col-span-2 lg:col-span-4">
            <button
              type="submit"
              data-umami-event="ssm-genereaza"
              className="bg-mk-cerneala text-mk-text-inv inline-flex h-11 items-center justify-center rounded px-8 text-[0.9375rem] font-medium transition-opacity hover:opacity-90"
            >
              Completează fișa
            </button>
          </div>
        </form>
        <div className="mt-6">
          <Descarcari
            eveniment="ssm"
            formate={["docx", "pdf"]}
            href={(format) => `/api/unelte/fisa-instruire-ssm?${q.toString()}&format=${format}`}
          />
        </div>
      </Banda>

      <Banda inaltime="scurta">
        <PrevizualizareDocument document={document} />
      </Banda>

      <div data-tipar="ascunde">
        <Banda inaltime="scurta" supratitlu="Fără hârtie" titlu="Scadențele, înainte să treacă">
          <p className="text-mk-text-slab mt-4 max-w-[68ch] text-[0.9375rem] leading-[1.7]">
            Instruirile periodice, fișele de aptitudini și echipamentul de protecție, cu alertă
            înainte de termen, pentru fiecare om.{" "}
            <Link href="/module/ssm" className="underline underline-offset-4">
              Cum arată modulul SSM
            </Link>
            .
          </p>
          <PeAcelasiSubiect legaturi={LEGATURI_CONEXE["/unelte/fisa-instruire-ssm"]} />
        </Banda>
      </div>
    </Cadru>
  );
}
