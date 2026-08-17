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

export const schemaCereDemo = z.object({
  nume: z
    .string()
    .trim()
    .min(3, "Scrie numele tău complet, cel puțin 3 caractere.")
    .max(120, "Numele poate avea cel mult 120 de caractere."),
  firma: z
    .string()
    .trim()
    .min(2, "Scrie denumirea firmei.")
    .max(160, "Denumirea firmei poate avea cel mult 160 de caractere."),
  email: z
    .email("Adresa de e-mail nu pare validă. Verifică dacă ai scris corect.")
    .max(254, "Adresa de e-mail este prea lungă."),
  telefon: z
    .string()
    .trim()
    .max(32, "Numărul de telefon poate avea cel mult 32 de caractere.")
    .refine(
      (valoare) => valoare.length === 0 || /^[0-9+()\s.-]{7,32}$/.test(valoare),
      "Numărul de telefon poate conține doar cifre, spații și semnele + ( ) - .",
    ),
  nrAngajati: z.enum(BENZI_ANGAJATI, "Alege numărul de angajați."),
  mesaj: z.string().trim().max(2000, "Mesajul poate avea cel mult 2000 de caractere."),
});

export type CereDemoInput = z.infer<typeof schemaCereDemo>;

export const CAMPURI_CERE_DEMO: readonly (keyof CereDemoInput)[] = [
  "nume",
  "firma",
  "email",
  "telefon",
  "nrAngajati",
  "mesaj",
];
