// src/schemas/job-position.ts
import { z } from "zod";
import { codCorOptional, enumOptional } from "./comun";

const textOptional = (maxim: number) =>
  z
    .string()
    .trim()
    .max(maxim, `Textul nu poate depăși ${String(maxim)} de caractere.`)
    .nullable()
    .default(null)
    .transform((valoare) => (valoare === null || valoare.length === 0 ? null : valoare));

export const creeazaFunctieSchema = z.object({
  cod: z.string().trim().min(1, "Codul funcției este obligatoriu.").max(32),
  denumire: z.string().trim().min(2, "Denumirea trebuie să aibă cel puțin 2 caractere.").max(160),
  cod_cor: codCorOptional,
  nivel_studii: textOptional(80),
  descriere: textOptional(1000),
});

export const actualizeazaFunctieSchema = creeazaFunctieSchema
  .omit({ cod: true })
  .extend({ id: z.uuid("Funcția selectată nu este validă.") });

export const dezactiveazaFunctieSchema = z.object({
  id: z.uuid("Funcția selectată nu este validă."),
});

/**
 * Cine deține funcția — lista COMPLETĂ, nu un adaos.
 *
 * ── DE CE LISTA ÎNTREAGĂ ȘI NU „ADAUGĂ X" / „SCOATE Y" ────────────────────
 * Ecranul e un rând de bife peste angajații activi, cu cei care au deja funcția
 * pre-bifați. Ce trimite el înapoi e o STARE dorită, nu o operație; handler-ul
 * calculează diferența față de bază. Un payload de tip „adaugă" ar fi
 * dezambiguat greșit tocmai debifarea, adică singurul fel în care se scoate
 * cineva de pe o funcție din ecranul ăsta.
 *
 * ── DE CE LISTA GOALĂ E VALIDĂ ────────────────────────────────────────────
 * Spre deosebire de `mutaAngajatiSchema`, aici NU există `.min(1)`. Debifarea
 * tuturor înseamnă „funcția asta nu mai e ținută de nimeni" — exact ce trebuie
 * făcut înainte de a o dezactiva, fiindcă `dezactiveazaFunctie` refuză cât timp
 * are angajați alocați. Un `.min(1)` ar închide singura ieșire din acel refuz.
 *
 * Plafonul de 200 nu e o limită de produs, e o plasă: cea mai mare firmă din
 * sistem are opt angajați.
 */
export const atribuieAngajatiSchema = z.object({
  job_position_id: z.uuid("Funcția selectată nu este validă."),
  employee_ids: z
    .array(z.uuid("Angajatul selectat nu este valid."))
    .max(200, "Se pot atribui cel mult 200 de persoane deodată.")
    .default([])
    // Deduplicarea NU e cosmetică: handler-ul compară numărul de rânduri
    // întoarse de `.select()` cu lungimea listei, ca să prindă un refuz parțial
    // al politicii RLS. Cu `["X","X"]`, baza întoarce UN rând iar lungimea e
    // doi, deci o scriere reușită ar fi raportată drept refuz. Din interfață nu
    // se poate întâmpla (selecția e un `Set`), dar acțiunea e un endpoint POST
    // invocabil direct. Aceeași notă stă la `mutaAngajatiSchema`.
    .transform((identificatori) => [...new Set(identificatori)]),
});

export type AtribuieAngajatiInput = z.infer<typeof atribuieAngajatiSchema>;

// ── Filtrele nomenclatorului ─────────────────────────────────────────────────

/**
 * Coloanele după care se poate sorta lista de funcții.
 *
 * `cor` și `angajati` NU sunt coloane în bază: prima e denumirea ocupației,
 * care trăiește în nomenclatorul COR din `src/domain/hr/`, a doua e o
 * numărătoare peste `employees`. Amândouă se sortează în memorie — vezi nota
 * din `src/lib/queries/job-positions.ts` despre de ce nomenclatorul se citește
 * întreg.
 */
export const SORTARI_FUNCTII = ["denumire", "cod", "cor", "angajati"] as const;
export type SortareFunctii = (typeof SORTARI_FUNCTII)[number];

/**
 * Fiecare câmp are `.default(...)`: `filtreDinUrl` cade pe `schema.parse({})`
 * când adresa conține o valoare invalidă, iar fără implicite acolo n-ar avea pe
 * ce cădea și ar arunca.
 *
 * `stare` NU e implicit „activă". Ar ascunde tăcut funcțiile dezactivate, iar
 * omul care caută una și n-o găsește n-ar avea niciun indiciu că lista e
 * filtrată — exact felul de gol fără explicație pe care îl documentează
 * `docs/design/ecrane/capcane.md`.
 */
export const filtreFunctiiSchema = z.object({
  q: textOptional(120),
  stare: enumOptional(["activa", "inactiva"], "Starea din filtru nu este validă."),
  /** `lipsa` — doar funcțiile fără cod COR, cele care blochează REVISAL-ul. */
  cor: enumOptional(["lipsa"], "Filtrul de cod COR nu este valid."),
  /** Forma din URL: `denumire` crescător, `-denumire` descrescător. */
  sort: textOptional(40),
});

export type FiltreFunctii = z.infer<typeof filtreFunctiiSchema>;
