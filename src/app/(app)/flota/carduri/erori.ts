// src/app/(app)/flota/carduri/erori.ts
// Traducerea erorilor Postgres ale cardurilor de combustibil (0214, F12b).
//
// Fișier propriu, nu un bloc în `flota/erori.ts`: acela îl ating fazele
// paralele ale flotei. Mesajele P0001 din 0214 sunt scrise pentru utilizator,
// cu ș/ț corecte, deci se propagă ca atare; aici se decide doar CÂMPUL pe care
// cad, ca eroarea să ajungă în caseta vinovată, nu într-un banner.

import { businessRule, invalidInput, isPostgrestError } from "@/lib/actions/errors";

/** Indexurile unice din 0214: numele lor apare în mesajul Postgres. */
const UNICITATI: readonly (readonly [string, string, string])[] = [
  ["fcard_amprenta_uq", "numar", "Cardul este deja înregistrat."],
  ["fctx_dedup_uq", "cheie_dedup", "Tranzacția a fost deja importată."],
  ["fctx_alimentare_uq", "fuel_entry_id", "Alimentarea e deja legată de altă tranzacție."],
  [
    "fcip_org_emitent_uq",
    "emitent",
    "Maparea acestui emitent a fost salvată între timp de altcineva. Reîncărcați pagina și reîncercați.",
  ],
];

/** Restricțiile de formă din 0214 care pot scăpa de Zod (un apel direct al acțiunii). */
const RESTRICTII: readonly (readonly [string, string, string])[] = [
  ["fcard_denumire_len", "denumire", "Denumirea cardului are cel mult 80 de caractere."],
  ["fcard_observatii_len", "observatii", "Observațiile au cel mult 1000 de caractere."],
  ["fcard_cifre_ck", "numar", "Pe card se păstrează doar ultimele 4–6 cifre."],
  ["fcard_tinta_ck", "tinta", "Cardul e pe un vehicul sau pe un șofer, nu pe amândoi."],
  ["fctx_stare_ck", "stare_potrivire", "Starea tranzacției nu se potrivește cu legătura ei."],
];

/** Câmpul refuzurilor triggerelor din 0214, după începutul mesajului. */
const CAMPURI_DUPA_MESAJ: readonly (readonly [RegExp, string])[] = [
  [/^Vehiculul ales pentru card/u, "tinta"],
  [/^Șoferul ales pentru card/u, "tinta"],
  [/^Emitentul și firma unui card/u, "emitent"],
  [/^Numărul unui card nu se schimbă/u, "numar"],
  [/^Spuneți de ce ignorați/u, "nota"],
  [/^Alimentarea aleasă/u, "fuel_entry_id"],
];

/**
 * Tip `never`: apelul întrerupe fluxul exact ca un `throw`, deci TypeScript
 * îngustează corect tipul lui `data` imediat după. Ce nu e recunoscut aici
 * merge mai departe la traducerea generică din `createAction`.
 */
export function traduEroareCarduri(error: unknown): never {
  if (isPostgrestError(error)) {
    if (error.code === "23505") {
      const u = UNICITATI.find(([index]) => error.message.includes(index));
      if (u !== undefined) {
        const [, camp, mesaj] = u;
        throw invalidInput(mesaj, { [camp]: [mesaj] });
      }
    }
    if (error.code === "23514") {
      const r = RESTRICTII.find(([nume]) => error.message.includes(nume));
      if (r !== undefined) {
        const [, camp, mesaj] = r;
        throw invalidInput(mesaj, { [camp]: [mesaj] });
      }
    }
    if (error.code === "P0001") {
      const mesaj = error.message.slice(0, 300);
      const camp = CAMPURI_DUPA_MESAJ.find(([re]) => re.test(mesaj))?.[1];
      if (camp !== undefined) throw invalidInput(mesaj, { [camp]: [mesaj] });
      throw businessRule(mesaj);
    }
  }
  throw error;
}
