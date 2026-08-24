// src/components/forms/combobox-cod.tsx
// Primitivele comune ale comboboxurilor „cod + denumire": nomenclatorul CAEN
// și lista de țări arată și se comportă la fel — se scrie liber pentru a
// filtra, se alege din listă sau se tastează codul direct, iar valoarea
// rămâne afișată ca „COD — Denumire".
//
// Aici stau doar filtrarea, rezolvarea textului scris de mână și partea
// vizuală. Starea fiecărui selector (ciornă, listă deschisă, rând activ)
// rămâne în componenta lui: sunt destule diferențe — CAEN principal e o
// valoare unică, CAEN secundare e o listă cu limită pe formă juridică — încât
// un singur component parametrizat ar fi ieșit mai greu de urmărit decât
// duplicarea pe care o evită.
"use client";

import { AlertTriangle } from "lucide-react";

import { clasaControl } from "@/components/ui/camp";
import { cheieCautare } from "@/lib/text/diacritice";
import { cn } from "@/lib/ui/cn";

export type OptiuneCod = Readonly<{
  cod: string;
  denumire: string;
}>;

/** `RO — România`, `6210 — Activități de realizare a softului la comandă` */
export function etichetaOptiune(o: OptiuneCod): string {
  return `${o.cod} — ${o.denumire}`;
}

/**
 * Chenarul celor patru comboboxuri (CAEN principal, CAEN secundare, țară,
 * câmpul cu sugestii) era `border-border` = #e3dbc9 pe #faf7f0, adică
 * **1,29:1**. WCAG 1.4.11 cere 3:1 pentru conturul unui control cu care se
 * interacționează: câmpul era, practic, invizibil ca formă — se ghicea din
 * text și din cursorul care se schimbă.
 *
 * `clasaControl()` din `ui/camp.tsx` e aceeași formă cu `border-foreground/60`
 * (4,23:1), plus ce lipsea cu totul: `hover:border-foreground`,
 * `aria-invalid:border-danger` și setul `disabled:` canonic — ultimul
 * înlocuiește `opacity-60` scris de mână în `selector-cod-caen.tsx`, care
 * măsura 4,34:1, tot sub prag.
 *
 * `mt-1` rămâne în afara clasei de control: e distanța față de etichetă, nu o
 * proprietate a câmpului.
 */
export const CLASA_CAMP = cn("mt-1", clasaControl());

/** Niciun rând evidențiat: Enter nu alege din listă, ci interpretează textul. */
export const FARA_RAND_ACTIV = -1;

/**
 * Filtrare pe cod SAU denumire, fără diacritice, fără sensibilitate la
 * majuscule; exclude codurile deja alese.
 *
 * Codul se normalizează la fel ca interogarea — altfel „ro" nu ar găsi
 * niciodată „RO", pentru că interogarea vine deja minusculată. La CAEN, unde
 * codurile sunt cifre, normalizarea nu schimbă nimic.
 */
export function filtreazaOptiuni(
  optiuni: readonly OptiuneCod[],
  interogare: string,
  exclude: ReadonlySet<string>,
  limita: number,
): readonly OptiuneCod[] {
  const termen = cheieCautare(interogare.trim());
  const sursa =
    termen.length === 0
      ? optiuni
      : optiuni.filter(
          (o) =>
            cheieCautare(o.cod).startsWith(termen) || cheieCautare(o.denumire).includes(termen),
        );
  const rezultat: OptiuneCod[] = [];
  for (const o of sursa) {
    if (exclude.has(o.cod)) continue;
    rezultat.push(o);
    if (rezultat.length >= limita) break;
  }
  return rezultat;
}

/**
 * Interpretează textul scris de mână, ca să nu fie nevoie de un clic în listă.
 * Acceptă, în ordine:
 *   1. codul singur, cu sau fără separatori — `RO`, `6210`, `62.10`, `62 10`;
 *   2. codul din fața etichetei — `RO — România`, `6210 — Denumire…`;
 *   3. denumirea scrisă complet (fără diacritice, case-insensitive);
 *   4. o căutare care întoarce un singur rezultat, deci neambiguă.
 * `undefined` = textul nu identifică fără dubiu o opțiune reală.
 */
