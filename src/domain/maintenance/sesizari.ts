// src/domain/maintenance/sesizari.ts
//
// Mașina de stări a sesizării de defecțiune — partea PURĂ, fără bază și fără
// React. Ecranul întreabă aici ce butoane să arate; triggerul din bază
// (`internal.fault_reports_garda`, 0181) rămâne judecătorul final. Cele două
// trebuie să spună același lucru, iar `sesizari.test.ts` e locul unde se citește
// contractul dintr-o privire.
//
// Trei actori, aceiași ca în gardă:
//   · GESTIONARUL — `maintenance:update ≥ team`: triază, atribuie, respinge,
//     rezolvă, închide, redeschide; poate tot.
//   · TEHNICIANUL — fișa lui e `atribuit_employee_id`: lucrează sesizarea LUI
//     (în lucru ↔ în așteptare, rezolvat), indiferent de rol.
//   · RAPORTORUL — fișa lui e `raportat_de_employee_id`: o retrage cât e nouă
//     sau în analiză, confirmă rezolvarea (închis) sau o contestă (redeschide).

import type { StatusSesizare } from "@/schemas/maintenance";

/** Stările din care nu se mai iese. */
export const STARI_TERMINALE_SESIZARE: readonly StatusSesizare[] = ["inchis", "respins", "retrasa"];

/**
 * Stările în care sesizarea e încă „deschisă" — ce intră în coada de triaj și
 * în `.in("status", …)` al acțiunilor. `rezolvat` NU e deschisă (lucrarea s-a
 * făcut), dar nici terminală: așteaptă confirmarea raportorului.
 */
export const STARI_DESCHISE_SESIZARE: readonly StatusSesizare[] = [
  "nou",
  "in_analiza",
  "in_lucru",
  "in_asteptare",
];

/** Stările care încă blochează utilajul, dacă sesizarea l-a oprit. */
export const STARI_BLOCANTE_SESIZARE: readonly StatusSesizare[] = STARI_DESCHISE_SESIZARE;

export type TranzitieSesizare = Exclude<StatusSesizare, "nou">;

export interface ActorSesizare {
  /** `can(permisiuni, "maintenance:update", "team")`. */
  readonly poateGestiona: boolean;
  /** Fișa actorului e tehnicianul atribuit. */
  readonly esteTehnician?: boolean;
  /** Fișa actorului e raportorul. */
  readonly esteRaportor?: boolean;
}

/** Tranzițiile pe care le admite structura, oricine ar fi actorul — oglinda gărzii. */
const TRANZITII: Readonly<Record<StatusSesizare, readonly TranzitieSesizare[]>> = {
  nou: ["in_analiza", "in_lucru", "respins", "retrasa"],
  in_analiza: ["in_lucru", "in_asteptare", "respins", "retrasa"],
  in_lucru: ["rezolvat", "in_asteptare", "in_analiza"],
  in_asteptare: ["in_lucru", "respins"],
  rezolvat: ["inchis", "in_lucru"],
  inchis: [],
  respins: [],
  retrasa: [],
};

export function esteTerminala(status: StatusSesizare): boolean {
  return STARI_TERMINALE_SESIZARE.includes(status);
}

export function esteDeschisa(status: StatusSesizare): boolean {
  return STARI_DESCHISE_SESIZARE.includes(status);
}

/** Tranziția e permisă STRUCTURAL (fără să țină cont de actor). */
export function tranzitiePermisa(din: StatusSesizare, spre: TranzitieSesizare): boolean {
  return TRANZITII[din].includes(spre);
}

/**
 * Ce poate face actorul cu o sesizare aflată în `status`.
 *
 * Ordinea întoarsă e ordinea butoanelor: întâi pașii înainte, apoi rezolvarea,
 * la coadă respingerea și retragerea (distructive, vizual separate). Starea
 * curentă nu e niciodată ofertă: pe o sesizare deja în analiză, „În analiză”
 * nu are ce face și nu apare.
 */
export function tranzitiiPermise(
  status: StatusSesizare,
  actor: ActorSesizare,
): readonly TranzitieSesizare[] {
  if (esteTerminala(status)) return [];
  const structurale = TRANZITII[status];
  if (actor.poateGestiona) {
    // Gestionarul nu „retrage” — retragerea e gestul raportorului; el respinge.
    // Nici nu „închide” din rezolvat în locul raportorului fără confirmare —
    // dar poate, dacă raportorul nu mai e în firmă: rămâne la el.
    return structurale.filter((t) => t !== "retrasa" || actor.esteRaportor === true);
  }
  const permise: TranzitieSesizare[] = [];
  if (actor.esteTehnician === true) {
    // O începe (din nouă sau din analiză, odată atribuită), o pune în așteptare
    // și o reia, o rezolvă. Nu o triază și nu o respinge: acelea sunt ale gestionarului.
    if (status === "nou" || status === "in_analiza" || status === "in_asteptare") {
      permise.push("in_lucru");
    }
    if (status === "in_lucru") permise.push("in_asteptare", "rezolvat");
  }
  if (actor.esteRaportor === true) {
    if (status === "nou" || status === "in_analiza") permise.push("retrasa");
    if (status === "rezolvat") permise.push("inchis", "in_lucru");
  }
  return permise.filter((t) => structurale.includes(t));
}

/** Raportorul își poate edita descrierea și urgența doar cât sesizarea e nouă. */
export function raportorulPoateEdita(status: StatusSesizare, actor: ActorSesizare): boolean {
  return status === "nou" && (actor.esteRaportor === true || actor.poateGestiona);
}

/** Cine poate comenta: oricine o vede. Nota INTERNĂ, doar gestionarul. */
export function poateNotaInterna(actor: ActorSesizare): boolean {
  return actor.poateGestiona;
}
