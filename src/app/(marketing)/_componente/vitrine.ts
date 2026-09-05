/**
 * Catalogul capturilor de ecran arătate pe paginile de modul.
 *
 * ── DE CE E UN FIȘIER SEPARAT, FĂRĂ `"use client"` ────────────────────────
 * Datele astea se citesc din `page.tsx`-ul de modul, care e Server Component.
 * Cât timp `prin-geam.tsx` era `"use client"`, ținerea lor acolo rupea
 * prerandarea TUTUROR celor nouăsprezece pagini `/module/*`: Next rescrie
 * fiecare export numit al unui modul marcat `"use client"` într-un
 * `registerClientReference`
 * (`node_modules/next/dist/build/webpack/loaders/next-flight-loader/index.js`),
 * iar proxy-ul acela ARUNCĂ la apel în graful de server — o referință de client
 * e o adresă de transmis browserului, nu o funcție de executat.
 *
 * `prin-geam.tsx` nu mai e de client (mărirea se face cu `popover` nativ), deci
 * capcana nu mai poate mușca prin acest drum. Fișierul rămâne totuși separat:
 * regula de aur — din partea de server nu se APELEAZĂ niciodată un export al
 * unui fișier `"use client"` — se apără mai bine cu un modul care n-are cum să
 * devină de client din greșeală.
 *
 * Poarta care păzește regula: `vitrine.test.ts`.
 */

/**
 * Modulele cu captură, fiecare cu nota care spune CÂT din modul se vede.
 *
 * Nota nu e decor. `ro.ts` promite, în punctele modulului `leave`, „Unsprezece
 * tipuri, fiecare cu temeiul legal notat", iar captura arată o singură lună
 * dintr-un singur ecran. Ambele texte apar pe aceeași pagină, deci pagina s-ar
 * contrazice singură sub ochii unui prospect. Textul din `ro.ts` e adevărat
 * despre PRODUS; ce arată mai puțin e captura — deci captura își declară
 * limita, nu produsul.
 *
 * `nota` e opțională: multe module n-au nimic de nuanțat, iar o notă scrisă
 * doar ca să existe e zgomot.
 */
/**
 * Fiecare captură există în DOUĂ lățimi, generate din același PNG de 2880px.
 *
 * Nu e micro-optimizare: pe telefon, slotul are sub 400px, iar o imagine de
 * 1920px acolo e de două ori și jumătate mai grea degeaba, pe o pagină de
 * conversie unde LCP-ul contează. `next/image` ar fi rezolvat-o singur, dar ar
 * fi adus optimizatorul de imagini al lui Next în joc pentru fișiere DEJA
 * optimizate, într-un deployment `standalone` — cost de rulare pentru zero
 * câștig. Două fișiere pe disc și un `srcset` fac același lucru, static.
 */
const LATIMI = [960, 1920] as const;

/** Dimensiunile variantei mari. Aceleași pentru toate capturile: 1440×900 la 2×, redus la 1920. */
export const LATIME_CAPTURA = 1920;
export const INALTIME_CAPTURA = 1200;

export type Captura = Readonly<{
  /** `srcset` gata format, cu descriptori de lățime. */
  srcset: string;
  /** Sursa de rezervă, pentru browserele fără `srcset`. */
  sursa: string;
  nota: string | undefined;
}>;

/** Notele care spun CÂT din modul se vede. Absente unde nu e nimic de nuanțat. */
const NOTE: Readonly<Record<string, string>> = {
  nucleu:
    "Aici se vede evidența de personal; nucleul mai cuprinde departamentele, organigrama, punctele de lucru și jurnalul de audit.",
  attendance:
    "Aici se vede foaia lunară; modulul mai are planul săptămânii, aprobarea pe departament și blocarea lunii.",
  leave:
    "Aici se vede calendarul de echipă pe o lună; modulul are unsprezece tipuri de concediu și încă patru ecrane.",
  payroll: "Aici se vede o singură perioadă de salarizare, deja aprobată, cu livrabilele ei.",
  rapoarte: "Aici se vede raportul anual agregat, construit din perioadele de salarizare închise.",
};

/** Modulele care au captură pe disc, în `public/capturi/`. */
const CU_CAPTURA: readonly string[] = ["nucleu", "attendance", "leave", "payroll", "rapoarte"];

/** Are modulul o captură? Restul nu randează banda deloc. */
export function arePrinGeam(cheie: string): boolean {
  return CU_CAPTURA.includes(cheie);
}

/**
 * Tot ce-i trebuie benzii ca să randeze captura, sau `undefined` dacă modulul
 * n-are una.
 *
 * Notele se citesc cu `Object.hasOwn`, nu cu acces direct: `NOTE["toString"]`
 * ar întoarce funcția MOȘTENITĂ de pe `Object.prototype`, nu `undefined` — iar
 * React ar primi un copil de tip funcție în loc de text.
 */
export function capturaModulului(cheie: string): Captura | undefined {
  if (!arePrinGeam(cheie)) return undefined;
  return {
    srcset: LATIMI.map((w) => `/capturi/${cheie}-${String(w)}.webp ${String(w)}w`).join(", "),
    sursa: `/capturi/${cheie}-${String(LATIME_CAPTURA)}.webp`,
    nota: Object.hasOwn(NOTE, cheie) ? NOTE[cheie] : undefined,
  };
}

/** Cheile cu captură — folosit de poarta care le compară cu fișierele de pe disc. */
export function cheiCuCaptura(): readonly string[] {
  return CU_CAPTURA;
}

/** Nota de limită a capturii. Expusă separat pentru poarta care verifică textele. */
export function notaVitrinei(cheie: string): string | undefined {
  if (!arePrinGeam(cheie)) return undefined;
  return Object.hasOwn(NOTE, cheie) ? NOTE[cheie] : undefined;
}
