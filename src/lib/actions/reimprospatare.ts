// src/lib/actions/reimprospatare.ts
import "server-only";
import { revalidatePath } from "next/cache";

/**
 * Grupurile de rute care depind de sesiune și de firma aleasă. `(marketing)` și
 * `(vitrina)` lipsesc intenționat — vezi mai jos de ce.
 */
const GRUPURI_CU_SESIUNE = ["/(app)", "/(portal)", "/(onboarding)", "/(auth)"] as const;

/**
 * Reîmprospătarea după o schimbare de identitate: deconectare, comutare de
 * firmă, invitație acceptată, firmă activată.
 *
 * ── DE CE NU `revalidatePath("/", "layout")` ──────────────────────────────
 * Până pe 23 sept 2026, cele șase locuri de felul ăsta chemau exact forma aia.
 * Ea expiră tag-ul `_N_T_/layout`, pe care îl poartă ORICE pagină, inclusiv
 * cele publice prerandate. Starea expirării trăiește doar în memoria replicii
 * care a rulat acțiunea. La cererea următoare, cache-ul replicii întoarce
 * `null` pentru `/module/*` și `/domenii/*`; fiindcă rutele aveau
 * `dynamicParams = false`, Next arunca `NoFallbackError` și servea 404 cu
 * `noindex`, cache-uit, până la restart. O singură deconectare scotea din
 * Google 23 de pagini publice pe jumătate din cereri. Capcana #45.
 *
 * Layout-urile de aici sunt `force-dynamic`, deci pe server nu era nimic de
 * invalidat. Ce contează e golirea Router Cache-ului din browser, iar orice
 * `revalidatePath` chemat dintr-o acțiune o face oricum.
 */
export function reimprospateazaAplicatia(): void {
  for (const grup of GRUPURI_CU_SESIUNE) revalidatePath(grup, "layout");
}
