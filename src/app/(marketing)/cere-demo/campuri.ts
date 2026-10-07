// src/app/(marketing)/cere-demo/campuri.ts

/**
 * Câmpurile formularului de demonstrație, FĂRĂ Zod.
 *
 * Formularul stă pe pagina de start și pe `/preturi`. Cât timp importa schema
 * Zod și `react-hook-form`, aducea pe calea de hidratare a paginii de start trei
 * fișiere de ~88 KB gzip — cam o treime din JavaScript-ul propriu al sitului,
 * descărcate de orice pagină prin prefetch-ul legăturii spre `/` (auditul din
 * 7 oct 2026). Clientul validează acum cu regulile de mai jos; autoritatea
 * rămâne schema Zod din `schema.ts`, pe care o folosește doar Server Action-ul.
 * `campuri.test.ts` ține cele două validări de acord pe aceleași exemple.
 */

export const BENZI_ANGAJATI = ["1-9", "10-49", "50-249", "250+"] as const;

export type BandaAngajati = (typeof BENZI_ANGAJATI)[number];

export const ETICHETE_BANDA: Readonly<Record<BandaAngajati, string>> = {
  "1-9": "Între 1 și 9 angajați",
  "10-49": "Între 10 și 49 de angajați",
  "50-249": "Între 50 și 249 de angajați",
  "250+": "Peste 250 de angajați",
};

export const ETICHETE_BANDA_EN: Readonly<Record<BandaAngajati, string>> = {
  "1-9": "Between 1 and 9 employees",
  "10-49": "Between 10 and 49 employees",
  "50-249": "Between 50 and 249 employees",
  "250+": "More than 250 employees",
};

/**
 * Mesajele de validare, în limba paginii.
 *
 * Schema de pe server le primește ca parametru (implicit românește): acolo
 * mesajul ajunge în jurnal. Clientul le alege după limba paginii.
 */
export type MesajeCereDemo = Readonly<{
  numeMin: string;
  numeMax: string;
  firmaMin: string;
  firmaMax: string;
  email: string;
  emailMax: string;
  telefonMax: string;
  telefonFormat: string;
  nrAngajati: string;
  mesajMax: string;
}>;

export const MESAJE_RO: MesajeCereDemo = {
  numeMin: "Scrie numele tău complet, cel puțin 3 caractere.",
  numeMax: "Numele poate avea cel mult 120 de caractere.",
  firmaMin: "Scrie denumirea firmei.",
  firmaMax: "Denumirea firmei poate avea cel mult 160 de caractere.",
  email: "Adresa de e-mail nu pare validă. Verifică dacă ai scris corect.",
  emailMax: "Adresa de e-mail este prea lungă.",
  telefonMax: "Numărul de telefon poate avea cel mult 32 de caractere.",
  telefonFormat: "Numărul de telefon poate conține doar cifre, spații și semnele + ( ) - .",
  nrAngajati: "Alege numărul de angajați.",
  mesajMax: "Mesajul poate avea cel mult 2000 de caractere.",
};

export const MESAJE_EN: MesajeCereDemo = {
  numeMin: "Enter your full name, at least 3 characters.",
  numeMax: "The name can be at most 120 characters.",
  firmaMin: "Enter the company name.",
  firmaMax: "The company name can be at most 160 characters.",
  email: "That e-mail address does not look valid. Please check the spelling.",
  emailMax: "The e-mail address is too long.",
  telefonMax: "The phone number can be at most 32 characters.",
  telefonFormat: "The phone number may contain only digits, spaces and the signs + ( ) - .",
  nrAngajati: "Choose the number of employees.",
  mesajMax: "The message can be at most 2000 characters.",
};

/** Ce trimite formularul. `schema.ts` verifică la compilare că Zod deduce același tip. */
export type CereDemoInput = {
  nume: string;
  firma: string;
  email: string;
  telefon: string;
  nrAngajati: BandaAngajati;
  mesaj: string;
};

export const CAMPURI_CERE_DEMO: readonly (keyof CereDemoInput)[] = [
  "nume",
  "firma",
  "email",
  "telefon",
  "nrAngajati",
  "mesaj",
];

export type EroriCereDemo = Partial<Record<keyof CereDemoInput, string>>;

/** Telefonul: gol, sau 7–32 de cifre, spații și `+ ( ) - .` — aceeași regulă ca în schemă. */
export const TIPAR_TELEFON = /^[0-9+()\s.-]{7,32}$/;

/**
 * Un e-mail plauzibil: ceva, `@`, un domeniu cu punct, fără spații. Mai blând
 * decât verificarea Zod de pe server; ce scapă de aici primește tot mesajul
 * localizat, din răspunsul acțiunii.
 */
const TIPAR_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Primul mesaj de eroare al fiecărui câmp, după aceleași reguli ca `schema.ts`. */
export function valideazaCerereDemo(
  valori: Readonly<Record<keyof CereDemoInput, string>>,
  mesaje: MesajeCereDemo,
): EroriCereDemo {
  const erori: EroriCereDemo = {};
  const nume = valori.nume.trim();
  const firma = valori.firma.trim();
  const email = valori.email.trim();
  const telefon = valori.telefon.trim();

  if (nume.length < 3) erori.nume = mesaje.numeMin;
  else if (nume.length > 120) erori.nume = mesaje.numeMax;

  if (firma.length < 2) erori.firma = mesaje.firmaMin;
  else if (firma.length > 160) erori.firma = mesaje.firmaMax;

  if (!TIPAR_EMAIL.test(email)) erori.email = mesaje.email;
  else if (email.length > 254) erori.email = mesaje.emailMax;

  if (telefon.length > 32) erori.telefon = mesaje.telefonMax;
  else if (telefon.length > 0 && !TIPAR_TELEFON.test(telefon)) erori.telefon = mesaje.telefonFormat;

  if (!(BENZI_ANGAJATI as readonly string[]).includes(valori.nrAngajati)) {
    erori.nrAngajati = mesaje.nrAngajati;
  }

  if (valori.mesaj.trim().length > 2000) erori.mesaj = mesaje.mesajMax;

  return erori;
}
