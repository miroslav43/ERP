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
  ssm: "Aici se vede matricea de instruiri; modulul mai acoperă medicina muncii, accidentele, stingătoarele, echipamentul individual și autorizațiile nominale.",
  fleet:
    "Aici se văd vehiculele cu documentul care expiră primul; modulul mai are foile de parcurs, alimentările și anomaliile de kilometraj.",
  inventory:
    "Aici se văd obiectele de inventar și cui sunt predate; modulul mai are procesele-verbale de predare-primire.",
  ticketing:
    "Aici se vede coada echipei; modulul mai are tichetele proprii, aprobările și istoricul fiecărei cereri.",
  announcements: "Aici se văd anunțurile publicate, cu cel fixat în capul listei.",
  courses:
    "Aici se văd cursurile firmei; modulul mai are biblioteca de materiale, atribuirea pe reguli și raportul de conformitate.",
  onboarding:
    "Aici se văd parcursurile în derulare; modulul mai are șabloanele cu pași reordonabili și dovada printabilă a parcurgerii.",
  evaluations:
    "Aici se văd evaluările anuale; modulul mai are indicatorii lunari și constructorul de șabloane.",
  kpi: "Aici se vede o singură lună; indicatorii se urmăresc pe tot anul, cu ținta pusă pe funcție și ajustată pe om.",
  maintenance:
    "Aici se vede panoul; modulul mai are echipamentele, planurile pe contor, intervențiile și sesizările de defecțiune.",
  per_diem:
    "Aici se văd deplasările cu diurna estimată; modulul mai are politica de diurnă și lanțul de aprobare.",
};

/** Modulele care au captură pe disc, în `public/capturi/`. */
const CU_CAPTURA: readonly string[] = [
  "nucleu",
  "attendance",
  "leave",
  "payroll",
  "rapoarte",
  "ssm",
  "fleet",
  "inventory",
  "ticketing",
  "announcements",
  "courses",
  "onboarding",
  "evaluations",
  "kpi",
  "maintenance",
  "per_diem",
];

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

/**
 * ── AL DOILEA CATALOG: CAPTURILE ÎNALTE ───────────────────────────────────
 *
 * Cele de mai sus sunt toate 1920×1200, fiindcă vin din același viewport de
 * birou. Pentru `/pontaj-pe-telefon` asta nu merge: pagina susține că omul
 * pontează de pe telefonul LUI, iar o captură de 1440px lățime ar arăta exact
 * ecranul pe care pagina spune că nu-l folosește nimeni. La fel afișul cu cod
 * QR — o foaie A4, nu o fereastră.
 *
 * Deci al doilea catalog, cu dimensiuni PER CHEIE, nu comune. Cheile lui nu se
 * pot lovi de cele de modul: astea au cratimă, cheile de modul sunt identificatori
 * de funcționalitate (`per_diem`, `employee_portal`). Poarta din `vitrine.test.ts`
 * compară reuniunea celor două cataloage cu fișierele de pe disc, deci o cheie
 * scrisă aici fără fișier — sau un fișier fără cheie — cade la test.
 *
 * Lățimile rămân două, din același motiv ca sus, dar sunt jumătatea și întregul
 * fișierului mare, nu 960/1920: un fișier de 1920px pentru un ecran de telefon
 * ar fi absurd.
 */
export type CapturaInalta = Readonly<{
  srcset: string;
  sursa: string;
  /** Textul alternativ. Aici e propriu fiecărei capturi — nu se poate deduce dintr-un titlu de modul. */
  alt: string;
  latime: number;
  inaltime: number;
  nota: string | undefined;
}>;

type FisaInalta = Readonly<{
  /** Dimensiunile variantei MARI, adică ale fișierului `-<latime>.webp`. */
  latime: number;
  inaltime: number;
  alt: string;
  nota?: string;
}>;

/**
 * Cele trei capturi înalte, cu sursa lor din `scripts/capturi/capturi.mjs`.
 *
 * Telefonul e 390×844 la scara 3 (iPhone 14/15, cel mai des întâlnit raport),
 * redus la 780 și 390. Afișul e 900×1200 la scara 2, redus la 1200 și 600.
 */
const INALTE: Readonly<Record<string, FisaInalta>> = {
  "portal-pontare": {
    latime: 780,
    inaltime: 1688,
    alt: "Cardul de pontare din portalul angajatului, pe telefon, cu butoanele „Am intrat” și „Pontez 08:00–16:30”",
    nota: "Cardul de pontare, așa cum îl vede angajatul pe telefonul lui. Deasupra lui stau salutul, soldul de concediu și salariul — se ajunge la el derulând.",
  },
  "portal-scanare": {
    latime: 780,
    inaltime: 1688,
    alt: "Ecranul de pontare deschis după scanarea codului QR de la intrare",
    nota: "Ce apare după scanarea afișului. Numele punctului de lucru se confirmă după apăsare, nu înainte — pagina nu-l poate citi.",
  },
  "afis-pontare": {
    latime: 1200,
    inaltime: 1600,
    alt: "Afișul cu cod QR al unui punct de lucru, gata de tipărit, deschis în aplicație",
    nota: "Afișul se tipărește din aplicație, cu Ctrl+P; la tipărire rămâne doar foaia din mijloc. Codul din captură e al firmei demonstrative.",
  },
};

/** Datele de randare ale unei capturi înalte, sau `undefined` dacă cheia nu există. */
export function capturaInalta(cheie: string): CapturaInalta | undefined {
  if (!Object.hasOwn(INALTE, cheie)) return undefined;
  const fisa = INALTE[cheie];
  if (fisa === undefined) return undefined;
  const latimi = [Math.round(fisa.latime / 2), fisa.latime];
  return {
    srcset: latimi.map((w) => `/capturi/${cheie}-${String(w)}.webp ${String(w)}w`).join(", "),
    sursa: `/capturi/${cheie}-${String(fisa.latime)}.webp`,
    alt: fisa.alt,
    latime: fisa.latime,
    inaltime: fisa.inaltime,
    nota: fisa.nota,
  };
}

/** Cheile capturilor înalte — folosit de poarta care le compară cu fișierele de pe disc. */
export function cheiInalte(): readonly string[] {
  return Object.keys(INALTE);
}

/**
 * Modulele care primesc și banda de capturi înalte, pe lângă cea lată.
 *
 * Harta stă aici, nu ca un `if` pe cheie în `module/[modul]/page.tsx`: pagina
 * aceea randează nouăsprezece module din același șablon, iar un caz particular
 * scris în ea e primul pas spre nouăsprezece.
 */
const INALTE_PE_MODUL: Readonly<Record<string, readonly string[]>> = {
  employee_portal: ["portal-pontare", "portal-scanare"],
};

/** Capturile înalte ale unui modul. Listă goală pentru cele optsprezece fără. */
export function capturiInalteAleModulului(cheie: string): readonly string[] {
  if (!Object.hasOwn(INALTE_PE_MODUL, cheie)) return [];
  return INALTE_PE_MODUL[cheie] ?? [];
}
