// src/domain/fleet/carduri/potrivire.ts
//
// Potrivirea tranzacțiilor de card pe vehicul, pe foaia zilei și pe alimentarea
// declarată de șofer (F12b §8.2). Funcție PURĂ: acțiunile adună contextul din
// bază și scriu rezultatul; aici doar se decide.
//
// Pe rând, în ordinea asta:
//   1. stornoul (cantitate sau valoare negativă) → `ignorata`, `corectie`;
//   2. cardul: amprenta numărului întreg, altfel emitentul + cifrele pe SUFIX;
//   3. vehiculul: numărul din extras (vehiculul care îl purta în ziua aceea,
//      chiar dacă a ieșit între timp din parc) > vehiculul cardului >
//      foaia unică a șoferului titular în ziua aceea > alocarea lui la moment;
//   4. ce nu e combustibil (AdBlue inclus) → `necombustibil`;
//   5. foaia: vehiculul + ziua românească + starea ≠ `respins`;
//   6. alimentarea: bonul egal câștigă; altfel litrii și ora în toleranță;
//   7–8. kilometrajul de la pompă și produsul nepotrivit vehiculului doar se
//      adaugă la motiv, fără să schimbe starea.
//
// Toleranțele sunt constante (F12b, Decizia pentru Miro 5, implicita (a)).

import type { CategorieTranzactie, TipCombustibilCard } from "./categorii";
import { cifreSePotrivesc } from "./card";

export const TOLERANTA_LITRI_ABS = 0.5;
export const TOLERANTA_LITRI_REL = 0.01;
export const TOLERANTA_VALOARE_ABS = 1;
export const TOLERANTA_VALOARE_REL = 0.01;
export const TOLERANTA_ORE = 3;

export const STARI_POTRIVIRE = [
  "potrivita",
  "diferenta",
  "fara_alimentare",
  "fara_foaie",
  "vehicul_necunoscut",
  "card_necunoscut",
  "necombustibil",
  "ignorata",
] as const;
export type StarePotrivire = (typeof STARI_POTRIVIRE)[number];

/** Enum-ul `fuel_type` (0012). */
export type TipCombustibilVehicul =
  "benzina" | "motorina" | "gpl" | "gnc" | "electric" | "hibrid" | "hibrid_plugin" | "altul";

export type TranzactieDePotrivit = Readonly<{
  emitent: string;
  /** Cifrele finale din extras (max. 6), dacă extrasul are numărul cardului. */
  cifreCard: string | null;
  /** HMAC-ul numărului întreg, dacă extrasul îl are în clar. */
  amprentaCard: string | null;
  /** Numărul de înmatriculare din extras, normalizat. */
  nrInmatriculare: string | null;
  /** ISO în UTC. */
  efectuatLa: string;
  /** Ziua din ora României. */
  dataRo: string;
  areOra: boolean;
  categorie: CategorieTranzactie;
  tipCombustibil: TipCombustibilCard | null;
  cantitate: number | null;
  valoareBruta: number;
  moneda: string;
  kmDeclarat: number | null;
  numarBon: string | null;
}>;

export type CardContext = Readonly<{
  id: string;
  emitent: string;
  ultimele_cifre: string;
  amprenta_numar: string | null;
  vehicle_id: string | null;
  employee_id: string | null;
}>;

export type VehiculContext = Readonly<{
  id: string;
  /** Normalizat ca în bază (0012 îl normalizează deja la scriere). */
  nr_inmatriculare: string;
  tip_combustibil: TipCombustibilVehicul;
  deleted_at: string | null;
  /**
   * Ziua ieșirii din parc (0218, F12h). Din implicita I-h2, numărul unui
   * vehicul ieșit se poate pune pe o mașină nouă: același număr poate sta pe
   * două vehicule neșterse, iar data ieșirii le desparte.
   */
  data_iesire: string | null;
}>;

export type AlocareContext = Readonly<{
  vehicle_id: string;
  employee_id: string;
  de_la: string;
  pana_la: string | null;
}>;

export type FoaieContext = Readonly<{
  id: string;
  vehicle_id: string;
  employee_id: string;
  data: string | null;
  status: "draft" | "trimis" | "aprobat" | "respins";
  km_plecare: number;
  km_sosire: number | null;
}>;

export type AlimentareContext = Readonly<{
  id: string;
  trip_sheet_id: string;
  litri: number;
  cost: number;
  alimentat_la: string;
  numar_bon: string | null;
}>;

