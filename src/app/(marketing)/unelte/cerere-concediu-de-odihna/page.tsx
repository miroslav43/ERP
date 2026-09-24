// src/app/(marketing)/unelte/cerere-concediu-de-odihna/page.tsx
import type { Metadata } from "next";

import { RO } from "@/content/landing/ro";
import { ANTET_CERERE_CONCEDIU } from "@/content/landing/unelte";
import { formatDate } from "@/lib/format/date";

import { AntetSecundar } from "../../_componente/antet-secundar";
import { Banda } from "../../_componente/banda";
import { Cadru } from "../../_componente/cadru";
import { metadatePagina } from "../../_componente/metadate";
import {
  AN_MAX,
  AN_MIN,
  aziIso,
  construiesteCerere,
  normalizeazaData,
  normalizeazaText,
  plusZile,
} from "./cerere";

/**
 * Cerere de concediu de odihnă, gratuită, fără cont.
 *
 * ── DE CE EXISTĂ ──────────────────────────────────────────────────────────
 * „Model cerere concediu de odihnă" e o căutare cu intenție limpede și cu o
 * concurență formată aproape numai din fișiere Word de pe bloguri. Toate au
 * același gol: un spațiu în care omul scrie singur numărul de zile. Numărul ăla
 * e greșit des, fiindcă art. 145 alin. (3) din Codul muncii scoate sărbătorile
 * legale din durata concediului, iar cine numără pe calendar le numără.
 *
 * Proba că nu e o problemă teoretică: testul acestei unelte a prins chiar
 * autorul lui scriind „patru zile lucrătoare" pentru 30 noiembrie – 4 decembrie
 * 2026. Sunt trei — 30 noiembrie e Sfântul Andrei, tot zi liberă legală.
 *
 * ── DE CE FORMULAR GET, FĂRĂ JAVASCRIPT ───────────────────────────────────
 * Aceeași alegere ca la foaia de pontaj: parametrii stau în adresă, deci cererea
 * se poate trimite pe e-mail gata completată, merge cu JavaScript oprit și se
 * tipărește direct din browser.
 *
 * ── CE NU FACE ────────────────────────────────────────────────────────────
 * Nu scade zilele libere plătite stabilite prin contractul colectiv sau prin
 * regulamentul intern, deși art. 145 alin. (3) le exclude și pe acelea. Nu le
 * putem cunoaște — sunt ale fiecărei firme. Pagina o spune, în loc să dea un
 * număr care pare exact și nu e.
 */
export const metadata: Metadata = metadatePagina({
  titlu: "Cerere de concediu de odihnă: zilele calculate",
  descriere:
    "Completează perioada și primești cererea gata de tipărit, cu numărul de zile lucrătoare calculat — weekendurile și sărbătorile legale scăzute automat. Fără cont.",
  cale: "/unelte/cerere-concediu-de-odihna",
});

type Proprietati = Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>;

const unul = (v: string | string[] | undefined): string | undefined =>
  Array.isArray(v) ? v[0] : v;

const CLASA_CAMP =
  "border-mk-rigla bg-mk-hartie focus:border-mk-text rounded w-full border px-3 py-2 text-[0.9375rem]";

/** Un loc de completat cu mâna, pe documentul tipărit. */
function Gol({ latime = "12rem" }: { readonly latime?: string }) {
  return (
    <span
      className="border-mk-text/50 inline-block border-b align-baseline"
      style={{ minWidth: latime }}
    />
  );
}

