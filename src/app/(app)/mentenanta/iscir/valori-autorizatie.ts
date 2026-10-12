// src/app/(app)/mentenanta/iscir/valori-autorizatie.ts
/**
 * Din `FormData` în intrarea acțiunilor ISCIR (M7, 0193). Pur, fără React —
 * îl folosesc caseta „Autorizație ISCIR nouă” de pe fișa echipamentului și
 * casetele „Corectează” / „Reînnoiește” din `actiuni-autorizatie.tsx`.
 *
 * Câmpurile goale pleacă `null` (sau lipsă, pentru valabilitate, ca schema să
 * spună „Completați data…” pe câmpul ei); emitentul gol devine „ISCIR”, ca la
 * înregistrarea dinainte de 0193. Validarea rămâne a schemei de pe server.
 */

function citeste(formular: FormData, cheie: string): string | null {
  const v = String(formular.get(cheie) ?? "").trim();
  return v.length === 0 ? null : v;
}

export type ValoriAutorizatie = Readonly<{
  regim: string;
  numar: string | null;
  tip: string;
  emitent: string;
  emis_la: string | null;
  valabil_pana: string;
  scadenta_verificare_tehnica: string | null;
  conditii: string | null;
}>;

/** Câmpurile comune ale înregistrării și ale corecturii. */
export function valoriAutorizatie(formular: FormData): ValoriAutorizatie {
  return {
    regim: citeste(formular, "regim") ?? "inregistrat",
    numar: citeste(formular, "numar"),
    tip: citeste(formular, "tip") ?? "",
    emitent: citeste(formular, "emitent") ?? "ISCIR",
    emis_la: citeste(formular, "emis_la"),
    valabil_pana: citeste(formular, "valabil_pana") ?? "",
    scadenta_verificare_tehnica: citeste(formular, "scadenta_verificare_tehnica"),
    conditii: citeste(formular, "conditii"),
  };
}

export type ValoriReinnoire = Readonly<{
  numar: string | null;
  emitent: string | null;
  emis_la: string | null;
  valabil_pana: string;
  scadenta_verificare_tehnica: string | null;
  conditii: string | null;
}>;

/**
 * Reînnoirea: tipul, regimul și echipamentul se moștenesc de la rândul vechi,
 * deci nu sunt în formular. Emitentul gol rămâne `null` — funcția din bază îl
 * ia atunci de pe autorizația veche.
 */
export function valoriReinnoire(formular: FormData): ValoriReinnoire {
  return {
    numar: citeste(formular, "numar"),
    emitent: citeste(formular, "emitent"),
    emis_la: citeste(formular, "emis_la"),
    valabil_pana: citeste(formular, "valabil_pana") ?? "",
    scadenta_verificare_tehnica: citeste(formular, "scadenta_verificare_tehnica"),
    conditii: citeste(formular, "conditii"),
  };
}