export type ContextPotrivire = Readonly<{
  carduri: readonly CardContext[];
  vehicule: readonly VehiculContext[];
  alocari: readonly AlocareContext[];
  foi: readonly FoaieContext[];
  alimentari: readonly AlimentareContext[];
  /** Alimentările legate deja în bază de ALTE tranzacții. */
  alimentariDejaLegate: ReadonlySet<string>;
}>;

export type RezultatPotrivire = Readonly<{
  cardId: string | null;
  vehicleId: string | null;
  tripSheetId: string | null;
  fuelEntryId: string | null;
  stare: StarePotrivire;
  categorie: CategorieTranzactie;
  motiv: string | null;
}>;

const ETICHETE_COMBUSTIBIL: Readonly<Record<TipCombustibilVehicul, string>> = {
  benzina: "benzină",
  motorina: "motorină",
  gpl: "GPL",
  gnc: "GNC",
  electric: "electric",
  hibrid: "hibrid",
  hibrid_plugin: "hibrid plug-in",
  altul: "alt combustibil",
};

/** Vehiculele care pot lua legitim mai multe produse: fără semnal de produs. */
const FARA_VERIFICARE_PRODUS: ReadonlySet<TipCombustibilVehicul> = new Set([
  "hibrid",
  "hibrid_plugin",
  "altul",
]);

const MS_ORA = 3_600_000;

function cifre(n: number): string {
  return n.toLocaleString("ro-RO", { maximumFractionDigits: 2 });
}

export function tolerantaLitri(cantitate: number): number {
  return Math.max(TOLERANTA_LITRI_ABS, Math.abs(cantitate) * TOLERANTA_LITRI_REL);
}

export function tolerantaValoare(valoare: number): number {
  return Math.max(TOLERANTA_VALOARE_ABS, Math.abs(valoare) * TOLERANTA_VALOARE_REL);
}

type Card = { readonly card: CardContext | null; readonly motiv: string | null };

function gasesteCard(tx: TranzactieDePotrivit, carduri: readonly CardContext[]): Card {
  const aleEmitentului = carduri.filter((c) => c.emitent === tx.emitent);
  if (tx.amprentaCard !== null) {
    const dupaAmprenta = aleEmitentului.find((c) => c.amprenta_numar === tx.amprentaCard);
    if (dupaAmprenta !== undefined) return { card: dupaAmprenta, motiv: null };
  }
  if (tx.cifreCard === null) return { card: null, motiv: null };
  const cifreTx = tx.cifreCard;
  const candidati = aleEmitentului.filter((c) => cifreSePotrivesc(c.ultimele_cifre, cifreTx));
  const [singurul] = candidati;
  if (candidati.length === 1 && singurul !== undefined) return { card: singurul, motiv: null };
  if (candidati.length > 1) {
    return {
      card: null,
      motiv: `Ultimele cifre se potrivesc cu ${String(candidati.length)} carduri; completați numărul întreg pe card.`,
    };
  }
  return { card: null, motiv: null };
}

function inInterval(alocare: AlocareContext, moment: number): boolean {
  const deLa = Date.parse(alocare.de_la);
  const panaLa = alocare.pana_la === null ? Number.POSITIVE_INFINITY : Date.parse(alocare.pana_la);
  return deLa <= moment && moment < panaLa;
}

type Vehicul = { readonly vehicleId: string | null; readonly motive: readonly string[] };

