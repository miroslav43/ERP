// src/app/(marketing)/unelte/fisa-instruire-ssm/page.tsx
import type { Metadata } from "next";
import Link from "next/link";

import { LEGATURI_CONEXE } from "@/content/landing/legaturi";
import { RO } from "@/content/landing/ro";
import { ANTET_FISA_SSM } from "@/content/landing/unelte";

import { AntetSecundar } from "../../_componente/antet-secundar";
import { Banda } from "../../_componente/banda";
import { Cadru } from "../../_componente/cadru";
import { JsonLd } from "../../_componente/json-ld";
import { nodUnealta } from "../../_componente/noduri-json-ld";
import { Descarcari } from "../../_componente/descarcari";
import { metadatePagina } from "../../_componente/metadate";
import { PeAcelasiSubiect } from "../../_componente/pe-acelasi-subiect";
import { PrevizualizareDocument } from "../../_componente/previzualizare-document";
import { construiesteFisaSsm, INSTRUIRI_SSM, parametriFisaSsm } from "./model";

/**
 * Fișa individuală de instruire SSM, gratuită.
 *
 * Fiecare rând din banda „Când se face fiecare instruire” are articolul lui din
 * normele aprobate prin HG 1425/2006, în forma consolidată din 2022 (Portalul
 * Legislativ, doc. 252029, recitită pe 7 oct 2026). Lista stă în `model.ts`,
 * unde o păzește un test.
 */
export const metadata: Metadata = metadatePagina({
  titlu: "Fișa de instruire SSM: model PDF și Word",
  descriere:
    "Fișa individuală de instruire SSM (anexa 11, HG 1425/2006), pe hârtie sau în format electronic: la angajare, periodică, suplimentară. Model Word, PDF.",
  cale: "/unelte/fisa-instruire-ssm",
});

type Proprietati = Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>;

const unul = (v: string | string[] | undefined): string | undefined =>
  Array.isArray(v) ? v[0] : v;

const CLASA_CAMP =
  "border-mk-rigla bg-mk-hartie focus:border-mk-text rounded w-full border px-3 py-2.5 text-base";

const CAMPURI = [
  { nume: "nume", eticheta: "Numele și prenumele", exemplu: "Popa Ion" },
  { nume: "functie", eticheta: "Funcția", exemplu: "Electrician" },
  { nume: "loc", eticheta: "Locul de muncă", exemplu: "Atelier întreținere" },
  { nume: "firma", eticheta: "Întreprinderea/unitatea", exemplu: "" },
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
      <JsonLd
        date={nodUnealta({
          cale: "/unelte/fisa-instruire-ssm",
          nume: ANTET_FISA_SSM.titlu,
          descriere: ANTET_FISA_SSM.lead,
        })}
      />
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
          lead="Articolele sunt din normele metodologice aprobate prin HG 1425/2006, în forma în vigoare. Din martie 2022, fișa se poate ține și în format electronic, semnată olograf sau cu semnătură electronică."
        >
          <dl className="border-mk-rigla/40 mt-6 border-t">
            {INSTRUIRI_SSM.map((r) => (
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

      {/* Toată banda formularului rămâne pe ecran: altfel umplutura și rigla ei
          se tipăreau goale deasupra documentului. */}
      <Banda inaltime="scurta" data-tipar="ascunde">
        <form
          action="#documentul"
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
          <Descarcari
            actiune="/api/unelte/fisa-instruire-ssm"
            eveniment="ssm"
            formate={["docx", "pdf"]}
          />
        </form>
      </Banda>

      <Banda id="documentul" inaltime="scurta">
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
