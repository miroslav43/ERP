// src/app/(app)/pontaj/vizualizari.ts
/**
 * Cele trei feluri de a privi aceeași lună de pontaj, și contractul lor de adresă.
 *
 * ── DE CE UN MODUL, NU CONSTANTE ÎN PAGINĂ ────────────────────────────────
 * `page.tsx` trecuse deja de 350 de linii înainte de vizualizări. Aici stă doar
 * enumul, ca să-l poată importa și pagina (server), și orice bucată de client
 * care ar avea nevoie de el, fără să tragă după ea citirile paginii.
 *
 * ── DE CE `saptamana` E IMPLICITĂ ─────────────────────────────────────────
 * E singura din care te poți ponta trăgând peste o zonă din zi. Fiind implicită,
 * NU se scrie în adresă (`implicita` din `ComutatorVizualizare` o șterge), deci
 * `/pontaj` curat înseamnă grila orară.
 */

import { CalendarClock, CalendarDays, LayoutList } from "lucide-react";
import { z } from "zod";

import type { OptiuneVizualizare } from "@/components/ui/comutator-vizualizare";

export const VIZUALIZARI = ["saptamana", "luna", "lista"] as const;
export type Vizualizare = (typeof VIZUALIZARI)[number];

export const VIZUALIZARE_IMPLICITA: Vizualizare = "saptamana";

/**
 * Vizualizarea cu care aterizează un rol pe `/pontaj` curat.
 *
 * ── DE CE NU MAI E O CONSTANTĂ ────────────────────────────────────────────
 * `saptamana` era implicita pentru toată lumea, fiindcă e singura din care te
 * poți ponta trăgând peste o zonă din zi. Argumentul e bun pentru un angajat și
 * greșit pentru toți ceilalți: grila orară arată pontajul CELUI CONECTAT, deci
 * un `org_admin` sau un `hr` care deschidea „Pontaj" ateriza în propria lui
 * săptămână, nu în firma pe care o administrează. Ca să vadă oamenii, trebuia
 * să comute de fiecare dată.
 *
 * Pragul e scope-ul de CITIRE, nu rolul: cine vede și pontajul altora
 * (`org_admin`, `hr` — `all`; `manager` — `team`) primește foaia colectivă;
 * cine se vede doar pe sine rămâne pe grila din care se pontează.
 *
 * `scopeFor` întoarce `null` pentru o permisiune absentă, iar baza colapsează
 * „absent" în `none` — de aceea apelantul normalizează la `"own"` înainte de a
 * ajunge aici, ca peste tot în pagină.
 */
export function implicitaPentruScope(scope: string): Vizualizare {
  return scope === "own" ? VIZUALIZARE_IMPLICITA : "lista";
}

/**
 * `.catch()`, nu `.parse()`: un `?vizualizare=` inventat sau repetat în adresă e
 * o cale greșită, nu o eroare — se cade tăcut pe cea implicită, ca la `an` și
 * `luna` (vezi `lib/rute/parametri.ts`).
 *
 * Implicita se primește ca argument, fiindcă depinde de rol. Ea trebuie să fie
 * ACEEAȘI cu cea dată lui `ComutatorVizualizare`: primitiva ȘTERGE din adresă
 * valoarea implicită, deci două valori diferite ar face ca butonul vizualizării
 * implicite să ducă la o adresă care se citește altfel decât s-a scris.
 */
export function vizualizareaCeruta(brut: unknown, implicita: Vizualizare): Vizualizare {
  return z.enum(VIZUALIZARI).catch(implicita).parse(brut);
}

export const OPTIUNI_VIZUALIZARE: readonly OptiuneVizualizare[] = [
  { cheie: "saptamana", eticheta: "Săptămână", pictograma: CalendarClock },
  { cheie: "luna", eticheta: "Lună", pictograma: CalendarDays },
  { cheie: "lista", eticheta: "Listă", pictograma: LayoutList },
];

/** Cheia de adresă a săptămânii afișate — o zi de luni, ISO. */
export const PARAM_SAPTAMANA = "saptamana";
export const PARAM_VIZUALIZARE = "vizualizare";
