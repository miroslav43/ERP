// src/app/(app)/flota/[id]/pv/model-din-rand.ts
//
// De la rândul citit (`citestePv`) la intrarea lui `modelPv`. O folosesc
// ecranul PV-ului și ruta PDF: aceeași traducere, deci aceeași hârtie.
//
// Modul NEUTRU (fără `"use client"`, fără `server-only`): îl importă și o
// pagină de server, și ruta. Tipul din `fleet-pv.ts` e doar de tip, deci se
// șterge la compilare.
//
// Regula: PV-ul finalizat se citește DIN INSTANTANEU (vehiculul, părțile și
// documentele de atunci); ciorna, din datele vii, iar ce nu se vede (embed
// `null` pentru cine n-are `employees:read`, capcana 18) apare „—”.

import {
  citesteDaune,
  citesteInstantaneu,
  type DocumentLaPv,
  type IntrareModelPv,
  type ParteaPv,
  type VehiculPv,
} from "@/domain/fleet/proces-verbal";
import type { PvComplet } from "@/lib/queries/fleet-pv";
import { ETICHETE_CATEGORIE, ETICHETE_COMBUSTIBIL } from "@/app/(app)/flota/etichete";

export type DateVii = Readonly<{
  /** Vehiculul de azi, pentru ciornă; `null` dacă nu e vizibil. */
  vehicul: VehiculPv | null;
  /** Documentele curente de azi, pentru ciornă. */
  documente: readonly DocumentLaPv[];
  /** Denumirea firmei, când instantaneul n-o are (ciorna). */
  firma: string;
}>;

const VEHICUL_NECUNOSCUT: VehiculPv = {
  nr_inmatriculare: "—",
  marca: "—",
  model: "",
  vin: null,
  categorie: "altele",
  tip_combustibil: "altul",
  an_fabricatie: null,
};

function parteVie(id: string | null, embed: PvComplet["predator"], firma: string): ParteaPv {
  if (id === null) return { tip: "firma", nume: firma, marca: null, functie: null };
  return {
    tip: "angajat",
    nume: embed?.full_name ?? null,
    marca: embed?.marca ?? null,
    functie: embed?.functie ?? null,
  };
}

export function intrareModelDinRand(pv: PvComplet, vii: DateVii): IntrareModelPv {
  const instantaneu = citesteInstantaneu(pv.snapshot);
  const date = {
    tip: pv.tip,
    stare: pv.stare,
    moment: pv.moment,
    data_pv: pv.data_pv,
    numar: pv.numar,
    numar_registru: pv.numar_registru,
    km_bord: pv.km_bord,
    nivel_rezervor: pv.nivel_rezervor,
    numar_chei: pv.numar_chei,
    stare_generala: pv.stare_generala,
    anvelope: pv.anvelope,
    documente_bord: pv.documente_bord,
    dotari: pv.dotari,
    daune_constatate: pv.daune_constatate,
    daune: citesteDaune(pv.daune),
    observatii: pv.observatii,
    finalizat_la: pv.finalizat_la,
    confirmat_predator_la: pv.confirmat_predator_la,
    confirmat_primitor_la: pv.confirmat_primitor_la,
    anulat_la: pv.anulat_la,
    motiv_anulare: pv.motiv_anulare,
  };
  const etichete = { categorie: ETICHETE_CATEGORIE, combustibil: ETICHETE_COMBUSTIBIL };

  if (instantaneu !== null) {
    const firma = instantaneu.firma.denumire ?? vii.firma;
    return {
      pv: date,
      vehicul: instantaneu.vehicul,
      predator: instantaneu.predator,
      primitor: instantaneu.primitor,
      reprezentant: instantaneu.reprezentant,
      firma,
      documente: instantaneu.documente,
      etichete,
    };
  }
  return {
    pv: date,
    vehicul: vii.vehicul ?? VEHICUL_NECUNOSCUT,
    predator: parteVie(pv.predator_employee_id, pv.predator, vii.firma),
    primitor: parteVie(pv.primitor_employee_id, pv.primitor, vii.firma),
    reprezentant: null,
    firma: vii.firma,
    documente: vii.documente,
    etichete,
  };
}
