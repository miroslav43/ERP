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

/**
 * Rolul din aplicație, arătat pe fișă — și de ce nu e același lucru cu statusul.
 *
 * ── PROBLEMA ──────────────────────────────────────────────────────────────
 * Patronul unei firme primește fișă de angajat automat, dintr-un trigger
 * (`0083_fisa_de_angajat_pentru_patron.sql`), cu `status = 'candidat'`. Alegerea
 * e corectă în bază — ține fișa în afara salarizării și a transmiterii către
 * ITM, exact ce trebuie cât timp omul n-are contract. Pe ecran însă „Candidat”
 * e cuvântul recrutării: îl citește ca pe cineva care așteaptă un răspuns la o
 * aplicare, nu ca pe administratorul firmei.
 *
 * Cele două informații sunt ORTOGONALE și de aceea rămân două insigne:
 * `organization_members.role` spune ce poate face omul în aplicație,
 * `employees.status` spune în ce relație de muncă e cu firma. Contopirea lor
 * într-un singur cuvânt ar minți într-o direcție sau în cealaltă.
 *
 * `super_admin` lipsește deliberat: schema are CHECK care îl interzice în
 * `organization_members` — sursa lui e `platform_admins`, deci nu poate apărea
 * niciodată aici. `employee` lipsește fiindcă ar fi zgomot: pe o listă de
 * angajați, insigna „Angajat” pe fiecare rând nu distinge pe nimeni.
 */
export const ROLURI_ADMINISTRATIVE = ["org_admin", "hr", "manager"] as const;
export type RolAdministrativ = (typeof ROLURI_ADMINISTRATIVE)[number];

export const ETICHETE_ROL_CONT: Readonly<Record<RolAdministrativ, string>> = {
  org_admin: "Administrator",
  hr: "Resurse umane",
  manager: "Manager",
};

/** Rolul brut din bază, îngustat la ce merită o insignă. Restul dă `null`. */
export function rolAdministrativ(rol: string | null | undefined): RolAdministrativ | null {
  if (rol === null || rol === undefined) return null;
  return (ROLURI_ADMINISTRATIVE as readonly string[]).includes(rol)
    ? (rol as RolAdministrativ)
    : null;
}

/**
 * Eticheta stării, cu „Candidat” reștampilat pentru cine are deja cont cu rol.
 *
 * Cuvântul se schimbă DOAR pe intersecția celor două condiții: fișa e
 * `candidat` ȘI contul legat de ea poartă un rol administrativ. Un candidat
 * adevărat la angajare n-are cont, deci n-are rol, deci rămâne „Candidat” —
 * ceea ce e corect, iar fluxul de recrutare nu se atinge.
 *
 * De ce nu s-a redenumit pur și simplu enum-ul: `candidat` e citit de
 * salarizare, de REGES și de trei ecrane de filtrare. Aici se schimbă un
 * cuvânt de pe ecran, nu o valoare din bază.
 */
export function etichetaStare(status: StatusAngajat, rol: RolAdministrativ | null): string {
  if (status === "candidat" && rol !== null) return "Fără contract";
  return ETICHETE_STATUS[status];
}

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
