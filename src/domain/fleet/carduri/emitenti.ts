// src/domain/fleet/carduri/emitenti.ts
//
// Emitenții de carduri de combustibil (F12b, 0214).
//
// În bază emitentul e TEXT cu CHECK (`^[a-z][a-z0-9_]{1,30}$`), nu enum:
// rețelele se vând și se redenumesc (programul Lukoil din România, cardurile
// OMV procesate de WEX din 2021). Lista cunoscută trăiește aici, cu `altul`
// pentru orice altceva; o rețea nouă e un rând nou, nu o migrare.

export const EMITENTI_CARD = [
  "omv_petrom",
  "mol",
  "lukoil",
  "rompetrol",
  "dkv",
  "shell",
  "eurowag",
  "altul",
] as const;

export type EmitentCard = (typeof EMITENTI_CARD)[number];

export const ETICHETE_EMITENT: Readonly<Record<EmitentCard, string>> = {
  omv_petrom: "OMV Petrom (Routex)",
  mol: "MOL",
  lukoil: "Lukoil",
  rompetrol: "Rompetrol",
  dkv: "DKV",
  shell: "Shell",
  eurowag: "Eurowag",
  altul: "Alt emitent",
};

export function esteEmitent(valoare: string): valoare is EmitentCard {
  return (EMITENTI_CARD as readonly string[]).includes(valoare);
}

/** Eticheta afișată; un emitent necunoscut aplicației (scris de altă versiune) apare ca atare. */
export function etichetaEmitent(emitent: string): string {
  return esteEmitent(emitent) ? ETICHETE_EMITENT[emitent] : emitent;
}
