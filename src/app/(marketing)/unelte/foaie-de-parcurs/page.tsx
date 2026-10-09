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
    "Foaie de parcurs lunară gata de completat: fiecare zi, traseul, scopul deplasării, kilometrii la plecare și la sosire. Model gratuit în Word, PDF sau Excel.",
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
        <Banda inaltime="scurta" supratitlu="Pe scurt" titlu="La ce folosește foaia de parcurs">
          <div className="mt-4 max-w-[68ch] space-y-3 text-[0.9375rem] leading-[1.7]">
            <p>
              Codul fiscal limitează la 50% deducerea cheltuielilor cu mașinile care nu sunt
              folosite exclusiv în activitatea firmei — art. 25 alin. (3) lit. l). Foaia de parcurs
              e documentul prin care firma arată, deplasare cu deplasare, unde a mers mașina și de
              ce.
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
          supratitlu="Fără hârtie"
          titlu="Mașinile firmei, într-un singur loc"
        >
          <p className="text-mk-text-slab mt-4 max-w-[68ch] text-[0.9375rem] leading-[1.7]">
            ITP-ul, RCA-ul, rovinieta și foile de parcurs ale fiecărei mașini, cu alertă înainte de
            expirare.{" "}
            <Link href="/module/flota" className="underline underline-offset-4">
              Cum arată modulul de parc auto
            </Link>
            .
          </p>
          <PeAcelasiSubiect legaturi={LEGATURI_CONEXE["/unelte/foaie-de-parcurs"]} />
        </Banda>
      </div>
    </Cadru>
  );
}
