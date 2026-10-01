// src/lib/documents/variabile.ts
// Ce variabile are voie să conțină fiecare șablon de document.
//
// ── DE CE E NEVOIE DE LISTA ASTA ────────────────────────────────────────────
// `genereazaDocument` aruncă `businessRule` la PRIMA variabilă fără valoare
// (`generator.ts:84-88`), iar `randeaza` tratează o cheie absentă exact ca pe
// una goală (`:36-44`). Cât timp șabloanele erau scrise de noi, în migrări,
// asta era o plasă de siguranță. Din momentul în care o firmă își editează
// singură șablonul, un `{{salariu_net}}` tastat din memorie nu strică o
// emitere: le strică pe TOATE emiterile viitoare ale acelui tip, pentru toți
// angajații firmei, iar defectul apare abia la următoarea înrolare.
//
// De aceea mulțimea validă se verifică la SALVARE, nu la emitere.
//
// ── DE CE FIȘIER-FRUNZĂ, FĂRĂ `server-only` ─────────────────────────────────
// Paleta de variabile din editor e un component client. Dacă lista ar sta în
// `valori-inrolare.ts`, clientul ar trage după el `formatLei`, `formatDate` și
// tot ce mai importă acelea. Aici nu se importă nimic, deliberat.
//
// Lista e scrisă de mână, dar nu poate rămâne în urmă: `variabile.test.ts`
// cheamă efectiv cele cinci funcții din `valori-inrolare.ts` și compară cheile
// hărților întoarse cu constanta de mai jos.

/** Contractul individual de muncă — șablon `contract_munca`, serie CIM. */
const CONTRACT_MUNCA = [
  "numar_contract",
  "data_contract",
  "organizatie_denumire",
  "angajat_nume",
  "cnp_complet",
  "serie_act",
  "numar_act",
  "act_eliberat_de",
  "act_eliberat_la",
  "angajat_adresa",
  "functie",
  "departament",
  "data_angajarii",
  "loc_munca",
  "durata_contract",
  "norma_ore_saptamana",
  "norma_ore_zi",
  "mod_lucru",
  "salariu_brut",
  "zile_concediu_anual",
] as const;

/** Fișa postului — șablon `fisa_postului`, serie FP. */
const FISA_POSTULUI = [
  "angajat_nume",
  "functie",
  "departament",
  "subordonare",
  "atributii",
  "competente",
] as const;

/** Acordul de confidențialitate — șablon `nda`, serie NDA. */
const NDA = [
  "data_document",
  "organizatie_denumire",
  "reprezentant_legal",
  "angajat_nume",
  "cnp_complet",
  "functie",
  "durata_confidentialitate",
] as const;

/** Anexa de proprietate intelectuală — șablon `anexa_proprietate_intelectuala`, serie API. */
const ANEXA_PI = [
  "numar_contract",
  "data_contract",
  "data_document",
  "organizatie_denumire",
  "reprezentant_legal",
  "angajat_nume",
  "functie",
] as const;

/** Actul adițional de telemuncă — șablon `act_aditional_telemunca`, serie AAT. */
const ACT_TELEMUNCA = [
  "numar_contract",
  "data_contract",
  "organizatie_denumire",
  "reprezentant_legal",
  "angajat_nume",
  "functie",
  "mod_lucru",
  "loc_telemunca",
  "data_intrare_vigoare",
  "norma_ore_saptamana",
] as const;

/**
 * Cele cinci documente ale înrolării, în ordinea în care se emit.
 *
 * Ordinea nu e cosmetică: e ordinea din `inrolare.ts:136-178`, deci ordinea în
 * care se consumă numerele din serii. Caseta de regenerare o folosește ca să
 * afișeze documentele în aceeași ordine în care apar în dosar.
 */
export const CODURI_INROLARE = [
  "contract_munca",
  "fisa_postului",
  "nda",
  "anexa_proprietate_intelectuala",
  "act_aditional_telemunca",
] as const;

export type CodInrolare = (typeof CODURI_INROLARE)[number];

/** Variabilele pe care le poate folosi fiecare șablon. Sursa: hărțile din `valori-inrolare.ts`. */
export const VARIABILE_PER_COD: Readonly<Record<CodInrolare, readonly string[]>> = {
  contract_munca: CONTRACT_MUNCA,
  fisa_postului: FISA_POSTULUI,
  nda: NDA,
  anexa_proprietate_intelectuala: ANEXA_PI,
  act_aditional_telemunca: ACT_TELEMUNCA,
};

/** Denumirea scurtă, pentru bifele casetei de regenerare. */
export const ETICHETE_SABLON: Readonly<Record<CodInrolare, string>> = {
  contract_munca: "Contractul individual de muncă",
  fisa_postului: "Fișa postului",
  nda: "Acordul de confidențialitate",
  anexa_proprietate_intelectuala: "Anexa de proprietate intelectuală",
  act_aditional_telemunca: "Actul adițional de telemuncă",
};

/**
 * Explicația de sub fiecare variabilă, în paleta editorului.
 *
 * Fără ea, `{{loc_munca}}` și `{{loc_telemunca}}` arată interschimbabile, deși
 * primul cade pe sediul social când angajatul e la birou, iar al doilea e
 * adresa reală de telemuncă (`valori-inrolare.ts:110-114`).
 */
