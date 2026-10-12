// src/app/(app)/flota/amenzi/etichete.ts
// Tonurile insignelor pentru amenzi și incidente (0206). Etichetele în română
// stau în domeniu (`src/domain/fleet/amenzi.ts`); aici e doar legătura cu
// componenta de insignă, care nu are voie să intre în domeniu.

import type { StadiuAmenda, StadiuIncident } from "@/domain/fleet/amenzi";
import type { TonStare } from "@/components/ui/badge";

export const TON_STADIU_AMENDA: Readonly<Record<StadiuAmenda, TonStare>> = {
  primita: "atentie",
  sofer_desemnat: "atentie",
  raspuns_trimis: "succes",
  platita: "succes",
  contestata: "atentie",
  anulata: "neutru",
};

export const TON_STADIU_INCIDENT: Readonly<Record<StadiuIncident, TonStare>> = {
  raportat: "atentie",
  constatat: "atentie",
  la_asigurator: "atentie",
  in_reparatie: "atentie",
  inchis: "succes",
};
