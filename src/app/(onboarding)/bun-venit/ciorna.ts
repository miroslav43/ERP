// src/app/(onboarding)/bun-venit/ciorna.ts
//
// Ciorna asistentului `/bun-venit`: ce se păstrează în `sessionStorage` între
// două încărcări ale aceleiași file, și cum se citește pasul din URL.
//
// Modul NEUTRU — fără `"use client"`, fără `server-only`, fără importuri din
// componente client. E importat de două părți ale graniței: `page.tsx` (Server
// Component) pentru `cheiaCiornei`, `asistent-firma.tsx` (client) pentru rest.
// Un export importat dintr-un fișier `"use client"` devine pe server un proxy
// de referință client care se STRINGIFICĂ sau ARUNCĂ, tăcut la tsc, lint și
// build (vezi memoria „constantă client importată în server"). De aceea
// `CAMPURI_CIORNA` e o listă COPIATĂ, nu derivată din `CAMPURI_PAS_1..5`, iar
// `ciorna.test.ts` e poarta care o ține egală cu reuniunea lor.

import type { OnboardeazaOrganizatieInput } from "@/schemas/organization";

/** Se incrementează când forma ciornei se schimbă; o versiune veche se ignoră. */
export const VERSIUNE_CIORNA = 1;

export type Ciorna = Readonly<{
  v: typeof VERSIUNE_CIORNA;
  pas: number;
  date: Partial<OnboardeazaOrganizatieInput>;
}>;

/** Pasul confirmării, ultimul din `ETICHETE_PASI` (șapte etichete). */
const PAS_MAXIM = 7;
/** Pasul proprietarului, ascuns în `/bun-venit`: cine completează ESTE proprietarul. */
const PAS_ASCUNS = 6;

/**
 * Câmpurile care ajung în ciornă: pașii 1–5, MINUS CNP-ul reprezentantului
 * legal. Excluderea e prin construcție, nu prin ștergere ulterioară — CNP-ul
 * nu are cum să ajungă în depozit nici dacă cineva uită să-l șteargă. IBAN-ul
 * rămâne: e o dată a firmei (apare pe facturi), nu una personală.
 *
 * `owner_*`, `plan` și `seats_limit` nu sunt aici fiindcă nu sunt în niciun
 * pas vizibil: vin din `valoriInitiale` la fiecare randare.
 */
export const CAMPURI_CIORNA = [
  // Pasul 1 — Date fiscale
  "name",
  "legal_name",
  "forma_juridica",
  "cui",
  "platitor_tva",
  "reg_com",
  "slug",
  "email_contact",
  "telefon_contact",
  "judet",
  "sector",
  "oras",
  "adresa",
  "cod_postal",
  "capital_social",
  "cod_caen",
  "cod_caen_secundare",
  // Pasul 2 — Reprezentant legal (fără `reprezentant_cnp`)
  "reprezentant_legal",
  "functie_reprezentant_legal",
  // Pasul 3 — Date financiare
  "banca_nume",
  "banca_iban",
  "plata_avans",
  "ziua_plata_avans",
  "ziua_plata_lichidare",
  "tichete_furnizor",
  // Pasul 4 — Structură și locații
  "punct_lucru_denumire",
  "punct_lucru_adresa",
  "punct_lucru_judet",
  "punct_lucru_oras",
  "punct_lucru_cod_postal",
  "zile_concediu_anual_implicit",
  // Pasul 5 — SSM / PSI
  "ssm_furnizor_extern",
  "ssm_persoana_responsabila",
] as const satisfies readonly (keyof OnboardeazaOrganizatieInput)[];

/**
 * Cheia depozitului include utilizatorul ȘI firma: alt cont în aceeași filă,
 * sau același cont într-o altă firmă, nu primește ciorna altcuiva.
 */
export function cheiaCiornei(userId: string, organizationId: string): string {
  return `bun-venit.ciorna.${userId}.${organizationId}`;
}

/** Păstrează doar `CAMPURI_CIORNA`; o cheie necompletată lipsește, nu devine `null`. */
export function curataPentruCiorna(
  valori: Partial<OnboardeazaOrganizatieInput>,
): Partial<OnboardeazaOrganizatieInput> {
  const curat: Record<string, unknown> = {};
  for (const camp of CAMPURI_CIORNA) {
    const valoare = valori[camp];
    if (valoare !== undefined) curat[camp] = valoare;
  }
  return curat as Partial<OnboardeazaOrganizatieInput>;
}

/**
 * Garda de FORMĂ cerută de `citesteDepozit`: o ciornă de altă versiune, un
 * pas inexistent sau `date` care nu e obiect se tratează ca „nu există
 * ciornă", nu ca o excepție în randare.
 */
export function esteCiornaValida(x: unknown): x is Ciorna {
  if (typeof x !== "object" || x === null || Array.isArray(x)) return false;
  const candidat = x as { v?: unknown; pas?: unknown; date?: unknown };
  if (candidat.v !== VERSIUNE_CIORNA) return false;
  if (
    typeof candidat.pas !== "number" ||
    !Number.isInteger(candidat.pas) ||
    candidat.pas < 1 ||
    candidat.pas > PAS_MAXIM
  ) {
    return false;
  }
  return (
    typeof candidat.date === "object" && candidat.date !== null && !Array.isArray(candidat.date)
  );
}

/**
 * `?pas=N` → un pas care EXISTĂ în `/bun-venit`: întreg 1..7, pasul ascuns al
 * proprietarului duce la confirmare, orice altceva la primul pas. Un URL
 * editat de mână nu are cum să deschidă un ecran gol.
 */
export function pasDinUrl(brut: string | null): number {
  if (brut === null || !/^[1-9]$/.test(brut)) return 1;
  const pas = Number(brut);
  if (pas > PAS_MAXIM) return 1;
  return pas === PAS_ASCUNS ? PAS_MAXIM : pas;
}
