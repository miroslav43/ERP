// src/content/legal/cuprins.ts
import type { PaginaLege } from "./tipuri";

/** „Marea Britanie (Regatul Unit)” → `marea-britanie-regatul-unit`, pentru `#ancora` din adresă. */
export function ancoraRand(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "");
}

/** Titlul fix al benzii de la coada fiecărei pagini-lege. */
export const TITLU_NESIGUR = "Ce nu putem afirma cu siguranță";

export type IntrareCuprins = Readonly<{ id: string; titlu: string }>;

/**
 * Ancorele secțiunilor unei pagini-lege, în ordinea în care apar pe pagină.
 *
 * Până la auditul din 7 oct 2026 (M49), cele nouă pagini-lege — între 800 și
 * 2.300 de cuvinte — nu dădeau niciunei secțiuni un `id`: niciun răspuns nu
 * putea fi legat direct, iar Google n-avea din ce face legături „Salt la" în
 * rezultat. Pe telefon, singura căutare a sitului din primele zece aterizează
 * pe o subsecțiune aflată la șapte ecrane sub pliu.
 *
 * Benzile fixe primesc ancore scurte, scrise de mână; secțiunile de proză și
 * tabelul își iau ancora din titlu, cu `ancora` din conținut ca suprascriere
 * când o adresă deja legată din afară trebuie să supraviețuiască unei
 * redenumiri.
 */
export function cuprinsulPaginii(text: PaginaLege): readonly IntrareCuprins[] {
  return [
    { id: "reguli", titlu: text.titluReguli },
    { id: "amenzi", titlu: text.titluAmenzi },
    ...text.sectiuni.map((s) => ({ id: s.ancora ?? ancoraRand(s.titlu), titlu: s.titlu })),
    ...(text.tabel === undefined
      ? []
      : [{ id: text.tabel.ancora ?? ancoraRand(text.tabel.titlu), titlu: text.tabel.titlu }]),
    { id: "nesigur", titlu: TITLU_NESIGUR },
  ];
}
