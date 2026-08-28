// src/components/ui/tabel.tsx
import Link from "next/link";
import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";
import type { ReactElement, ReactNode } from "react";

import { cn } from "@/lib/ui/cn";

import { RandTabel } from "../data/rand-tabel";
import { SenzorLink } from "@/components/incarcare/senzor-link";

/**
 * Tabelul aplicației. Înlocuiește 57 de `<table>` scrise de mână.
 *
 * ── DE CE E SERVER COMPONENT, DEȘI SORTEAZĂ ȘI CADE PE CARD ───────────────
 * Auditul a semnalat, corect, că un API de forma
 * `coloane={[{ celula: (r) => <Badge/> }]}` trimite o FUNCȚIE de la server la
 * client și cade la runtime — iar toate cele 94 de pagini din `(app)` sunt
 * Server Components. Concluzia lui era că `Tabel` trebuie spart în două.
 *
 * Nu trebuie, fiindcă niciuna dintre cele două funcții pe care le-ar fi cerut
 * clientul nu are nevoie de client:
 *
 * · **Sortarea e stare de URL.** Antetul e un `<Link>` către `?sort=…`, nu un
 *   `onClick`. Serverul recitește, `aria-sort` se schimbă, zero JavaScript.
 * · **Căderea pe card e CSS.** Se randează ambele marcaje din ACELEAȘI
 *   metadate — tabel peste `md`, listă sub — și se ascunde unul. Costă DOM
 *   dublat pentru douăzeci și cinci de rânduri, ceea ce e mai ieftin decât un
 *   pachet de JavaScript pe fiecare listă din produs.
 *
 * Fișierul n-are `"use client"`, deci se compilează în graful care îl importă:
 * funcțiile din `coloane` se creează și se consumă de aceeași parte a
 * graniței. Singura bucată de client rămâne `RandTabel`, care exista dinainte
 * și primește `children`, nu funcții.
 *
 * ── DENSITATEA E O DECIZIE, NU O ÎNTÂMPLARE ───────────────────────────────
 * În depozit erau trei densități în uz aproape egal: `px-3 py-2` de 403 de ori,
 * `px-4 py-3` de 375 și `px-4 py-2` de 324. Într-un ERP densitatea e o alegere
 * de produs — patruzeci de rânduri pe ecran în pontaj, douăsprezece în fișa
 * angajatului — deci se cere explicit.
 */
export type Sortare = Readonly<{ cheie: string; directie: "asc" | "desc" }>;

export type Coloana<R> = Readonly<{
  cheie: string;
  antet: string;
  /**
   * Antetul se anunță, dar nu se vede — pentru coloane fără nume util
   * (fotografie, pictogramă). NU e același lucru cu a-l lăsa gol: un `<th>` fără
   * conținut nu spune nimic cititorului de ecran despre coloana pe care o
   * conduce.
   */
  antetAscuns?: boolean;
  /** Fără `sortabil`, antetul rămâne text — nu un buton care nu face nimic. */
  sortabil?: boolean;
  /** Cifre: aliniate la dreapta, cu `tabular-nums`, ca să se compare pe verticală. */
  numeric?: boolean;
  /** `ingusta` — coloana ia exact cât îi trebuie (avatar, cod, pictogramă). */
  latime?: "auto" | "ingusta";
  /**
   * Rolul celulei în varianta de card, sub 768px.
   * `titlu` — rândul de sus, îngroșat. Exact una pe tabel.
   * `insigna` — la dreapta titlului (o pastilă de stare).
   * `meta` — rândul de dedesubt, mărunt, separat prin „·".
   * `ascuns` — nu apare pe telefon.
   */
  peTelefon?: "titlu" | "insigna" | "meta" | "ascuns";
  celula: (rand: R) => ReactNode;
}>;

