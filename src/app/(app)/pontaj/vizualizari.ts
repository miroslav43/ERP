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
 * `.catch()`, nu `.parse()`: un `?vizualizare=` inventat sau repetat în adresă e
 * o cale greșită, nu o eroare — se cade tăcut pe cea implicită, ca la `an` și
 * `luna` (vezi `lib/rute/parametri.ts`).
 */
export const vizualizareSchema = z.enum(VIZUALIZARI).catch(VIZUALIZARE_IMPLICITA);

export const OPTIUNI_VIZUALIZARE: readonly OptiuneVizualizare[] = [
  { cheie: "saptamana", eticheta: "Săptămână", pictograma: CalendarClock },
  { cheie: "luna", eticheta: "Lună", pictograma: CalendarDays },
  { cheie: "lista", eticheta: "Listă", pictograma: LayoutList },
];

/** Cheia de adresă a săptămânii afișate — o zi de luni, ISO. */
export const PARAM_SAPTAMANA = "saptamana";
export const PARAM_VIZUALIZARE = "vizualizare";
