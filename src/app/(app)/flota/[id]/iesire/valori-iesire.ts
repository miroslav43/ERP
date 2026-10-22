// src/app/(app)/flota/[id]/iesire/valori-iesire.ts
//
// `FormData` → încărcătura lui `scoateDinParc` (0218, F12h). Singura traducere,
// pe tiparul `flota/valori-vehicul.ts`.
//
// Două capcane tăcute stau aici, prinse de `valori-iesire.test.ts`:
//  · bifa nebifată LIPSEȘTE din `FormData`, iar bifată vine `"on"`, nu `true`:
//    trimisă direct, `pastreaza_numarul: z.boolean()` ar pica validarea;
//  · câmpurile pe care felul ieșirii nu le cere (destinația epavei, motivul
//    radierii, cumpărătorul, prețul) pleacă `null`, nu `""` și nici valoarea
//    rămasă de la un tip ales înainte: o schimbare de tip în casetă nu golește
//    câmpurile deja demontate din DOM, dar nici nu trebuie să le trimită.
import { eInstrainare, permitePastrareaNumarului } from "@/schemas/flota-iesire";
import type { DestinatieEpava, MotivRadiere, TipIesire } from "@/schemas/flota-iesire";

export type ValoriIesire = Readonly<{
  vehicle_id: string;
  tip: string;
  destinatie_epava: string | null;
  motiv_radiere: string | null;
  data_iesire: string;
  /** Text, nu număr: schema spune „nu e număr” sau „în afara intervalului”, separat. */
  km_iesire: string | null;
  motiv: string;
  cumparator: string | null;
  pret: string | null;
  nr_document: string | null;
  pastreaza_numarul: boolean;
  observatii: string | null;
}>;

function text(date: FormData, cheie: string): string {
  return String(date.get(cheie) ?? "").trim();
}

function textSauNull(date: FormData, cheie: string): string | null {
  const valoare = text(date, cheie);
  return valoare.length === 0 ? null : valoare;
}

export function valoriIesire(date: FormData, vehiculId: string): ValoriIesire {
  const tip = text(date, "tip");
  const destinatie = tip === "dauna_totala" ? textSauNull(date, "destinatie_epava") : null;
  const motivRadiere = tip === "radiere" ? textSauNull(date, "motiv_radiere") : null;
  // Predicatele schemei, pe valorile încă nevalidate: un tip necunoscut nu
  // deschide nimic, iar schema îl refuză apoi cu mesajul ei.
  const instrainare = eInstrainare(tip as TipIesire, destinatie as DestinatieEpava | null);
  const pastrare = permitePastrareaNumarului(tip as TipIesire, motivRadiere as MotivRadiere | null);

  return {
    vehicle_id: vehiculId,
    tip,
    destinatie_epava: destinatie,
    motiv_radiere: motivRadiere,
    data_iesire: text(date, "data_iesire"),
    km_iesire: textSauNull(date, "km_iesire"),
    motiv: text(date, "motiv"),
    cumparator: instrainare ? textSauNull(date, "cumparator") : null,
    // Prețul se tastează cu virgulă („1500,50”); `Number` o citește doar cu punct.
    pret: instrainare ? (textSauNull(date, "pret")?.replace(",", ".") ?? null) : null,
    nr_document: textSauNull(date, "nr_document"),
    pastreaza_numarul: pastrare && date.get("pastreaza_numarul") === "on",
    observatii: textSauNull(date, "observatii"),
  };
}
