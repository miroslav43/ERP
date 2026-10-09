// src/app/(marketing)/unelte/foaie-de-pontaj/page.tsx
import type { Metadata } from "next";
import Link from "next/link";

import { ACOPERIRE_FOAIE, INTREBARI_FOAIE_PONTAJ } from "@/content/landing/intrebari-pontaj";
import { LEGATURI_CONEXE } from "@/content/landing/legaturi";
import { RO } from "@/content/landing/ro";
import { metaUnealta } from "@/content/landing/seo-unelte";
import { ANTET_FOAIE_PONTAJ } from "@/content/landing/unelte";
import { calendarulAnului, cuDe } from "@/content/legal/zile-libere";
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
} from "./foaie";
import { documenteleFoii } from "./foaie-document";
import {
  CHEI_PONTAJ,
  construiestePontaj,
  parametriPontaj,
  PROGRAME,
  rezumatNorma,
  VARIANTE,
} from "./pontaj";
import { TabelColectiv } from "./tabel-colectiv";

/**
 * Foaie de pontaj lunară, gratuită, fără cont: colectivă sau câte o fișă pe om.
 *
 * ── DE CE EXISTĂ ──────────────────────────────────────────────────────────
 * „Foaie de pontaj lunar excel” e una dintre puținele căutări din zona asta cu
 * intenție clară și cu concurență slabă: rezultatele sunt șabloane statice, cu
 * sărbătorile scrise de mână pentru anul în care au fost făcute. Aici
 * sărbătorile se CALCULEAZĂ, inclusiv Paștele ortodox — același cod care ține
 * calendarul aplicației.
 *
 * ── CE A ADUS AUDITUL DIN 8 OCT 2026 ──────────────────────────────────────
 * Utilitate 3/5: lipseau ora de început și de sfârșit (art. 119), codurile,
 * totalurile pe absențe, antetul firmei, norma pe angajat, tipărirea Excelului.
 * Acum: varianta individuală (art. 119), programul pe ture, `Nume | normă`,
 * coduri ca în aplicație, Excel cu formule și A4 cu capul repetat.
 *
 * ── DE CE FORMULAR GET, FĂRĂ JAVASCRIPT ───────────────────────────────────
 * Parametrii stau în adresă: foaia se pune la favorite și se trimite pe e-mail
 * gata completată. Merge cu JavaScript oprit, iar descărcările sunt butoane de
 * trimitere spre `/api/unelte/foaie-de-pontaj` (vezi `Descarcari`).
 */
// Titlul și descrierea: `seo-unelte.ts` (8 oct 2026). „lunar” rămâne în titlu:
// e singurul termen pentru care Google afișa pagina.
export const metadata: Metadata = metadatePagina(metaUnealta("/unelte/foaie-de-pontaj"));

type Proprietati = Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>;

const unul = (v: string | string[] | undefined): string | undefined =>
  Array.isArray(v) ? v[0] : v;

const CLASA_CAMP =
  "border-mk-rigla bg-mk-hartie focus:border-mk-text rounded w-full border px-3 py-2.5 text-base";
const CLASA_ETICHETA = "text-[0.875rem] font-medium";
const CLASA_AJUTOR = "text-mk-text-slab text-[0.8125rem]";

/** Loc pentru „ | 7:30” după fiecare nume și pentru linia nouă: 60 × (80 + 9). */
const MAX_TEXT_ANGAJATI = MAX_ANGAJATI * (MAX_LUNGIME_NUME + 9);

