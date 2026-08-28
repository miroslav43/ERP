// src/app/(app)/angajati/etichete.ts
// Etichete de interfață — separate de actions.ts, care poate exporta doar funcții async.

import type { TonStare } from "@/components/ui/badge";
import type { TIPURI_ACT_IDENTITATE } from "@/domain/reges/operatii";
import type {
  CONDITII_MUNCA,
  DURATE_CONTRACT,
  GENURI,
  REGIMURI_SPECIALE,
  STARI_CIVILE,
} from "@/schemas/employee";
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
 * Actele de identitate, din vocabularul REGES, în română.
 *
 * Aceeași hartă hrănește DOUĂ lucruri: opțiunile `<select>`-ului din asistent și
 * textul scris în `employees.tip_act_identitate`, care ajunge pe documentele
 * tipărite. Ținute separat, cele două ar fi divergent tăcut — omul ar alege
 * „Permis de ședere" și contractul ar scrie altceva.
 *
 * Ordinea nu e cea din enum: primele sunt cele pe care le alege cineva în 99%
 * din cazuri, restul urmează. Un `<select>` de treisprezece opțiuni în ordinea
 * bazei e o listă în care nu găsești nimic.
 */
export const ETICHETE_ACT_IDENTITATE: Readonly<
  Record<(typeof TIPURI_ACT_IDENTITATE)[number], string>
> = {
  CarteIdentitate: "Carte de identitate",
  Pasaport: "Pașaport",
  PermisDeSedere: "Permis de ședere",
  CarteDeRezidenta: "Carte de rezidență",
  BuletinIdentitate: "Buletin de identitate",
  AltActIdentitateRomanesc: "Alt act de identitate românesc",
  AvizDeAngajare: "Aviz de angajare",
  DocumentDeIdentitatetemporara: "Document de identitate temporară",
  CertificatInregistrare: "Certificat de înregistrare",
  PasaportBeneficiarProtectieInternationala: "Pașaport — protecție internațională",
  AltApatridTolerat: "Apatrid tolerat",
  NIF: "Număr de identificare fiscală",
  Alt: "Alt document",
};

export const ETICHETE_REGIM_SPECIAL: Readonly<Record<(typeof REGIMURI_SPECIALE)[number], string>> =
  {
    ucenicie: "Ucenicie",
    internship: "Internship",
    zilier: "Zilier",
  };

export const ETICHETE_DURATA_CONTRACT: Readonly<Record<(typeof DURATE_CONTRACT)[number], string>> =
  {
    nedeterminat: "Nedeterminată",
    determinat: "Determinată",
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