export type PropsTabel<R> = Readonly<{
  /** `<caption class="sr-only">`. Obligatoriu: un tabel fără nume e mut. */
  caption: string;
  coloane: readonly Coloana<R>[];
  randuri: readonly R[];
  cheieRand: (rand: R) => string;
  /** Face rândul apăsabil. Linkul accesibil stă în coloana `peTelefon="titlu"`. */
  href?: (rand: R) => string;
  sortare?: Sortare;
  /** Construiește adresa pentru o sortare nouă. Fără ea, antetele nu sortează. */
  hrefSortare?: (s: Sortare) => string;
  densitate?: "compact" | "confortabil";
  /** Ce se arată când `randuri` e gol — de obicei un `<StareGoala>`. */
  gol: ReactNode;
  /** `<tfoot>` cu totaluri. */
  subsol?: ReactNode;
  /**
   * Marcaj vizibil când citirea a fost tăiată. `max_rows = 1000` TRUNCHIAZĂ
   * TĂCUT în PostgREST, iar într-un ERP financiar o cifră greșită fără eroare
   * e mai rea decât o eroare.
   */
  trunchiat?: boolean;
  className?: string;
}>;

export function Tabel<R>({
  caption,
  coloane,
  randuri,
  cheieRand,
  href,
  sortare,
  hrefSortare,
  densitate = "confortabil",
  gol,
  subsol,
  trunchiat,
  className,
}: PropsTabel<R>): ReactElement {
  if (randuri.length === 0) return <>{gol}</>;

  const celula = densitate === "compact" ? "px-3 py-2" : "px-4 py-3";
  // Aceeași coloană poartă linkul în ambele marcaje — vezi nota de mai jos.
  const coloanaTitlu = coloane.find((c) => c.peTelefon === "titlu") ?? coloane[0];

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {trunchiat === true ? (
        <p className="border-warning/40 bg-warning/12 text-foreground rounded-panou text-nota border px-3 py-2">
          Lista e tăiată la primele {randuri.length} de rânduri. Restrângeți filtrele ca să vedeți
          restul.
        </p>
      ) : null}

      {/* ── PESTE md: TABEL ─────────────────────────────────────────────── */}
      <div className="border-border rounded-panou hidden overflow-x-auto border md:block">
        <table className="text-corp w-full text-left">
          <caption className="sr-only">{caption}</caption>
          <thead className="bg-surface border-border border-b">
            <tr>
              {coloane.map((c) => (
                <AntetColoana
                  key={c.cheie}
                  coloana={c}
                  celula={celula}
                  {...(sortare === undefined ? {} : { sortare })}
                  {...(hrefSortare === undefined ? {} : { hrefSortare })}
                />
              ))}
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {randuri.map((r) => {
              const continut = coloane.map((c) => (
                <td
                  key={c.cheie}
                  className={cn(
                    celula,
                    "align-middle",
                    c.numeric === true ? "text-right tabular-nums" : "",
                    c.latime === "ingusta" ? "w-px whitespace-nowrap" : "",
                  )}
                >
                  {href === undefined || c !== coloanaTitlu ? (
                    c.celula(r)
                  ) : (
                    // `RandTabel` face rândul apăsabil, dar e DOAR `onClick` pe
                    // `<tr>`: fără acest link, marcajul de peste 768px n-are
                    // nicio țintă pentru tastatură sau cititor de ecran.
                    // Comentariul din `rand-tabel.tsx` spune chiar el că
                    // „linkul accesibil pe nume rămâne neatins" — adică îl
                    // presupune pus de apelant. Aici e apelantul.
                    // `closest("a, …")` din `RandTabel` oprește navigarea
                    // dublă la clic.
                    <Link href={href(r)} className="hover:underline">
                      {c.celula(r)}
                    </Link>
                  )}
                </td>
              ));
              return href === undefined ? (
                <tr key={cheieRand(r)}>{continut}</tr>
              ) : (
                <RandTabel key={cheieRand(r)} href={href(r)}>
                  {continut}
                </RandTabel>
              );
            })}
          </tbody>
          {subsol === undefined ? null : <tfoot className="bg-surface font-medium">{subsol}</tfoot>}
        </table>
      </div>

      {/* ── SUB md: CARDURI ─────────────────────────────────────────────
          Aceleași metadate, alt marcaj. Înainte, cele 57 de tabele deveneau pe
          telefon o bară de derulare orizontală — zero dintre ele aveau vreun
          tratament pentru ecran îngust. */}
      <ul className="border-border rounded-panou divide-border divide-y border md:hidden">
        {randuri.map((r) => (
          <CardRand
            key={cheieRand(r)}
            rand={r}
            coloane={coloane}
            {...(coloanaTitlu === undefined ? {} : { coloanaTitlu })}
            {...(href === undefined ? {} : { href: href(r) })}
          />
        ))}
      </ul>
    </div>
  );
}

