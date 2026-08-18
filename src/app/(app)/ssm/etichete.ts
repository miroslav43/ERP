// src/app/(app)/ssm/etichete.ts
import type { StareScadentaSsm } from "@/domain/ssm/scadente";
import type {
  RezultatExamen,
  RezultatVerificareStingator,
  SsmDomain,
  StatusStingator,
  TipAccident,
  TipExamen,
  TipVerificareStingator,
} from "@/schemas/ssm";

export const ETICHETE_DOMENIU: Readonly<Record<SsmDomain, string>> = {
  ssm: "SSM",
  psi: "PSI",
};

export const ETICHETE_TIP_ACCIDENT: Readonly<Record<TipAccident, string>> = {
  usor: "Ușor",
  grav: "Grav",
  mortal: "Mortal",
  colectiv: "Colectiv",
};

export const CLASE_TIP_ACCIDENT: Readonly<Record<TipAccident, string>> = {
  usor: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100",
  grav: "bg-orange-100 text-orange-900 dark:bg-orange-950 dark:text-orange-100",
  mortal: "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-100",
  colectiv: "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-100",
};

export const ETICHETE_TIP_EXAMEN: Readonly<Record<TipExamen, string>> = {
  angajare: "La angajare",
  periodic: "Periodic",
  reluare: "La reluarea activității",
  adaptare: "De adaptare",
};

export const ETICHETE_REZULTAT_EXAMEN: Readonly<Record<RezultatExamen, string>> = {
  apt: "Apt",
  apt_conditionat: "Apt condiționat",
  inapt_temporar: "Inapt temporar",
  inapt: "Inapt",
};

export const CLASE_REZULTAT_EXAMEN: Readonly<Record<RezultatExamen, string>> = {
  apt: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100",
  apt_conditionat: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100",
  inapt_temporar: "bg-orange-100 text-orange-900 dark:bg-orange-950 dark:text-orange-100",
  inapt: "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-100",
};

export const ETICHETE_STATUS_STINGATOR: Readonly<Record<StatusStingator, string>> = {
  activ: "Activ",
  in_service: "În service",
  casat: "Casat",
};

export const CLASE_STATUS_STINGATOR: Readonly<Record<StatusStingator, string>> = {
  activ: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100",
  in_service: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100",
  casat: "bg-zinc-200 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100",
};

export const ETICHETE_TIP_VERIFICARE_STINGATOR: Readonly<Record<TipVerificareStingator, string>> = {
  verificare: "Verificare tehnică",
  reincarcare: "Reîncărcare",
  proba_presiune: "Probă de presiune",
};

export const ETICHETE_REZULTAT_VERIFICARE: Readonly<Record<RezultatVerificareStingator, string>> = {
  conform: "Conform",
  neconform: "Neconform",
  remediat: "Remediat",
};

export const ETICHETE_SCADENTA: Readonly<Record<StareScadentaSsm, string>> = {
  niciodata: "Niciodată efectuată",
  expirat: "Expirat",
  critic: "Expiră în curând",
  atentie: "Atenție",
  ok: "În regulă",
};

export const CLASE_SCADENTA: Readonly<Record<StareScadentaSsm, string>> = {
  niciodata: "bg-zinc-200 text-zinc-900 dark:bg-zinc-700 dark:text-zinc-100",
  expirat: "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-100",
  critic: "bg-orange-100 text-orange-900 dark:bg-orange-950 dark:text-orange-100",
  atentie: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100",
  ok: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100",
};
