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

/**
 * Decizia asupra unei cereri: ieșirea din `in_aprobare` spre `in_lucru`
 * (aprobare) sau `respins`. Are o singură cale în interfață — `DecizieCerere`
 * / `decideTichet`, care scrie și `motiv_respingere`; oferită ca simplu buton
 * de stare, respingerea lovea `tickets_respingere_ck` și dădea eroare generică.
 */
export function esteDecizie(din: StatusTichet, catre: StatusTichet): boolean {
  return din === "in_aprobare" && (catre === "in_lucru" || catre === "respins");
}

export function poateSchimbaStatusul(
  din: StatusTichet,
  catre: StatusTichet,
  drepturi: DrepturiActor,
): RezultatTranzitie {
  if (!tranzitiePermisa(din, catre)) return { permisa: false, motiv: "tranzitie_invalida" };

  // Decizia asupra unei cereri: doar managerul direct sau patronul.
  if (esteDecizie(din, catre)) {
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

/**
 * Ce i se oferă SOLICITANTULUI în portal, pe propriul tichet.
 *
 * Deliberat mai îngust decât `tranzitiiOferite(din, { esteSolicitant: true, … })`:
 * aceea ar da și `respins → redeschis` — permis în domeniu și în bază, dar din
 * `redeschis` se trece în `in_lucru` fără nicio decizie, deci o cerere respinsă
 * ar ocoli reaprobarea — și `anulat`, care e definitiv și ar cere o confirmare.
 * Portalul oferă doar ce poate face omul fără să-și facă rău: confirmă
 * rezolvarea sau o contestă.
 */
export function tranzitiiSolicitantului(din: StatusTichet): readonly StatusTichet[] {
  switch (din) {
    case "rezolvat":
      return ["inchis", "redeschis"];
    case "inchis":
      return ["redeschis"];
    default:
      return [];
  }
}

/**
 * Butoanele de stare de pe pagina tichetului din aplicație (`/ticketing/[id]`).
 *
 * · Solicitantul care nu operează primește EXACT ce primește în portal
 *   (`tranzitiiSolicitantului`). Altfel un manager sau un `hr` care își cere un
 *   laptop își redeschidea, de aici, cererea respinsă și ocolea reaprobarea —
 *   ocolișul închis doar în portal.
 * · Ceilalți primesc `tranzitiiOferite`, fără decizii: decizia asupra unei
 *   cereri are o singură cale, `DecizieCerere` → `decideTichet`, care scrie și
 *   `motiv_respingere` (MGR-011).
 */
export function tranzitiiPeTichet(
  din: StatusTichet,
  drepturi: DrepturiActor,
): readonly StatusTichet[] {
  if (drepturi.esteSolicitant && !drepturi.poateOpera) return tranzitiiSolicitantului(din);
  return tranzitiiOferite(din, drepturi).filter((catre) => !esteDecizie(din, catre));
}
