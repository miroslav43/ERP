// src/app/(portal)/portal/etichete.ts
//
// Etichetele portalului sunt scrise pentru ANGAJAT, nu pentru administrator.
// „Trimisă" din aplicația mare devine aici „Trimisă spre aprobare": omul care a
// depus cererea vrea să știe unde e ea, nu în ce stare tehnică se află.
//
// Indexate pe `string`, nu pe uniunea de stări: valorile vin din bază, iar o
// stare adăugată printr-o migrare viitoare trebuie să se afișeze ca atare, nu să
// scoată `undefined` pe ecranul unui om.

import type { TonStare } from "@/components/ui/badge";

export const ETICHETE_STATUS_CERERE: Readonly<Record<string, string>> = {
  ciorna: "Ciornă",
  trimisa: "Trimisă spre aprobare",
  in_aprobare: "În aprobare",
  aprobata: "Aprobată",
  respinsa: "Respinsă",
  anulata: "Anulată",
  intrerupta: "Întreruptă",
};

/**
 * Culoarea NU e singurul purtător de sens — badge-ul are întotdeauna text.
 * Aici alegem doar tonul, pentru cine îl poate percepe.
 *
 * Indexat pe `string` din același motiv ca `ETICHETE_STATUS_CERERE`: o stare
 * nouă venită din bază iese `undefined`, iar locurile de randare o tratează ca
 * „neutru” — stare necunoscută.
 */
export const TONURI_STATUS_CERERE: Readonly<Record<string, TonStare>> = {
  ciorna: "ciorna",
  // Depusă, dar încă fără răspuns: atenție, nu succes.
  trimisa: "atentie",
  in_aprobare: "atentie",
  aprobata: "succes",
  respinsa: "pericol",
  anulata: "neutru",
  // Rechemarea din concediu cere atenția omului, nu e o încheiere liniștită.
  intrerupta: "atentie",
};

export const ETICHETE_TIP_ZI: Readonly<Record<string, string>> = {
  lucratoare: "Lucrată",
  weekend: "Weekend",
  sarbatoare: "Sărbătoare legală",
  concediu: "Concediu",
  medical: "Concediu medical",
  absenta_nemotivata: "Absență nemotivată",
  delegatie: "Delegație",
};
