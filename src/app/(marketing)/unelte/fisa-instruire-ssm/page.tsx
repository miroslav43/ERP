// src/app/(marketing)/unelte/fisa-instruire-ssm/page.tsx
import type { Metadata } from "next";
import Link from "next/link";

import { exempluPentru, imagineExemplu } from "@/content/landing/exemple-unelte";
import { LEGATURI_CONEXE } from "@/content/landing/legaturi";
import { RO } from "@/content/landing/ro";
import { metaUnealta } from "@/content/landing/seo-unelte";
import { ANTET_FISA_SSM } from "@/content/landing/unelte";
import { cuDe } from "@/content/legal/zile-libere";
import { formatDate } from "@/lib/format/date";

import { AntetSecundar } from "../../_componente/antet-secundar";
import { Banda } from "../../_componente/banda";
import { Cadru } from "../../_componente/cadru";
import { JsonLd } from "../../_componente/json-ld";
import { nodUnealta } from "../../_componente/noduri-json-ld";
import { Descarcari } from "../../_componente/descarcari";
import { ExempluCompletat } from "../../_componente/exemplu-completat";
import { metadatePagina } from "../../_componente/metadate";
import { PeAcelasiSubiect } from "../../_componente/pe-acelasi-subiect";
import { PrevizualizareDocument } from "../../_componente/previzualizare-document";
import {
  ANI_ACOPERITI,
  construiesteFisaSsm,
  INSTRUIRI_SSM,
  parametriFisaSsm,
  PERIODICITATI,
  randuriPeriodice,
  scadentePeriodice,
  type Periodicitate,
} from "./model";

/**
 * Fișa individuală de instruire SSM, gratuită, completă după anexa 11.
 *
 * Fiecare rând din banda „Ce spun normele” are articolul lui din normele
 * aprobate prin HG 1425/2006, în forma consolidată din 07.03.2022 (Portalul
 * Legislativ, doc. 252029, recitită pe 8 oct 2026). Lista stă în `model.ts`,
 * unde o păzește un test.
 *
 * Termenele instruirii periodice se arată DOAR pe pagină: anexa n-are o
 * rubrică pentru ele, iar o dată tipărită în coloana „Data instruirii” ar
 * arăta ca o instruire făcută.
 */
export const metadata: Metadata = metadatePagina(metaUnealta("/unelte/fisa-instruire-ssm"));

type Proprietati = Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>;

const unul = (v: string | string[] | undefined): string | undefined =>
  Array.isArray(v) ? v[0] : v;

const CLASA_CAMP =
  "border-mk-rigla bg-mk-hartie focus:border-mk-text rounded w-full border px-3 py-2.5 text-base";
const CLASA_GRUP = "grid gap-4 sm:grid-cols-2 lg:grid-cols-3";
const CLASA_LEGENDA = "font-mk-display col-span-full text-[1rem] font-semibold";

const CAMPURI_LUCRATOR = [
  { nume: "nume", eticheta: "Numele și prenumele", exemplu: "Popa Ion" },
  { nume: "marca", eticheta: "Legitimația, marca", exemplu: "" },
  { nume: "calificare", eticheta: "Calificarea", exemplu: "Electrician" },
  { nume: "functie", eticheta: "Funcția", exemplu: "Electrician întreținere" },
  { nume: "loc", eticheta: "Locul de muncă", exemplu: "Atelier întreținere" },
  { nume: "firma", eticheta: "Întreprinderea/unitatea", exemplu: "" },
] as const;

const FAZE = [
  {
    titlu: "1) Introductiv-generală",
    data: "data_ig",
    ore: "ore_ig",
    instructor: "instructor_ig",
    functie: "functie_ig",
    exemplu: "Lucrător desemnat",
  },
  {
    titlu: "2) La locul de muncă",
    data: "data_lm",
    ore: "ore_lm",
    instructor: "instructor_lm",
    functie: "functie_lm",
    exemplu: "Șef atelier",
  },
] as const;

/** Câte termene se arată pe pagină; restul le ține minte modulul SSM. */
const SCADENTE_PE_PAGINA = 6;

function Camp({
  nume,
  eticheta,
  valoare,
  exemplu = "",
  tip = "text",
}: Readonly<{
  nume: string;
  eticheta: string;
  valoare: string;
  exemplu?: string;
  tip?: "text" | "date" | "number";
}>) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[0.875rem] font-medium">{eticheta}</span>
      <input
        type={tip}
        name={nume}
        defaultValue={valoare}
        placeholder={exemplu}
        className={CLASA_CAMP}
        {...(tip === "text" ? { maxLength: 120 } : {})}
        {...(tip === "number" ? { min: 1, max: 40, step: 1, inputMode: "numeric" as const } : {})}
      />
    </label>
  );
}

