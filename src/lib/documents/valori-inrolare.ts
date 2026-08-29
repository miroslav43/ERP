// src/lib/documents/valori-inrolare.ts
// Valorile celor cinci documente de înrolare, într-un singur loc.
//
// ── DE CE ÎMPREUNĂ, ȘI DE CE PURE ─────────────────────────────────────────
// `randeaza()` (`generator.ts:36-44`) tratează o cheie ABSENTĂ exact ca pe una
// goală, iar `genereazaDocument` ARUNCĂ `businessRule` la prima variabilă fără
// valoare (`:83-88`). Cu cinci documente și cinci hărți scrise de mână, o
// singură cheie uitată face să cadă 100% din emiterile acelui document — nu
// ocazional, ci de fiecare dată, iar defectul se vede abia la prima înrolare
// reală.
//
// Funcțiile de aici sunt PURE: primesc date, întorc o hartă. Citirile din bază
// rămân în adaptoarele care le cheamă. Așa `valori-inrolare.test.ts` poate
// compara cheile fiecărei hărți cu lista `variabile` din migrarea care a
// însămânțat șablonul, fără bază de date și fără mock-uri.
import { formatDate } from "@/lib/format/date";
import { formatLei } from "@/lib/format/money";

/**
 * Textul pus în locul unei valori care lipsește.
 *
 * NICIODATĂ șirul gol: acela ar face documentul să nu se mai emită deloc.
 * Precedentul e `contract-munca.ts`, unde CNP-ul lipsă devenea „CNP nefurnizat
 * la înrolare" — un gol vizibil pe hârtie e mai util decât niciun document.
 */
export function rezerva(valoare: string | null | undefined, text = "nespecificat"): string {
  return valoare === null || valoare === undefined || valoare.trim() === "" ? text : valoare;
}

/** Data, formatată, sau textul de rezervă dacă lipsește. */
function dataSau(valoare: string | null | undefined, text = "nespecificată"): string {
  return valoare === null || valoare === undefined || valoare === "" ? text : formatDate(valoare);
}

export type DateOrganizatie = Readonly<{
  /** Forma juridică completă dacă există, altfel denumirea uzuală. */
  denumire: string;
  reprezentantLegal: string | null;
}>;

export type DateAngajat = Readonly<{
  nume: string;
  cnpComplet: string;
  adresa: string | null;
  serieAct: string | null;
  numarAct: string | null;
  actEliberatDe: string | null;
  actEliberatLa: string | null;
  functie: string | null;
  departament: string | null;
}>;

export type DateContract = Readonly<{
  numar: string;
  dataContract: string;
  dataAngajarii: string;
  durata: string;
  normaOreSaptamana: number;
  normaOreZi: number;
  modLucru: string;
  locMunca: string | null;
  locTelemunca: string | null;
  salariuBrut: number;
  zileConcediuAnual: number;
}>;

export type ContextDocumente = Readonly<{
  organizatie: DateOrganizatie;
  angajat: DateAngajat;
  contract: DateContract;
  /** Data emiterii — se dă din afară, ca documentul să fie reproductibil. */
  azi: string;
}>;

/** Contractul individual de muncă. Șablon `contract_munca`, serie CIM. */
export function valoriContractMunca(ctx: ContextDocumente): ReadonlyMap<string, string> {
  const { organizatie: o, angajat: a, contract: c } = ctx;
  return new Map([
    ["numar_contract", c.numar],
    ["data_contract", formatDate(c.dataContract)],
    ["organizatie_denumire", o.denumire],
    ["angajat_nume", a.nume],
    ["cnp_complet", a.cnpComplet],
    ["serie_act", rezerva(a.serieAct, "—")],
    ["numar_act", rezerva(a.numarAct, "—")],
    ["act_eliberat_de", rezerva(a.actEliberatDe)],
    ["act_eliberat_la", dataSau(a.actEliberatLa)],
    ["angajat_adresa", rezerva(a.adresa, "nespecificată")],
    ["functie", rezerva(a.functie, "nespecificată")],
    ["departament", rezerva(a.departament)],
    ["data_angajarii", formatDate(c.dataAngajarii)],
    ["loc_munca", locul(c)],
    ["durata_contract", c.durata],
    ["norma_ore_saptamana", String(c.normaOreSaptamana)],
    ["norma_ore_zi", String(c.normaOreZi)],
    ["mod_lucru", c.modLucru],
    ["salariu_brut", formatLei(c.salariuBrut)],
    ["zile_concediu_anual", String(c.zileConcediuAnual)],
  ]);
}

