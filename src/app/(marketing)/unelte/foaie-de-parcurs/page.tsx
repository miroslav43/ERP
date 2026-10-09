// src/app/(marketing)/unelte/foaie-de-parcurs/page.tsx
import type { Metadata } from "next";
import Link from "next/link";

import { LEGATURI_CONEXE } from "@/content/landing/legaturi";
import { RO } from "@/content/landing/ro";
import { ANTET_FOAIE_PARCURS } from "@/content/landing/unelte";

import { AntetSecundar } from "../../_componente/antet-secundar";
import { AvizCorectari } from "../../_componente/aviz-corectari";
import { Banda } from "../../_componente/banda";
import { Cadru } from "../../_componente/cadru";
import { JsonLd } from "../../_componente/json-ld";
import { nodUnealta } from "../../_componente/noduri-json-ld";
import { Descarcari } from "../../_componente/descarcari";
import { metadatePagina } from "../../_componente/metadate";
import { PeAcelasiSubiect } from "../../_componente/pe-acelasi-subiect";
import { PrevizualizareDocument } from "../../_componente/previzualizare-document";
import { AN_MAX, AN_MIN, avizeParametri, LUNI } from "../foaie-de-pontaj/foaie";
import {
  avizeFoaieParcurs,
  CATEGORII,
  COMBUSTIBILI,
  construiesteFoaieParcurs,
  ETICHETE_CATEGORIE,
  ETICHETE_COMBUSTIBIL,
  ETICHETE_UTILIZARE,
  EXEMPLU_COMPLETAT,
  MAX_CURSE_PE_ZI,
  parametriFoaieParcurs,
  UTILIZARI,
} from "./model";

/**
 * Foaia de parcurs, gratuită.
 *
 * Keyword Planner, 2 oct 2026: „foaie de parcurs model” are 100–1.000 de
 * căutări pe lună, cu „word free download”, „pdf” și „excel” printre sugestii.
 * Formular GET, ca restul uneltelor: starea stă în adresă.
 *
 * Din 8 oct 2026 foaia are cele patru elemente minime din normele Codului
 * fiscal (vezi `model.ts`), mai multe curse pe zi, alimentările, rezumatul
 * lunii și un Excel cu formule.
 */
export const metadata: Metadata = metadatePagina({
  titlu: "Foaie de parcurs: model Word, PDF și Excel",
  descriere:
    "Foaie de parcurs cu cele 4 elemente cerute de normele Codului fiscal: mai multe curse pe zi, alimentări, Excel cu formule. Gratuită, în Word și PDF, fără cont.",
  cale: "/unelte/foaie-de-parcurs",
});

type Proprietati = Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>;

const unul = (v: string | string[] | undefined): string | undefined =>
  Array.isArray(v) ? v[0] : v;

const CLASA_CAMP =
  "border-mk-rigla bg-mk-hartie focus:border-mk-text rounded w-full border px-3 py-2.5 text-base";

/** Parametrii pe care îi citește foaia; restul adresei se ignoră. */
const CHEI = [
  "an",
  "luna",
  "auto",
  "marca",
  "sofer",
  "firma",
  "cui",
  "nr",
  "categorie",
  "combustibil",
  "utilizare",
  "norma",
  "km",
  "stoc",
  "curse",
] as const;

/**
 * Răspunsurile stau pe textul legii, verificat pe 8 oct 2026 pe formele
 * consolidate de pe legislatie.just.ro: Codul fiscal (08.08.2026), normele HG
 * 1/2016 (31.03.2026), OMFP 2634/2015 (01.08.2024). Ce nu spune legea textual
 * (ce e „categoria de vehicul”) e spus ca atare și trecut în NOTES.md ⚠.
 */