export default async function PaginaFisaSsm({ searchParams }: Proprietati) {
  const p = await searchParams;
  const q = new URLSearchParams();
  for (const [cheie, v] of Object.entries(p)) {
    const valoare = unul(v);
    if (valoare !== undefined && valoare !== "") q.set(cheie, valoare);
  }
  const ales = parametriFisaSsm(q);
  const document = construiesteFisaSsm(ales);
  const exemplu = exempluPentru("/unelte/fisa-instruire-ssm");
  const lucrator: Readonly<Record<(typeof CAMPURI_LUCRATOR)[number]["nume"], string>> = {
    nume: ales.nume,
    marca: ales.marca,
    calificare: ales.calificare,
    functie: ales.functie,
    loc: ales.locMunca,
    firma: ales.firma,
  };
  const ore = (v: number | null) => (v === null ? "" : String(v));
  const faze: Readonly<Record<string, string>> = {
    data_ig: ales.dataIg ?? "",
    ore_ig: ore(ales.oreIg),
    instructor_ig: ales.instructorIg,
    functie_ig: ales.functieIg,
    data_lm: ales.dataLm ?? "",
    ore_lm: ore(ales.oreLm),
    instructor_lm: ales.instructorLm,
    functie_lm: ales.functieLm,
  };
  const angajareCompletata =
    Object.values(faze).some((v) => v !== "") || ales.admisNume !== "" || ales.admisFunctie !== "";
  // Zilele ISO se compară ca șiruri. Aceeași zi e permisă: art. 90 alin. (1)
  // cere doar ordinea. Fișa nu se corectează, omul decide.
  const fazeInversate = ales.dataIg !== null && ales.dataLm !== null && ales.dataLm < ales.dataIg;
  const nrRanduri = randuriPeriodice(ales.periodicitate, ales.ani);
  // Prima instruire periodică se socotește de la ultima instruire la angajare.
  const start = ales.dataLm ?? ales.dataIg;
  const scadente =
    start === null
      ? []
      : scadentePeriodice(
          start,
          PERIODICITATI[ales.periodicitate].luni,
          Math.min(nrRanduri, SCADENTE_PE_PAGINA),
        );

  return (
    <Cadru text={RO}>
      <JsonLd
        date={nodUnealta({
          cale: "/unelte/fisa-instruire-ssm",
          nume: ANTET_FISA_SSM.titlu,
          descriere: ANTET_FISA_SSM.lead,
          ...(exemplu === undefined ? {} : { imagine: imagineExemplu(exemplu) }),
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

      {/* Toată banda formularului rămâne pe ecran: altfel umplutura și rigla ei
          se tipăreau goale deasupra documentului. */}
      <Banda inaltime="scurta" data-tipar="ascunde">
        <form action="#documentul" method="get" className="grid gap-8" data-tipar="ascunde">
          <fieldset className={CLASA_GRUP}>
            <legend className={CLASA_LEGENDA}>Lucrătorul</legend>
            {CAMPURI_LUCRATOR.map((c) => (
              <Camp
                key={c.nume}
                nume={c.nume}
                eticheta={c.eticheta}
                valoare={lucrator[c.nume]}
                exemplu={c.exemplu}
              />
            ))}
          </fieldset>

          <details open={angajareCompletata} className="border-mk-rigla/40 border-t pt-4">
            <summary className="cursor-pointer text-[0.9375rem] font-medium">
              Instruirea la angajare: data, orele, cine a instruit (opțional)
            </summary>
            <div className="mt-4 grid gap-6">
              {FAZE.map((f) => (
                <fieldset key={f.data} className={CLASA_GRUP}>
                  <legend className={CLASA_LEGENDA}>{f.titlu}</legend>
                  <Camp nume={f.data} eticheta="Data" valoare={faze[f.data] ?? ""} tip="date" />
                  <Camp
                    nume={f.ore}
                    eticheta="Durata (ore, cel puțin 1)"
                    valoare={faze[f.ore] ?? ""}
                    tip="number"
                  />
                  <Camp
                    nume={f.instructor}
                    eticheta="Cine a făcut instruirea"
                    valoare={faze[f.instructor] ?? ""}
                  />
                  <Camp
                    nume={f.functie}
                    eticheta="Funcția lui"
                    valoare={faze[f.functie] ?? ""}
                    exemplu={f.exemplu}
                  />
                </fieldset>
              ))}
              <fieldset className={CLASA_GRUP}>
                <legend className={CLASA_LEGENDA}>3) Admis la lucru de</legend>
                <Camp nume="admis_nume" eticheta="Numele și prenumele" valoare={ales.admisNume} />
                <Camp
                  nume="admis_functie"
                  eticheta="Funcția (șef secție, atelier, șantier)"
                  valoare={ales.admisFunctie}
                />
              </fieldset>
            </div>
          </details>
          {fazeInversate && (
            <p role="status" className="max-w-[68ch] text-[0.875rem]">
              Instruirea la locul de muncă se face după cea introductiv-generală (art. 90 alin.
              (1)). Verifică datele de la punctele 1) și 2): fișa le scrie așa cum le-ai dat.
            </p>
          )}

          <fieldset className={CLASA_GRUP}>
            <legend className={CLASA_LEGENDA}>Rândurile de instruire periodică</legend>
            <label className="flex flex-col gap-1.5">
              <span className="text-[0.875rem] font-medium">Periodicitatea</span>
              <select name="periodicitate" defaultValue={ales.periodicitate} className={CLASA_CAMP}>
                {(Object.keys(PERIODICITATI) as Periodicitate[]).map((k) => (
                  <option key={k} value={k}>
                    {PERIODICITATI[k].eticheta}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[0.875rem] font-medium">Pentru câți ani</span>
              <select name="ani" defaultValue={String(ales.ani)} className={CLASA_CAMP}>
                {ANI_ACOPERITI.map((n) => (
                  <option key={n} value={String(n)}>
                    {n === 1 ? "un an" : `${String(n)} ani`}
                  </option>
                ))}
              </select>
            </label>
            <p className="text-mk-text-slab self-end text-[0.875rem]" data-rinduri={nrRanduri}>
              Fișa va avea {nrRanduri === 1 ? "un rând" : cuDe(nrRanduri, "rânduri")} de instruire
              periodică și 6 pentru instruirea suplimentară, fiecare înalt de 1 cm.
            </p>
            {ales.periodicitate === "anuala" && (
              <p role="status" className="col-span-full max-w-[68ch] text-[0.875rem]">
                Intervalul de 12 luni e permis doar personalului tehnico-administrativ (art. 96
                alin. (3)); pentru ceilalți, cel mult 6 luni (art. 96 alin. (2¹)).
              </p>
            )}
          </fieldset>

          <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
            <button
              type="submit"
              data-umami-event="ssm-genereaza"
              className="bg-mk-cerneala text-mk-text-inv inline-flex h-11 items-center justify-center rounded px-8 text-[0.9375rem] font-medium transition-opacity hover:opacity-90"
            >
              Completează fișa
            </button>
            <Descarcari
              actiune="/api/unelte/fisa-instruire-ssm"
              eveniment="ssm"
              formate={["docx", "pdf"]}
            />
          </div>
        </form>
      </Banda>

      <Banda id="documentul" inaltime="scurta">
        <PrevizualizareDocument document={document} />
      </Banda>

      <div data-tipar="ascunde">
        <Banda
          inaltime="scurta"
          supratitlu="Ce spun normele"
          titlu="Cine face fiecare instruire și când"
          lead="Articolele sunt din normele metodologice aprobate prin HG 1425/2006, în forma consolidată din 7 martie 2022. Fișa de mai sus are toate rubricile anexei 11, în ordinea ei."
        >
          <dl className="border-mk-rigla/40 mt-6 border-t">
            {INSTRUIRI_SSM.map((r) => (
              <div
                key={r.tip}
                className="border-mk-rigla/40 grid gap-1 border-b py-4 md:grid-cols-12 md:gap-8"
              >
                <dt className="font-mk-display text-[1rem] font-semibold md:col-span-3">{r.tip}</dt>
                <dd className="text-mk-text-slab text-[0.9375rem] leading-[1.65] md:col-span-7">
                  {r.regula} <span className="text-mk-text">Cine: {r.cine}</span>
                </dd>
                <dd className="font-mk-date text-mk-text-slab text-[0.75rem] tracking-[0.04em] md:col-span-2">
                  {r.temei}
                </dd>
              </div>
            ))}
          </dl>
          <p className="text-mk-text-slab mt-6 max-w-[68ch] text-[0.9375rem] leading-[1.7]">
            Lucrătorii unei firme care îți prestează servicii și vizitatorii nu primesc fișă
            individuală: pentru ei se întocmește fișa de instruire colectivă din anexa 12, în două
            exemplare sau electronic (art. 82 alin. (2)–(4)).
          </p>
        </Banda>
      </div>

      <ExempluCompletat exemplu={exemplu} />

      <div data-tipar="ascunde">
        <Banda inaltime="scurta" supratitlu="Fără hârtie" titlu="Scadențele, înainte să treacă">
          {scadente.length > 0 && (
            <div className="mt-4">
              <p className="max-w-[68ch] text-[0.9375rem] leading-[1.7]">
                Instruirea periodică{ales.nume === "" ? "" : ` pentru ${ales.nume}`}, la
                periodicitatea aleasă, socotită de la {formatDate(start ?? "")}, cel târziu la:
              </p>
              <ol data-scadente className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-[0.9375rem]">
                {scadente.map((zi) => (
                  <li key={zi} className="font-mk-date">
                    {formatDate(zi)}
                  </li>
                ))}
              </ol>
            </div>
          )}
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
