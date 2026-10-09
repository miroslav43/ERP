// src/app/(marketing)/unelte/fisa-evaluare/page.tsx
import type { Metadata } from "next";
import Link from "next/link";

import { exempluPentru, imagineExemplu } from "@/content/landing/exemple-unelte";
import { LEGATURI_CONEXE } from "@/content/landing/legaturi";
import { RO } from "@/content/landing/ro";
import { metaUnealta } from "@/content/landing/seo-unelte";
import { ANTET_FISA_EVALUARE } from "@/content/landing/unelte";

import { AntetSecundar } from "../../_componente/antet-secundar";
import { Banda } from "../../_componente/banda";
import { Cadru } from "../../_componente/cadru";
import { Descarcari } from "../../_componente/descarcari";
import { ExempluCompletat } from "../../_componente/exemplu-completat";
import { JsonLd } from "../../_componente/json-ld";
import { metadatePagina } from "../../_componente/metadate";
import { nodUnealta } from "../../_componente/noduri-json-ld";
import { PeAcelasiSubiect } from "../../_componente/pe-acelasi-subiect";
import { PrevizualizareDocument } from "../../_componente/previzualizare-document";
import { GrilaEvaluare } from "./grila-evaluare";
import { PASI_CONCEDIERE, REGULI_EVALUARE, type RegulaLege } from "./lege";
import { construiesteFisaEvaluare, MAX_RUBRICA, parametriFisaEvaluare } from "./model";

/**
 * Fișa de evaluare a angajaților, gratuită, care calculează.
 *
 * Auditul din 8 oct 2026 a dat-o „puțin peste un tabel Word”: promitea
 * „pondere și notă”, dar nu se putea scrie niciuna, Excelul n-avea nicio
 * formulă, PDF-ul tăia criteriile, iar pagina tăcea despre ce contează juridic.
 * Acum: seturi de criterii pe post, ponderea și nota pe fiecare, nota finală și
 * calificativul calculate pe loc și în Excel, rubricile pe care le are orice
 * model serios și cele două benzi de lege, verificate pe forma consolidată la
 * 27.04.2026 (`lege.ts`).
 *
 * `searchParams` e `Promise` în Next 16 (`node_modules/next/dist/docs/01-app/
 * 03-api-reference/03-file-conventions/page.md`). Valorile repetate
 * (`criteriu`, `pondere`, `nota`) vin ca tablou și se păstrează TOATE, inclusiv
 * cele goale: pozițiile lor aliniază rândurile.
 */
export const metadata: Metadata = metadatePagina(metaUnealta("/unelte/fisa-evaluare"));

type Proprietati = Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>;

/** Cheile pe care le citește `parametriFisaEvaluare`; restul adresei (UTM, `m`) nu intră. */
const CHEI: ReadonlySet<string> = new Set([
  "nume",
  "functie",
  "perioada",
  "evaluator",
  "firma",
  "data",
  "set",
  "incarca",
  "criteriu",
  "pondere",
  "nota",
  "criterii",
  "prag_fb",
  "prag_b",
  "prag_s",
  "puncte_forte",
  "de_imbunatatit",
  "obiective",
  "dezvoltare",
]);

const CLASA_CAMP =
  "border-mk-rigla bg-mk-hartie focus:border-mk-text rounded w-full border px-3 py-2.5 text-base";

const CAMPURI = [
  { nume: "nume", eticheta: "Angajat", exemplu: "Ilie Maria" },
  { nume: "functie", eticheta: "Funcția", exemplu: "Contabil" },
  { nume: "perioada", eticheta: "Perioada evaluată", exemplu: "ianuarie – decembrie 2026" },
  { nume: "evaluator", eticheta: "Evaluator", exemplu: "Popa Ion, director" },
  { nume: "firma", eticheta: "Firma (opțional)", exemplu: "" },
] as const;

const RUBRICI = [
  { nume: "puncte_forte", eticheta: "Puncte forte" },
  { nume: "de_imbunatatit", eticheta: "De îmbunătățit" },
  { nume: "obiective", eticheta: "Obiective pentru perioada următoare" },
  { nume: "dezvoltare", eticheta: "Plan de dezvoltare (formare, îndrumare)" },
] as const;

