// src/app/(marketing)/unelte/condica-de-prezenta/page.tsx
import type { Metadata } from "next";
import Link from "next/link";

import { ACOPERIRE_CONDICA, INTREBARI_CONDICA } from "@/content/landing/intrebari-pontaj";
import { LEGATURI_CONEXE } from "@/content/landing/legaturi";
import { RO } from "@/content/landing/ro";
import { ANTET_CONDICA } from "@/content/landing/unelte";
import { avertismentCui, MAX_COMPARTIMENT, MAX_CUI, MAX_FIRMA } from "@/lib/unelte/antet-firma";

import { AntetSecundar } from "../../_componente/antet-secundar";
import { AvizCorectari } from "../../_componente/aviz-corectari";
import { Banda } from "../../_componente/banda";
import { Cadru } from "../../_componente/cadru";
import { CeCereItm } from "../../_componente/ce-cere-itm";
import { Descarcari } from "../../_componente/descarcari";
import { IntrebariUnealta } from "../../_componente/intrebari-unealta";
import { JsonLd } from "../../_componente/json-ld";
import { metadatePagina } from "../../_componente/metadate";
import { nodUnealta } from "../../_componente/noduri-json-ld";
import { PeAcelasiSubiect } from "../../_componente/pe-acelasi-subiect";
import { PrevizualizareDocument } from "../../_componente/previzualizare-document";
import {
  AN_MAX,
  AN_MIN,
  avizAngajati,
  avizeParametri,
  LUNI,
  MAX_ANGAJATI,
  MAX_LUNGIME_NUME,
} from "../foaie-de-pontaj/foaie";
import { liniiAngajati, PROGRAME } from "../foaie-de-pontaj/pontaj";
import { condicaDocument, parametriCondica } from "./model";

/**
 * Condica de prezență, gratuită.
 *
 * Keyword Planner, 2 oct 2026: „condica de prezență model word” are 100–1.000
 * de căutări pe lună, cu „este obligatorie” printre cele mai sugerate. Pagina
 * răspunde întâi la întrebare (banda „Pe scurt”), apoi dă fișierul.
 *
 * Auditul din 8 oct 2026 (MAJOR): condica sărea sâmbetele, duminicile și
 * sărbătorile. Acum are programul luni–vineri, luni–sâmbătă sau ture, rânduri
 * marcate L/SL pentru zilele nelucrate, pauză, ore lucrate și observații, iar
 * Excelul calculează orele.
 *
 * Formular GET: starea stă în adresă, pagina merge fără JavaScript, iar
 * descărcările sunt butoane de trimitere spre `/api/unelte/condica-de-prezenta`.
 */
export const metadata: Metadata = metadatePagina({
  titlu: "Condica de prezență: model Word, PDF și Excel",
  descriere:
    "Condica de prezență pentru orice lună, cu sâmbete și ture, ora sosirii și a plecării, pauza și orele calculate în Excel. Word, PDF sau Excel, gratuit.",
  cale: "/unelte/condica-de-prezenta",
});

type Proprietati = Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>;

const unul = (v: string | string[] | undefined): string | undefined =>
  Array.isArray(v) ? v[0] : v;

const CLASA_CAMP =
  "border-mk-rigla bg-mk-hartie focus:border-mk-text rounded w-full border px-3 py-2.5 text-base";
const CLASA_ETICHETA = "text-[0.875rem] font-medium";

const CHEI_CONDICA = ["an", "luna", "program", "firma", "cui", "compartiment", "angajati"] as const;
const MAX_TEXT_ANGAJATI = MAX_ANGAJATI * (MAX_LUNGIME_NUME + 9);

export default async function PaginaCondica({ searchParams }: Proprietati) {
  const p = await searchParams;
  const q = new URLSearchParams();
  for (const cheie of CHEI_CONDICA) {
    const v = unul(p[cheie]);
    if (v !== undefined && v !== "") q.set(cheie, v);
  }
  const ales = parametriCondica(q);
  const document = condicaDocument(ales);
  const brutAngajati = unul(p.angajati) ?? "";
  // Un singur aviz pe pagină (`AvizCorectari`, B4/B8), plus CUI-ul (E).
  const avize = [
    ...avizeParametri({ an: q.get("an") ?? undefined, luna: q.get("luna") ?? undefined }, ales),
    ...avizAngajati(liniiAngajati(q.get("angajati") ?? undefined, 8).lista),
    avertismentCui(ales.antet),
  ].filter((a): a is string => a !== null);

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

      <Banda inaltime="scurta" data-tipar="ascunde">
        <form
          action="#documentul"
          method="get"
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
          data-tipar="ascunde"
        >
          <label className="flex flex-col gap-1.5">
            <span className={CLASA_ETICHETA}>Luna</span>
            <select name="luna" defaultValue={String(ales.luna)} className={CLASA_CAMP}>
              {LUNI.map((nume, i) => (
                <option key={nume} value={String(i + 1)}>
                  {nume}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={CLASA_ETICHETA}>Anul</span>
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
            <span className={CLASA_ETICHETA}>Program</span>
            <select name="program" defaultValue={ales.program} className={CLASA_CAMP}>
              {PROGRAME.map((o) => (
                <option key={o.valoare} value={o.valoare}>
                  {o.eticheta}
                </option>
              ))}
            </select>
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
          <label className="flex flex-col gap-1.5 sm:col-span-2">
            <span className={CLASA_ETICHETA}>Firma (opțional)</span>
            <input
              type="text"
              name="firma"
              maxLength={MAX_FIRMA}
              defaultValue={ales.antet.firma}
              autoComplete="organization"
              className={CLASA_CAMP}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={CLASA_ETICHETA}>CUI (opțional)</span>
            <input
              type="text"
              name="cui"
              maxLength={MAX_CUI}
              defaultValue={ales.antet.cui}
              className={CLASA_CAMP}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={CLASA_ETICHETA}>Compartiment (opțional)</span>
            <input
              type="text"
              name="compartiment"
              maxLength={MAX_COMPARTIMENT}
              defaultValue={ales.antet.compartiment}
              className={CLASA_CAMP}
            />
          </label>
          <label className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-4">
            <span className={CLASA_ETICHETA}>Angajați</span>
            <span className="text-mk-text-slab text-[0.8125rem]">
              Câte un nume pe rând. Gol = câte zece rânduri pe zi, de completat cu pixul. La
              „Luni–vineri”, sâmbetele, duminicile și sărbătorile apar câte un rând, marcat cu L sau
              SL; dacă lucrați atunci, alege „Luni–sâmbătă” sau „Toate zilele (ture)”.
            </span>
            <textarea
              name="angajati"
              rows={4}
              maxLength={MAX_TEXT_ANGAJATI}
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
        <AvizCorectari avize={avize} />
      </Banda>

      <Banda id="documentul" inaltime="scurta">
        <PrevizualizareDocument document={document} />
      </Banda>

      <div data-tipar="ascunde">
        <CeCereItm acoperire={ACOPERIRE_CONDICA} />
      </div>

      <div data-tipar="ascunde">
        <IntrebariUnealta titlu="Ce se mai întreabă despre condică" intrebari={INTREBARI_CONDICA} />
      </div>

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
