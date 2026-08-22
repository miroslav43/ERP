// src/domain/ticketing/macrouri.ts
// Răspunsuri predefinite: un click scrie textul și mută starea.
//
// Deliberat în cod, nu în bază. Regulile de rutare din specificație trebuie să
// fie configurabile per organizație — acelea vor sta într-un tabel. Macro-urile
// nu: sunt formulări standard ale echipei, se schimbă la fel de rar ca eticheta
// unui buton, iar un tabel ar fi însemnat un ecran de administrare pentru trei
// propoziții. Dacă vreodată un client cere macro-uri proprii, se mută.

import type { StatusTichet } from "./stari";

export type Macro = Readonly<{
  cod: string;
  eticheta: string;
  text: string;
  /** Starea în care trece tichetul odată aplicat macro-ul. */
  status: StatusTichet;
}>;

export const MACROURI: readonly Macro[] = [
  {
    cod: "detalii",
    eticheta: "Am nevoie de mai multe detalii",
    text: "Bună ziua! Ca să pot continua, am nevoie de câteva lămuriri suplimentare. Îmi poți spune mai exact ce se întâmplă și când ai observat prima dată problema?",
    status: "in_asteptare",
  },
  {
    cod: "instalat",
    eticheta: "Instalat, verifică te rog",
    text: "Am făcut instalarea. Te rog să verifici și să-mi confirmi că totul funcționează cum trebuie.",
    status: "rezolvat",
  },
  {
    cod: "inlocuit",
    eticheta: "Echipament înlocuit",
    text: "Echipamentul a fost înlocuit. Cel vechi a fost ridicat, iar cel nou apare în inventarul tău.",
    status: "rezolvat",
  },
  {
    cod: "in_lucru",
    eticheta: "Am preluat, lucrez la asta",
    text: "Am preluat solicitarea și lucrez la ea. Revin cu un răspuns imediat ce am noutăți.",
    status: "in_lucru",
  },
];

export function macroDupaCod(cod: string): Macro | undefined {
  return MACROURI.find((m) => m.cod === cod);
}
