// src/app/(marketing)/unelte/condica-de-prezenta/page.tsx
import type { Metadata } from "next";
import Link from "next/link";

import { LEGATURI_CONEXE } from "@/content/landing/legaturi";
import { RO } from "@/content/landing/ro";
import { ANTET_CONDICA } from "@/content/landing/unelte";

import { AntetSecundar } from "../../_componente/antet-secundar";
import { Banda } from "../../_componente/banda";
import { Cadru } from "../../_componente/cadru";
import { JsonLd } from "../../_componente/json-ld";
import { nodUnealta } from "../../_componente/noduri-json-ld";
import { Descarcari } from "../../_componente/descarcari";
import { metadatePagina } from "../../_componente/metadate";
import { PeAcelasiSubiect } from "../../_componente/pe-acelasi-subiect";
import { PrevizualizareDocument } from "../../_componente/previzualizare-document";
import { AN_MAX, AN_MIN, LUNI } from "../foaie-de-pontaj/foaie";
import { construiesteCondica, parametriCondica } from "./model";

/**
 * Condica de prezență, gratuită.
 *
 * Keyword Planner, 2 oct 2026: „condica de prezență model word” are 100–1.000
 * de căutări pe lună, cu „este obligatorie” printre cele mai sugerate. Pagina
 * răspunde întâi la întrebare (banda „Pe scurt”), apoi dă fișierul.
 *
 * Formular GET, ca la foaia de pontaj: starea stă în adresă, pagina merge fără
 * JavaScript, iar descărcările sunt `<a>` simple spre `/api/unelte/…`.
 */
export const metadata: Metadata = metadatePagina({
  titlu: "Condica de prezență: model Word, PDF și Excel",
  descriere:
    "Condica de prezență completată cu zilele lucrătoare ale lunii, ora sosirii, ora plecării și semnătura. Model gratuit în Word, PDF sau Excel. E obligatorie?",
  cale: "/unelte/condica-de-prezenta",
});

type Proprietati = Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>;

const unul = (v: string | string[] | undefined): string | undefined =>
  Array.isArray(v) ? v[0] : v;

const CLASA_CAMP =
  "border-mk-rigla bg-mk-hartie focus:border-mk-text rounded w-full border px-3 py-2 text-[0.9375rem]";

export default async function PaginaCondica({ searchParams }: Proprietati) {
  const p = await searchParams;
  const q = new URLSearchParams();
  for (const cheie of ["an", "luna", "angajati", "firma"]) {
    const v = unul(p[cheie]);
    if (v !== undefined && v !== "") q.set(cheie, v);
  }
  const ales = parametriCondica(q);
  const document = construiesteCondica(ales.an, ales.luna, ales.angajati, ales.firma);
  const brutAngajati = unul(p.angajati) ?? "";

  return (
    <Cadru text={RO}>
      <JsonLd
        date={nodUnealta({
          cale: "/unelte/condica-de-prezenta",
          nume: ANTET_CONDICA.titlu,
          descriere: ANTET_CONDICA.lead,
        })}
      />
      <div data-tipar="ascunde">
        <AntetSecundar
          text={ANTET_CONDICA}
          firimituri={[
            { eticheta: "Acasă", href: "/" },
            { eticheta: "Unelte", href: "/unelte" },
            { eticheta: "Condica de prezență", href: "/unelte/condica-de-prezenta" },
          ]}
        />
      </div>

      <div data-tipar="ascunde">
        <Banda inaltime="scurta" supratitlu="Pe scurt" titlu="Condica de prezență e obligatorie?">
          <div className="mt-4 max-w-[68ch] space-y-3 text-[0.9375rem] leading-[1.7]">
            <p>
              Legea nu cere un registru numit „condică”. Cere evidența orelor prestate zilnic de
              fiecare salariat, cu ora de începere și ora de sfârșit a programului — art. 119 alin.
              (1) din Codul muncii. Condica pe hârtie e felul cel mai vechi de a o ține; o aplicație
              de pontaj e altul.
            </p>
            <p>
              Ce se cere exact, unde se ține și ce amenzi sunt, cu articolul lângă fiecare:{" "}
              <Link href="/evidenta-orelor-de-munca" className="underline underline-offset-4">
                evidența orelor de muncă
              </Link>
              .
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
          <label className="flex flex-col gap-1.5">
            <span className="text-[0.875rem] font-medium">Firma (opțional)</span>
            <input
              type="text"
              name="firma"
              maxLength={120}
              defaultValue={ales.firma}
              className={CLASA_CAMP}
            />
          </label>
          <div className="flex items-end">
            <button
              type="submit"
              data-umami-event="condica-genereaza"
              className="bg-mk-cerneala text-mk-text-inv inline-flex h-11 w-full items-center justify-center rounded px-5 text-[0.9375rem] font-medium transition-opacity hover:opacity-90"
            >
              Generează
            </button>
          </div>
          <label className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-4">
            <span className="text-[0.875rem] font-medium">Angajați</span>
            <span className="text-mk-text-slab text-[0.8125rem]">
              Câte un nume pe rând. Gol = câte zece rânduri pe zi, de completat cu pixul.
            </span>
            <textarea
              name="angajati"
              rows={4}
              defaultValue={brutAngajati}
              placeholder={"Popa Ion\nIlie Maria\nRadu Andrei"}
              className={CLASA_CAMP}
            />
          </label>
          <Descarcari
            actiune="/api/unelte/condica-de-prezenta"
            eveniment="condica"
            formate={["docx", "pdf", "xlsx"]}
          />
        </form>
      </Banda>

      <Banda inaltime="scurta">
        <PrevizualizareDocument document={document} />
      </Banda>

      <div data-tipar="ascunde">
        <Banda inaltime="scurta" supratitlu="Fără hârtie" titlu="Când condica devine prea mult">
          <p className="text-mk-text-slab mt-4 max-w-[68ch] text-[0.9375rem] leading-[1.7]">
            Cu o aplicație, ora sosirii și a plecării se scriu de pe telefonul omului, iar luna se
            închide fără să recopiezi nimic.{" "}
            <Link href="/module/pontaj" className="underline underline-offset-4">
              Cum arată modulul de pontaj
            </Link>
            .
          </p>
          <PeAcelasiSubiect legaturi={LEGATURI_CONEXE["/unelte/condica-de-prezenta"]} />
        </Banda>
      </div>
    </Cadru>
  );
}