export function rezolvaOptiune(
  optiuni: readonly OptiuneCod[],
  text: string,
  exclude: ReadonlySet<string>,
  limita: number,
): OptiuneCod | undefined {
  const brut = text.trim();
  if (brut.length === 0) return undefined;

  const peCod = (candidat: string): OptiuneCod | undefined =>
    optiuni.find((o) => o.cod.toUpperCase() === candidat.toUpperCase());

  const compact = peCod(brut.replace(/[.\s]/g, ""));
  if (compact !== undefined) return compact;

  const prefix = /^([^\s—-]+)\s*(?:—|-)/.exec(brut)?.[1];
  if (prefix !== undefined) {
    const pePrefix = peCod(prefix);
    if (pePrefix !== undefined) return pePrefix;
  }

  const normalizat = cheieCautare(brut);
  const peDenumire = optiuni.filter((o) => cheieCautare(o.denumire) === normalizat);
  if (peDenumire.length === 1) return peDenumire[0];

  const filtrate = filtreazaOptiuni(optiuni, brut, exclude, limita);
  return filtrate.length === 1 ? filtrate[0] : undefined;
}

/**
 * Avertismentul de sub combobox — „«6210x» nu corespunde niciunui cod din
 * nomenclator".
 *
 * Textul era `text-warning`, adică #b7791f pe pânză: 3,40:1, sub pragul de
 * 4,5:1 al WCAG 1.4.3 pentru text sub 18,66px bold, iar aici e `text-nota`.
 * Mesajul spune singurul lucru care explică de ce codul tastat nu se salvează,
 * și era cel mai slab vizibil element din câmp.
 *
 * Regula, o dată: PICTOGRAMA poartă tonul, CUVÂNTUL poartă sensul, culoarea nu
 * poartă nimic singură. `text-foreground` cu triunghi dă 13,67:1 și rămâne
 * lizibil și tipărit alb-negru.
 */
export function Avertisment({ id, mesaj }: Readonly<{ id: string; mesaj: string | undefined }>) {
  if (mesaj === undefined) return null;
  return (
    <p id={id} role="status" className="text-foreground text-nota mt-1 flex items-start gap-1.5">
      <AlertTriangle aria-hidden="true" className="text-warning size-3.5 shrink-0 translate-y-px" />
      <span>{mesaj}</span>
    </p>
  );
}

export function ListaRezultate({
  rezultate,
  indiceActiv,
  onAlege,
  idListbox,
  mesajGol,
}: Readonly<{
  rezultate: readonly OptiuneCod[];
  indiceActiv: number;
  onAlege: (optiune: OptiuneCod) => void;
  idListbox: string;
  mesajGol: string;
}>) {
  if (rezultate.length === 0) {
    return (
      <div className="border-border bg-background text-muted-foreground rounded-control text-corp shadow-plutitor z-meniu absolute mt-1 w-full border p-2">
        {mesajGol}
      </div>
    );
  }
  return (
    <ul
      id={idListbox}
      role="listbox"
      /*
        ── DE CE `z-meniu` ȘI NU `z-10` ────────────────────────────────────
        `z-10` e treapta `--z-coloana` din `globals.css:122`, adică a coloanei
        lipite dintr-o matrice. Antetul lipit al unui tabel e 20, deci lista
        deschisă într-un ecran cu tabel intra SUB antet: cine caută un cod cu
        pagina derulată vedea primele rânduri ale listei acoperite, fără nicio
        eroare. `z-meniu` (30) e treapta declarată exact pentru „liste
        derulante și meniuri deschise în pagină”.

        ── DE CE PANOUL E `bg-background`, NU `bg-surface` ─────────────────
        Panoul era `bg-surface` (#f2ede1) și rândurile încercau `bg-primary/10`
        peste `hover:bg-primary/5` — două fundaluri TRANSLUCIDE una peste alta,
        cu delta aproape nulă. Cu panoul pe pânză (`background`), rândul are din
        nou unde să se ducă: `bg-surface` e treapta următoare, opacă, aceeași pe
        care o folosește rândul de tabel. Un singur fundal, două stări, iar
        „rândul navigat cu săgețile” se distinge prin BARĂ, nu prin nuanță.

        `min(16rem, 50dvh)`: 16rem fixe acoperă tot ecranul unui telefon ținut
        în peisaj, iar lista nu mai lasă loc câmpului din care se caută.
      */
      className="border-border bg-background rounded-control shadow-plutitor z-meniu absolute mt-1 max-h-[min(16rem,50dvh)] w-full overflow-auto border"
    >
      {rezultate.map((o, index) => (
        <li key={o.cod}>
          <button
            type="button"
            role="option"
            aria-selected={index === indiceActiv}
            onMouseDown={(e) => {
              e.preventDefault(); // păstrează focusul pe input, nu-l fură butonul
              onAlege(o);
            }}
            className={
              "text-corp flex w-full items-baseline gap-2 border-l-2 px-3 py-2 text-left transition-colors " +
              (index === indiceActiv
                ? "border-l-primary bg-surface"
                : "hover:bg-surface border-l-transparent")
            }
          >
            <span className="text-foreground font-mono font-medium">{o.cod}</span>
            <span className="text-muted-foreground">{o.denumire}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
