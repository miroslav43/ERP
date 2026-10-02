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
  lead: "Alege luna și scrie numele. Weekendurile și sărbătorile legale se marchează singure — inclusiv Paștele ortodox și zilele care depind de el. Se tipărește sau se descarcă în PDF, Word ori Excel, fără cont.",
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

/**
 * Condica: ce se caută e „model Word” și „este obligatorie”. Pagina răspunde la
 * a doua întrebare înainte să dea fișierul pentru prima.
 */
export const ANTET_CONDICA: AntetPagina = {
  supratitlu: "Unealtă gratuită",
  titlu: "Condica de prezență",
  lead: "Alege luna și scrie numele: primești condica cu fiecare zi lucrătoare, ora sosirii, ora plecării și semnătura. Sărbătorile legale se scot singure. Descarci în Word, PDF sau Excel, fără cont.",
};

/** Foaia de parcurs: „model”, „word”, „pdf” și „excel” sunt formele căutate (Keyword Planner, 2 oct 2026). */
export const ANTET_FOAIE_PARCURS: AntetPagina = {
  supratitlu: "Unealtă gratuită",
  titlu: "Foaie de parcurs",
  lead: "Scrie mașina, șoferul și luna: primești foaia de parcurs cu fiecare zi, traseul, scopul deplasării și kilometrii la plecare și la sosire. Descarci în Word, PDF sau Excel, fără cont.",
};

/** Fișa individuală de instruire SSM, după anexa 11 la HG 1425/2006. */
export const ANTET_FISA_SSM: AntetPagina = {
  supratitlu: "Unealtă gratuită",
  titlu: "Fișa de instruire SSM",
  lead: "Fișa individuală de instruire după anexa 11 la HG 1425/2006, cu datele lucrătorului completate: instruirea la angajare, periodică și suplimentară, cu cele trei semnături. Descarci în Word sau PDF, fără cont.",
};