export const DESCRIERI_VARIABILE: Readonly<Record<string, string>> = {
  act_eliberat_de: "Cine a eliberat actul de identitate",
  act_eliberat_la: "Data eliberării actului de identitate",
  angajat_adresa: "Adresa de domiciliu, dintr-o bucată",
  angajat_nume: "Numele complet al angajatului",
  atributii: "Atribuțiile din fișa postului, separate prin „;”",
  cnp_complet: "CNP-ul întreg, decriptat (consultarea se auditează)",
  competente: "Competențele din fișa postului, separate prin „;”",
  data_angajarii: "Data de la care contractul e valabil",
  data_contract: "Data contractului de muncă",
  data_document: "Data emiterii documentului",
  data_intrare_vigoare: "Data de la care se aplică actul adițional",
  departament: "Departamentul angajatului",
  durata_confidentialitate: "Cât ține confidențialitatea după încetare",
  durata_contract: "„nedeterminată”, sau „determinată, până la …”",
  functie: "Funcția, din nomenclatorul COR",
  loc_munca: "Locul muncii — adresa de telemuncă dacă există, altfel sediul",
  loc_telemunca: "Adresa de telemuncă",
  mod_lucru: "Eticheta modului de lucru (birou, telemuncă, mixt…)",
  norma_ore_saptamana: "Norma săptămânală, în ore",
  norma_ore_zi: "Norma zilnică, în ore",
  numar_act: "Numărul actului de identitate",
  numar_contract: "Numărul contractului de muncă",
  organizatie_denumire: "Denumirea juridică a firmei",
  reprezentant_legal: "Reprezentantul legal al firmei",
  salariu_brut: "Salariul de bază brut, formatat în lei",
  serie_act: "Seria actului de identitate",
  subordonare: "Cui se subordonează postul",
  zile_concediu_anual: "Zilele de concediu de odihnă pe an",
};

/** `true` dacă `cod` e unul dintre cele cinci coduri de înrolare. */
export function esteCodInrolare(cod: string): cod is CodInrolare {
  return (CODURI_INROLARE as readonly string[]).includes(cod);
}

/**
 * Valori-specimen pentru previzualizarea unui șablon.
 *
 * ── DE CE SPECIMEN, ȘI NU UN ANGAJAT REAL ───────────────────────────────────
 * Previzualizarea trebuie să meargă înainte ca firma să aibă vreun angajat —
 * momentul în care omul chiar își aranjează șabloanele e prima zi, nu a suta.
 * În plus, harta asta ajunge în `date_document` la emitere, dar previzualizarea
 * nu scrie nimic; iar dacă ar folosi fișa cuiva, un `{{cnp_complet}}` tastat
 * într-un șablon ar deveni un mod de a citi CNP-uri fără audit, exact poarta pe
 * care `hr_read_sensitive` o păzește.
 *
 * ── DE CE TREBUIE SĂ FIE COMPLETĂ ───────────────────────────────────────────
 * `genereazaDocument` aruncă `businessRule` la PRIMA variabilă fără valoare
 * (`generator.ts`), iar previzualizarea folosește exact același randare. O
 * variabilă fără specimen ar face butonul să întoarcă „lipsesc date din fișă”
 * pe un șablon perfect valid. `variabile.test.ts` compară cheile de mai jos cu
 * reuniunea lui `VARIABILE_PER_COD`, deci lista nu poate rămâne în urmă.
 *
 * Valorile sunt vizibil fictive — „Ion Popescu”, un CNP cu zerouri — ca nimeni
 * să nu confunde o previzualizare tipărită cu un document emis.
 */
export const VALORI_EXEMPLU: Readonly<Record<string, string>> = {
  act_eliberat_de: "SPCLEP Sector 6",
  act_eliberat_la: "12.03.2019",
  angajat_adresa: "Str. Teiului 4, ap. 12, București, Sector 2",
  angajat_nume: "Ion Popescu",
  atributii: "Redactează documente; Arhivează dosare; Ține evidența corespondenței",
  cnp_complet: "1990101000000",
  competente: "Operare PC; Redactare în limba română; Atenție la detalii",
  data_angajarii: "01.10.2026",
  data_contract: "25.09.2026",
  data_document: "25.09.2026",
  data_intrare_vigoare: "01.11.2026",
  departament: "Administrativ",
  durata_confidentialitate: "2 ani de la încetarea contractului",
  durata_contract: "nedeterminată",
  functie: "Referent de specialitate",
  loc_munca: "Sediul social al angajatorului",
  loc_telemunca: "Str. Teiului 4, ap. 12, București, Sector 2",
  mod_lucru: "mixt",
  norma_ore_saptamana: "40",
  norma_ore_zi: "8",
  numar_act: "123456",
  numar_contract: "000000",
  organizatie_denumire: "Firma dumneavoastră",
  reprezentant_legal: "Maria Ionescu",
  salariu_brut: "5.000,00 lei",
  serie_act: "RD",
  subordonare: "Directorului administrativ",
  zile_concediu_anual: "21",
};
