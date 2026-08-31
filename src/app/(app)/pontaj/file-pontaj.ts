// src/app/(app)/pontaj/file-pontaj.ts
//
// Ce file vede cineva în banda de navigare a pontajului.
//
// ── DE CE UN HELPER, ȘI NU ÎNCĂ O LINIE ÎN FIECARE PAGINĂ ───────────────────
// `NavPontaj` primește booleeni, nu harta de permisiuni — o componentă client
// nu poate importa `can`. Consecința: cele patru pagini de sub `/pontaj` își
// calculau fiecare `poateAproba` cu același `can(permisiuni, …)`, în cinci
// locuri.
//
// Cât timp condiția a fost UNA, dublarea era inofensivă. Din 0118 sunt două —
// permisiunea ȘI alegerea firmei de a avea sau nu un pas de aprobare — iar
// varianta „adaug al doilea `&&` în cinci locuri" garanta că unul rămâne în
// urmă. Exact felul de rămânere în urmă pe care o descrie în scris
// `portal/pontajul-meu/saptamana/page.tsx`: o reparație aplicată pe ecranul de
// admin și uitată pe celălalt, ani întregi în care nimeni nu compară două
// fișiere.
//
// Helper de SERVER: citește baza și atinge `can`. Rezultatul lui se pasează în
// jos ca proprietăți simple.

import { can, type PermissionMap } from "@/lib/auth/permissions";
import { setariPontareRapida } from "@/lib/queries/attendance";
import { configPontareRapida } from "@/domain/attendance/pontare-rapida";

export interface FilePontaj {
  /**
   * Are drept de aprobare ȘI firma cere aprobare.
   *
   * Compus, nu doar permisiunea: e valoarea care stinge deodată fila
   * „Aprobare", secțiunea de decizie din dialogul zilei și butoanele de decizie
   * din foaia colectivă. Bariera adevărată rămâne în acțiuni
   * (`refuzaCandAprobareaEStinsa`) și în RLS — aici e doar ce se desenează.
   */
  readonly poateAproba: boolean;
  readonly poateConfigura: boolean;
  /**
   * Alegerea firmei, SEPARAT de permisiune.
   *
   * `poateAproba` le compune pe amândouă și e bun pentru „ce butoane desenez".
   * Pentru „ce SCRIE pe ele" trebuie regula curată: un `employee` are
   * `poateAproba = false` oricum, dar butonul din planul lui trebuie să spună
   * „Trimite spre aprobare" într-o firmă care aprobă și „Salvează planul" în
   * una care nu. Compusă, regula i-ar fi spus mereu a doua variantă.
   */
  readonly necesitaAprobare: boolean;
}

export async function fileDePontaj(
  organizationId: string,
  permisiuni: PermissionMap,
): Promise<FilePontaj> {
  const config = configPontareRapida(await setariPontareRapida(organizationId));
  return {
    poateAproba: config.necesitaAprobare && can(permisiuni, "attendance:approve", "team"),
    poateConfigura: can(permisiuni, "attendance:update", "all"),
    necesitaAprobare: config.necesitaAprobare,
  };
}
