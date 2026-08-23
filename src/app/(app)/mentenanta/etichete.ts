// src/app/(app)/mentenanta/etichete.ts
import type {
  RezultatInterventie,
  StatusEchipament,
  StatusSesizare,
  TipContor,
  TipMentenanta,
  UrgentaSesizare,
} from "@/schemas/maintenance";
import type { StareScadentaMentenanta } from "@/domain/maintenance/scadente";
import type { TonStare } from "@/components/ui/badge";

export const ETICHETE_STATUS_ECHIPAMENT: Readonly<Record<StatusEchipament, string>> = {
  in_functiune: "În funcțiune",
  in_reparatie: "În reparație",
  in_conservare: "În conservare",
  casat: "Casat",
};

export const TONURI_STATUS_ECHIPAMENT: Readonly<Record<StatusEchipament, TonStare>> = {
  in_functiune: "succes",
  // În reparație = utilajul lipsește din producție acum; e o stare de urmărit, nu o reușită.
  in_reparatie: "atentie",
  in_conservare: "neutru",
  casat: "neutru",
};

export const ETICHETE_TIP_CONTOR: Readonly<Record<TipContor, string>> = {
  ore: "Ore de funcționare",
  km: "Kilometri",
  cicluri: "Cicluri",
};

export const ETICHETE_TIP_MENTENANTA: Readonly<Record<TipMentenanta, string>> = {
  preventiva: "Preventivă",
  predictiva: "Predictivă",
  corectiva: "Corectivă",
};

export const ETICHETE_REZULTAT_INTERVENTIE: Readonly<Record<RezultatInterventie, string>> = {
  reusita: "Reușită",
  partiala: "Parțială",
  esuata: "Eșuată",
  amanata: "Amânată",
};

export const TONURI_REZULTAT_INTERVENTIE: Readonly<Record<RezultatInterventie, TonStare>> = {
  reusita: "succes",
  // Parțială = lucrarea s-a făcut pe jumătate, rămâne de revenit — atenție, nu succes.
  partiala: "atentie",
  esuata: "pericol",
  // Amânată = nu s-a încheiat nimic; intervenția s-a închis fără efect.
  amanata: "neutru",
};

export const ETICHETE_URGENTA_SESIZARE: Readonly<Record<UrgentaSesizare, string>> = {
  scazuta: "Scăzută",
  medie: "Medie",
  ridicata: "Ridicată",
  critica: "Critică",
};

/**
 * Urgența e o SCARĂ, nu o stare: nu există „succes” pe ea. Scăzută rămâne
 * neutră (nu cere nimic), medie și ridicată împart tonul de atenție — se
 * despart prin CUVÂNT, singurul purtător de înțeles — iar critica e pericol.
 */
export const TONURI_URGENTA_SESIZARE: Readonly<Record<UrgentaSesizare, TonStare>> = {
  scazuta: "neutru",
  medie: "atentie",
  ridicata: "atentie",
  critica: "pericol",
};

export const ETICHETE_STATUS_SESIZARE: Readonly<Record<StatusSesizare, string>> = {
  nou: "Nouă",
  in_analiza: "În analiză",
  in_lucru: "În lucru",
  rezolvat: "Rezolvată",
  respins: "Respinsă",
};

export const TONURI_STATUS_SESIZARE: Readonly<Record<StatusSesizare, TonStare>> = {
  // Nouă = nimeni n-a atins-o încă; e neînceput, nu „în regulă”.
  nou: "ciorna",
  in_analiza: "atentie",
  // În lucru = deschisă și în sarcina cuiva. Atenție, nu succes: succesul e „Rezolvată”.
  in_lucru: "atentie",
  rezolvat: "succes",
  respins: "pericol",
};

export const ETICHETE_STARE_SCADENTA: Readonly<Record<StareScadentaMentenanta, string>> = {
  in_intarziere: "În întârziere",
  scadenta_apropiata: "Scadență apropiată",
  in_regula: "În regulă",
  fara_scadenta: "Fără scadență",
};

export const TONURI_STARE_SCADENTA: Readonly<Record<StareScadentaMentenanta, TonStare>> = {
  // În întârziere se randează cu `cuAvertisment` — pictograma îl separă de restul
  // stărilor de pericol pe o listă tipărită alb-negru.
  in_intarziere: "pericol",
  scadenta_apropiata: "atentie",
  in_regula: "succes",
  // Fără scadență nu e „în ordine”: scadența n-a putut fi calculată încă.
  fara_scadenta: "ciorna",
};
