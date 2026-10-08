// src/lib/registru/filtre.ts
//
// Vocabularul filtrelor registrului, FĂRĂ `server-only`.
//
// ── DE CE UN FIȘIER SEPARAT DE `queries/registru.ts` ───────────────────────
// Bara de filtre e Client Component și are nevoie de listele de stări, surse,
// grupări și sortări ca să deseneze `<select>`-urile. `queries/registru.ts`
// importă `server-only` (creează clientul Supabase cu cookie-urile cererii), iar
// un import de VALOARE de acolo într-un `"use client"` pică la build — și NUMAI
// la build: `tsc`, `eslint` și `vitest` tac toate trei. S-a întâmplat pe
// 8 oct 2026, la a7c2b58; `scripts/checks/client-imports-server-only.mjs` e
// poarta scrisă atunci.
//
// Importurile `import type` rămân permise de oriunde: se șterg la compilare.

export const STARI_REGISTRU = ["active", "anulate", "in_lucru", "rezolvate"] as const;
export type StareRegistru = (typeof STARI_REGISTRU)[number];

/** `manual` = înregistrat pe hârtie (art. 8); restul vin din triggere. */
export const SURSE_REGISTRU = ["automat", "manual"] as const;
export type SursaRegistru = (typeof SURSE_REGISTRU)[number];

export const GRUPURI_REGISTRU = ["tip", "dosar", "luna", "angajat"] as const;
export type GrupRegistru = (typeof GRUPURI_REGISTRU)[number];

export const SORTARI_REGISTRU = ["numar", "data", "tip", "dosar"] as const;
export type CheieSortare = (typeof SORTARI_REGISTRU)[number];
