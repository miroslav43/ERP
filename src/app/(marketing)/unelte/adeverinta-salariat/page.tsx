// src/app/(marketing)/unelte/adeverinta-salariat/page.tsx
import type { Metadata } from "next";
import Link from "next/link";

import { exempluPentru, imagineExemplu } from "@/content/landing/exemple-unelte";
import { LEGATURI_CONEXE } from "@/content/landing/legaturi";
import { RO } from "@/content/landing/ro";
import { metaUnealta } from "@/content/landing/seo-unelte";
import { ANTET_ADEVERINTA_SALARIAT } from "@/content/landing/unelte";
import { todayInBucharest } from "@/lib/format/date";

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
import { INTREBARI_ADEVERINTA } from "./intrebari";
import { citesteAdeverinta, construiesteAdeverinta } from "./model";

/**
 * Adeverința de salariat, gratuită.
 *
 * Completarea automată Google, 8 oct 2026: „adeverinta de salariat” e căutată
 * după destinație („pentru spital”, „medic familie”, „gradinita”), deci câmpul
 * „Pentru” ține locul a zece modele. Fără CNP: vezi `model.ts`.
 */
const CALE = "/unelte/adeverinta-salariat";

export const metadata: Metadata = metadatePagina(metaUnealta(CALE));

type Proprietati = Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>;

const unul = (v: string | string[] | undefined): string | undefined =>
  Array.isArray(v) ? v[0] : v;

const CLASA_CAMP =
  "border-mk-rigla bg-mk-hartie focus:border-mk-text rounded w-full border px-3 py-2.5 text-base";

const TEXTE = [
  { nume: "firma", eticheta: "Firma", exemplu: "Administrativo Demo SRL", max: 120 },
  { nume: "cui", eticheta: "CUI (opțional)", exemplu: "", max: 20 },
  { nume: "nr", eticheta: "Nr. de înregistrare (opțional)", exemplu: "154", max: 30 },
  { nume: "nume", eticheta: "Salariatul", exemplu: "Popescu Ana", max: 120 },
  { nume: "functie", eticheta: "Funcția", exemplu: "contabil", max: 120 },
  { nume: "salariu", eticheta: "Salariul brut (opțional)", exemplu: "4.325", max: 20 },
  { nume: "scop", eticheta: "Pentru (opțional)", exemplu: "medicul de familie", max: 120 },
] as const;

const CHEI = [...TEXTE.map((t) => t.nume), "angajare", "durata", "ore"] as const;

export default async function PaginaAdeverintaSalariat({ searchParams }: Proprietati) {
  const p = await searchParams;
  const q = new URLSearchParams();
  for (const cheie of CHEI) {
    const v = unul(p[cheie]);
    if (v !== undefined && v !== "") q.set(cheie, v);
  }
  const { parametri, avertismente } = citesteAdeverinta(q, todayInBucharest());
  const document = construiesteAdeverinta(parametri);
  const exemplu = exempluPentru(CALE);

  return (
    <Cadru text={RO}>
      <JsonLd
        date={nodUnealta({
          cale: CALE,
          nume: ANTET_ADEVERINTA_SALARIAT.titlu,
          descriere: ANTET_ADEVERINTA_SALARIAT.lead,
          ...(exemplu === undefined ? {} : { imagine: imagineExemplu(exemplu) }),
        })}
      />
      <div data-tipar="ascunde">
        <AntetSecundar
          text={ANTET_ADEVERINTA_SALARIAT}
          firimituri={[
            { eticheta: "Acasă", href: "/" },
            { eticheta: "Unelte", href: "/unelte" },
            { eticheta: "Adeverință de salariat", href: CALE },
          ]}
        />
      </div>

      <Banda inaltime="scurta">
        <form
          action="#documentul"
          method="get"
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          data-tipar="ascunde"
        >
          {TEXTE.map((c) => (
            <label key={c.nume} className="flex flex-col gap-1.5">
              <span className="text-[0.875rem] font-medium">{c.eticheta}</span>
              <input
                type="text"
                name={c.nume}
                maxLength={c.max}
                defaultValue={unul(p[c.nume]) ?? ""}
                placeholder={c.exemplu}
                inputMode={c.nume === "salariu" ? "decimal" : undefined}
                className={CLASA_CAMP}
              />
            </label>
          ))}
          <label className="flex flex-col gap-1.5">
            <span className="text-[0.875rem] font-medium">Data angajării</span>
            <input
              type="date"
              name="angajare"
              defaultValue={parametri.angajare}
              className={CLASA_CAMP}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[0.875rem] font-medium">Contractul</span>
            <select name="durata" defaultValue={parametri.durata} className={CLASA_CAMP}>
              <option value="nedeterminata">pe durată nedeterminată</option>
              <option value="determinata">pe durată determinată</option>
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[0.875rem] font-medium">Norma</span>
            <select name="ore" defaultValue={String(parametri.ore)} className={CLASA_CAMP}>
              <option value="8">întreagă, 8 ore pe zi</option>
              {[7, 6, 5, 4, 3, 2, 1].map((o) => (
                <option key={o} value={o}>
                  parțială, {o} {o === 1 ? "oră" : "ore"} pe zi
                </option>
              ))}
            </select>
          </label>
          <p className="text-mk-text-slab text-[0.8125rem] leading-[1.5] sm:col-span-2 lg:col-span-3">
            CNP-ul nu se cere aici: tot ce scrii stă în adresa paginii. Îl completezi de mână pe
            foaia tipărită sau în Word.
          </p>
          <div className="flex items-end">
            <button
              type="submit"
              data-umami-event="adeverinta-genereaza"
              className="bg-mk-cerneala text-mk-text-inv inline-flex h-11 w-full items-center justify-center rounded px-5 text-[0.9375rem] font-medium transition-opacity hover:opacity-90"
            >
              Completează adeverința
            </button>
          </div>
          <Descarcari
            actiune="/api/unelte/adeverinta-salariat"
            eveniment="adeverinta"
            formate={["docx", "pdf"]}
          />
        </form>
        {avertismente.length > 0 && (
          <ul
            role="status"
            className="border-mk-rigla mt-6 max-w-[68ch] space-y-1 border-l-2 pl-4 text-[0.9375rem]"
            data-tipar="ascunde"
          >
            {avertismente.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        )}
      </Banda>

      <Banda id="documentul" inaltime="scurta">
        <PrevizualizareDocument document={document} />
      </Banda>

      <ExempluCompletat exemplu={exemplu} />

      <div data-tipar="ascunde">
        <IntrebariUnealta
          titlu="Ce se mai întreabă despre adeverința de salariat"
          intrebari={INTREBARI_ADEVERINTA}
        />

        <Banda
          inaltime="scurta"
          supratitlu="Fără hârtie"
          titlu="Datele salariatului, într-un singur loc"
        >
          <p className="text-mk-text-slab mt-4 max-w-[68ch] text-[0.9375rem] leading-[1.7]">
            În aplicație, funcția, contractul și data angajării stau pe fișa fiecărui om și pleacă
            de acolo în REGES-ONLINE: o adeverință se completează din ce e deja scris, nu din
            memorie.{" "}
            <Link href="/module/nucleu" className="underline underline-offset-4">
              Cum arată evidența angajaților
            </Link>
            .
          </p>
          <PeAcelasiSubiect legaturi={LEGATURI_CONEXE["/unelte/adeverinta-salariat"]} />
        </Banda>
      </div>
    </Cadru>
  );
}
