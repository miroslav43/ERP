// src/app/(app)/cursuri/etichete.ts
// Toate șirurile modulului, într-un singur loc.
//
// Nu e (încă) internaționalizare: proiectul n-are sistem de traduceri, iar
// interfața rămâne în română. E pregătirea pentru ea — dacă textele stau aici
// de la început, traducerea de mâine e o muncă mecanică, nu o rescriere a
// paginilor. Același tipar ca `onboarding/etichete.ts` și `ssm/etichete.ts`.

import type { TonStare } from "@/components/ui/badge";
import type {
  CursItemStatus,
  CursMaterialFel,
  CursMaterialSursa,
  CursMotiv,
  CursStatus,
  CursTreaptaDovada,
} from "@/schemas/cursuri";

export const ETICHETE_STATUS: Readonly<Record<CursStatus, string>> = {
  neinceput: "Neînceput",
  in_curs: "În curs",
  finalizat: "Parcurs",
  expirat: "Expirat",
  anulat: "Anulat",
};

export const TONURI_STATUS: Readonly<Record<CursStatus, TonStare>> = {
  neinceput: "ciorna",
  in_curs: "atentie",
  finalizat: "succes",
  expirat: "pericol",
  anulat: "neutru",
};

export const ETICHETE_STATUS_LECTIE: Readonly<Record<CursItemStatus, string>> = {
  neinceput: "Neînceput",
  in_curs: "În curs",
  finalizat: "Parcurs",
};

export const TONURI_STATUS_LECTIE: Readonly<Record<CursItemStatus, TonStare>> = {
  neinceput: "ciorna",
  in_curs: "atentie",
  finalizat: "succes",
};

export const ETICHETE_FEL: Readonly<Record<CursMaterialFel, string>> = {
  pdf: "Document",
  video: "Film",
};

export const ETICHETE_SURSA: Readonly<Record<CursMaterialSursa, string>> = {
  fisier: "Încărcat în aplicație",
  link: "Link extern",
};

export const ETICHETE_TREAPTA: Readonly<Record<CursTreaptaDovada, string>> = {
  bifa: "Bifă",
  parcurgere: "Parcurgere măsurată",
  test: "Test grilă",
  declaratie: "Declarație asumată",
};

/** Ce înseamnă fiecare treaptă, scris pentru administratorul care alege. */
export const EXPLICATII_TREAPTA: Readonly<Record<CursTreaptaDovada, string>> = {
  bifa: "Angajatul apasă „Am parcurs”. Cel mai simplu, fără dovadă.",
  parcurgere: "Se măsoară cât din film a fost urmărit. Doar pentru filme încărcate în aplicație.",
  test: "Angajatul dă un test grilă și trebuie să treacă un prag.",
  declaratie:
    "Angajatul își scrie numele și asumă un text. Se înregistrează data, adresa IP și versiunea materialului.",
};

export const ETICHETE_MOTIV: Readonly<Record<CursMotiv, string>> = {
  manual: "Atribuit manual",
  regula: "Atribuit automat",
  recertificare: "Recertificare",
};

export const TITLURI = {
  modul: "Cursuri",
  lista: "Cursurile firmei",
  biblioteca: "Bibliotecă",
  portal: "Cursurile mele",
} as const;

export const DESCRIERI = {
  /**
   * Dezambiguizarea față de `/ssm/instruiri` se scrie o singură dată, aici.
   * Meniul rămâne „Cursuri”: două vocabulare pentru același obiect ar fi mai rău
   * decât un cuvânt scurt.
   */
  lista:
    "Cursurile pe care le face firma, cu materiale parcurse direct în aplicație. Instruirile obligatorii prin lege se consemnează la SSM și PSI.",
  biblioteca:
    "Materialele refolosibile ale firmei. Un material încărcat o dată poate intra în oricâte cursuri.",
  portal: "Ce aveți de parcurs și ce ați parcurs deja.",
} as const;
