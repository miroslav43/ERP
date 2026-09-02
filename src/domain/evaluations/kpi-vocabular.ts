// src/domain/evaluations/kpi-vocabular.ts

/**
 * Vocabularul KPI, separat de `kpi.ts`.
 *
 * `src/schemas/kpi.ts` are nevoie de listele astea, iar `kpi.ts` importă tipuri
 * pe care schema nu le folosește. Un fișier de constante fără dependențe se
 * poate importa din orice strat — inclusiv dintr-o componentă client, unde
 * etichetele se afișează.
 *
 * Oglindește `public.kpi_indicator_tip` și `public.kpi_sens` din
 * `0119_kpi_lunar.sql`. Ordinea e cea din enum-ul SQL.
 */

export const TIPURI_INDICATOR_KPI = ["masurat", "apreciat"] as const;
export const SENSURI_KPI = ["crestere", "descrestere"] as const;

export const ETICHETE_TIP_INDICATOR_KPI: Readonly<
  Record<(typeof TIPURI_INDICATOR_KPI)[number], string>
> = {
  masurat: "Măsurat (țintă și realizat)",
  apreciat: "Apreciat (notă pe scală)",
};

export const ETICHETE_SENS_KPI: Readonly<Record<(typeof SENSURI_KPI)[number], string>> = {
  crestere: "Mai mult e mai bine",
  descrestere: "Mai puțin e mai bine",
};
