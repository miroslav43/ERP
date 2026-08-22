// src/domain/ticketing/stari.ts
// Mașina de stări a tichetelor și cine are voie să facă fiecare tranziție.
//
// Aceleași reguli există și în `internal.tickets_valideaza_tranzitia`
// (0045_ticketing_it.sql). Duplicarea e deliberată și are o singură direcție de
// autoritate: baza decide, aici doar anticipăm, ca interfața să nu ofere butoane
// care ar fi respinse. Integritatea nu poate depinde de client — cine apelează
// direct PostgREST ocolește tot ce e scris în TypeScript.
//
// Testele din `stari.test.ts` verifică lista de tranziții; dacă o schimbi aici,
// schimb-o și în migrație, altfel interfața și baza încep să nu mai fie de acord.

export const TIPURI_TICHET = ["software", "hardware", "defectiune", "bug_erp"] as const;
export type TipTichet = (typeof TIPURI_TICHET)[number];

export const STATUSURI_TICHET = [
  "nou",
  "in_aprobare",
  "respins",
  "in_lucru",
  "in_asteptare",
  "rezolvat",
  "inchis",
  "anulat",
  "redeschis",
] as const;
export type StatusTichet = (typeof STATUSURI_TICHET)[number];

/** Tipurile care trec prin aprobare. Proprietate a tipului, nu alegere. */
export const TIPURI_CU_APROBARE: ReadonlySet<TipTichet> = new Set(["software", "hardware"]);

export function cereAprobare(tip: TipTichet): boolean {
  return TIPURI_CU_APROBARE.has(tip);
}

/** Statusul cu care se naște un tichet, în funcție de tip. */
export function statusInitial(tip: TipTichet): StatusTichet {
  return cereAprobare(tip) ? "in_aprobare" : "nou";
}

/** Statusuri din care tichetul nu mai poate ieși decât prin redeschidere. */
export const STATUSURI_FINALE: ReadonlySet<StatusTichet> = new Set(["inchis", "anulat", "respins"]);

const TRANZITII: Readonly<Record<StatusTichet, readonly StatusTichet[]>> = {
  // Fără `in_aprobare`: tipurile care cer aprobare se nasc direct acolo
  // (`statusInitial`), iar defecțiunea și bug-ul nu trec niciodată prin
  // aprobare. Tranziția ar fi fost moartă și, mai rău, singura care scăpa
  // neautorizată — prinsă de test.
  nou: ["in_lucru", "anulat"],
  in_aprobare: ["respins", "in_lucru", "anulat"],
  respins: ["anulat", "redeschis"],
  in_lucru: ["in_asteptare", "rezolvat", "anulat"],
  in_asteptare: ["in_lucru", "rezolvat", "anulat"],
  rezolvat: ["inchis", "redeschis"],
  inchis: ["redeschis"],
  anulat: [],
  redeschis: ["in_lucru", "anulat"],
};

export function tranzitiiPosibile(din: StatusTichet): readonly StatusTichet[] {
  return TRANZITII[din];
}

export function tranzitiePermisa(din: StatusTichet, catre: StatusTichet): boolean {
  return TRANZITII[din].includes(catre);
}

/**
 * Drepturile actorului asupra tichetului, așa cum le vede și baza de date.
 * `poateAproba` e deja fals pentru solicitant — auto-aprobarea nu există,
 * indiferent de rol: un patron care își cere un laptop are nevoie tot de
 * decizia altcuiva.
 */
export type DrepturiActor = Readonly<{
  esteSolicitant: boolean;
  /** Manager direct al solicitantului, sau `tickets:approve` = all. */
  poateAproba: boolean;
  /** `tickets:update` = all, ori administrator de platformă (bug_erp). */
  poateOpera: boolean;
}>;

export type MotivRefuz = "tranzitie_invalida" | "fara_drept";

export type RezultatTranzitie =
  Readonly<{ permisa: true }> | Readonly<{ permisa: false; motiv: MotivRefuz }>;

export function poateSchimbaStatusul(
  din: StatusTichet,
  catre: StatusTichet,
  drepturi: DrepturiActor,
): RezultatTranzitie {
  if (!tranzitiePermisa(din, catre)) return { permisa: false, motiv: "tranzitie_invalida" };

  // Decizia asupra unei cereri: doar managerul direct sau patronul.
  if (din === "in_aprobare" && (catre === "in_lucru" || catre === "respins")) {
    return drepturi.poateAproba ? { permisa: true } : { permisa: false, motiv: "fara_drept" };
  }

  // Prelucrarea propriu-zisă: echipa care rezolvă.
  if (
    catre === "rezolvat" ||
    catre === "in_asteptare" ||
    (catre === "in_lucru" && din !== "in_aprobare")
  ) {
    return drepturi.poateOpera ? { permisa: true } : { permisa: false, motiv: "fara_drept" };
  }

  // Anulare, închidere, redeschidere: și solicitantul, și echipa.
  if (catre === "anulat" || catre === "inchis" || catre === "redeschis") {
    return drepturi.esteSolicitant || drepturi.poateOpera
      ? { permisa: true }
      : { permisa: false, motiv: "fara_drept" };
  }

  // Refuz implicit. Orice tranziție adăugată în `TRANZITII` fără o ramură de
  // autorizare mai sus va fi respinsă, nu permisă tăcut — exact greșeala pe
  // care a prins-o testul cu `nou → in_aprobare`.
  return { permisa: false, motiv: "fara_drept" };
}

/** Tranzițiile pe care actorul le poate oferi efectiv în interfață. */
export function tranzitiiOferite(
  din: StatusTichet,
  drepturi: DrepturiActor,
): readonly StatusTichet[] {
  return tranzitiiPosibile(din).filter(
    (catre) => poateSchimbaStatusul(din, catre, drepturi).permisa,
  );
}