function ListaLege({ reguli }: Readonly<{ reguli: readonly RegulaLege[] }>) {
  return (
    <dl className="border-mk-rigla/40 mt-6 border-t">
      {reguli.map((r) => (
        <div
          key={r.tip}
          className="border-mk-rigla/40 grid gap-1 border-b py-4 md:grid-cols-12 md:gap-8"
        >
          <dt className="font-mk-display text-[1rem] font-semibold md:col-span-3">{r.tip}</dt>
          <dd className="text-mk-text-slab text-[0.9375rem] leading-[1.65] md:col-span-6">
            {r.regula}
          </dd>
          <dd className="font-mk-date text-mk-text-slab text-[0.75rem] tracking-[0.04em] md:col-span-3">
            {r.temei}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export default async function PaginaFisaEvaluare({ searchParams }: Proprietati) {
  const p = await searchParams;
  const q = new URLSearchParams();
  for (const [cheie, valoare] of Object.entries(p)) {
    if (!CHEI.has(cheie)) continue;
    for (const v of Array.isArray(valoare) ? valoare : [valoare]) {
      if (v !== undefined) q.append(cheie, v);
    }
  }
  const ales = parametriFisaEvaluare(q);
  const document = construiesteFisaEvaluare(ales);
  const exemplu = exempluPentru("/unelte/fisa-evaluare");
  const valori: Readonly<Record<(typeof CAMPURI)[number]["nume"], string>> = {
    nume: ales.nume,
    functie: ales.functie,
    perioada: ales.perioada,
    evaluator: ales.evaluator,
    firma: ales.firma,
  };
  const valoriRubrici: Readonly<Record<(typeof RUBRICI)[number]["nume"], string>> = {
    puncte_forte: ales.puncteForte,
    de_imbunatatit: ales.deImbunatatit,
    obiective: ales.obiective,
    dezvoltare: ales.dezvoltare,
  };
  const rubriciCompletate = Object.values(valoriRubrici).some((v) => v !== "");

  return (
    <Cadru text={RO}>
      <JsonLd
        date={nodUnealta({
          cale: "/unelte/fisa-evaluare",
          nume: ANTET_FISA_EVALUARE.titlu,
          descriere: ANTET_FISA_EVALUARE.lead,
          ...(exemplu === undefined ? {} : { imagine: imagineExemplu(exemplu) }),
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

      <Banda
        inaltime="scurta"
        supratitlu="Pe scurt"
        titlu="Ce spune Codul muncii despre evaluare"
        lead="Codul muncii nu dă un model de fișă pentru firmele private. Spune cine stabilește criteriile, unde se scriu și cum se schimbă. Rezumat după forma consolidată la 27 aprilie 2026."
        data-tipar="ascunde"
      >
        <ListaLege reguli={REGULI_EVALUARE} />
      </Banda>

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
          <label className="flex flex-col gap-1.5">
            <span className="text-[0.875rem] font-medium">Data evaluării (opțional)</span>
            <input type="date" name="data" defaultValue={ales.data} className={CLASA_CAMP} />
          </label>

          <GrilaEvaluare grila={ales.grila} set={ales.set} praguri={ales.praguri} />

          <details className="sm:col-span-2 lg:col-span-3" open={rubriciCompletate}>
            <summary className="cursor-pointer text-[0.875rem] font-medium">
              Puncte forte, obiective și plan de dezvoltare (opțional)
            </summary>
            <p className="text-mk-text-slab mt-2 text-[0.8125rem]">
              Goale, rămân rânduri de scris de mână. Rubrica „Comentariile angajatului” e mereu
              goală: o completează el.
            </p>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              {RUBRICI.map((r) => (
                <label key={r.nume} className="flex flex-col gap-1.5">
                  <span className="text-[0.875rem] font-medium">{r.eticheta}</span>
                  <textarea
                    name={r.nume}
                    rows={3}
                    maxLength={MAX_RUBRICA}
                    defaultValue={valoriRubrici[r.nume]}
                    className={CLASA_CAMP}
                  />
                </label>
              ))}
            </div>
          </details>

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

      <Banda
        inaltime="scurta"
        supratitlu="Când evaluarea devine dovadă"
        titlu="Concedierea pentru necorespundere profesională"
        lead="E singurul motiv de concediere pentru care codul cere o evaluare înainte. Pașii, în ordine. Pentru un caz concret, vorbește cu juristul firmei."
        data-tipar="ascunde"
      >
        <ListaLege reguli={PASI_CONCEDIERE} />
      </Banda>

      <ExempluCompletat exemplu={exemplu} />

      <Banda
        inaltime="scurta"
        supratitlu="Fără hârtie"
        titlu="Evaluările, cu istoric pe fiecare om"
        data-tipar="ascunde"
      >
        <p className="text-mk-text-slab mt-4 max-w-[68ch] text-[0.9375rem] leading-[1.7]">
          În aplicație, criteriile, ponderile și scala devin un șablon pe care îl copiezi de la an
          la an. Evaluarea finalizată se închide și rămâne în dosarul omului, iar angajatul și-o
          citește în portal.
        </p>
        <p className="mt-4 flex flex-wrap gap-x-8 gap-y-2 text-[0.9375rem]">
          <Link href="/module/evaluari" className="underline underline-offset-4">
            Cum arată modulul de evaluări
          </Link>
          <Link href={RO.hero.ctaPrimar.href} className="underline underline-offset-4">
            {RO.hero.ctaPrimar.eticheta}
          </Link>
        </p>
        <PeAcelasiSubiect legaturi={LEGATURI_CONEXE["/unelte/fisa-evaluare"]} />
      </Banda>
    </Cadru>
  );
}