function gasesteVehicul(
  tx: TranzactieDePotrivit,
  card: CardContext | null,
  ctx: ContextPotrivire,
): Vehicul {
  const motive: string[] = [];
  if (tx.nrInmatriculare !== null && tx.nrInmatriculare.length > 0) {
    // Câștigă vehiculul care purta numărul în ziua tranzacției. Din 0218 (I-h2),
    // numărul păstrat al unui vehicul ieșit trece pe o mașină nouă, deci pot fi
    // două neșterse: întâi cel ieșit în ziua tranzacției sau după ea (numărul
    // era încă al lui), apoi cel din parc, apoi oricare neșters, apoi cel șters.
    const cuNumarul = ctx.vehicule.filter((v) => v.nr_inmatriculare === tx.nrInmatriculare);
    const dinParc =
      cuNumarul.find(
        (v) => v.deleted_at === null && v.data_iesire !== null && v.data_iesire >= tx.dataRo,
      ) ??
      cuNumarul.find((v) => v.deleted_at === null && v.data_iesire === null) ??
      cuNumarul.find((v) => v.deleted_at === null) ??
      cuNumarul[0];
    if (dinParc !== undefined) {
      const alCardului = card?.vehicle_id ?? null;
      if (alCardului !== null && alCardului !== dinParc.id) {
        motive.push("Cardul e înregistrat pe alt vehicul.");
      }
      return { vehicleId: dinParc.id, motive };
    }
  }
  const vehiculCard = card?.vehicle_id ?? null;
  if (vehiculCard !== null) return { vehicleId: vehiculCard, motive };
  const titular = card?.employee_id ?? null;
  if (titular !== null) {
    const foiZi = ctx.foi.filter(
      (f) => f.employee_id === titular && f.data === tx.dataRo && f.status !== "respins",
    );
    const vehiculeFoi = [...new Set(foiZi.map((f) => f.vehicle_id))];
    const [singurul] = vehiculeFoi;
    if (vehiculeFoi.length === 1 && singurul !== undefined) return { vehicleId: singurul, motive };
    const moment = Date.parse(tx.efectuatLa);
    const alocari = ctx.alocari.filter((a) => a.employee_id === titular && inInterval(a, moment));
    const vehiculeAlocate = [...new Set(alocari.map((a) => a.vehicle_id))];
    const [alocat] = vehiculeAlocate;
    if (vehiculeAlocate.length === 1 && alocat !== undefined) return { vehicleId: alocat, motive };
    if (vehiculeFoi.length > 1) {
      motive.push(
        `Șoferul titular are ${String(vehiculeFoi.length)} foi în ziua aceasta; legați tranzacția manual.`,
      );
    }
  }
  return { vehicleId: null, motive };
}

type Alimentare = {
  readonly alimentare: AlimentareContext;
  readonly dupaBon: boolean;
};

function bonEgal(a: string | null, b: string | null): boolean {
  if (a === null || b === null) return false;
  const x = a.trim().toLowerCase();
  return x.length > 0 && x === b.trim().toLowerCase();
}

function gasesteAlimentarea(
  tx: TranzactieDePotrivit,
  foaieId: string,
  ctx: ContextPotrivire,
  folosite: ReadonlySet<string>,
): Alimentare | null {
  const libere = ctx.alimentari.filter(
    (a) =>
      a.trip_sheet_id === foaieId && !ctx.alimentariDejaLegate.has(a.id) && !folosite.has(a.id),
  );
  const dupaBon = libere.find((a) => bonEgal(a.numar_bon, tx.numarBon));
  if (dupaBon !== undefined) return { alimentare: dupaBon, dupaBon: true };
  if (tx.cantitate === null) return null;
  const cantitate = tx.cantitate;
  const moment = Date.parse(tx.efectuatLa);
  const tol = tolerantaLitri(cantitate);
  const candidati = libere
    .map((a) => ({
      a,
      dl: Math.abs(a.litri - cantitate),
      dt: Math.abs(Date.parse(a.alimentat_la) - moment),
    }))
    .filter((c) => c.dl <= tol + 1e-9 && (!tx.areOra || c.dt <= TOLERANTA_ORE * MS_ORA))
    .sort((x, y) => x.dl - y.dl || x.dt - y.dt);
  const [cel] = candidati;
  return cel === undefined ? null : { alimentare: cel.a, dupaBon: false };
}

/** Motivul diferenței, cu cifrele; `null` dacă alimentarea e în toleranță. */
function diferenta(tx: TranzactieDePotrivit, a: AlimentareContext): string | null {
  const parti: string[] = [];
  if (
    tx.cantitate !== null &&
    Math.abs(a.litri - tx.cantitate) > tolerantaLitri(tx.cantitate) + 1e-9
  ) {
    parti.push(`litri: card ${cifre(tx.cantitate)}, foaie ${cifre(a.litri)}`);
  }
  // `fuel_entries.cost` e în lei: valoarea se compară doar pe RON.
  if (
    tx.moneda === "RON" &&
    Math.abs(a.cost - tx.valoareBruta) > tolerantaValoare(tx.valoareBruta) + 1e-9
  ) {
    parti.push(`valoare: card ${cifre(tx.valoareBruta)} lei, foaie ${cifre(a.cost)} lei`);
  }
  return parti.length === 0
    ? null
    : `Diferență față de alimentarea declarată (${parti.join("; ")}).`;
}

function motive(lista: readonly (string | null)[]): string | null {
  const curate = lista.filter((m): m is string => m !== null && m.length > 0);
  return curate.length === 0 ? null : curate.join(" ").slice(0, 500);
}

