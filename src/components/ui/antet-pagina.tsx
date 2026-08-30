// src/components/ui/antet-pagina.tsx
import Link from "next/link";
import { Fragment, type ReactElement, type ReactNode } from "react";

import { cn } from "@/lib/ui/cn";

/**
 * Antetul unei pagini. Înlocuiește 122 de `<header>`-uri scrise de mână, dintre
 * care 99 conțin literal aceleași clase, în cel puțin patru structuri diferite.
 *
 * ── CE REPARĂ, DINCOLO DE COPIERE ─────────────────────────────────────────
 * **Nu randează `<main>`.** Cele 122 de antete stăteau în interiorul unui
 * `<main>` scris de pagină, care se dubla peste cel al învelișului. Landmark-ul
 * aparține acum exclusiv layout-ului de zonă, iar componenta asta e locul în
 * care regula devine imposibil de încălcat din reflex.
 *
 * **Titlul are o singură mărime.** Erau `text-titlu` în 99 de fișiere și
 * `text-titlu` pe panou, fără niciun motiv. Acum e `text-titlu`, declarat o dată
 * în `@theme`.
 *
 * **Descrierea nu e opțională din întâmplare.** Aplicația face un lucru rar și
 * bun: textul descriptiv se schimbă după `scope` — „Toate vehiculele
 * organizației" vs „Vehiculele la care aveți acces". Prop-ul îl păstrează
 * vizibil ca parte a contractului, ca să nu se piardă la rescriere.
 *
 * ── LĂȚIMEA NU E AICI ─────────────────────────────────────────────────────
 * Componenta nu-și impune lățimea. Învelișul de zonă dă maximul (104rem), iar
 * paginile care au nevoie de o coloană mai îngustă o cer pe rădăcina lor, cu
 * `LATIMI.formular` sau `LATIMI.detaliu`. Un antet care și-ar seta singur
 * lățimea s-ar desincroniza de conținutul de sub el.
 */
export type PropsAntetPagina = Readonly<{
  /**
   * `ReactNode`, nu `string`. La migrarea celor 116 antete, cinci titluri și
   * trei descrieri purtau marcaj înăuntru — numărul intern al unui accident în
   * gri, numărul unui tichet cu `font-mono`, contorul „3 din 7 pași" cu
   * `tabular-nums`. Turtite în șir, textul rămânea identic și nuanțarea se
   * pierdea tăcut.
   */
  titlu: ReactNode;
  descriere?: ReactNode;
  /**
   * Firimitura de deasupra titlului — „Angajați / Ionescu Ana / Documente".
   *
   * Există fiindcă șase ecrane o scriau ca `<p>` ÎN interiorul lui `<header>`,
   * înaintea lui `<h1>`. Fără prop, tiparul se rescrie de mână la fiecare ecran
   * nou. Nu se confundă cu firimitura din antetul aplicației: aceea spune unde
   * ești în produs, asta spune al cui e ecranul.
   */
  firimituri?: readonly Readonly<{ eticheta: string; href?: string }>[];
  /**
   * Butoanele din dreapta. Cel mult două — a treia se mută într-un meniu.
   *
   * ── DE CE CONTAINERUL LOR ARE ȘI `max-w-full` ─────────────────────────
   * `shrink-0` singur îl rupea. Lățimea de conținut a unui container
   * `flex-wrap` este suma copiilor pe UN rând — asta e `max-content`, iar
   * `shrink-0` spune fix „nu coborî sub `max-content`". Deci containerul
   * rămânea la lățimea tuturor butoanelor puse cap la cap, `flex-wrap` nu
   * apuca niciodată să încapsuleze nimic, iar butoanele ieșeau din card, fără
   * bară de derulare proprie și fără nicio eroare.
   *
   * `max-w-full` îl taie la lățimea antetului: abia sub plafonul ăsta copiii
   * încep să curgă pe al doilea rând. Se vedea pe fișa angajatului, unde
   * antetul primește CINCI copii (două butoane, ștergerea, două ecusoane), nu
   * doi — iar meniul lateral fix de la `md` în sus lasă conținutului sub 600px
   * pe un ecran de 900. Prima poziție unde se rupea nu era telefonul, ci
   * laptopul mic.
   */
  actiuni?: ReactNode;
  /** Banda de file a modulului, ca `<NavConcedii />`. Logica rămâne la modul. */
  file?: ReactNode;
  className?: string;
}>;

export function AntetPagina({
  titlu,
  descriere,
  firimituri,
  actiuni,
  file,
  className,
}: PropsAntetPagina): ReactElement {
  return (
    <header className={cn("flex flex-col gap-4", className)}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          {firimituri === undefined || firimituri.length === 0 ? null : (
            <p className="text-muted-foreground text-nota mb-1 flex flex-wrap items-center gap-1.5">
              {firimituri.map((f, i) => (
                <Fragment key={f.eticheta}>
                  {i > 0 ? <span aria-hidden="true">/</span> : null}
                  {f.href === undefined ? (
                    <span>{f.eticheta}</span>
                  ) : (
                    <Link
                      href={f.href}
                      className="hover:text-foreground underline-offset-2 hover:underline"
                    >
                      {f.eticheta}
                    </Link>
                  )}
                </Fragment>
              ))}
            </p>
          )}
          <h1 className="text-foreground text-titlu leading-tight font-semibold text-balance">
            {titlu}
          </h1>
          {descriere === undefined ? null : (
            <p className="text-muted-foreground text-corp mt-1 max-w-prose text-pretty">
              {descriere}
            </p>
          )}
        </div>
        {actiuni === undefined ? null : (
          <div className="flex max-w-full shrink-0 flex-wrap items-center gap-2">{actiuni}</div>
        )}
      </div>
      {file}
    </header>
  );
}

/**
 * Cele trei lățimi de citire ale produsului.
 *
 * Înainte existau șase, alese pe loc: `max-w-3xl` de 78 de ori, `max-w-2xl` de
 * 42, apoi `4xl`, `5xl`, `6xl` și nimic. Iar `<main>` n-avea niciun maxim, deci
 * pe un monitor de 27" un tabel de șase coloane se întindea pe 2400 de pixeli
 * și ochiul pierdea rândul între prima și ultima celulă.
 *
 * Se pun pe rădăcina paginii, nu pe antet.
 */
export const LATIMI = {
  /** Formulare și ecrane cu o singură coloană de câmpuri. */
  formular: "mx-auto w-full max-w-3xl",
  /** Fișe: destul pentru două coloane de perechi etichetă-valoare. */
  detaliu: "mx-auto w-full max-w-5xl",
  /** Liste și tabele: cât dă învelișul, fără îngustare proprie. */
  lista: "w-full",
} as const;
