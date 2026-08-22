// src/app/(marketing)/cere-demo/schema.ts
import { z } from "zod";

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
 * Mesajele de validare, ca parametru.
 *
 * Schema e folosită în două locuri cu cerințe diferite: în client, unde omul
 * trebuie să citească eroarea în limba paginii, și în Server Action, unde
 * limba nu contează fiindcă mesajul ajunge în jurnal. De aceea schema devine o
 * FABRICĂ cu implicit românesc — `actions.ts` continuă să importe
 * `schemaCereDemo` și rămâne neatins.
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

export function creeazaSchemaCereDemo(mesaje: MesajeCereDemo = MESAJE_RO) {
  return z.object({
    nume: z.string().trim().min(3, mesaje.numeMin).max(120, mesaje.numeMax),
    firma: z.string().trim().min(2, mesaje.firmaMin).max(160, mesaje.firmaMax),
    email: z.email(mesaje.email).max(254, mesaje.emailMax),
    telefon: z
      .string()
      .trim()
      .max(32, mesaje.telefonMax)
      .refine(
        (valoare) => valoare.length === 0 || /^[0-9+()\s.-]{7,32}$/.test(valoare),
        mesaje.telefonFormat,
      ),
    nrAngajati: z.enum(BENZI_ANGAJATI, mesaje.nrAngajati),
    mesaj: z.string().trim().max(2000, mesaje.mesajMax),
  });
}

export const schemaCereDemo = creeazaSchemaCereDemo();

export type CereDemoInput = z.infer<typeof schemaCereDemo>;

export const CAMPURI_CERE_DEMO: readonly (keyof CereDemoInput)[] = [
  "nume",
  "firma",
  "email",
  "telefon",
  "nrAngajati",
  "mesaj",
];