const INTREBARI: readonly Readonly<{ q: string; a: string; href?: string }>[] = [
  {
    q: "Există un formular tipizat obligatoriu?",
    a: "Nu. OMFP 2634/2015, ordinul cu modelele documentelor financiar-contabile, nu are un model de foaie de parcurs. Normele Codului fiscal cer conținutul, adică cele patru informații de mai sus, nu un anumit formular. Modelul de aici e pentru mașinile firmei: nu ține locul documentelor cerute în transportul rutier profesional de mărfuri sau de persoane, cum sunt înregistrările tahografului.",
  },
  {
    q: "Ce înseamnă „categoria de vehicul”?",
    a: "Normele cer categoria, dar n-o definesc. Foaia scrie de aceea două lucruri: tipul vehiculului (autoturism, autoutilitară și celelalte) și felul în care e folosit, cu temeiul din Codul fiscal, de exemplu „agent de vânzări — art. 298 alin. (3) lit. b)”. Încadrarea o face firma (pct. 68 alin. (8) din norme); dacă ai dubii, întreabă contabilul.",
  },
  {
    q: "Cum trec norma de consum?",
    a: "Normele cer „norma proprie de consum carburant pe kilometru parcurs”, deci norma firmei pentru mașina respectivă. Foaia o scrie în litri la 100 km și, alături, pe kilometru: 6,5 l/100 km înseamnă 0,065 l/km. Excel-ul înmulțește singur kilometrii fiecărei curse cu norma și, la sfârșitul lunii, pune stocul după normă lângă cel constatat la bord.",
  },
  {
    q: "O foaie pe zi sau una pe lună?",
    a: "Normele nu cer o anumită perioadă. Modelul e lunar, cu fiecare zi a lunii trecută deja. Dacă mașina face mai multe drumuri pe zi, cum face un agent de vânzări, alegi 2, 3 sau 4 rânduri pe zi, câte unul pe deplasare.",
  },
  {
    q: "Cum arată o foaie completată?",
    a: "Ca mai sus, cu mașina, norma și kilometrajul de început trecute. Poți deschide un exemplu completat pentru un agent de vânzări, cu două rânduri pe zi, apoi îl schimbi cu datele tale.",
    href: EXEMPLU_COMPLETAT,
  },
];

const CAMPURI_TEXT = [
  { nume: "auto", eticheta: "Nr. de înmatriculare", exemplu: "B-123-ABC", max: 120 },
  { nume: "marca", eticheta: "Marca și modelul", exemplu: "Dacia Logan", max: 120 },
  { nume: "sofer", eticheta: "Conducător auto", exemplu: "Radu Andrei", max: 120 },
  { nume: "firma", eticheta: "Firma", exemplu: "Construct SRL", max: 120 },
  { nume: "cui", eticheta: "CUI", exemplu: "RO12345678", max: 20 },
  { nume: "nr", eticheta: "Foaia nr.", exemplu: "17", max: 20 },
] as const;

const CAMPURI_NUMERICE = [
  {
    nume: "norma",
    eticheta: "Norma proprie de consum (l/100 km)",
    exemplu: "6,5",
    ajutor: "Norma firmei pentru mașina asta. La electrice, în kWh/100 km.",
  },
  {
    nume: "km",
    eticheta: "Km la bord la începutul lunii",
    exemplu: "125.000",
    ajutor: "Intră pe prima cursă, la plecare.",
  },
  {
    nume: "stoc",
    eticheta: "Combustibil în rezervor la început",
    exemplu: "20",
    ajutor: "În litri (kWh la electrice), pentru stocul de la sfârșitul lunii.",
  },
] as const;