/**
 * Locul muncii, în forma în care intră pe hârtie.
 *
 * La telemuncă și la muncă la domiciliu, locul REAL e `loc_telemunca` — câmpul
 * obligatoriu prin CHECK-ul `contracts_telemunca_are_loc`. `loc_munca` rămâne
 * gol acolo, iar contractul ar fi spus „nespecificat" exact pentru cazul în
 * care legea cere cea mai mare precizie.
 */
function locul(c: DateContract): string {
  const dinTelemunca = c.locTelemunca ?? "";
  if (dinTelemunca.trim() !== "") return dinTelemunca;
  return rezerva(c.locMunca, "sediul social al angajatorului");
}

/** Acordul de confidențialitate. Șablon `nda`, serie NDA. */
export function valoriNda(
  ctx: ContextDocumente,
  durataConfidentialitate: string,
): ReadonlyMap<string, string> {
  const { organizatie: o, angajat: a } = ctx;
  return new Map([
    ["data_document", formatDate(ctx.azi)],
    ["organizatie_denumire", o.denumire],
    ["reprezentant_legal", rezerva(o.reprezentantLegal, "reprezentantul legal")],
    ["angajat_nume", a.nume],
    ["cnp_complet", a.cnpComplet],
    ["functie", rezerva(a.functie, "nespecificată")],
    ["durata_confidentialitate", durataConfidentialitate],
  ]);
}

/** Anexa de proprietate intelectuală. Șablon `anexa_proprietate_intelectuala`, serie API. */
export function valoriAnexaPi(ctx: ContextDocumente): ReadonlyMap<string, string> {
  const { organizatie: o, angajat: a, contract: c } = ctx;
  return new Map([
    ["numar_contract", c.numar],
    ["data_contract", formatDate(c.dataContract)],
    ["data_document", formatDate(ctx.azi)],
    ["organizatie_denumire", o.denumire],
    ["reprezentant_legal", rezerva(o.reprezentantLegal, "reprezentantul legal")],
    ["angajat_nume", a.nume],
    ["functie", rezerva(a.functie, "nespecificată")],
  ]);
}

/** Actul adițional de telemuncă. Șablon `act_aditional_telemunca`, serie AAT. */
export function valoriActAditionalTelemunca(ctx: ContextDocumente): ReadonlyMap<string, string> {
  const { organizatie: o, angajat: a, contract: c } = ctx;
  return new Map([
    ["numar_contract", c.numar],
    ["data_contract", formatDate(c.dataContract)],
    ["organizatie_denumire", o.denumire],
    ["reprezentant_legal", rezerva(o.reprezentantLegal, "reprezentantul legal")],
    ["angajat_nume", a.nume],
    ["functie", rezerva(a.functie, "nespecificată")],
    ["mod_lucru", c.modLucru],
    ["loc_telemunca", locul(c)],
    ["data_intrare_vigoare", formatDate(c.dataAngajarii)],
    ["norma_ore_saptamana", String(c.normaOreSaptamana)],
  ]);
}

/** Fișa postului. Șablon `fisa_postului`, serie FP. */
export function valoriFisaPostului(
  ctx: ContextDocumente,
  fisa: Readonly<{
    subordonare: string | null;
    atributii: readonly string[];
    competente: readonly string[];
  }>,
): ReadonlyMap<string, string> {
  const { angajat: a } = ctx;
  return new Map([
    ["angajat_nume", a.nume],
    ["functie", rezerva(a.functie, "nespecificată")],
    ["departament", rezerva(a.departament)],
    ["subordonare", rezerva(fisa.subordonare)],
    // `escapeHtml` din `generator.ts` evadează tot, deci nu se pot trimite
    // `<li>`-uri: lista devine text separat prin `;`, ca la varianta veche.
    ["atributii", rezerva(fisa.atributii.join("; "), "—")],
    ["competente", rezerva(fisa.competente.join("; "), "—")],
  ]);
}
