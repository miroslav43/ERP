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
  lead: "Alegi luna și programul, scrii numele — cu norma fiecăruia, dacă lucrează cu timp parțial. Weekendurile și sărbătorile legale se marchează singure, inclusiv Paștele ortodox. Primești foaia colectivă sau câte o fișă pe om, cu ora de început și de sfârșit, în Excel cu formule, PDF sau Word, fără cont.",
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
 * Perechea cererii: înainte de „ce perioadă”, „câte zile am”. Proporția pentru
 * un an lucrat parțial e prezentată ca practică, nu ca lege — ca în ghidul
 * `/ghid/concediu-de-odihna`.
 */
export const ANTET_CALCULATOR_CONCEDIU: AntetPagina = {
  supratitlu: "Unealtă gratuită",
  titlu: "Calculator de zile de concediu de odihnă",
  lead: "Câte zile de concediu ți se cuvin pe an și cât din ele dacă te-ai angajat sau pleci în cursul anului: minimul legal, zilele suplimentare și calculul proporțional, cu ce e lege și ce e doar practică.",
};

/**
 * Condica: ce se caută e „model Word” și „este obligatorie”. Pagina răspunde la
 * a doua întrebare înainte să dea fișierul pentru prima.
 */
export const ANTET_CONDICA: AntetPagina = {
  supratitlu: "Unealtă gratuită",
  titlu: "Condica de prezență",
  lead: "Alege luna și programul, scrie numele: primești condica cu fiecare zi a lunii, ora sosirii, ora plecării, pauza și semnătura — și pentru sâmbete sau ture. Sărbătorile legale se marchează singure, iar în Excel orele lucrate se calculează. Word, PDF sau Excel, fără cont.",
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

/** Fișa de evaluare: criteriile se pot înlocui cu ale firmei (art. 40 alin. (1) lit. f) Codul muncii). */
export const ANTET_FISA_EVALUARE: AntetPagina = {
  supratitlu: "Unealtă gratuită",
  titlu: "Fișa de evaluare a angajaților",
  lead: "Fișa de evaluare a performanțelor profesionale, cu criteriile firmei, pondere și notă pe fiecare, plus semnăturile evaluatorului și ale angajatului. Descarci în Word, PDF sau Excel, fără cont.",
};

/** Calculatorul de salariu: cea mai mare cerere din cercetare (10.000–100.000 de căutări pe lună, Keyword Planner, 2 oct 2026). */
export const ANTET_CALCULATOR: AntetPagina = {
  supratitlu: "Unealtă gratuită",
  titlu: "Calcul salariu net și brut 2026",
  lead: "Scrie brutul și afli netul, sau invers, pentru ianuarie–iunie sau iulie–decembrie 2026: CAS, CASS, impozitul, deducerea personală, și pentru copii sau sub 26 de ani, tichetele de masă, timpul parțial și costul total pentru firmă.",
};
