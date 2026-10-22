// src/schemas/flota-amenzi.ts
// Validările de intrare pentru amenzile și incidentele flotei (0206, F11).
//
// Fișier separat de `fleet.ts`, pe care îl scriu și fazele paralele ale
// flotei. Regulile de formă le repetă pe cele ale bazei (CHECK-urile `vf_*` și
// `vi_*`, refuzurile triggerelor), ca omul să afle pe câmp, înainte de bază, ce
// nu se potrivește. Tranzițiile de stadiu le judecă baza (`amenzi_inainte`,
// `incidente_inainte`); aici se verifică doar ce trebuie completat ca să intre
// într-un stadiu.

import { z } from "zod";

import { STADII_INCIDENT, TIPURI_INCIDENT, cerintaStadiuIncident } from "@/domain/fleet/amenzi";

import { dataObligatorie, dataOptionala, idOptional } from "./flota-fiscal";
import { dataOraRomania, numarOptional, textOptional } from "./comun";

const MESAJ_NUMAR_PV = "Scrieți numărul procesului-verbal sau al solicitării.";
const MESAJ_SOFER = "Alegeți șoferul pe care îl comunicați autorității.";

/** Câmpurile unei amenzi, comune înregistrării și corecturii. */
const campuriAmenda = {
  numar_pv: z
    .string(MESAJ_NUMAR_PV)
    .trim()
    .min(1, MESAJ_NUMAR_PV)
    .max(60, "Numărul are cel mult 60 de caractere."),
  data_pv: dataOptionala,
  constatata_la: dataOraRomania("faptei"),
  locul: textOptional(200),
  fapta: z
    .string("Scrieți fapta constatată, în cel puțin 3 caractere.")
    .trim()
    .min(3, "Scrieți fapta constatată, în cel puțin 3 caractere.")
    .max(500, "Fapta are cel mult 500 de caractere."),
  autoritate: textOptional(200),
  suma: numarOptional({
    min: 0,
    max: 1_000_000,
    mesaj: "Suma trebuie să fie un număr.",
    interval: "Suma e între 0 și 1.000.000 lei.",
  }),
  primita_la: dataObligatorie("Scrieți data la care ați primit documentul."),
  termen_raspuns: dataOptionala,
  observatii: textOptional(1000),
};

/** Ordinea datelor, pe șiruri `AAAA-LL-ZZ` (se compară lexicografic). */
function verificaDatele(
  v: Readonly<{ data_pv: string | null; primita_la: string; termen_raspuns: string | null }>,
  ctx: z.RefinementCtx,
): void {
  if (v.data_pv !== null && v.primita_la < v.data_pv) {
    ctx.addIssue({
      code: "custom",
      path: ["primita_la"],
      message: "Data primirii nu poate fi înaintea datei procesului-verbal.",
    });
  }
  if (v.termen_raspuns !== null && v.termen_raspuns < v.primita_la) {
    ctx.addIssue({
      code: "custom",
      path: ["termen_raspuns"],
      message: "Termenul de răspuns nu poate fi înaintea datei primirii.",
    });
  }
}

/** O amendă nouă. Intră mereu în stadiul „primită” (o pinuiește politica). */
export const amendaNouaSchema = z
  .object({ vehicle_id: z.uuid("Vehiculul nu este valid."), ...campuriAmenda })
  .superRefine(verificaDatele);
export type AmendaNoua = z.output<typeof amendaNouaSchema>;

/**
 * Corectura unei amende: aceleași câmpuri, fără vehicul. O amendă pe vehiculul
 * greșit se șterge (cât e neatinsă) și se înregistrează din nou.
 */
export const actualizeazaAmendaSchema = z
  .object({ id: z.uuid("Amenda nu este validă."), ...campuriAmenda })
  .superRefine(verificaDatele);
export type ActualizareAmenda = z.output<typeof actualizeazaAmendaSchema>;

export const desemneazaSoferSchema = z.object({
  id: z.uuid("Amenda nu este validă."),
  employee_id: z.uuid(MESAJ_SOFER),
});
export type DesemnareSofer = z.output<typeof desemneazaSoferSchema>;

export const retrageDesemnareaSchema = z.object({ id: z.uuid("Amenda nu este validă.") });

/** Răspunsul către autoritate a plecat: data și, opțional, numărul de ieșire. */
export const trimiteRaspunsSchema = z.object({
  id: z.uuid("Amenda nu este validă."),
  raspuns_trimis_la: dataObligatorie("Scrieți data la care a plecat răspunsul."),
  raspuns_numar: textOptional(60),
});
export type TrimitereRaspuns = z.output<typeof trimiteRaspunsSchema>;

const MESAJ_MOTIV = "Scrieți motivul anulării.";

