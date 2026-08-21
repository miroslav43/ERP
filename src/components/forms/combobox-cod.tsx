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

export type OptiuneCod = Readonly<{
  cod: string;
  denumire: string;
}>;

export function normalizeaza(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** `RO — România`, `6210 — Activități de realizare a softului la comandă` */
export function etichetaOptiune(o: OptiuneCod): string {
  return `${o.cod} — ${o.denumire}`;
}

export const CLASA_CAMP =
  "mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground";

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
  const termen = normalizeaza(interogare.trim());
  const sursa =
    termen.length === 0
      ? optiuni
      : optiuni.filter(
          (o) =>
            normalizeaza(o.cod).startsWith(termen) || normalizeaza(o.denumire).includes(termen),
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

  const normalizat = normalizeaza(brut);
  const peDenumire = optiuni.filter((o) => normalizeaza(o.denumire) === normalizat);
  if (peDenumire.length === 1) return peDenumire[0];

  const filtrate = filtreazaOptiuni(optiuni, brut, exclude, limita);
  return filtrate.length === 1 ? filtrate[0] : undefined;
}

export function Avertisment({ id, mesaj }: Readonly<{ id: string; mesaj: string | undefined }>) {
  if (mesaj === undefined) return null;
  return (
    <p id={id} role="status" className="text-warning mt-1 text-xs">
      {mesaj}
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
      <div className="border-border bg-surface text-muted-foreground absolute z-10 mt-1 w-full rounded-md border p-2 text-sm shadow-md">
        {mesajGol}
      </div>
    );
  }
  return (
    <ul
      id={idListbox}
      role="listbox"
      className="border-border bg-surface absolute z-10 mt-1 max-h-64 w-full overflow-auto rounded-md border shadow-md"
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
              "flex w-full items-baseline gap-2 px-3 py-2 text-left text-sm " +
              (index === indiceActiv ? "bg-primary/10" : "hover:bg-primary/5")
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
