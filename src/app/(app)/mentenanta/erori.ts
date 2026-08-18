// src/app/(app)/mentenanta/erori.ts
// Traducerea codurilor Postgres specifice modulului de mentenanță — separat
// de traducerea generică din `src/lib/actions/errors.ts`, ca fiecare modul
// să-și scrie mesajele fără să atingă un fișier comun altor agenți.

import { businessRule, isPostgrestError } from "@/lib/actions/errors";

/**
 * Traduce o eroare Postgres într-un mesaj de business afișabil ca atare.
 *
 * Cazul care contează cel mai mult e P0001. Triggerele din 0011_ssm.sql
 * ridică mesaje deja scrise pentru utilizator final, cu CIFRELE în ele:
 *
 *   „Citirea (9500) este mai mică decât ultima citire înregistrată
 *    (10000). Corectați valoarea sau bifați „Resetare contor”."
 *
 * Garda ISCIR (247 de caractere, încape în limita de mai jos) explică exact
 * ce trebuie făcut — alt responsabil autorizat, sau o derogare de minimum 20
 * de caractere de la un administrator. Fără propagare, `mapPostgrestError`
 * le-ar înlocui pe toate cu „Operațiunea a fost respinsă de o regulă a
 * sistemului” — omul n-ar afla nici cifra, nici pasul următor.
 *
 * Tip `never`: apelul `traduEroare(error)` întrerupe fluxul exact ca un
 * `throw`, deci TypeScript îngustează corect tipul lui `data` imediat după.
 */
export function traduEroare(error: unknown): never {
  if (isPostgrestError(error)) {
    if (error.code === "23505") {
      // `equipment_uq` (organization_id, cod) sau `iscir_authorizations_uq`
      // (organization_id, numar) — nu putem ști din codul Postgres care
      // dintre cele două a picat, dar mesajul rămâne util în ambele cazuri.
      throw businessRule(
        "Există deja o înregistrare cu acest cod sau număr în organizație. Verificați codul echipamentului sau numărul autorizației ISCIR.",
      );
    }
    if (error.code === "22012" || error.code === "22003") {
      throw businessRule(
        "O valoare numerică este în afara intervalului acceptat. Verificați citirea contorului, costurile și duratele.",
      );
    }
    if (error.code === "P0001") {
      throw businessRule(error.message.slice(0, 300));
    }
  }
  throw error;
}