/**
 * Stadiile fără acțiune proprie: plătită, contestată, anulată (cu motiv).
 * „Șofer desemnat” și „răspuns trimis” au schemele lor, fiindcă cer date.
 */
export const schimbaStadiulAmenziiSchema = z.discriminatedUnion("stadiu", [
  z.object({ id: z.uuid("Amenda nu este validă."), stadiu: z.literal("platita") }),
  z.object({ id: z.uuid("Amenda nu este validă."), stadiu: z.literal("contestata") }),
  z.object({
    id: z.uuid("Amenda nu este validă."),
    stadiu: z.literal("anulata"),
    motiv: z
      .string(MESAJ_MOTIV)
      .trim()
      .min(3, MESAJ_MOTIV)
      .max(500, "Motivul are cel mult 500 de caractere."),
  }),
]);
export type SchimbareStadiuAmenda = z.output<typeof schimbaStadiulAmenziiSchema>;

export const stergeAmendaSchema = z.object({ id: z.uuid("Amenda nu este validă.") });

// ── Incidentele ─────────────────────────────────────────────────────────────

const MESAJ_DESCRIERE = "Descrieți incidentul, în cel puțin 3 caractere.";

const costuri = (ce: string) =>
  numarOptional({
    min: 0,
    max: 100_000_000,
    mesaj: `${ce} trebuie să fie un număr.`,
    interval: `${ce} e între 0 și 100.000.000 lei.`,
  });

const detaliiIncident = {
  tip: z.enum(TIPURI_INCIDENT, "Alegeți tipul incidentului."),
  produs_la: dataOraRomania("incidentului"),
  locul: textOptional(200),
  descriere: z
    .string(MESAJ_DESCRIERE)
    .trim()
    .min(3, MESAJ_DESCRIERE)
    .max(2000, "Descrierea are cel mult 2.000 de caractere."),
  sofer_id: idOptional,
  cost_estimat: costuri("Costul estimat"),
  observatii: textOptional(1000),
};

/** Un incident nou. Intră mereu în stadiul „raportat”. */
export const incidentNouSchema = z.object({
  vehicle_id: z.uuid("Vehiculul nu este valid."),
  ...detaliiIncident,
});
export type IncidentNou = z.output<typeof incidentNouSchema>;

/**
 * Declarația șoferului din portal („Mașina mea”, 0206 §F). Doar ce știe el:
 * vehiculul, tipul, momentul, locul și ce s-a întâmplat. Șoferul și declarantul
 * nu se trimit (îi pune baza), iar costurile, asigurătorul și dosarul le
 * completează responsabilul de flotă (politica le refuză declarantului).
 */
export const declaratieIncidentSchema = z.object({
  vehicle_id: z.uuid("Alegeți vehiculul."),
  tip: detaliiIncident.tip,
  produs_la: detaliiIncident.produs_la,
  locul: detaliiIncident.locul,
  descriere: detaliiIncident.descriere,
});
export type DeclaratieIncident = z.output<typeof declaratieIncidentSchema>;

/** Detaliile editabile ale unui incident deschis; stadiul are acțiunea lui. */
export const actualizeazaIncidentSchema = z.object({
  id: z.uuid("Incidentul nu este valid."),
  ...detaliiIncident,
  despagubire: costuri("Despăgubirea"),
  asigurator: textOptional(200),
  dosar_numar: textOptional(60),
  work_accident_id: idOptional,
});
export type ActualizareIncident = z.output<typeof actualizeazaIncidentSchema>;

/**
 * Schimbarea stadiului. Ce cere baza ca să intre în stadiu (asigurătorul la
 * „la asigurător”, costul final la „închis”) se verifică aici, pe câmpul lui.
 */
export const schimbaStadiulIncidentuluiSchema = z
  .object({
    id: z.uuid("Incidentul nu este valid."),
    stadiu: z.enum(STADII_INCIDENT, "Alegeți stadiul incidentului."),
    cost_final: costuri("Costul final"),
    despagubire: costuri("Despăgubirea"),
    asigurator: textOptional(200),
    dosar_numar: textOptional(60),
  })
  .superRefine((v, ctx) => {
    const cerinta = cerintaStadiuIncident(v.stadiu, {
      asigurator: v.asigurator,
      cost_final: v.cost_final,
    });
    if (cerinta === null) return;
    ctx.addIssue({
      code: "custom",
      path: [v.stadiu === "inchis" ? "cost_final" : "asigurator"],
      message: cerinta,
    });
  });
export type SchimbareStadiuIncident = z.output<typeof schimbaStadiulIncidentuluiSchema>;

export const stergeIncidentSchema = z.object({ id: z.uuid("Incidentul nu este valid.") });
