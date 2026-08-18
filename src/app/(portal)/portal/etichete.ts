// src/app/(portal)/portal/etichete.ts
//
// Etichetele portalului sunt scrise pentru ANGAJAT, nu pentru administrator.
// „Trimisă" din aplicația mare devine aici „Trimisă spre aprobare": omul care a
// depus cererea vrea să știe unde e ea, nu în ce stare tehnică se află.
//
// Indexate pe `string`, nu pe uniunea de stări: valorile vin din bază, iar o
// stare adăugată printr-o migrare viitoare trebuie să se afișeze ca atare, nu să
// scoată `undefined` pe ecranul unui om.

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
 * Aici alegem doar accentul, pentru cine îl poate percepe.
 */
export const CLASE_STATUS_CERERE: Readonly<Record<string, string>> = {
  ciorna: "border-border text-muted-foreground",
  trimisa: "border-ring text-foreground",
  in_aprobare: "border-ring text-foreground",
  aprobata: "border-success text-success",
  respinsa: "border-danger text-danger",
  anulata: "border-border text-muted-foreground",
  intrerupta: "border-warning text-warning",
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
