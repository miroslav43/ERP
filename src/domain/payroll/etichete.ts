// src/domain/payroll/etichete.ts
// Etichete pentru tipurile de bonus/reținere (enum-uri `payroll_bonus_type` /
// `payroll_deduction_type`). Neutru — importabil atât din `(app)/salarizare`
// cât și din `components/payroll/fluturas.tsx`, montată și în `(portal)`.

export const ETICHETE_TIP_PRIMA: Record<string, string> = {
  prima_performanta: "Primă de performanță",
  prima_proiect: "Primă de proiect",
  prima_vacanta: "Primă de vacanță",
  spor_conditii: "Spor condiții de muncă",
  alta: "Altă primă",
};

export const ETICHETE_TIP_RETINERE: Record<string, string> = {
  avans: "Avans",
  poprire: "Poprire",
  imputatie: "Imputație",
  rata_interna: "Rată internă",
  retinere_sindicat: "Reținere sindicat",
  alta: "Altă reținere",
};
