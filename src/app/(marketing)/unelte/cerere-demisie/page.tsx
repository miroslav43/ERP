// src/app/(marketing)/unelte/cerere-demisie/page.tsx
import type { Metadata } from "next";
import Link from "next/link";

import { exempluPentru, imagineExemplu } from "@/content/landing/exemple-unelte";
import { LEGATURI_CONEXE } from "@/content/landing/legaturi";
import { RO } from "@/content/landing/ro";
import { metaUnealta } from "@/content/landing/seo-unelte";
import { ANTET_CERERE_DEMISIE } from "@/content/landing/unelte";
import { dataLunga } from "@/domain/calendar/interval-lucrator";
import { todayInBucharest } from "@/lib/format/date";
import { EroareIntrare, type DocumentTabelar } from "@/lib/unelte/document-tabelar";

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
import { zileLucratoareText } from "../cerere-concediu-de-odihna/text-zile";
import { INTREBARI_DEMISIE } from "./intrebari";
import {
  calculeazaPreaviz,
  citesteDemisie,
  construiesteDemisie,
  PLAFON_PREAVIZ,
  TIPURI_DEMISIE,
  type Preaviz,
} from "./model";

/**
 * Cererea de demisie, gratuită, fără cont.
 *
 * Completarea automată Google, 8 oct 2026: „model demisie”, „cerere demisie” și
 * „preaviz demisie” sunt cele mai largi familii măsurate în zona HR. Modelele
 * găsite (zarinacrm, hipo, wps) lasă data încetării goală; aici ultima zi de
 * preaviz se calculează pe zile lucrătoare, cu sărbătorile legale.
 */
const CALE = "/unelte/cerere-demisie";

export const metadata: Metadata = metadatePagina(metaUnealta(CALE));

type Proprietati = Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>;

const unul = (v: string | string[] | undefined): string | undefined =>
  Array.isArray(v) ? v[0] : v;

const CLASA_CAMP =
  "border-mk-rigla bg-mk-hartie focus:border-mk-text rounded w-full border px-3 py-2.5 text-base";

const CAMPURI = [
  { nume: "nume", eticheta: "Numele și prenumele", exemplu: "Popescu Ana" },
  { nume: "functie", eticheta: "Funcția", exemplu: "contabil" },
  { nume: "angajator", eticheta: "Angajatorul", exemplu: "Administrativo Demo SRL" },
  { nume: "contract", eticheta: "Contractul (nr. și data)", exemplu: "nr. 12 din 03.02.2025" },
] as const;

const CHEI = [
  "tip",
  "categorie",
  "nume",
  "functie",
  "angajator",
  "contract",
  "depunere",
  "preaviz",
  "data_acord",
] as const;

