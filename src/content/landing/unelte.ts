import type { AntetPagina } from "./tipuri";

/**
 * Antetul uneltei de pontaj, o singură dată.
 *
 * Îl citesc două pagini: unealta însăși (`/unelte/foaie-de-pontaj`) și hub-ul
 * `/unelte`, care o prezintă. Scris în fișierul rutei, hub-ul n-ar fi putut să-l
 * refolosească — un `page.tsx` nu are voie să exporte altceva decât ce cere Next
 * — și ar fi ținut o a doua copie a descrierii.
 */
export const ANTET_FOAIE_PONTAJ: AntetPagina = {
  supratitlu: "Unealtă gratuită",
  titlu: "Foaie de pontaj lunar",
  lead: "Alege luna și scrie numele. Weekendurile și sărbătorile legale se marchează singure — inclusiv Paștele ortodox și zilele care depind de el. Se tipărește sau se descarcă în Excel, fără cont.",
};
