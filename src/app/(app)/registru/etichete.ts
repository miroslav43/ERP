// src/app/(app)/registru/etichete.ts
//
// Cum se citesc în ecran valorile tehnice din registru.

import type { SensRegistru } from "@/lib/queries/registru";

/**
 * Cele trei sensuri, cu cuvintele legii.
 *
 * Legea 16/1996 art. 7 le numește „documente **intrate**", „întocmite pentru
 * **uz intern**" și „**ieșite**" — nu „primite/trimise". Etichetele urmează
 * textul, fiindcă exact după el se uită inspectorul.
 */
export const ETICHETE_SENS: Readonly<Record<SensRegistru, string>> = {
  intrare: "Intrare",
  iesire: "Ieșire",
  intern: "Uz intern",
};

/**
 * Denumirile tipurilor de document produse azi de aplicație.
 *
 * `tip_document` e text liber în bază, deliberat: un modul nou nu trebuie să
 * ceară o migrare de enum ca să înregistreze. Harta de aici e doar pentru
 * afișare, iar un cod necunoscut cade pe forma lui brută, curățată — nu pe un
 * gol. Un rând de registru fără denumire ar fi mai rău decât unul urât.
 */
const DENUMIRI: Readonly<Record<string, string>> = {
  contract_munca: "Contract individual de muncă",
  act_aditional: "Act adițional la contract",
  fisa_postului: "Fișa postului",
  nda: "Acord de confidențialitate",
  anexa_proprietate_intelectuala: "Anexă de proprietate intelectuală",
  act_aditional_telemunca: "Act adițional de telemuncă",
  document_personal: "Document de personal",
};

/** „adeverinta_vechime" → „Adeverință vechime" pentru codurile fără denumire proprie. */
function dinCod(cod: string): string {
  const cuvinte = cod.replace(/_/g, " ").trim();
  return cuvinte.charAt(0).toUpperCase() + cuvinte.slice(1);
}

export function eticheteazaTipDocument(cod: string): string {
  return DENUMIRI[cod] ?? dinCod(cod);
}