export default async function PaginaFoaieDePontaj({ searchParams }: Proprietati) {
  const p = await searchParams;
  const q = new URLSearchParams();
  for (const cheie of CHEI_PONTAJ) {
    const v = unul(p[cheie]);
    if (v !== undefined && v !== "") q.set(cheie, v);
  }
  const parametri = parametriPontaj(q);
  const pontaj = construiestePontaj(parametri);
  const [primul, ...restul] = documenteleFoii(pontaj);
  const calendar = calendarulAnului(pontaj.an);
  const brutAngajati = unul(p.angajati) ?? "";
  // Un singur aviz pe pagină (`AvizCorectari`, B4): ce a corectat B din adresă și
  // din listă, apoi ce a corectat E — norma care nu se citește, CUI-ul.
  const avize = [
    ...avizeParametri(
      { an: unul(p.an), luna: unul(p.luna), ore: unul(p.ore) },
      { an: pontaj.an, luna: pontaj.luna },
    ),
    ...avizAngajati(parametri.linii.lista),
    ...parametri.linii.avertismente,
    avertismentCui(parametri.antet),
  ].filter((a): a is string => a !== null);
  const cuNormaProprie = pontaj.angajati.filter(
    (a) => a.nume !== "" && a.oreZi !== pontaj.oreZi,
  ).length;

  return (
    <Cadru text={RO}>
      <JsonLd
        date={nodUnealta({
          cale: "/unelte/foaie-de-pontaj",
          nume: ANTET_FOAIE_PONTAJ.titlu,
          descriere: ANTET_FOAIE_PONTAJ.lead,
        })}
      />
      {/* `data-tipar="ascunde"` e convenția proiectului: la tipărire rămâne doar
          `#documentul` (secțiunea B: `Antet`, `Subsol`, bara de cookie-uri, `Banda`). */}
      <div data-tipar="ascunde">
        <AntetSecundar
          text={ANTET_FOAIE_PONTAJ}
          firimituri={[
            { eticheta: "Acasă", href: "/" },
            { eticheta: "Unelte", href: "/unelte" },
            { eticheta: "Foaie de pontaj", href: "/unelte/foaie-de-pontaj" },
          ]}
        />
      </div>

      {/* Toată banda formularului rămâne pe ecran (B6): altfel umplutura și rigla
          ei se tipăreau goale deasupra documentului. */}
      <Banda inaltime="scurta" data-tipar="ascunde">
        <form
          action="#documentul"
          method="get"
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
          data-tipar="ascunde"
        >
          <label className="flex flex-col gap-1.5">
            <span className={CLASA_ETICHETA}>Luna</span>
            <select name="luna" defaultValue={String(pontaj.luna)} className={CLASA_CAMP}>
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
              defaultValue={String(pontaj.an)}
              className={CLASA_CAMP}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={CLASA_ETICHETA}>Ore pe zi</span>
            <input
              type="number"
              name="ore"
              min={1}
              max={24}
              step="0.5"
              defaultValue={String(pontaj.oreZi)}
              className={CLASA_CAMP}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={CLASA_ETICHETA}>Program</span>
            <select name="program" defaultValue={pontaj.program} className={CLASA_CAMP}>
              {PROGRAME.map((o) => (
                <option key={o.valoare} value={o.valoare}>
                  {o.eticheta}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 sm:col-span-2">
            <span className={CLASA_ETICHETA}>Varianta</span>
            <select name="varianta" defaultValue={pontaj.varianta} className={CLASA_CAMP}>
              {VARIANTE.map((o) => (
                <option key={o.valoare} value={o.valoare}>
                  {o.eticheta}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 sm:col-span-2">
            <span className={CLASA_ETICHETA}>Firma (opțional)</span>
            <input
              type="text"
              name="firma"
              maxLength={MAX_FIRMA}
              defaultValue={parametri.antet.firma}
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
              defaultValue={parametri.antet.cui}
              inputMode="text"
              className={CLASA_CAMP}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={CLASA_ETICHETA}>Compartiment (opțional)</span>
            <input
              type="text"
              name="compartiment"
              maxLength={MAX_COMPARTIMENT}
              defaultValue={parametri.antet.compartiment}
              className={CLASA_CAMP}
            />
          </label>
          <div className="flex items-end sm:col-span-2">
            <button
              type="submit"
              data-umami-event="foaie-genereaza"
              className="bg-mk-cerneala text-mk-text-inv inline-flex h-11 w-full items-center justify-center rounded px-5 text-[0.9375rem] font-medium transition-opacity hover:opacity-90"
            >
              Generează
            </button>
          </div>
          <label className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-4">
            <span className={CLASA_ETICHETA}>Angajați</span>
            <span className={CLASA_AJUTOR}>
              Câte un nume pe rând. Cine are altă normă decât cea de sus primește orele după o bară:
              „Ilie Maria | 4”. Poți lipi direct două coloane din Excel, numele și orele. Lasă gol
              pentru foaia de completat cu pixul.
            </span>
            <textarea
              name="angajati"
              rows={5}
              maxLength={MAX_TEXT_ANGAJATI}
              defaultValue={brutAngajati}
              placeholder={"Popa Ion\nIlie Maria | 4\nRadu Andrei"}
              className={CLASA_CAMP}
            />
          </label>
          <Descarcari actiune="/api/unelte/foaie-de-pontaj" eveniment="foaie" />
        </form>

        <AvizCorectari avize={avize} />
        <p className="text-mk-text-slab mt-6 text-[0.9375rem]" data-tipar="ascunde">
          {rezumatNorma(pontaj)}
          {cuNormaProprie > 0 &&
            ` · ${cuNormaProprie === 1 ? "un angajat" : cuDe(cuNormaProprie, "angajați")} cu normă proprie`}
        </p>
      </Banda>

      <Banda id="documentul" inaltime="scurta">
        {pontaj.varianta === "colectiva" ? (
          <figure data-tipar-pagina="peisaj">
            {/* Fără `mk-foaie`: `globals.css` ascunde sub 1280 px orice `[data-zi]`
                dintr-un `.mk-foaie` (ferestrele foii din aplicație), iar
                `TabelColectiv` marchează cu `data-zi` capul fiecărei zile. */}
            <figcaption className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
              <p className="font-mk-date text-[0.6875rem] font-medium tracking-[0.14em] uppercase">
                {primul.titlu}
              </p>
              {primul.subtitlu !== null && (
                <p className="font-mk-date text-mk-text-slab text-[0.6875rem] tracking-[0.04em]">
                  {primul.subtitlu}
                </p>
              )}
            </figcaption>
            <TabelColectiv pontaj={pontaj} document={primul} />
            {primul.note.map((n) => (
              <p key={n} className="text-mk-text-slab mt-3 text-[0.8125rem] leading-[1.6]">
                {n}
              </p>
            ))}
          </figure>
        ) : (
          <>
            <PrevizualizareDocument document={primul} />
            {restul.length > 0 && (
              <p className="text-mk-text-slab mt-4 text-[0.875rem]">
                {restul.length === 1 ? "Încă o fișă" : `Încă ${cuDe(restul.length, "fișe")}`}, câte
                una pe pagină, în fișierul descărcat.
              </p>
            )}
          </>
        )}
      </Banda>

      <div data-tipar="ascunde">
        <CeCereItm acoperire={ACOPERIRE_FOAIE} />
      </div>

      {/* Zilele lucrătoare și norma pe luni, pentru anul ales — din același calcul
          ca ghidul zilelor libere (auditul din 7 oct 2026). */}
      <div data-tipar="ascunde">
        <Banda
          id="zile-lucratoare"
          inaltime="medie"
          titlu={`Zile lucrătoare și ore normă în ${String(pontaj.an)}`}
          lead={`Pentru normă întreagă de 8 ore pe zi. ${String(pontaj.an)} are ${cuDe(calendar.zileLucratoare, "zile lucrătoare")}, adică ${cuDe(calendar.zileLucratoare * 8, "ore")}.`}
        >
          <div className="relative mt-6 max-w-xl overflow-x-auto">
            <table className="w-full border-collapse text-left text-[0.9375rem]">
              <thead>
                <tr className="border-mk-rigla border-b">
                  <th scope="col" className="py-2 pr-4 font-medium">
                    Luna
                  </th>
                  <th scope="col" className="py-2 pr-4 font-medium">
                    Zile lucrătoare
                  </th>
                  <th scope="col" className="py-2 font-medium">
                    Ore normă
                  </th>
                </tr>
              </thead>
              <tbody>
                {calendar.luni.map((l) => (
                  <tr key={l.luna} className="border-mk-rigla/40 border-b">
                    <td className="py-2 pr-4 capitalize">{l.luna}</td>
                    <td className="font-mk-date py-2 pr-4 tabular-nums">{l.zileLucratoare}</td>
                    <td className="font-mk-date py-2 tabular-nums">{l.zileLucratoare * 8}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-mk-text-slab mt-4 text-[0.9375rem] leading-[1.6]">
            Sărbătorile legale ale anului, cu ziua în care cade fiecare:{" "}
            <Link href="/ghid/zile-libere" className="underline underline-offset-4">
              zilele libere legale
            </Link>
            .
          </p>
        </Banda>
      </div>

      <div data-tipar="ascunde">
        <IntrebariUnealta
          titlu="Ce se mai întreabă despre foaia de pontaj"
          intrebari={INTREBARI_FOAIE_PONTAJ}
        />
      </div>

      <div data-tipar="ascunde">
        <Banda inaltime="medie" titlu="De ce sărbătorile de aici sunt corecte">
          <div className="mt-6 max-w-[68ch] space-y-4">
            <p className="text-mk-text-slab text-[0.9375rem] leading-[1.7]">
              Un șablon de foaie de calcul descărcat de pe internet are sărbătorile scrise de mână,
              pentru anul în care a fost făcut. Anul următor arată exact la fel și e greșit — iar
              Paștele ortodox, Vinerea Mare și Rusaliile se mută în fiecare an.
            </p>
            <p className="text-mk-text-slab text-[0.9375rem] leading-[1.7]">
              Aici zilele se calculează exact ca în calendarul aplicației. Dacă alegi 2031, primești
              sărbătorile lui 2031, nu pe ale lui 2026.
            </p>
            <p className="text-mk-text-slab text-[0.9375rem] leading-[1.7]">
              Pe hârtie, foaia nu face socoteli; fișierul Excel adună orele și numără codurile pe
              fiecare om. Tot nu știe cine a fost în concediu și nu poate dovedi peste șase luni
              cine a modificat-o. Pentru astea e nevoie de un loc în care datele să stea, nu de un
              fișier mai bun.
            </p>
            {/*
              Nota asta rămâne, chiar dacă scade conversia: foaia COLECTIVĂ are o
              căsuță pe zi, iar art. 119 cere ora de începere ȘI de sfârșit. O
              unealtă care lasă impresia că te pune în legalitate, când nu te pune,
              e mai rea decât una care lipsește. Din 8 oct 2026 nota trimite la
              varianta care chiar acoperă cerința.
            */}
            <p className="text-mk-text-slab text-[0.9375rem] leading-[1.7]">
              Foaia colectivă are o căsuță pe zi, adică numărul de ore. Art. 119 din Codul muncii
              cere ora de începere <em>și</em> ora de sfârșit, zilnic, ținute la locul de muncă.
              Pentru asta alege{" "}
              {/* `<a>`, nu `Link`: o adresă cu interogare cere navigare tare
                  (`adresa-analitice.test.ts`). Calea întreagă, nu „?varianta=…”:
                  poarta aceluiași test caută adresele care încep cu „?”. */}
              <a
                href="/unelte/foaie-de-pontaj?varianta=individuala#documentul"
                className="underline underline-offset-4"
              >
                fișa individuală
              </a>{" "}
              sau{" "}
              <Link href="/unelte/condica-de-prezenta" className="underline underline-offset-4">
                condica de prezență
              </Link>
              ;{" "}
              <Link href="/evidenta-orelor-de-munca" className="underline underline-offset-4">
                ce cere exact art. 119
              </Link>
              .
            </p>
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href={RO.hero.ctaPrimar.href}
              data-umami-event="cta-foaie-pontaj"
              className="bg-mk-cerneala text-mk-text-inv inline-flex h-12 items-center rounded px-6 text-[0.9375rem] font-medium transition-opacity hover:opacity-90"
            >
              {RO.hero.ctaPrimar.eticheta}
            </Link>
            <Link
              href="/comparatie/excel"
              className="border-mk-rigla hover:border-mk-text inline-flex h-12 items-center rounded border px-6 text-[0.9375rem] font-medium transition-colors"
            >
              Excel sau aplicație
            </Link>
          </div>
          <PeAcelasiSubiect legaturi={LEGATURI_CONEXE["/unelte/foaie-de-pontaj"]} />
        </Banda>
      </div>
    </Cadru>
  );
}
