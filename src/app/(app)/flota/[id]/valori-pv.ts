// src/app/(app)/flota/[id]/valori-pv.ts
//
// SINGURA traducere `FormData` → încărcătura acțiunilor procesului-verbal
// (`creeazaPv`, `actualizeazaPv`), ca `valori-vehicul.ts` și `valori-document.ts`.
//
// Trei capcane tăcute stau aici, prinse de `valori-pv.test.ts`:
//  · `Number("")` e `0`: un kilometraj necompletat ar pleca „0 km”. Se trimite
//    șirul, iar `numarOptional` din schemă scoate golul ÎNAINTE de coerciție;
//  · o bifă nebifată LIPSEȘTE din `FormData`: listele se citesc cu `getAll`, iar
//    lipsa înseamnă listă goală;
//  · radioul „S-au constatat daune?” neales e `null`, NU `false`: pe hârtia
//    semnată, un rând gol nu înseamnă „nu există”.

function text(date: FormData, nume: string): string {
  const v = date.get(nume);
  return typeof v === "string" ? v.trim() : "";
}

function textSauNull(date: FormData, nume: string): string | null {
  const v = text(date, nume);
  return v.length === 0 ? null : v;
}

function lista(date: FormData, nume: string): string[] {
  return date.getAll(nume).filter((v): v is string => typeof v === "string" && v.length > 0);
}

export type ValoriPv = Readonly<{
  km_bord: string;
  nivel_rezervor: string | null;
  numar_chei: string;
  stare_generala: string | null;
  anvelope: string | null;
  documente_bord: string[];
  dotari: string[];
  daune_constatate: "da" | "nu" | null;
  /** JSON-ul listei de daune, din câmpul ascuns; schema îl parsează. */
  daune: string;
  observatii: string | null;
}>;

export function valoriPv(date: FormData): ValoriPv {
  const daune = text(date, "daune_constatate");
  const lista_daune = text(date, "daune");
  return {
    km_bord: text(date, "km_bord"),
    nivel_rezervor: textSauNull(date, "nivel_rezervor"),
    numar_chei: text(date, "numar_chei"),
    stare_generala: textSauNull(date, "stare_generala"),
    anvelope: textSauNull(date, "anvelope"),
    documente_bord: lista(date, "documente_bord"),
    dotari: lista(date, "dotari"),
    daune_constatate: daune === "da" || daune === "nu" ? daune : null,
    // „Nu” golește lista: ce s-a scris înainte de a schimba răspunsul nu
    // trebuie să ajungă la bază (ar pica `pvv_daune_coerente_ck`).
    daune: daune === "nu" || lista_daune.length === 0 ? "[]" : lista_daune,
    observatii: textSauNull(date, "observatii"),
  };
}