function AntetColoana<R>({
  coloana,
  celula,
  sortare,
  hrefSortare,
}: {
  coloana: Coloana<R>;
  celula: string;
  sortare?: Sortare;
  hrefSortare?: (s: Sortare) => string;
}): ReactElement {
  const activ = sortare?.cheie === coloana.cheie;
  const poateSorta = coloana.sortabil === true && hrefSortare !== undefined;

  const clase = cn(
    celula,
    "text-eticheta text-foreground font-semibold tracking-wide uppercase",
    coloana.numeric === true ? "text-right tabular-nums" : "text-left",
    coloana.latime === "ingusta" ? "w-px whitespace-nowrap" : "",
  );

  if (!poateSorta) {
    return (
      <th scope="col" className={clase}>
        {coloana.antetAscuns === true ? (
          <span className="sr-only">{coloana.antet}</span>
        ) : (
          coloana.antet
        )}
      </th>
    );
  }

  const urmatoare: Sortare = {
    cheie: coloana.cheie,
    directie: activ && sortare?.directie === "asc" ? "desc" : "asc",
  };

  return (
    <th
      scope="col"
      // `aria-sort` era ZERO în tot proiectul. Fără el, un cititor de ecran nu
      // are cum să afle după ce e ordonat tabelul.
      aria-sort={activ ? (sortare?.directie === "asc" ? "ascending" : "descending") : "none"}
      className={clase}
    >
      <Link
        href={hrefSortare(urmatoare)}
        className={cn(
          "hover:bg-border -m-1 flex w-full items-center gap-1 rounded p-1 transition-colors",
          coloana.numeric === true ? "justify-end" : "",
        )}
      >
        {coloana.antet}
        {activ ? (
          sortare?.directie === "asc" ? (
            <ChevronUp aria-hidden="true" className="size-3.5 shrink-0" />
          ) : (
            <ChevronDown aria-hidden="true" className="size-3.5 shrink-0" />
          )
        ) : (
          <ChevronsUpDown aria-hidden="true" className="size-3.5 shrink-0 opacity-40" />
        )}
        {/*
          Sortarea reordonează pe SERVER (`hrefSortare` schimbă adresa, iar
          pagina reface interogarea), deci între clic și rânduri e un dus-întors
          întreg în care antetul arăta exact ca înainte — inclusiv `aria-sort`,
          care rămânea pe coloana veche.
        */}
        <SenzorLink eticheta="tabelul" />
      </Link>
    </th>
  );
}

function CardRand<R>({
  rand,
  coloane,
  coloanaTitlu,
  href,
}: {
  rand: R;
  coloane: readonly Coloana<R>[];
  coloanaTitlu?: Coloana<R>;
  href?: string;
}): ReactElement {
  const titlu = coloanaTitlu;
  const insigne = coloane.filter((c) => c.peTelefon === "insigna");
  const meta = coloane.filter(
    (c) => c !== titlu && c.peTelefon !== "insigna" && c.peTelefon !== "ascuns",
  );

  return (
    <li className="relative flex min-h-14 items-start gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-foreground text-corp font-medium">
            {href === undefined ? (
              titlu?.celula(rand)
            ) : (
              // Linkul acoperă tot cardul: o singură oprire de tabulare, o
              // țintă de dimensiunea rândului.
              <Link href={href} className="after:absolute after:inset-0 hover:underline">
                {titlu?.celula(rand)}
              </Link>
            )}
          </span>
          {insigne.map((c) => (
            <span key={c.cheie} className="relative">
              {c.celula(rand)}
            </span>
          ))}
        </div>
        {meta.length === 0 ? null : (
          <p className="text-muted-foreground text-nota mt-1 flex flex-wrap items-center gap-x-1.5">
            {meta.map((c, i) => (
              <span key={c.cheie} className={c.numeric === true ? "tabular-nums" : ""}>
                {i > 0 ? (
                  <span aria-hidden="true" className="me-1.5">
                    ·
                  </span>
                ) : null}
                {c.celula(rand)}
              </span>
            ))}
          </p>
        )}
      </div>
    </li>
  );
}
