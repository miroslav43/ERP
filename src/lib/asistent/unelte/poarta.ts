// src/lib/asistent/unelte/poarta.ts
/**
 * Cine are voie să cheme ce unealtă.
 *
 * Fișierul e separat de registru (`index.ts`) tocmai ca să NU atingă
 * `server-only`: poarta e partea care trebuie testată, iar un test care are
 * nevoie de conexiune la bază ca să verifice o regulă de autorizare ajunge să
 * nu fie rulat.
 *
 * ── DE CE SE VERIFICĂ DE DOUĂ ORI ────────────────────────────────────────────
 * `uneltelePermise` decide ce unelte AFLĂ modelul că există; `verificaAcces` se
 * cheamă din nou, imediat înainte de execuție. Pare redundant și nu e: un model
 * poate cere o unealtă pe care nu i-am descris-o — din memoria antrenamentului,
 * dintr-un istoric de conversație care a traversat o schimbare de permisiuni,
 * sau pur și simplu greșind. Prima verificare e igienă de context; a doua e
 * bariera. Dacă am avea doar prima, autorizarea ar depinde de bunele intenții
 * ale modelului.
 */
import { meetsScope } from "@/config/permissions";

import type { ContextUnealta, Unealta } from "./tip";

export type Refuz = Readonly<{ permis: false; motiv: string }>;
export type Acces = Readonly<{ permis: true }> | Refuz;

export function verificaAcces(unealta: Unealta, context: ContextUnealta): Acces {
  if (unealta.featureKey !== null && !context.features.has(unealta.featureKey)) {
    return { permis: false, motiv: "Firma nu are modulul acesta activat." };
  }
  if (
    unealta.permission !== null &&
    !meetsScope(context.permisiuni.get(unealta.permission), unealta.minScope)
  ) {
    return { permis: false, motiv: "Nu are dreptul să vadă datele acestea." };
  }
  if (unealta.cereFisaProprie === true && context.employeeId === null) {
    // Un `org_admin` care e doar administrator, fără fișă, chiar nu are sold de
    // concediu. E o stare reală, nu o eroare, și merită spusă ca atare.
    return { permis: false, motiv: "Contul acesta nu are fișă de angajat." };
  }
  return { permis: true };
}

/** Uneltele despre care modelul are voie să afle. */
export function uneltelePermise(
  toate: readonly Unealta[],
  context: ContextUnealta,
): readonly Unealta[] {
  return toate.filter((unealta) => verificaAcces(unealta, context).permis);
}
