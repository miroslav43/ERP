// src/app/(app)/angajati/etichete.ts
// Etichete de interfață — separate de actions.ts, care poate exporta doar funcții async.

import type { TonStare } from "@/components/ui/badge";
import type { CONDITII_MUNCA, GENURI, STARI_CIVILE } from "@/schemas/employee";
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

/*
 * Enumerările bazei, în română. Fără ele, ecranele afișau valoarea brută:
 * „masculin" mai trecea, dar „necasatorit" și „nedeclarat" se citeau ca erori
 * de tastare, iar „normale" nu spune nimic despre condiții de muncă.
 * Diacriticele nu pot sta în enum-ul Postgres, deci traducerea trebuie să fie
 * aici, nu în bază.
 */
export const ETICHETE_GEN: Readonly<Record<(typeof GENURI)[number], string>> = {
  masculin: "Masculin",
  feminin: "Feminin",
  nedeclarat: "Nedeclarat",
};

export const ETICHETE_STARE_CIVILA: Readonly<Record<(typeof STARI_CIVILE)[number], string>> = {
  necasatorit: "Necăsătorit(ă)",
  casatorit: "Căsătorit(ă)",
  divortat: "Divorțat(ă)",
  vaduv: "Văduv(ă)",
};

export const ETICHETE_CONDITII_MUNCA: Readonly<Record<(typeof CONDITII_MUNCA)[number], string>> = {
  normale: "Normale",
  deosebite: "Deosebite",
  speciale: "Speciale",
};

/**
 * Tipurile de componentă salarială. Stăteau în corpul fișei angajatului, adică
 * a doua hartă de etichete a modulului, într-un loc unde nimeni nu o caută.
 */
export const ETICHETE_TIP_COMPONENTA: Readonly<Record<string, string>> = {
  spor_procent: "Spor procentual",
  spor_suma: "Spor — sumă fixă",
  indemnizatie: "Indemnizație",
  prima_recurenta: "Primă recurentă",
  beneficiu_natura: "Beneficiu în natură",
};

export const ETICHETE_SCUTIRE: Readonly<Record<TipScutire, string>> = {
  it: "IT — creație software",
  constructii: "Construcții",
  agricultura: "Agricultură și industrie alimentară",
  industrie_alimentara: "Industria alimentară",
  persoana_handicap: "Persoană cu handicap",
  cercetare_dezvoltare: "Cercetare-dezvoltare",
};
