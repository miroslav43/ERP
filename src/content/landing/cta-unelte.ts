// src/content/landing/cta-unelte.ts
import type { FeatureKey } from "@/config/features";
import { SURSA_UTM_UNEALTA } from "@/lib/unelte/masurare";

import { lunar, MODULE_NUCLEU, PRAG_ANGAJATI, PRET_NUCLEU, PRETURI_MODULE } from "./preturi";
import { RO } from "./ro";

/**
 * Îndemnul de după document, pe fiecare unealtă.
 *
 * ── DE CE AICI ────────────────────────────────────────────────────────────
 * Singura conversie organică din tot site-ul (30 sept 2026) a venit din foaia
 * de pontaj, la trei minute după „Generează”. Pagina avea atunci un singur
 * îndemn, în banda de jos, cu aceeași adresă ca butonul din antet — contul nu
 * spunea de unde vine.
 *
 * ── CE PROMITE ȘI CE NU ───────────────────────────────────────────────────
 * Fiecare text spune ce face modulul în locul uneltei, cu cuvintele fișei lui
 * (`fise-module.ts`). Prețul se calculează din `preturi.ts`. Înscrierea pornește
 * cu pachetul de bază (pontaj, concedii, portal — `0145_marginea_platformei.sql`),
 * deci la modulele opționale spunem că se adaugă, nu că sunt incluse. SSM: fișa
 * semnată rămâne pe hârtie (`fise-module.ts:248`). Salarizare: nu promitem
 * aceleași cifre ca în calculator (secțiunea D a planului din 8 oct 2026).
 */
export type LocCta = "dupa-document" | "banda";

export type CtaUnealta = Readonly<{ modul: FeatureKey; titlu: string; text: string }>;

const CTA: Readonly<Record<string, CtaUnealta>> = {
  "foaie-de-pontaj": {
    modul: "attendance",
    titlu: "Luna viitoare, foaia se completează singură",
    text: "În aplicație, fiecare om își marchează intrarea și ieșirea de pe telefon, iar foaia colectivă iese gata la sfârșitul lunii, cu aceleași weekenduri și sărbători scoase — fără să mai scrii numele încă o dată.",
  },
  "condica-de-prezenta": {
    modul: "attendance",
    titlu: "Condica, ținută de pe telefon",
    text: "Ora sosirii și a plecării se notează pe loc, din telefon, iar evidența cerută de art. 119 alin. (1) din Codul muncii — zilnic, cu ora de început și de sfârșit — e gata de arătat inspectorului.",
  },
  "cerere-concediu-de-odihna": {
    modul: "leave",
    titlu: "Cererea, aprobarea și soldul, în același loc",
    text: "Omul cere concediul din telefon, șeful îl aprobă dintr-o apăsare, iar zilele lucrătoare se scad singure din sold, cu sărbătorile legale scoase la fel ca aici.",
  },
  "calculator-zile-concediu": {
    modul: "leave",
    titlu: "Soldul de concediu, ținut la zi",
    text: "În aplicație, dreptul fiecărui om se calculează din contract, iar soldul scade singur la fiecare cerere aprobată.",
  },
  "foaie-de-parcurs": {
    modul: "fleet",
    titlu: "Foile de parcurs, ținute pe fiecare mașină",
    text: "Modulul Flotă reține kilometrajul și alimentările de pe fiecare foaie, iar consumul rezultat se poate compara cu bonurile. Termenele mașinii se văd înainte de scadență.",
  },
  "fisa-instruire-ssm": {
    modul: "ssm",
    titlu: "Cine a făcut instruirea și când expiră",
    text: "Modulul SSM ține instruirile fiecărui om, cu semafor care se aprinde înainte de termen. Fișa semnată rămâne pe hârtie, ca aceasta; aplicația reține când și de către cine s-a făcut instruirea.",
  },
  "fisa-evaluare": {
    modul: "evaluations",
    titlu: "Evaluarea de anul trecut, găsită pe loc",
    text: "Șablonul de evaluare se face o dată și se refolosește anul următor, iar fiecare evaluare rămâne în dosarul omului, citibilă exact cum a fost completată.",
  },
  "calculator-salariu": {
    modul: "payroll",
    titlu: "Statul de plată, din aceeași aplicație",
    text: "Din fiecare lună de salarizare aprobată, modulul Salarizare scoate statul de plată, fluturașii pe care fiecare om îi vede în portal, declarația 112 și fișierul pentru bancă.",
  },
  /*
   * Uneltele adăugate de secțiunea K (K7–K10). Textele iau doar ce spun fișele
   * `leave` și `nucleu` din `fise-module.ts` și ce face `src/domain/leave/planificator.ts`
   * (un rând pe om, o coloană pe zi): aplicația NU emite adeverințe și NU
   * redactează demisii — ține cererile, soldul, planificatorul și fișa omului. O intrare pentru o unealtă care nu există
   * încă în hartă e inofensivă (`areCtaPropriu` e verificat doar pe hartă).
   */
  "calculator-zile-lucratoare": {
    modul: "leave",
    titlu: "Zilele de concediu, scăzute singure din sold",
    text: "În aplicație, omul cere concediul de pe telefon, iar soldul se scade la aprobare, nu la cerere, și se pune la loc dacă cererea se anulează. Nimeni nu mai ține un al doilea calcul pe hârtie.",
  },
  "programare-concedii": {
    modul: "leave",
    titlu: "Cine e plecat și când, pe ecranul de aprobare",
    text: "Documentul programării îl faci aici. În aplicație, planificatorul arată un rând pe om și o coloană pe zi, cu cererile aprobate și cele încă în aprobare, iar cine aprobă vede dacă un coleg din echipă e deja plecat în aceleași zile.",
  },
  "cerere-demisie": {
    modul: "nucleu",
    titlu: "Fișa fiecărui om, într-un singur loc",
    text: "În aplicație, fiecare angajat are fișa lui, cu drepturi pe rol, iar fiecare acțiune rămâne în jurnalul de audit. Ce iese din uz se marchează ca șters și rămâne în jurnal, nu dispare.",
  },
  "adeverinta-salariat": {
    modul: "nucleu",
    titlu: "Datele angajaților, ținute la zi",
    text: "În aplicație, fiecare angajat are fișa lui, ținută de HR, iar omul își vede propriile date din portal. Datele unei firme nu se văd din contul alteia.",
  },
};