export default async function PaginaCerereConcediu({ searchParams }: Proprietati) {
  const p = await searchParams;
  const azi = aziIso();

  const angajator = normalizeazaText(unul(p.angajator));
  const salariat = normalizeazaText(unul(p.salariat));
  const functie = normalizeazaText(unul(p.functie), 80);
  const localitate = normalizeazaText(unul(p.localitate), 60);
  // Implicitele: peste o lună, o săptămână. Nu azi — o cerere depusă pentru azi
  // e exact ce art. 148 alin. (4) NU presupune.
  const deLa = normalizeazaData(unul(p.de_la), plusZile(azi, 30));
  const panaLa = normalizeazaData(unul(p.pana_la), plusZile(azi, 36));
  const dataCererii = normalizeazaData(unul(p.data), azi);

  const cerere = construiesteCerere(deLa, panaLa);

  return (
    <Cadru text={RO}>
      {/* `data-tipar="ascunde"` e convenția proiectului: la tipărire rămâne doar
          cererea, fără antet, formular și subsol. */}
      <div data-tipar="ascunde">
        <AntetSecundar
          text={ANTET_CERERE_CONCEDIU}
          firimituri={[
            { eticheta: "Acasă", href: "/" },
            { eticheta: "Unelte", href: "/unelte" },
            { eticheta: "Cerere de concediu", href: "/unelte/cerere-concediu-de-odihna" },
          ]}
        />
      </div>

      <Banda inaltime="scurta">
        <form method="get" className="grid gap-4 sm:grid-cols-2" data-tipar="ascunde">
          <label className="flex flex-col gap-1.5">
            <span className="text-[0.875rem] font-medium">Angajatorul</span>
            <input
              type="text"
              name="angajator"
              defaultValue={angajator}
              placeholder="Firma Exemplu SRL"
              className={CLASA_CAMP}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[0.875rem] font-medium">Numele salariatului</span>
            <input
              type="text"
              name="salariat"
              defaultValue={salariat}
              placeholder="Popescu Ion"
              className={CLASA_CAMP}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[0.875rem] font-medium">Funcția</span>
            <input
              type="text"
              name="functie"
              defaultValue={functie}
              placeholder="operator"
              className={CLASA_CAMP}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[0.875rem] font-medium">Localitatea</span>
            <input
              type="text"
              name="localitate"
              defaultValue={localitate}
              placeholder="Timișoara"
              className={CLASA_CAMP}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[0.875rem] font-medium">De la</span>
            <input
              type="date"
              name="de_la"
              defaultValue={deLa}
              min={`${String(AN_MIN)}-01-01`}
              max={`${String(AN_MAX)}-12-31`}
              className={CLASA_CAMP}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[0.875rem] font-medium">Până la, inclusiv</span>
            <input
              type="date"
              name="pana_la"
              defaultValue={panaLa}
              min={`${String(AN_MIN)}-01-01`}
              max={`${String(AN_MAX)}-12-31`}
              className={CLASA_CAMP}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[0.875rem] font-medium">Data cererii</span>
            <input
              type="date"
              name="data"
              defaultValue={dataCererii}
              min={`${String(AN_MIN)}-01-01`}
              max={`${String(AN_MAX)}-12-31`}
              className={CLASA_CAMP}
            />
          </label>
          <div className="flex items-end">
            <button
              type="submit"
              className="bg-mk-cerneala text-mk-text-inv font-mk-date w-full px-4 py-2.5 text-[0.8125rem] tracking-[0.08em] uppercase"
            >
              Recalculează
            </button>
          </div>
        </form>
      </Banda>

      <Banda inaltime="scurta">
        {cerere.problema !== null ? (
          <p className="border-mk-rigla text-mk-text border p-4 text-[0.9375rem]">
            {cerere.problema} Alegeți un interval în care data de sfârșit vine după cea de început.
          </p>
        ) : (
          <>
            {/* Documentul propriu-zis. Singurul lucru care rămâne la tipărire. */}
            {/* `print:` scoate chenarul și marginile interioare: pe ecran sunt
                ce face documentul să arate ca o foaie, pe hârtie sunt o ramă
                tipărită degeaba și un text împins spre mijloc. Aceeași alegere
                ca la afișul de pontare din aplicație. */}
            <article className="border-mk-rigla mx-auto max-w-[46rem] border p-8 text-[0.9375rem] leading-[1.75] sm:p-12 print:border-0 print:p-0">
              <p className="text-right">
                Către: {angajator === "" ? <Gol latime="16rem" /> : angajator}
              </p>

              <h2 className="font-mk-display my-8 text-center text-[1.5rem] font-semibold tracking-[0.02em]">
                CERERE
              </h2>

              <p>
                Subsemnatul/Subsemnata {salariat === "" ? <Gol latime="16rem" /> : salariat}, având
                funcția de {functie === "" ? <Gol latime="10rem" /> : functie}, vă rog să binevoiți
                a aproba efectuarea concediului de odihnă în perioada{" "}
                <strong>{formatDate(cerere.deLa)}</strong> –{" "}
                <strong>{formatDate(cerere.panaLa)}</strong> inclusiv, reprezentând{" "}
                <strong>
                  {cerere.zileLucratoare}{" "}
                  {cerere.zileLucratoare === 1 ? "zi lucrătoare" : "zile lucrătoare"}
                </strong>
                .
              </p>

              <p className="mt-4">
                Menționez că în intervalul solicitat nu se numără{" "}
                {cerere.zileWeekend > 0
                  ? `cele ${String(cerere.zileWeekend)} zile de weekend`
                  : "nicio zi de weekend"}
                {cerere.excluse.length > 0
                  ? ` și nici sărbătorile legale: ${cerere.excluse
                      .map((z) => `${formatDate(z.data)} (${z.motiv})`)
                      .join(", ")}`
                  : ""}
                .
              </p>

              <div className="mt-12 flex flex-wrap justify-between gap-6">
                <p>
                  {localitate === "" ? <Gol latime="8rem" /> : localitate},{" "}
                  {formatDate(dataCererii)}
                </p>
                <p>
                  Semnătura <Gol />
                </p>
              </div>

              <div className="border-mk-rigla/60 mt-12 flex flex-wrap justify-between gap-6 border-t pt-6">
                <p>
                  Șef ierarhic <Gol latime="10rem" />
                </p>
                <p>
                  Aprobat <Gol latime="10rem" />
                </p>
              </div>
            </article>

            {/* Explicația cifrei, sub document. Nu se tipărește. */}
            <div className="mt-6 space-y-2" data-tipar="ascunde">
              <p className="text-mk-text-slab text-[0.875rem] leading-[1.6]">
                {cerere.zileCalendaristice} zile pe calendar · {cerere.zileWeekend} de weekend ·{" "}
                {cerere.excluse.length}{" "}
                {cerere.excluse.length === 1 ? "sărbătoare legală" : "sărbători legale"} ={" "}
                <strong className="text-mk-text">
                  {cerere.zileLucratoare} zile scăzute din sold
                </strong>
                .
              </p>
              <p className="text-mk-text-slab text-[0.875rem] leading-[1.6]">
                Tipăriți pagina din browser — rămâne doar cererea, fără formular și fără meniuri.
              </p>
            </div>
          </>
        )}
      </Banda>

      {/* `Banda` nu primește atribute libere, deci marcajul de tipărire stă pe
          învelișul ei — la fel ca la antet, mai sus. */}
      <div data-tipar="ascunde">
        <Banda
          inaltime="medie"
          supratitlu="Ce spune legea"
          titlu="Trei reguli care schimbă cererea"
          lead="Codul muncii nu impune un model de cerere. Impune însă lucruri care se văd în ea: numărul de zile, momentul depunerii și termenul de plată."
        >
          <div className="border-mk-rigla/40 mt-8 border-t">
            {[
              {
                titlu: "Sărbătorile legale nu intră în concediu",
                text: "Art. 145 alin. (3) scoate din durata concediului de odihnă atât sărbătorile legale în care nu se lucrează, cât și zilele libere plătite stabilite prin contractul colectiv aplicabil. Pe primele le calculează unealta asta; pe celelalte nu le putem ști, fiindcă sunt ale fiecărei firme — dacă firma ta are așa ceva, scade-le tu din numărul de mai sus.",
              },
              {
                titlu: "Cererea se depune cu 60 de zile înainte",
                text: "Art. 148 alin. (4): în cadrul perioadelor stabilite prin programarea colectivă sau individuală, salariatul poate solicita efectuarea concediului cu cel puțin 60 de zile anterioare efectuării acestuia. Termenul presupune că există o programare — ea se face, potrivit alin. (1), până la sfârșitul anului calendaristic, pentru anul următor.",
              },
              {
                titlu: "Banii vin înainte de plecare, nu după",
                text: "Art. 150 alin. (3) cere ca indemnizația de concediu să fie plătită cu cel puțin 5 zile lucrătoare înainte de plecare, iar obligația e a angajatorului, fără condiție de cerere din partea salariatului. În practică e ratată aproape peste tot, fiindcă plata se face din același stat de salarii ca restul lunii.",
              },
            ].map((r) => (
              <div
                key={r.titlu}
                className="border-mk-rigla/40 grid gap-2 border-b py-5 md:grid-cols-12 md:gap-8"
              >
                <h3 className="font-mk-display text-[1rem] leading-[1.25] font-semibold md:col-span-4">
                  {r.titlu}
                </h3>
                <p className="text-mk-text-slab text-[0.9375rem] leading-[1.6] md:col-span-8">
                  {r.text}
                </p>
              </div>
            ))}
          </div>
        </Banda>
      </div>
    </Cadru>
  );
}