function semnaleFoaie(
  tx: TranzactieDePotrivit,
  foaie: FoaieContext,
  vehicul: VehiculContext | undefined,
): string[] {
  const semnale: string[] = [];
  if (tx.kmDeclarat !== null) {
    const sub = tx.kmDeclarat < foaie.km_plecare;
    const peste = foaie.km_sosire !== null && tx.kmDeclarat > foaie.km_sosire;
    if (sub || peste) {
      const interval = `${String(foaie.km_plecare)}–${foaie.km_sosire === null ? "…" : String(foaie.km_sosire)}`;
      semnale.push(
        `Kilometrajul de la pompă (${String(tx.kmDeclarat)}) e în afara foii (${interval}).`,
      );
    }
  }
  semnale.push(...semnalProdus(tx, vehicul));
  return semnale;
}

function semnalProdus(tx: TranzactieDePotrivit, vehicul: VehiculContext | undefined): string[] {
  if (vehicul === undefined || tx.tipCombustibil === null) return [];
  const tipV = vehicul.tip_combustibil;
  if (FARA_VERIFICARE_PRODUS.has(tipV) || tipV === tx.tipCombustibil) return [];
  // Un vehicul pe GPL pornește și merge și pe benzină.
  if (tipV === "gpl" && tx.tipCombustibil === "benzina") return [];
  return [
    `Produsul (${ETICHETE_COMBUSTIBIL[tx.tipCombustibil]}) nu corespunde vehiculului (${ETICHETE_COMBUSTIBIL[tipV]}).`,
  ];
}

/**
 * Potrivirea unui lot, în ordine. O alimentare legată de o tranzacție a
 * lotului nu se mai leagă de o alta din același lot (nici de una legată deja
 * în bază, `alimentariDejaLegate`).
 */
export function potrivesteTranzactii(
  tranzactii: readonly TranzactieDePotrivit[],
  ctx: ContextPotrivire,
): RezultatPotrivire[] {
  const folosite = new Set<string>();
  return tranzactii.map((tx) => {
    // 1. Stornoul: apare în raport, nu se potrivește.
    if ((tx.cantitate !== null && tx.cantitate < 0) || tx.valoareBruta < 0) {
      return {
        cardId: null,
        vehicleId: null,
        tripSheetId: null,
        fuelEntryId: null,
        stare: "ignorata",
        categorie: "corectie",
        motiv: "Storno din extras.",
      };
    }

    // 2. Cardul.
    const { card, motiv: motivCard } = gasesteCard(tx, ctx.carduri);

    // 3. Vehiculul.
    const { vehicleId, motive: motiveVehicul } = gasesteVehicul(tx, card, ctx);
    const baza = { cardId: card?.id ?? null, categorie: tx.categorie };
    if (vehicleId === null) {
      return {
        ...baza,
        vehicleId: null,
        tripSheetId: null,
        fuelEntryId: null,
        stare: card === null ? "card_necunoscut" : "vehicul_necunoscut",
        motiv: motive([motivCard, ...motiveVehicul]),
      };
    }
    const vehicul = ctx.vehicule.find((v) => v.id === vehicleId);

    // 4. Ce nu e combustibil: cu vehicul, fără foaie.
    if (tx.categorie !== "combustibil") {
      return {
        ...baza,
        vehicleId,
        tripSheetId: null,
        fuelEntryId: null,
        stare: "necombustibil",
        motiv: motive([motivCard, ...motiveVehicul]),
      };
    }

    // 5. Foaia zilei.
    const foaie = ctx.foi.find(
      (f) => f.vehicle_id === vehicleId && f.data === tx.dataRo && f.status !== "respins",
    );
    if (foaie === undefined) {
      return {
        ...baza,
        vehicleId,
        tripSheetId: null,
        fuelEntryId: null,
        stare: "fara_foaie",
        motiv: motive([motivCard, ...motiveVehicul, ...semnalProdus(tx, vehicul)]),
      };
    }
    const semnale = semnaleFoaie(tx, foaie, vehicul);

    // 6. Alimentarea declarată.
    const gasita = gasesteAlimentarea(tx, foaie.id, ctx, folosite);
    if (gasita === null) {
      return {
        ...baza,
        vehicleId,
        tripSheetId: foaie.id,
        fuelEntryId: null,
        stare: "fara_alimentare",
        motiv: motive([motivCard, ...motiveVehicul, ...semnale]),
      };
    }
    folosite.add(gasita.alimentare.id);
    const dif = diferenta(tx, gasita.alimentare);
    return {
      ...baza,
      vehicleId,
      tripSheetId: foaie.id,
      fuelEntryId: gasita.alimentare.id,
      stare: dif === null ? "potrivita" : "diferenta",
      motiv: motive([motivCard, ...motiveVehicul, dif, ...semnale]),
    };
  });
}
