// src/app/(marketing)/unelte/foaie-de-parcurs/page.tsx
import type { Metadata } from "next";
import Link from "next/link";

import { LEGATURI_CONEXE } from "@/content/landing/legaturi";
import { RO } from "@/content/landing/ro";
import { ANTET_FOAIE_PARCURS } from "@/content/landing/unelte";

import { AntetSecundar } from "../../_componente/antet-secundar";
import { Banda } from "../../_componente/banda";
import { Cadru } from "../../_componente/cadru";
import { Descarcari } from "../../_componente/descarcari";
import { metadatePagina } from "../../_componente/metadate";
import { PeAcelasiSubiect } from "../../_componente/pe-acelasi-subiect";
import { PrevizualizareDocument } from "../../_componente/previzualizare-document";
import { AN_MAX, AN_MIN, LUNI } from "../foaie-de-pontaj/foaie";
import { construiesteFoaieParcurs, parametriFoaieParcurs } from "./model";

/**
 * Foaia de parcurs, gratuită.
 *
 * Keyword Planner, 2 oct 2026: „foaie de parcurs model” are 100–1.000 de
 * căutări pe lună, cu „word free download”, „pdf” și „excel” printre sugestii.
 * Formular GET, ca restul uneltelor: starea stă în adresă.
 *
 * Banda „La ce folosește” spune DOAR ce s-a verificat în Codul fiscal (art. 25
 * alin. (3) lit. l), forma consolidată la 2 oct 2026). Elementele minime ale
 * foii, din normele de aplicare, nu sunt afirmate: trimitem la contabil.
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
  "border-mk-rigla bg-mk-hartie focus:border-mk-text rounded w-full border px-3 py-2 text-[0.9375rem]";

const CAMPURI_TEXT = [
  { nume: "auto", eticheta: "Nr. de înmatriculare", exemplu: "B-123-ABC" },
  { nume: "marca", eticheta: "Marca și modelul", exemplu: "Dacia Logan" },
  { nume: "sofer", eticheta: "Conducător auto", exemplu: "Radu Andrei" },
  { nume: "firma", eticheta: "Firma (opțional)", exemplu: "" },
] as const;

export default async function PaginaFoaieParcurs({ searchParams }: Proprietati) {
  const p = await searchParams;
  const q = new URLSearchParams();
  for (const cheie of ["an", "luna", "auto", "marca", "sofer", "firma"]) {
    const v = unul(p[cheie]);
    if (v !== undefined && v !== "") q.set(cheie, v);
  }
  const ales = parametriFoaieParcurs(q);
  const document = construiesteFoaieParcurs(ales);
  const valori: Readonly<Record<(typeof CAMPURI_TEXT)[number]["nume"], string>> = {
    auto: ales.nrAuto,
    marca: ales.marca,
    sofer: ales.sofer,
    firma: ales.firma,
  };

  return (
    <Cadru text={RO}>
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
            <p>
              Dacă mașina ta intră la deducere integrală și ce elemente minime cer normele de
              aplicare pentru foaie stabilește contabilul firmei. Modelul de mai jos are coloanele
              obișnuite: data, traseul, scopul și kilometrii.
            </p>
          </div>
        </Banda>
      </div>

      <Banda inaltime="scurta">
        <form
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
          {CAMPURI_TEXT.map((c) => (
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
          <div className="flex items-end sm:col-span-2 lg:col-span-2">
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
      </Banda>

      <Banda inaltime="scurta">
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