const CTA_IMPLICIT: CtaUnealta = {
  modul: "nucleu",
  titlu: "Evidența de personal, într-un singur cont",
  text: "Pontaj de pe telefon, concedii și dosare de personal, ținute la zi pentru toată firma.",
};

export function areCtaPropriu(unealta: string): boolean {
  return Object.hasOwn(CTA, unealta);
}

export function ctaPentru(unealta: string): CtaUnealta {
  return (areCtaPropriu(unealta) ? CTA[unealta] : undefined) ?? CTA_IMPLICIT;
}

/** Prețul, ca pe `/preturi`: sume finale, fără TVA adăugat, fără card la înscriere. */
export function pretPentru(modul: FeatureKey): string {
  const baza = `${lunar(PRET_NUCLEU, "ro")} până la ${PRAG_ANGAJATI} de angajați, prima lună gratuită, fără card la înscriere`;
  const pret = PRETURI_MODULE[modul];
  if (MODULE_NUCLEU.includes(modul) || pret === undefined) {
    return `Intră în pachetul de bază: ${baza}. Preț final, fără TVA adăugat.`;
  }
  return `Contul pornește cu pachetul de bază: ${baza}. Modulul se adaugă cu ${lunar(pret, "ro")}. Prețuri finale, fără TVA adăugat.`;
}

/**
 * Adresa de înregistrare cu sursa uneltei. UTM, nu un parametru nou: A4 păstrează
 * `utm_*` în Umami, deci și pâlnia din browser vede sursa, iar pagina de
 * înregistrare citește aceeași valoare pe server (`sursaDinParametri`).
 */
export function adresaInregistrare(unealta: string, loc: LocCta): string {
  const q = new URLSearchParams({
    utm_source: SURSA_UTM_UNEALTA,
    utm_medium: loc,
    utm_campaign: unealta,
  });
  return `${RO.hero.ctaPrimar.href}?${q.toString()}`;
}
