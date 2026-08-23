// src/app/(app)/angajati/etichete.ts
// Etichete de interfață — separate de actions.ts, care poate exporta doar funcții async.

import type { TonStare } from "@/components/ui/badge";
import type { StatusAngajat, TipScutire } from "@/schemas/employee";

export const ETICHETE_STATUS: Readonly<Record<StatusAngajat, string>> = {
  candidat: "Candidat",
  activ: "Activ",
  suspendat: "Suspendat",
  preaviz: "În preaviz",
  incetat: "Contract încetat",
  arhivat: "Arhivat",
};

export const TONURI_STATUS: Readonly<Record<StatusAngajat, TonStare>> = {
  // Candidatul e o fișă care nu s-a umplut încă — „neînceput”, deci ciornă.
  candidat: "ciorna",
  activ: "succes",
  // Suspendat și preaviz sunt stări trecătoare care cer o acțiune, nu eșecuri:
  // atenție, nu pericol.
  suspendat: "atentie",
  preaviz: "atentie",
  // Contractul încetat e o relație închisă, nu o respingere — de aceea neutru,
  // deși vechea hartă îl colora roșiatic.
  incetat: "neutru",
  arhivat: "neutru",
};

export const ETICHETE_CONTRACT: Readonly<Record<string, string>> = {
  proiect: "Proiect",
  activ: "Activ",
  suspendat: "Suspendat",
  incetat: "Încetat",
  anulat: "Anulat",
};

export const ETICHETE_MOD_LUCRU: Readonly<Record<string, string>> = {
  sediu: "La sediu",
  telemunca: "Telemuncă",
  domiciliu: "La domiciliu",
  mixt: "Mixt",
};

export const ETICHETE_SCUTIRE: Readonly<Record<TipScutire, string>> = {
  it: "IT — creație software",
  constructii: "Construcții",
  agricultura: "Agricultură și industrie alimentară",
  industrie_alimentara: "Industria alimentară",
  persoana_handicap: "Persoană cu handicap",
  cercetare_dezvoltare: "Cercetare-dezvoltare",
};
