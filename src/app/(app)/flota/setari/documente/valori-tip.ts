// src/app/(app)/flota/setari/documente/valori-tip.ts

import { CATEGORII_VEHICUL, type CategorieVehicul } from "@/schemas/fleet";

/**
 * `FormData` → încărcătura acțiunilor pe tipul propriu (0199). Singura
 * traducere, folosită de creare și de modificare, ca cele două să nu divergă.
 *
 * Două capcane tăcute, prinse de `valori-tip.test.ts`:
 *  · o bifă NEBIFATĂ lipsește din `FormData` — absența ei înseamnă `false`, nu
 *    „nu s-a trimis”;
 *  · categoriile vin ca valori repetate (`getAll`); niciuna bifată înseamnă
 *    „oricare”, iar schema o trimite ca `null` (`vdt_categorii_ck` refuză `{}`).
 * Masa rămâne text: `numarOptional` face golul `null`, nu `0`.
 */
export type ValoriTip = Readonly<{
  denumire: string;
  descriere: string | null;
  cere_expirare: boolean;
  obligatoriu: boolean;
  categorii_aplicabile: CategorieVehicul[];
  masa_max_kg: string;
}>;

function esteCategorie(v: string): v is CategorieVehicul {
  return (CATEGORII_VEHICUL as readonly string[]).includes(v);
}

export function valoriTip(date: FormData): ValoriTip {
  const descriere = String(date.get("descriere") ?? "").trim();
  return {
    denumire: String(date.get("denumire") ?? ""),
    descriere: descriere.length === 0 ? null : descriere,
    cere_expirare: date.get("cere_expirare") === "on",
    obligatoriu: date.get("obligatoriu") === "on",
    categorii_aplicabile: date.getAll("categorii_aplicabile").map(String).filter(esteCategorie),
    masa_max_kg: String(date.get("masa_max_kg") ?? "").trim(),
  };
}
