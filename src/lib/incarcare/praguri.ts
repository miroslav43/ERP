// src/lib/incarcare/praguri.ts

/**
 * Pragurile voalului de încărcare.
 *
 * Cifrele nu sunt gust, sunt consecințe măsurate pe ACEASTĂ aplicație:
 * serverul stă la ~27 ms dus-întors de Supabase, iar `fetch-cu-termen.ts:35-38`
 * scrie negru pe alb că mediana unui apel GoTrue e sub 130 ms. Fiecare cerere
 * plătește DOUĂ astfel de apeluri (`proxy.ts` + pagina), deci ~260 ms de tăcere
 * pură înainte de prima interogare de date. Peste asta, învelișul `(app)` la
 * rece mai adaugă 6-9 valuri secvențiale.
 */

/**
 * Cât se așteaptă înainte să apară voalul.
 *
 * 400 ms e pragul Doherty: sub el interacțiunea se citește ca dialog, nu ca
 * așteptare, iar un indicator băgat acolo face durata să PARĂ mai mare, nu mai
 * mică. Pragul separă curat cele două populații reale din proiect — navigările
 * cu `loading.tsx` frate, deja prefetch-uite, se comit sub 200 ms; cele vizate
 * (învelișul la rece, comutarea de firmă, autentificarea) nu coboară sub ~300 ms
 * nici în ipoteza optimistă.
 */
export const PRAG_VOAL = 400;

/**
 * Cât rămâne voalul, odată apărut.
 *
 * Un voal care apare și dispare în 80 ms nu se citește ca stare, ci ca defect
 * grafic. Aritmetica pe cazul cel mai prost: o navigare de 401 ms devine 851 ms
 * percepuți — încă sub limita de o secundă a lui Nielsen, dincolo de care se
 * pierde senzația de manipulare directă. Cu 1000 ms minim, aceeași navigare ar
 * ajunge la 1401 ms, adică indicatorul ar PRODUCE problema pe care o semnalează.
 */
export const DURATA_MINIMA_VOAL = 450;

/** Peste o secundă omul își retrage atenția și caută ce să facă. Mesajul vine imediat după. */
export const PRAG_MESAJ = 1200;

/**
 * Mesajele sunt plafonate la 120 de caractere ≈ 16-18 cuvinte; la 200-250 de
 * cuvinte pe minut înseamnă 4,3-5,4 s de citit. 6,5 s lasă o pauză după.
 */
export const ROTATIE_MESAJ = 6500;

/** Peste atât, voalul spune că durează mai mult decât de obicei. */
export const PRAG_INTARZIERE = 5000;

/**
 * Plafoanele există fiindcă o sursă scursă — un senzor demontat fără curățare, o
 * tranziție care nu se închide — ar bloca aplicația la nesfârșit în spatele unui
 * voal care înghite clicurile. La `PLAFON_MOALE` se eliberează `pointer-events`;
 * la `PLAFON_TARE` sursele se sting forțat. Voalul nu poate deveni o închisoare.
 */
export const PLAFON_MOALE = 15000;
export const PLAFON_TARE = 30000;
