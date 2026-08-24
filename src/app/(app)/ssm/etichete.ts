// src/app/(app)/ssm/etichete.ts
import type { TonStare } from "@/components/ui/badge";
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

// Gravitatea o poartă CUVÂNTUL („Ușor" / „Grav"), nu tonul: „usor" și „grav"
// împart tonul „atenție" fiindcă amândouă cer acțiune, dar niciunul nu e
// ireversibil. „mortal" și „colectiv" declanșează obligația de comunicare la
// ITM — singurele care merită „pericol".
export const TONURI_TIP_ACCIDENT: Readonly<Record<TipAccident, TonStare>> = {
  usor: "atentie",
  grav: "atentie",
  mortal: "pericol",
  colectiv: "pericol",
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

// „inapt_temporar" e „atenție", nu „pericol": angajatul revine la lucru după
// expirarea restricției — doar „inapt" închide definitiv postul.
export const TONURI_REZULTAT_EXAMEN: Readonly<Record<RezultatExamen, TonStare>> = {
  apt: "succes",
  apt_conditionat: "atentie",
  inapt_temporar: "atentie",
  inapt: "pericol",
};

export const ETICHETE_STATUS_STINGATOR: Readonly<Record<StatusStingator, string>> = {
  activ: "Activ",
  in_service: "În service",
  casat: "Casat",
};

// „in_service" e „atenție", nu „neutru": stingătorul lipsește fizic din
// locație, deci acoperirea PSI e descoperită cât timp ține service-ul.
export const TONURI_STATUS_STINGATOR: Readonly<Record<StatusStingator, TonStare>> = {
  activ: "succes",
  in_service: "atentie",
  casat: "neutru",
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

/*
 * Cuvintele urmau ordinea GREȘITĂ a gravității, iar inversiunea s-a văzut abia
 * când `<Scadenta>` a adăugat forma ca a doua marcă: `critic` (≤ 7 zile) purta
 * „Expiră în curând" și primea triunghiul de alarmă, în timp ce `atentie`
 * (≤ 30 de zile) purta „Atenție" și primea ceasul. Treapta mai gravă suna mai
 * blând decât cea mai puțin gravă, deci cuvântul și forma se contraziceau.
 *
 * Acum cuvintele urcă odată cu treapta, iar numărul de zile e în ele: „în
 * curând" nu spune nimic cuiva care trebuie să programeze o clinică.
 */
export const ETICHETE_SCADENTA: Readonly<Record<StareScadentaSsm, string>> = {
  niciodata: "Niciodată efectuată",
  expirat: "Expirat",
  critic: "Expiră în mai puțin de o săptămână",
  atentie: "Expiră în curând",
  ok: "În regulă",
};

/*
 * `TONURI_SCADENTA` a dispărut odată cu trecerea celor șase ecrane SSM pe
 * `<Scadenta>` — la fel cum a dispărut perechea ei din
 * `src/app/(app)/flota/etichete.ts`. Pastila își ia culoarea ȘI forma din
 * treaptă, iar treapta o dă `stareScadentaSsm` prin `treaptaSsm`. Harta de
 * tonuri ar fi fost a doua sursă pentru aceeași severitate — exact felul de
 * divergență din care s-a născut primitiva. Rămâne numai CUVÂNTUL, mai sus:
 * `<Scadenta>` nu-și scrie niciodată singură conținutul.
 */