export default async function PaginaFoaieParcurs({ searchParams }: Proprietati) {
  const p = await searchParams;
  const q = new URLSearchParams();
  for (const cheie of CHEI) {
    const v = unul(p[cheie]);
    if (v !== undefined && v !== "") q.set(cheie, v);
  }
  const ales = parametriFoaieParcurs(q);
  const document = construiesteFoaieParcurs(ales);
  const avize = [
    ...avizeParametri({ an: q.get("an") ?? undefined, luna: q.get("luna") ?? undefined }, ales),
    ...avizeFoaieParcurs(q, ales),
  ];
  const valoriText: Readonly<Record<(typeof CAMPURI_TEXT)[number]["nume"], string>> = {
    auto: ales.nrAuto,
    marca: ales.marca,
    sofer: ales.sofer,
    firma: ales.firma,
    cui: ales.cui,
    nr: ales.nrFoaie,
  };
  const numar = (n: number | null) => (n === null ? "" : String(n).replace(".", ","));
  const valoriNumerice: Readonly<Record<(typeof CAMPURI_NUMERICE)[number]["nume"], string>> = {
    norma: numar(ales.norma),
    km: ales.kmInitial === null ? "" : String(ales.kmInitial),
    stoc: numar(ales.stocInitial),
  };

  return (
    <Cadru text={RO}>
      <JsonLd
        date={nodUnealta({
          cale: "/unelte/foaie-de-parcurs",
          nume: ANTET_FOAIE_PARCURS.titlu,
          descriere: ANTET_FOAIE_PARCURS.lead,
        })}
      />
      <div data-tipar="ascunde">
        <AntetSecundar
          text={ANTET_FOAIE_PARCURS}
          firimituri={[
            { eticheta: "Acasă", href: "/" },
            { eticheta: "Unelte", href: "/unelte" },
            { eticheta: "Foaie de parcurs", href: "/unelte/foaie-de-parcurs" },
          ]}
        />
      </div>

      <div data-tipar="ascunde">
        <Banda
          inaltime="scurta"
          supratitlu="Pe scurt"
          titlu="Ce trebuie să conțină foaia ca să deduci cheltuiala"
        >
          <div className="mt-4 max-w-[68ch] space-y-3 text-[0.9375rem] leading-[1.7]">
            <p>
              Normele Codului fiscal cer ca foaia de parcurs să cuprindă cel puțin patru informații:
              HG 1/2016, titlul II pct. 16 alin. (2) pentru impozitul pe profit și titlul VII pct.
              68 alin. (2) pentru TVA.
            </p>
            <ol className="list-decimal space-y-1 pl-6">
              <li>categoria de vehicul utilizat;</li>
              <li>scopul și locul deplasării;</li>
              <li>kilometrii parcurși;</li>
              <li>norma proprie de consum carburant pe kilometru parcurs.</li>
            </ol>
            <p>
              Modelul de aici le are pe toate patru. Are și ce cere orice document justificativ
              (OMFP 2634/2015, anexa 1 pct. 2–3): denumirea firmei, CUI-ul, numărul și data
              întocmirii, semnăturile.
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
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
          data-tipar="ascunde"
        >
          <label className="flex flex-col gap-1.5">
            <span className="text-[0.875rem] font-medium">Luna</span>
            <select name="luna" defaultValue={String(ales.luna)} className={CLASA_CAMP}>
              {LUNI.map((nume, i) => (
                <option key={nume} value={String(i + 1)}>
                  {nume}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[0.875rem] font-medium">Anul</span>
            <input
              type="number"
              name="an"
              min={AN_MIN}
              max={AN_MAX}
              defaultValue={String(ales.an)}
              className={CLASA_CAMP}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[0.875rem] font-medium">Categoria vehiculului</span>
            <select name="categorie" defaultValue={ales.categorie ?? ""} className={CLASA_CAMP}>
              <option value="">de completat de mână</option>
              {CATEGORII.map((c) => (
                <option key={c} value={c}>
                  {ETICHETE_CATEGORIE[c]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[0.875rem] font-medium">Combustibil</span>
            <select name="combustibil" defaultValue={ales.combustibil ?? ""} className={CLASA_CAMP}>
              <option value="">de completat de mână</option>
              {COMBUSTIBILI.map((c) => (
                <option key={c} value={c}>
                  {ETICHETE_COMBUSTIBIL[c]}
                </option>
              ))}
            </select>
          </label>
          {CAMPURI_TEXT.map((c) => (
            <label key={c.nume} className="flex flex-col gap-1.5">
              <span className="text-[0.875rem] font-medium">{c.eticheta}</span>
              <input
                type="text"
                name={c.nume}
                maxLength={c.max}
                defaultValue={valoriText[c.nume]}
                placeholder={c.exemplu}
                className={CLASA_CAMP}
              />
            </label>
          ))}
          {CAMPURI_NUMERICE.map((c) => (
            <label key={c.nume} className="flex flex-col gap-1.5">
              <span className="text-[0.875rem] font-medium">{c.eticheta}</span>
              <input
                type="text"
                inputMode="decimal"
                name={c.nume}
                maxLength={12}
                defaultValue={valoriNumerice[c.nume]}
                placeholder={c.exemplu}
                className={CLASA_CAMP}
              />
              <span className="text-mk-text-slab text-[0.8125rem]">{c.ajutor}</span>
            </label>
          ))}
          <label className="flex flex-col gap-1.5 sm:col-span-2">
            <span className="text-[0.875rem] font-medium">Utilizarea vehiculului</span>
            <select name="utilizare" defaultValue={ales.utilizare ?? ""} className={CLASA_CAMP}>
              <option value="">de completat de mână</option>
              {UTILIZARI.map((u) => (
                <option key={u} value={u}>
                  {ETICHETE_UTILIZARE[u]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[0.875rem] font-medium">Curse pe zi</span>
            <select name="curse" defaultValue={String(ales.cursePeZi)} className={CLASA_CAMP}>
              {Array.from({ length: MAX_CURSE_PE_ZI }, (_, i) => i + 1).map((n) => (
                <option key={n} value={String(n)}>
                  {n === 1 ? "1 rând pe zi" : `${String(n)} rânduri pe zi`}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end">
            <button
              type="submit"
              data-umami-event="parcurs-genereaza"
              className="bg-mk-cerneala text-mk-text-inv inline-flex h-11 w-full items-center justify-center rounded px-5 text-[0.9375rem] font-medium transition-opacity hover:opacity-90"
            >
              Generează
            </button>
          </div>
          <Descarcari
            actiune="/api/unelte/foaie-de-parcurs"
            eveniment="parcurs"
            formate={["docx", "pdf", "xlsx"]}
          />
        </form>
        <AvizCorectari avize={avize} />
      </Banda>

      <Banda id="documentul" inaltime="scurta">
        <PrevizualizareDocument document={document} />
      </Banda>

      <div data-tipar="ascunde">
        <Banda
          inaltime="scurta"
          supratitlu="Deducerea"
          titlu="50% sau 100%: impozit pe profit și TVA"
        >
          <div className="mt-4 max-w-[68ch] space-y-3 text-[0.9375rem] leading-[1.7]">
            <p>
              Pentru o mașină de cel mult 3.500 kg și cel mult 9 scaune cu tot cu al șoferului,
              folosită și în scop personal, firma deduce 50% din cheltuieli la impozitul pe profit
              (art. 25 alin. (3) lit. l) din Codul fiscal) și 50% din TVA (art. 298 alin. (1)).
              Amortizarea nu intră sub limita de la impozitul pe profit.
            </p>
            <p>
              Deducerea e integrală când mașina e folosită exclusiv în activitatea firmei sau intră
              într-una dintre categoriile din lege: servicii de urgență, pază și protecție,
              curierat; agenți de vânzări și de achiziții; transport de persoane cu plată, inclusiv
              taxi; servicii cu plată, închiriere, școli de șoferi; vehicule vândute ca marfă (art.
              25 alin. (3) lit. l) pct. 1–5 și art. 298 alin. (3)).
            </p>
            <p>
              Foaia de parcurs e dovada pentru deducerea integrală. Cine aplică deducerea de 50% nu
              trebuie să dovedească folosirea mașinii cu foaia de parcurs, spun normele la TVA (pct.
              68 alin. (4)). Peste 3.500 kg sau peste 9 scaune, limita de 50% nu se aplică (art. 298
              alin. (2)).
            </p>
          </div>
        </Banda>
      </div>

      <div data-tipar="ascunde">
        <Banda
          inaltime="medie"
          supratitlu="Întrebări"
          titlu="Ce se mai întreabă despre foaia de parcurs"
        >
          <div className="border-mk-rigla/40 mt-8 border-t">
            {INTREBARI.map((r) => (
              <div
                key={r.q}
                className="border-mk-rigla/40 grid gap-2 border-b py-5 md:grid-cols-12 md:gap-8"
              >
                <h3 className="font-mk-display text-[1rem] leading-[1.25] font-semibold md:col-span-4">
                  {r.q}
                </h3>
                <div className="md:col-span-8">
                  <p className="text-mk-text-slab text-[0.9375rem] leading-[1.6]">{r.a}</p>
                  {r.href !== undefined && (
                    <a
                      href={r.href}
                      data-umami-event="parcurs-exemplu"
                      className="mt-2 inline-block text-[0.9375rem] underline underline-offset-4"
                    >
                      Deschide exemplul completat
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Banda>
      </div>

      <div data-tipar="ascunde">
        <Banda
          inaltime="scurta"
          supratitlu="Fără hârtie"
          titlu="Mașinile firmei, într-un singur loc"
        >
          <p className="text-mk-text-slab mt-4 max-w-[68ch] text-[0.9375rem] leading-[1.7]">
            ITP-ul, RCA-ul, rovinieta și foile de parcurs ale fiecărei mașini, cu alertă înainte de
            expirare. Kilometrajul de plecare se propune din foaia anterioară, un regres sau un salt
            de kilometri se semnalează, iar consumul din alimentări se compară cu cel declarat al
            mașinii. Șeful de echipă aprobă foile oamenilor lui.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href={RO.hero.ctaPrimar.href}
              data-umami-event="cta-foaie-parcurs"
              className="bg-mk-cerneala text-mk-text-inv inline-flex h-12 items-center rounded px-6 text-[0.9375rem] font-medium transition-opacity hover:opacity-90"
            >
              {RO.hero.ctaPrimar.eticheta}
            </Link>
            <Link
              href="/module/flota"
              className="border-mk-rigla hover:border-mk-text inline-flex h-12 items-center rounded border px-6 text-[0.9375rem] font-medium transition-colors"
            >
              Cum arată modulul Flotă
            </Link>
          </div>
          <PeAcelasiSubiect legaturi={LEGATURI_CONEXE["/unelte/foaie-de-parcurs"]} />
        </Banda>
      </div>
    </Cadru>
  );
}
