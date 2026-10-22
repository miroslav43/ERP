// src/app/(app)/flota/rezervari/valori-rezervare.ts
//
// SINGURA traducere `FormData` → încărcătura acțiunilor de rezervare, ca
// `valori-vehicul.ts` și `valori-pv.ts`. Modul neutru (fără `"use client"`):
// îl folosesc caseta din aplicația mare și cea din portal, iar testul îl citește
// fără DOM.
//
// Două capcane tăcute stau aici, prinse de `valori-rezervare.test.ts`:
//  · un câmp gol devine `null`, nu `""`: o destinație goală nu e o destinație;
//  · selectul de angajat LIPSEȘTE din formular când omul rezervă pentru el
//    (sub `create = all` nu se afișează), deci absența e `null` = „eu”, iar
//    acțiunea rezolvă fișa pe server.

function text(date: FormData, nume: string): string {
  const v = date.get(nume);
  return typeof v === "string" ? v.trim() : "";
}

function textSauNull(date: FormData, nume: string): string | null {
  const v = text(date, nume);
  return v.length === 0 ? null : v;
}

export type ValoriRezervare = Readonly<{
  vehicle_id: string;
  employee_id: string | null;
  de_la: string;
  pana_la: string;
  scop: string;
  destinatie: string | null;
  observatii: string | null;
}>;

export function valoriRezervare(date: FormData): ValoriRezervare {
  return {
    vehicle_id: text(date, "vehicle_id"),
    employee_id: textSauNull(date, "employee_id"),
    de_la: text(date, "de_la"),
    pana_la: text(date, "pana_la"),
    scop: text(date, "scop"),
    destinatie: textSauNull(date, "destinatie"),
    observatii: textSauNull(date, "observatii"),
  };
}

/** Câmpul de motiv al deciziei sau al anulării: gol = `null`. */
export function motivDin(date: FormData): string | null {
  return textSauNull(date, "motiv");
}
