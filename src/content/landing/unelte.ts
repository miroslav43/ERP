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

/**
 * A doua unealtă, pe același tipar și din același motiv.
 *
 * Modelele de cerere care circulă lasă un spațiu gol pentru numărul de zile.
 * Art. 145 alin. (3) din Codul muncii scoate sărbătorile legale din durata
 * concediului, iar cine numără pe calendar le numără — deci exact cifra care
 * ajunge semnată și scăzută din sold e cea nesigură.
 */
export const ANTET_CERERE_CONCEDIU: AntetPagina = {
  supratitlu: "Unealtă gratuită",
  titlu: "Cerere de concediu de odihnă",
  lead: "Completează perioada și primești cererea gata de tipărit, cu zilele lucrătoare calculate: weekendurile și sărbătorile legale se scad singure, iar cele scoase se enumeră, cu motivul lângă fiecare.",
};
