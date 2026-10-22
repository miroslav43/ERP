// src/domain/fleet/contabil/test-linii.ts
//
// Fabrica de linii și de configurări pentru testele exportului contabil. Doar
// pentru `*.test.ts`: nu se importă din cod de producție.
import { CONFIGURARE_IMPLICITA, type ConfigurareExport, type FirmaExport } from "./configurare";
import type { LinieCost } from "./linii";

export const FIRMA: FirmaExport = {
  denumire: "Firma Test SRL",
  cui: "12345678",
  platitorTva: true,
};

let contor = 0;

/**
 * Un id de forma uuid. Cu `n`, determinist (`idTest(1)` e mereu același); fără,
 * unul nou la fiecare apel, pe alt prefix, ca să nu se ciocnească cu cele numerotate.
 */
export function idTest(n?: number): string {
  if (n !== undefined) return `${n.toString(16).padStart(8, "0")}-1111-4111-8111-111111111111`;
  contor += 1;
  return `${contor.toString(16).padStart(8, "0")}-2222-4222-8222-222222222222`;
}

export function linie(m: Partial<LinieCost> = {}): LinieCost {
  return {
    id: m.id ?? idTest(),
    sursa: "alimentare",
    data: "2026-10-03",
    categorie: "combustibil",
    totalBani: 10_000,
    vehicul: { id: "aaaaaaaa-1111-4111-8111-111111111111", nr: "B123ABC", masaMaximaKg: 1800 },
    sofer: "Popescu Ion",
    document: "4521",
    furnizor: "OMV Pipera",
    cuiFurnizor: "1590082",
    sursaAreCui: true,
    litri: 30,
    detaliu: "Motorină",
    regimDeclarat: "integral",
    stareFoaie: "aprobat",
    foaieStearsa: false,
    peCardDeFlota: false,
    ...m,
  };
}

export function configurare(m: Partial<ConfigurareExport> = {}): ConfigurareExport {
  return { ...CONFIGURARE_IMPLICITA, ...m };
}
