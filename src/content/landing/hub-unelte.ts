// src/content/landing/hub-unelte.ts
import {
  AN_MAX as AN_MAX_CERERE,
  AN_MIN as AN_MIN_CERERE,
} from "@/app/(marketing)/unelte/cerere-concediu-de-odihna/cerere";
import { AN_MAX, AN_MIN, MAX_ANGAJATI } from "@/app/(marketing)/unelte/foaie-de-pontaj/foaie";

import {
  ANTET_ADEVERINTA_SALARIAT,
  ANTET_CALCULATOR,
  ANTET_CALCULATOR_CONCEDIU,
  ANTET_CALCULATOR_ZILE_LUCRATOARE,
  ANTET_CERERE_CONCEDIU,
  ANTET_CERERE_DEMISIE,
  ANTET_CONDICA,
  ANTET_FISA_EVALUARE,
  ANTET_FISA_SSM,
  ANTET_FOAIE_PARCURS,
  ANTET_FOAIE_PONTAJ,
  ANTET_PROGRAMARE_CONCEDII,
} from "./unelte";

/**
 * Hub-ul `/unelte`, pe categorii.
 *
 * ── DE CE CATEGORII ───────────────────────────────────────────────────────
 * O listă plată mergea la șapte rânduri. Odată cu uneltele noi din oct 2026
 * (zile lucrătoare, demisie, programarea concediilor, adeverință) trece de
 * doisprezece, iar omul care caută „ceva pentru concedii” trebuia să citească
 * tot. Fiecare categorie e o `Banda` cu ancoră și `h2`, iar uneltele rămân `h3`
 * (`ListaHub`) — structura pe care o citesc și cititorul de ecran, și motorul.
 *
 * Titlurile și lead-urile vin din antetele paginilor (`unelte.ts`), nu se
 * rescriu aici. Nota e a hub-ului: ce te face să alegi unealta, într-un rând.
 * Notele de mai jos sunt cele scrise de secțiunile care dețin uneltele (C11,
 * E13, E14, F13, F14, G8, H7, I9), mutate aici neschimbate. Anii vin din
 * constantele uneltelor, nu se scriu de mână.
 *
 * ── POARTA ────────────────────────────────────────────────────────────────
 * `hub-unelte.test.ts` compară lista cu directoarele de pe disc: o unealtă nouă
 * fără rând aici pică testul, în același commit.
 */

export type RandHub = Readonly<{ href: string; titlu: string; lead: string; nota: string }>;

export type GrupHub = Readonly<{
  id: string;
  supratitlu: string;
  titlu: string;
  lead: string;
  pagini: readonly RandHub[];
}>;

const rand = (
  href: string,
  antet: Readonly<{ titlu: string; lead: string }>,
  nota: string,
): RandHub => ({ href, titlu: antet.titlu, lead: antet.lead, nota });

export const GRUPURI_HUB: readonly GrupHub[] = [
  {
    id: "pontaj",
    supratitlu: "Pontaj și prezență",
    titlu: "Orele lunii, pe hârtie sau în Excel",
    lead: "Foaia de pontaj și condica de prezență, cu weekendurile și sărbătorile legale calculate pentru orice lună.",
    pagini: [
      rand(
        "/unelte/foaie-de-pontaj",
        ANTET_FOAIE_PONTAJ,
        `${AN_MIN}–${AN_MAX} · colectivă sau individuală · normă pe angajat · Excel cu formule · până la ${MAX_ANGAJATI} de angajați`,
      ),
      rand(
        "/unelte/condica-de-prezenta",
        ANTET_CONDICA,
        "toate zilele, inclusiv ture · ore lucrate calculate în Excel · Word, PDF, Excel",
      ),
      rand(
        "/unelte/calculator-zile-lucratoare",
        ANTET_CALCULATOR_ZILE_LUCRATOARE,
        "între două date sau peste N zile · sărbătorile scăzute · fără cont",
      ),
    ],
  },
  {
    id: "concedii",
    supratitlu: "Concedii",
    titlu: "Zilele de concediu, numărate corect",
    lead: "Cererea cu zilele lucrătoare calculate și câte zile ți se cuvin într-un an.",
    pagini: [
      rand(
        "/unelte/cerere-concediu-de-odihna",
        ANTET_CERERE_CONCEDIU,
        `${AN_MIN_CERERE}–${AN_MAX_CERERE} · odihnă, fără plată, paternal, îngrijitor · Word, PDF`,
      ),
      rand(
        "/unelte/calculator-zile-concediu",
        ANTET_CALCULATOR_CONCEDIU,
        "minimul legal, zile suplimentare, an lucrat parțial · fără cont",
      ),
      rand(
        "/unelte/programare-concedii",
        ANTET_PROGRAMARE_CONCEDII,
        "un rând pe om, zilele lucrătoare pe luni · Excel, Word, PDF",
      ),
    ],
  },
  {
    id: "plecare",
    supratitlu: "Plecare și adeverințe",
    titlu: "Când omul pleacă sau cere o hârtie",
    lead: "Demisia cu preavizul calculat și actele pe care le cere un salariat de la firmă.",
    pagini: [
      rand(
        "/unelte/cerere-demisie",
        ANTET_CERERE_DEMISIE,
        "ultima zi de preaviz calculată · fără preaviz, probă, acord · Word, PDF",
      ),
      rand(
        "/unelte/adeverinta-salariat",
        ANTET_ADEVERINTA_SALARIAT,
        "funcție, contract, normă, salariu opțional · fără CNP · Word, PDF",
      ),
    ],
  },
  {
    id: "salarii",
    supratitlu: "Salarii",
    titlu: "Cât iese net și cât costă firma",
    lead: "Brut, net și costul total, cu valorile legale în vigoare.",
    pagini: [
      rand(
        "/unelte/calculator-salariu",
        ANTET_CALCULATOR,
        "net și brut · tichete, deduceri, timp parțial · ambele perioade din 2026",
      ),
    ],
  },
  {
    id: "documente",
    supratitlu: "SSM, evaluări, mașini",
    titlu: "Fișele cerute la control și la evaluare",
    lead: "Documentele pe care le cere inspectorul sau contabilul, cu datele trecute o singură dată.",
    pagini: [
      rand(
        "/unelte/fisa-instruire-ssm",
        ANTET_FISA_SSM,
        "toate rubricile anexei 11 la HG 1425/2006 · Word, PDF",
      ),
      rand(
        "/unelte/fisa-evaluare",
        ANTET_FISA_EVALUARE,
        "nota finală calculată · Excel cu formule, Word, PDF",
      ),
      rand(
        "/unelte/foaie-de-parcurs",
        ANTET_FOAIE_PARCURS,
        "cele 4 elemente din normele fiscale · până la 4 curse pe zi · Excel cu formule",
      ),
    ],
  },
];
