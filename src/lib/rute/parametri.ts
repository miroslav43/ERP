// src/lib/rute/parametri.ts
import "server-only";

import { notFound } from "next/navigation";
import type { z } from "zod";

/**
 * Ce vine din bara de adrese nu e date, e intrare de la un străin.
 *
 * O verificare adversarială a găsit trei feluri în care aplicația trata URL-ul
 * ca pe ceva de încredere. Toate se manifestau identic pentru utilizator —
 * ecranul generic de eroare, cel care arată la fel ca o cădere de rețea:
 *
 *   /concedii/zzz          → 22P02 „invalid input syntax for type uuid"
 *   /inventar?limita=abc   → ZodError necaptat din `.parse()`
 *   /concedii/sold?an=99999999999 → 22003 „value out of range for type integer"
 *
 * Niciuna nu e o breșă: RLS ține în continuare. Dar un 404 sau o revenire tăcută
 * la valorile implicite e răspunsul corect pentru o cale inventată, iar un ecran
 * de eroare pe un link greșit copiat dintr-un e-mail îl face pe om să creadă că
 * aplicația e stricată.
 *
 * De ce aici și nu în fiecare pagină: erau patru pagini cu aceeași scăpare,
 * scrise de doi autori diferiți, în aceeași zi. A cincea va fi scrisă de altcineva.
 */

/** Un UUID canonic, în forma pe care o emite `gen_random_uuid()`. */
const TIPAR_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Identificatorul dintr-un segment dinamic de rută.
 *
 * Un segment care nu e UUID nu poate desemna niciun rând, deci 404 e răspunsul
 * exact — aceeași pagină pe care o primește un id valid dar inexistent. Fără
 * verificarea asta, Postgres primea șirul brut și ridica 22P02, care ieșea la
 * suprafață ca eroare de server.
 *
 * Cazul care a scos-o la iveală nu era ostil: `/concedii/cerere-noua`, o rută
 * scrisă din memorie greșit (cea reală e `/concedii/noua`), înghițită de
 * segmentul `[id]`.
 */
export function idDinRuta(valoare: string): string {
  if (!TIPAR_UUID.test(valoare)) notFound();
  return valoare;
}

/**
 * Filtrele din query string, cu revenire la valorile implicite.
 *
 * Un filtru nevalid NU e un motiv să refuzi pagina. Cineva a editat URL-ul, a
 * urmat un link vechi de după o redenumire de status, sau a copiat o adresă
 * trunchiată. Comportamentul așteptat e lista nefiltrată, nu un ecran de eroare.
 *
 * Schema trebuie să aibă valori implicite pentru tot ce e opțional — atunci
 * `safeParse({})` reușește mereu și ramura de revenire e sigură. Dacă nici
 * obiectul gol nu trece, schema cere ceva ce URL-ul nu poate garanta, iar asta e
 * un defect de schemă: aruncăm, ca să se vadă la dezvoltare, nu în producție.
 */
export function filtreDinUrl<TSchema extends z.ZodType>(
  schema: TSchema,
  parametri: Record<string, string | string[] | undefined>,
): z.output<TSchema> {
  const rezultat = schema.safeParse(parametri);
  if (rezultat.success) return rezultat.data;

  const implicite = schema.safeParse({});
  if (implicite.success) return implicite.data;

  throw new Error(
    "Schema de filtre nu acceptă un obiect gol, deci nu poate avea o valoare implicită sigură. " +
      "Adaugă `.default(...)` pe fiecare câmp opțional.",
  );
}

/**
 * Un an calendaristic din URL.
 *
 * `Number.isInteger()` singur nu ajunge: acceptă `-5`, `0` și `99999999999`.
 * Ultimul ajungea până la Postgres, unde coloana e `integer`, și ridica 22003.
 * Intervalul de mai jos e cel al datelor pe care le poate ține aplicația —
 * seed-ul de sărbători legale acoperă 2024–2040, iar `internal.paste_ortodox`
 * refuză explicit în afara lui 1900–2199.
 */
export function anDinUrl(
  valoare: string | string[] | undefined,
  implicit: number,
): number {
  const brut = Array.isArray(valoare) ? valoare[0] : valoare;
  if (brut === undefined) return implicit;

  const parsat = Number(brut);
  if (!Number.isInteger(parsat) || parsat < 1900 || parsat > 2199) return implicit;
  return parsat;
}
