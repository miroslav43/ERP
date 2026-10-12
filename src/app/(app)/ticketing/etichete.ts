// src/app/(app)/ticketing/etichete.ts
import type { TonStare } from "@/components/ui/badge";
import type { StatusTichet, TipTichet } from "@/domain/ticketing/stari";
import type { Prioritate } from "@/domain/ticketing/prioritate";

export const ETICHETE_TIP: Readonly<Record<TipTichet, string>> = {
  software: "Cerere software",
  hardware: "Cerere hardware",
  defectiune: "Defecțiune",
  bug_erp: "Problemă în aplicație",
};

/** Text scurt, la persoana întâi, pentru ecranul de alegere a tipului. */
export const DESCRIERI_TIP: Readonly<Record<TipTichet, string>> = {
  software: "Am nevoie de o aplicație instalată pe calculator.",
  hardware: "Am nevoie de un echipament pe care nu îl am.",
  defectiune: "Ceva ce am în primire s-a stricat.",
  bug_erp: "Aplicația se comportă greșit.",
};

export const ETICHETE_STATUS: Readonly<Record<StatusTichet, string>> = {
  nou: "Nou",
  in_aprobare: "În aprobare",
  respins: "Respins",
  in_lucru: "În lucru",
  in_asteptare: "Așteaptă răspunsul tău",
  rezolvat: "Rezolvat",
  inchis: "Închis",
  anulat: "Anulat",
  redeschis: "Redeschis",
};

/**
 * Eticheta BUTONULUI pe care îl apasă solicitantul, nu a stării în care ajunge
 * tichetul. „Închis” pe un buton nu spune nimănui că e confirmarea rezolvării;
 * „Confirm rezolvarea” da. Hartă parțială: solicitantul n-are verb pentru
 * fiecare stare, iar `SchimbaStatus` cade pe `ETICHETE_STATUS` unde lipsește.
 */
export const ETICHETE_ACTIUNE_SOLICITANT: Readonly<Partial<Record<StatusTichet, string>>> = {
  inchis: "Confirm rezolvarea",
  redeschis: "Redeschide tichetul",
  anulat: "Anulează tichetul",
};

/**
 * Cine se ocupă de tichet, așa cum o poate spune pagina solicitantului.
 *
 * Coloana brută `asignat_employee_id` se vede prin politica tichetelor; rândul
 * operatorului din `employees` NU — angajatul are `employees:read = own`, deci
 * embed-ul `asignat` vine NULL deși tichetul E repartizat. Pagina confunda
 * „embed NULL” cu „nerepartizat” și scria „Neatribuit încă” în toate stările
 * (FLX-004). Numele operatorului rămâne nevizibil fără o funcție `security
 * definer`; textul e alternativa acceptată explicit în constatare.
 */
export function responsabilulTichetului(asignatId: string | null, nume: string | null): string {
  if (asignatId === null) return "Neatribuit încă";
  if (nume === null) return "Preluat de echipa de suport";
  return `În lucru la ${nume}`;
}

export const TONURI_STATUS: Readonly<Record<StatusTichet, TonStare>> = {
  // Tichet deschis, dar neluat încă de nimeni — „neînceput”, nu „în lucru”.
  nou: "ciorna",
  in_aprobare: "atentie",
  respins: "pericol",
  // „În lucru” e atenție, nu succes: lucrul e început, nu terminat.
  in_lucru: "atentie",
  // Era deliberat cel mai vizibil status, fiindcă e singurul în care mingea e la
  // solicitant. Distincția o poartă acum CUVÂNTUL („Așteaptă răspunsul tău”), nu
  // o nuanță proprie de portocaliu.
  in_asteptare: "atentie",
  rezolvat: "succes",
  inchis: "neutru",
  anulat: "neutru",
  // Redeschis e o stare activă — munca s-a întors la echipă —, deci atenție, nu
  // neutru, deși vechea culoare era violet.
  redeschis: "atentie",
};

export const ETICHETE_PRIORITATE: Readonly<Record<Prioritate, string>> = {
  scazuta: "Scăzută",
  normala: "Normală",
  ridicata: "Ridicată",
  critica: "Critică",
};

export const TONURI_PRIORITATE: Readonly<Record<Prioritate, TonStare>> = {
  scazuta: "neutru",
  normala: "neutru",
  ridicata: "atentie",
  critica: "pericol",
};

/** Cum se numesc câmpurile în istoricul tichetului. */
export const ETICHETE_CAMP: Readonly<Record<string, string>> = {
  status: "Stare",
  prioritate: "Prioritate",
};
