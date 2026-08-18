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

export const ETICHETE_STATUS_ECHIPAMENT: Readonly<Record<StatusEchipament, string>> = {
  in_functiune: "În funcțiune",
  in_reparatie: "În reparație",
  in_conservare: "În conservare",
  casat: "Casat",
};

export const CLASE_STATUS_ECHIPAMENT: Readonly<Record<StatusEchipament, string>> = {
  in_functiune: "bg-emerald-100 text-emerald-900",
  in_reparatie: "bg-amber-100 text-amber-900",
  in_conservare: "bg-zinc-200 text-zinc-800",
  casat: "bg-zinc-200 text-zinc-800",
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

export const CLASE_REZULTAT_INTERVENTIE: Readonly<Record<RezultatInterventie, string>> = {
  reusita: "bg-emerald-100 text-emerald-900",
  partiala: "bg-amber-100 text-amber-900",
  esuata: "bg-red-100 text-red-900",
  amanata: "bg-zinc-200 text-zinc-800",
};

export const ETICHETE_URGENTA_SESIZARE: Readonly<Record<UrgentaSesizare, string>> = {
  scazuta: "Scăzută",
  medie: "Medie",
  ridicata: "Ridicată",
  critica: "Critică",
};

export const CLASE_URGENTA_SESIZARE: Readonly<Record<UrgentaSesizare, string>> = {
  scazuta: "bg-zinc-200 text-zinc-800",
  medie: "bg-blue-100 text-blue-900",
  ridicata: "bg-amber-100 text-amber-900",
  critica: "bg-red-100 text-red-900",
};

export const ETICHETE_STATUS_SESIZARE: Readonly<Record<StatusSesizare, string>> = {
  nou: "Nouă",
  in_analiza: "În analiză",
  in_lucru: "În lucru",
  rezolvat: "Rezolvată",
  respins: "Respinsă",
};

export const CLASE_STATUS_SESIZARE: Readonly<Record<StatusSesizare, string>> = {
  nou: "bg-blue-100 text-blue-900",
  in_analiza: "bg-amber-100 text-amber-900",
  in_lucru: "bg-amber-100 text-amber-900",
  rezolvat: "bg-emerald-100 text-emerald-900",
  respins: "bg-red-100 text-red-900",
};

export const ETICHETE_STARE_SCADENTA: Readonly<Record<StareScadentaMentenanta, string>> = {
  in_intarziere: "În întârziere",
  scadenta_apropiata: "Scadență apropiată",
  in_regula: "În regulă",
  fara_scadenta: "Fără scadență",
};

export const CLASE_STARE_SCADENTA: Readonly<Record<StareScadentaMentenanta, string>> = {
  in_intarziere: "bg-red-100 text-red-900",
  scadenta_apropiata: "bg-amber-100 text-amber-900",
  in_regula: "bg-emerald-100 text-emerald-900",
  fara_scadenta: "bg-zinc-200 text-zinc-800",
};
