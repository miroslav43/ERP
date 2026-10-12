// src/app/(app)/mentenanta/iscir/dosar-control.ts
//
// „Dosarul de control” (M7): liniile comune exportului CSV și celui PDF —
// autorizațiile ISCIR CURENTE și planurile active de tip `verificare_legala`.
// Funcție pură: ruta citește, aici doar se compune, ca cele două formate să nu
// poată spune lucruri diferite despre același utilaj.
//
// „Temei” = temeiul legal: pe autorizație, cel al categoriei legale care îi
// acoperă tipul (`categoriePentruTipIscir`, cu ⚠ când nu e verificat pe text);
// emitentul documentului (ISCIR, RSVTI, o firmă autorizată) nu e un temei și
// stă la observații.

import type { AutorizatieIscir, PlanMentenanta } from "@/lib/queries/maintenance";
import {
  ETICHETE_REGIM_ISCIR,
  ETICHETE_STARE_AUTORIZATIE,
  avertismentMaximLegal,
  categoriePentruTipIscir,
  etichetaTipIscir,
  stareAutorizatie,
} from "@/domain/maintenance/iscir";
import { categorieLegala, temeiPentruPlan } from "@/domain/maintenance/legal";
import { stareScadentaData } from "@/domain/maintenance/scadente";

import { ETICHETE_STARE_SCADENTA } from "../etichete";

export type LinieDosarControl = Readonly<{
  echipament: string;
  ce: string;
  categorie: string;
  temei: string;
  numar: string;
  /** Emiterea autorizației sau ultima execuție a verificării (ISO sau gol). */
  emisa: string;
  valabilaPana: string;
  urmatoareaVerificare: string;
  stare: string;
  /** Linia cere atenție: expirată, suspendată sau în întârziere (roșu în PDF). */
  rosu: boolean;
  observatii: string;
}>;

export const ANTET_DOSAR_CONTROL: readonly string[] = [
  "Echipament",
  "Ce",
  "Categorie / tip",
  "Temei",
  "Număr / regim",
  "Emisă / ultima execuție",
  "Valabilă până la",
  "Următoarea verificare",
  "Stare",
  "Observații",
];

/** Linia ca rând de tabel, în ordinea din `ANTET_DOSAR_CONTROL`. */
export function coloaneLinie(l: LinieDosarControl): readonly string[] {
  return [
    l.echipament,
    l.ce,
    l.categorie,
    l.temei,
    l.numar,
    l.emisa,
    l.valabilaPana,
    l.urmatoareaVerificare,
    l.stare,
    l.observatii,
  ];
}

type AutorizatieDosar = Pick<
  AutorizatieIscir,
  | "equipment_id"
  | "numar"
  | "tip"
  | "emitent"
  | "emis_la"
  | "valabil_pana"
  | "scadenta_verificare_tehnica"
  | "conditii"
  | "suspendata_la"
  | "regim"
  | "motiv_suspendare"
  | "inlocuita_de_id"
>;

type PlanDosar = Pick<
  PlanMentenanta,
  | "equipment_id"
  | "denumire"
  | "tip"
  | "categorie_legala"
  | "temei_legal"
  | "ultima_executie"
  | "urmatoarea_scadenta"
  | "amanat_pana"
>;

export function liniiDosarControl(
  intrare: Readonly<{
    autorizatii: readonly AutorizatieDosar[];
    planuri: readonly PlanDosar[];
    numeEchipament: (id: string) => string;
    azi: string;
  }>,
): readonly LinieDosarControl[] {
  const { numeEchipament, azi } = intrare;

  const autorizatii = intrare.autorizatii
    // Rândul înlocuit prin reînnoire e istoric, nu intră în dosar.
    .filter((a) => a.inlocuita_de_id === null)
    .map((a): LinieDosarControl => {
      const stare = stareAutorizatie(a, azi);
      const categorie = categoriePentruTipIscir(a.tip);
      const observatii = [
        `Emitent: ${a.emitent}`,
        a.suspendata_la === null
          ? null
          : `Suspendată la ${a.suspendata_la}${a.motiv_suspendare === null ? "" : `: ${a.motiv_suspendare}`}`,
        avertismentMaximLegal(a),
        a.conditii === null ? null : `Condiții: ${a.conditii}`,
      ].filter((v): v is string => v !== null);
      return {
        echipament: numeEchipament(a.equipment_id),
        ce: "Autorizație ISCIR",
        categorie: etichetaTipIscir(a.tip),
        temei: categorie === null ? "" : temeiPentruPlan(categorie),
        numar: a.numar ?? ETICHETE_REGIM_ISCIR[a.regim],
        emisa: a.emis_la ?? "",
        valabilaPana: a.valabil_pana,
        urmatoareaVerificare: a.scadenta_verificare_tehnica ?? "",
        stare: ETICHETE_STARE_AUTORIZATIE[stare],
        rosu: stare === "expirata" || stare === "suspendata",
        observatii: observatii.join(" · "),
      };
    });

  const planuri = intrare.planuri
    .filter((p) => p.tip === "verificare_legala")
    .map((p): LinieDosarControl => {
      const categorie = categorieLegala(p.categorie_legala);
      const stare = stareScadentaData(p.urmatoarea_scadenta, azi);
      return {
        echipament: numeEchipament(p.equipment_id),
        ce: `Verificare legală: ${p.denumire}`,
        categorie: categorie?.eticheta ?? "",
        temei: p.temei_legal ?? (categorie === null ? "" : temeiPentruPlan(categorie)),
        numar: "",
        emisa: p.ultima_executie ?? "",
        valabilaPana: "",
        urmatoareaVerificare: p.urmatoarea_scadenta ?? "",
        stare: ETICHETE_STARE_SCADENTA[stare],
        rosu: stare === "in_intarziere",
        observatii: p.amanat_pana === null ? "" : `Amânată până la ${p.amanat_pana}`,
      };
    });

  return [...autorizatii, ...planuri];
}