export default async function PaginaCerereDemisie({ searchParams }: Proprietati) {
  const p = await searchParams;
  const q = new URLSearchParams();
  for (const cheie of CHEI) {
    const v = unul(p[cheie]);
    if (v !== undefined && v !== "") q.set(cheie, v);
  }
  const { parametri, avertismente } = citesteDemisie(q, todayInBucharest());
  const exemplu = exempluPentru(CALE);
  let document: DocumentTabelar | null = null;
  let preaviz: Preaviz | null = null;
  let problema: string | null = null;
  try {
    document = construiesteDemisie(parametri);
    if (parametri.tip === "preaviz") {
      preaviz = calculeazaPreaviz(parametri.depunere, parametri.zilePreaviz);
    }
  } catch (eroare) {
    if (!(eroare instanceof EroareIntrare)) throw eroare;
    problema = eroare.message;
  }
  const valori: Readonly<Record<(typeof CAMPURI)[number]["nume"], string>> = {
    nume: parametri.nume,
    functie: parametri.functie,
    angajator: parametri.angajator,
    contract: parametri.contract,
  };

  return (
    <Cadru text={RO}>
      <JsonLd
        date={nodUnealta({
          cale: CALE,
          nume: ANTET_CERERE_DEMISIE.titlu,
          descriere: ANTET_CERERE_DEMISIE.lead,
          ...(exemplu === undefined ? {} : { imagine: imagineExemplu(exemplu) }),
        })}
      />
      <div data-tipar="ascunde">
        <AntetSecundar
          text={ANTET_CERERE_DEMISIE}
          firimituri={[
            { eticheta: "Acasă", href: "/" },
            { eticheta: "Unelte", href: "/unelte" },
            { eticheta: "Cerere de demisie", href: CALE },
          ]}
        />
      </div>

      <div data-tipar="ascunde">
        <Banda inaltime="scurta" supratitlu="Pe scurt" titlu="Ce spune Codul muncii despre demisie">
          <div className="mt-4 max-w-[68ch] space-y-3 text-[0.9375rem] leading-[1.7]">
            <p>
              Demisia e o notificare scrisă prin care anunți angajatorul că pleci, după un termen de
              preaviz (art. 81 alin. (1)). Nu trebuie motivată (alin. (3)), iar angajatorul e
              obligat s-o înregistreze (alin. (2)).
            </p>
            <p>
              Preavizul e cel din contract, dar cel mult{" "}
              {zileLucratoareText(PLAFON_PREAVIZ.executie)} pentru o funcție de execuție și{" "}
              {zileLucratoareText(PLAFON_PREAVIZ.conducere)} pentru una de conducere (alin. (4)).
              Contractul încetează în ultima zi de preaviz sau mai devreme, dacă angajatorul renunță
              la preaviz (alin. (7)).
            </p>
          </div>
        </Banda>
      </div>

      <Banda inaltime="scurta">
        <form
          action="#documentul"
          method="get"
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          data-tipar="ascunde"
        >
          <label className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-3">
            <span className="text-[0.875rem] font-medium">Ce fel de cerere</span>
            <select name="tip" defaultValue={parametri.tip} className={CLASA_CAMP}>
              {TIPURI_DEMISIE.map((t) => (
                <option key={t.cheie} value={t.cheie}>
                  {t.eticheta}
                </option>
              ))}
            </select>
          </label>
          {CAMPURI.map((c) => (
            <label key={c.nume} className="flex flex-col gap-1.5">
              <span className="text-[0.875rem] font-medium">{c.eticheta}</span>
              <input
                type="text"
                name={c.nume}
                maxLength={c.nume === "contract" ? 60 : 120}
                defaultValue={valori[c.nume]}
                placeholder={c.exemplu}
                className={CLASA_CAMP}
              />
            </label>
          ))}
          <label className="flex flex-col gap-1.5">
            <span className="text-[0.875rem] font-medium">Funcția e de</span>
            <select name="categorie" defaultValue={parametri.categorie} className={CLASA_CAMP}>
              <option value="executie">execuție (preaviz de cel mult 20 de zile)</option>
              <option value="conducere">conducere (preaviz de cel mult 45 de zile)</option>
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[0.875rem] font-medium">
              Preavizul din contract (zile lucrătoare)
            </span>
            <input
              type="number"
              name="preaviz"
              min={1}
              max={45}
              inputMode="numeric"
              defaultValue={String(parametri.zilePreaviz)}
              className={CLASA_CAMP}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[0.875rem] font-medium">Data înregistrării cererii</span>
            <input
              type="date"
              name="depunere"
              defaultValue={parametri.depunere}
              className={CLASA_CAMP}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[0.875rem] font-medium">
              Data încetării (doar la acordul părților)
            </span>
            <input
              type="date"
              name="data_acord"
              defaultValue={parametri.dataAcord}
              className={CLASA_CAMP}
            />
          </label>
          <div className="flex items-end">
            <button
              type="submit"
              data-umami-event="demisie-genereaza"
              className="bg-mk-cerneala text-mk-text-inv inline-flex h-11 w-full items-center justify-center rounded px-5 text-[0.9375rem] font-medium transition-opacity hover:opacity-90"
            >
              Completează cererea
            </button>
          </div>
          <Descarcari
            actiune="/api/unelte/cerere-demisie"
            eveniment="demisie"
            formate={["docx", "pdf"]}
          />
        </form>
        {(avertismente.length > 0 || problema !== null) && (
          <ul
            role="status"
            className="border-mk-rigla mt-6 max-w-[68ch] space-y-1 border-l-2 pl-4 text-[0.9375rem]"
            data-tipar="ascunde"
          >
            {[...avertismente, ...(problema === null ? [] : [problema])].map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        )}
      </Banda>

      {preaviz !== null && (
        <div data-tipar="ascunde">
          <Banda
            id="rezultat"
            inaltime="scurta"
            supratitlu="Ultima zi de preaviz"
            titlu={dataLunga(preaviz.ultimaZi)}
          >
            <p className="text-mk-text-slab mt-4 max-w-[68ch] text-[0.9375rem] leading-[1.7]">
              {zileLucratoareText(preaviz.zile)} numărate de a doua zi după{" "}
              {dataLunga(parametri.depunere)}, fără sâmbete și duminici
              {preaviz.sarbatoriSarite.length > 0
                ? ` și fără ${preaviz.sarbatoriSarite.map((s) => s.denumire).join(", ")}`
                : ""}
              . Alt termen?{" "}
              <Link
                href={`/unelte/calculator-zile-lucratoare?mod=adauga&de_la=${parametri.depunere}&zile=${String(preaviz.zile)}#rezultat`}
                className="underline underline-offset-4"
              >
                Calculatorul de zile lucrătoare
              </Link>
              .
            </p>
          </Banda>
        </div>
      )}

      {document !== null && (
        <Banda id="documentul" inaltime="scurta">
          <PrevizualizareDocument document={document} />
        </Banda>
      )}

      <ExempluCompletat exemplu={exemplu} />

      <div data-tipar="ascunde">
        <IntrebariUnealta titlu="Ce se mai întreabă despre demisie" intrebari={INTREBARI_DEMISIE} />

        <Banda inaltime="scurta" supratitlu="Fără hârtie" titlu="Plecarea unui om, ținută la zi">
          <p className="text-mk-text-slab mt-4 max-w-[68ch] text-[0.9375rem] leading-[1.7]">
            În aplicație, încetarea contractului devine un eveniment de transmis în REGES-ONLINE, cu
            termenul lui calculat.{" "}
            <Link href="/module/reges" className="underline underline-offset-4">
              Cum arată modulul REGES
            </Link>
            .
          </p>
          <PeAcelasiSubiect legaturi={LEGATURI_CONEXE["/unelte/cerere-demisie"]} />
        </Banda>
      </div>
    </Cadru>
  );
}
