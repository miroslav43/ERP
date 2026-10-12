// src/app/(app)/mentenanta/echipamente/[id]/precompletare-plan.ts
/**
 * Alegerea unei categorii legale în formularul de plan (M7) PRECOMPLETEAZĂ
 * câmpurile, fără să le blocheze: tipul devine „Verificare legală”, temeiul și
 * periodicitatea sugerată se scriu în câmpurile lor, iar denumirea se pune doar
 * dacă e goală — un nume ales de om nu se suprascrie.
 *
 * Câmpurile formularului rămân NECONTROLATE (`defaultValue`, ca `valoriTrimise`
 * să le poată repune după un refuz), deci precompletarea scrie direct în
 * elementele formularului, nu într-o stare React. Periodicitatea unei categorii
 * legate de eveniment (`null`, de exemplu verificarea după montare) nu golește
 * ce era deja scris.
 *
 * Fără `"use client"`: e o funcție pură peste DOM, importată de formularul client.
 */
import { preCompletarePlan } from "@/domain/maintenance/legal";

type CampScriabil = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

function camp(formular: HTMLFormElement, nume: string): CampScriabil | null {
  const element = formular.elements.namedItem(nume);
  return element instanceof HTMLInputElement ||
    element instanceof HTMLSelectElement ||
    element instanceof HTMLTextAreaElement
    ? element
    : null;
}

/** Întoarce `true` dacă a scris ceva (codul e o categorie cunoscută). */
export function aplicaCategorieLegala(formular: HTMLFormElement, cod: string): boolean {
  const valori = preCompletarePlan(cod === "" ? null : cod);
  if (valori === null) return false;

  const tip = camp(formular, "tip");
  if (tip !== null) tip.value = valori.tip;

  const temei = camp(formular, "temei_legal");
  if (temei !== null) temei.value = valori.temei_legal;

  const periodicitate = camp(formular, "periodicitate_zile");
  if (periodicitate !== null && valori.periodicitate_zile !== "") {
    periodicitate.value = valori.periodicitate_zile;
  }

  const denumire = camp(formular, "denumire");
  if (denumire !== null && denumire.value.trim() === "") denumire.value = valori.denumire;

  return true;
}
