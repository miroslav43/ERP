// src/lib/ui/cn.ts
import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * `tailwind-merge` cunoaște scara implicită a lui Tailwind, nu pe a noastră.
 * Fără lista de mai jos, clasifică GREȘIT fiecare token propriu — și greșește
 * TĂCUT.
 *
 * Cazul care a dat peste cap trei primitive deodată, găsit de testele de
 * randare, nu de compilator:
 *
 *     twMerge("text-corp", "text-foreground")  →  "text-foreground"
 *     twMerge("text-foreground", "text-corp")  →  "text-corp"
 *
 * `text-corp` e o MĂRIME de text (`--text-corp` din `@theme`), dar biblioteca
 * n-are de unde ști asta: vede prefixul `text-`, nu recunoaște valoarea, o
 * tratează drept culoare și o pune în conflict cu cerneala. Rezultatul, în
 * funcție de ordinea în care Prettier sortase clasele: ori pastila își pierdea
 * mărimea, ori câmpul de formular își pierdea culoarea. Ambele fără nicio
 * eroare, nicăieri.
 *
 * Aceeași problemă, în oglindă, la utilitarele scrise cu `@utility` în
 * `globals.css`: `z-antet` și `z-meniu` nu se anulau reciproc, fiindcă niciuna
 * nu era recunoscută ca indice de stivuire — două valori de `z-index` ajungeau
 * împreună în atribut, iar câștigătoarea o decidea ordinea din foaia de stil.
 *
 * Lista trebuie ținută în sincron cu `@theme inline` și cu blocurile `@utility`
 * din `src/app/globals.css`. Un token nou acolo, fără pereche aici, se
 * comportă exact ca înainte de reparație.
 */
const merge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        "text-cifra",
        "text-titlu",
        "text-sectiune",
        "text-corp",
        "text-nota",
        "text-eticheta",
      ],
      rounded: ["rounded-control", "rounded-panou"],
      shadow: ["shadow-ridicat", "shadow-plutitor"],
      z: ["z-coloana", "z-antet-tabel", "z-meniu", "z-antet", "z-scrim", "z-sertar", "z-plutitor"],
      duration: ["durata-lent"],
    },
  },
});

/**
 * Singurul loc din proiect care are voie să concateneze clase Tailwind.
 *
 * De ce e nevoie de el, când `${a} ${b}` pare să facă același lucru: nu face.
 * Într-o listă de clase, ultima câștigă doar dacă are aceeași specificitate —
 * dar utilitarele Tailwind se emit în ordinea din foaia de stil, nu în ordinea
 * din atribut. Deci `"p-4"` scris după `"p-2"` NU garantează 16px; garantează
 * doar că amândouă sunt prezente, iar câștigătoarea o decide ordinea de
 * generare. `twMerge` rezolvă asta semantic: știe că `p-4` și `p-2` ocupă
 * același loc și o păstrează pe ultima.
 *
 * Consecința practică e motivul pentru care fișierul ăsta se scrie ÎNAINTEA
 * oricărei primitive: fără el, o componentă nu poate primi `className` din
 * exterior fără să se bată cu propria bază — și exact de aceea, în tot repo-ul,
 * fiecare fișier și-a scris propria constantă de clase în loc să folosească o
 * componentă. `clsx`, `tailwind-merge` și `class-variance-authority` erau deja
 * în `package.json`, cu zero importuri.
 *
 * Atenție la Prettier: clasele din `cn()` NU se sortează decât dacă numele
 * funcției e trecut în `tailwindFunctions` din `.prettierrc.json`. Verificat
 * empiric — vezi `docs/design/redesign/0-decizii-de-pornire.md` §B2.
 */
export function cn(...intrari: readonly ClassValue[]): string {
  return merge(clsx(intrari));
}
