// src/content/landing/legaturi.ts
import type { Legatura } from "./tipuri";

/**
 * Legăturile „Pe același subiect" ale paginilor care nu au un fișier de conținut
 * propriu cu așa ceva (fișele au `ghiduri`, paginile-lege `legaturiConexe`).
 *
 * Cheia e calea paginii. Testul din `continut.test.ts` cere ca fiecare cale și
 * fiecare destinație să fie în sitemap și ca pagina să-și randeze rândul.
 * Ancorele spun termenul pe care pagina-destinație vrea să-l țină.
 *
 * Auditul SEO din 2 oct 2026 a găsit uneltele cu doar firimituri,
 * `/pontaj-pe-telefon` fără nicio legătură în text și domeniile legate doar de
 * modulele lor.
 */
export const LEGATURI_CONEXE: Readonly<Record<string, readonly Legatura[]>> = {
  "/unelte/cerere-concediu-de-odihna": [
    { eticheta: "Concediul de odihnă: zile, programare, report", href: "/ghid/concediu-de-odihna" },
    { eticheta: "Program de concedii: cerere, aprobare și sold", href: "/module/concedii" },
  ],
  "/unelte/condica-de-prezenta": [
    { eticheta: "Ce cere art. 119 la evidența orelor", href: "/evidenta-orelor-de-munca" },
    { eticheta: "Program de pontaj cu ora de început și de sfârșit", href: "/module/pontaj" },
    { eticheta: "Foaie de pontaj lunar, gratuită", href: "/unelte/foaie-de-pontaj" },
  ],
  "/unelte/foaie-de-parcurs": [
    { eticheta: "Program de parc auto: ITP, RCA, rovinietă", href: "/module/flota" },
    { eticheta: "Diurna: cele două plafoane neimpozabile", href: "/ghid/diurna" },
  ],
  "/unelte/fisa-instruire-ssm": [
    { eticheta: "Program SSM: instruiri, aptitudini, echipament", href: "/module/ssm" },
    { eticheta: "Ce se cere la un control ITM", href: "/ghid/control-itm" },
  ],
  "/unelte/fisa-evaluare": [
    { eticheta: "Program de evaluare a angajaților, cu istoric", href: "/module/evaluari" },
    { eticheta: "KPI-uri: indicatori și ținte pe angajat", href: "/module/kpi" },
  ],
  "/unelte/calculator-salariu": [
    { eticheta: "Program de salarizare: calculul salariilor", href: "/module/salarizare" },
    { eticheta: "Diurna: cele două plafoane neimpozabile", href: "/ghid/diurna" },
  ],
  "/unelte/foaie-de-pontaj": [
    { eticheta: "Program de pontaj cu ora de început și de sfârșit", href: "/module/pontaj" },
    { eticheta: "Pontaj de pe telefon, fără instalare", href: "/pontaj-pe-telefon" },
  ],
  "/comparatie/excel": [
    { eticheta: "Program de pontaj", href: "/module/pontaj" },
    { eticheta: "Foaie de pontaj lunar, gratuită", href: "/unelte/foaie-de-pontaj" },
    { eticheta: "Ce cere art. 119 la evidența orelor", href: "/evidenta-orelor-de-munca" },
  ],
  "/pontaj-pe-telefon": [
    { eticheta: "Program de pontaj", href: "/module/pontaj" },
    { eticheta: "Ce cere art. 119 la evidența orelor", href: "/evidenta-orelor-de-munca" },
    { eticheta: "Foaie de pontaj lunar, gratuită", href: "/unelte/foaie-de-pontaj" },
  ],
  "/domenii/constructii": [
    { eticheta: "Pontaj de pe telefon, la punctul de lucru", href: "/pontaj-pe-telefon" },
    { eticheta: "Ce se cere la un control ITM", href: "/ghid/control-itm" },
  ],
  "/domenii/productie": [
    { eticheta: "Ce se cere la un control ITM", href: "/ghid/control-itm" },
    { eticheta: "REGES-ONLINE: termene și amenzi", href: "/reges-online" },
  ],
  "/domenii/transport": [
    { eticheta: "Diurna: cele două plafoane neimpozabile", href: "/ghid/diurna" },
    { eticheta: "Program de diurne și deplasări", href: "/module/diurna" },
  ],
  "/domenii/servicii": [
    { eticheta: "Concediul de odihnă: zile, programare, report", href: "/ghid/concediu-de-odihna" },
    { eticheta: "Foaie de pontaj lunar, gratuită", href: "/unelte/foaie-de-pontaj" },
  ],
};

/** Cardurile „De unde începi" de pe `/ghid`, fiecare spre ghidul lui. */
export const DE_UNDE_GHID = [
  {
    titlu: "Ai primit o înștiințare de control",
    text: "Începe cu ghidul de control ITM: ce documente se cer, în ce ordine se verifică și ce se poate pregăti în ajun — plus ce nu se mai poate.",
    href: "/ghid/control-itm",
  },
  {
    titlu: "Ai angajat pe cineva săptămâna asta",
    text: "REGES-ONLINE are termene pe zile lucrătoare, diferite pentru angajare, suspendare și încetare. Ghidul le ia pe rând, cu temeiul lângă fiecare.",
    href: "/reges-online",
  },
  {
    titlu: "Ții pontajul în fișiere de calcul",
    text: "Evidența orelor cere ora de începere și ora de sfârșit, zilnic, la locul de muncă. Ghidul spune ce înseamnă asta în practică și cât costă absența ei.",
    href: "/evidenta-orelor-de-munca",
  },
  {
    titlu: "Cineva ți-a cerut zilele rămase din anul trecut",
    text: "Ghidul de concediu de odihnă ia termenul de report de 18 luni, decizia ÎCCJ din august 2026 despre zilele rămase după el, și calculul indemnizației pe ultimele trei luni.",
    href: "/ghid/concediu-de-odihna",
  },
  {
    titlu: "Trimiți oameni în deplasare",
    text: "Diurna are două plafoane neimpozabile, nu unul, iar al doilea se calculează separat pentru fiecare lună. Ghidul le ia pe rând, cu formula scrisă în lege.",
    href: "/ghid/diurna",
  },
] as const;
