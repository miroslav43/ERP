// src/app/(app)/flota/[id]/valori-service.ts

/**
 * `FormData` → încărcătura acțiunilor de service (0203).
 *
 * Toate valorile pleacă ca TEXT, nu ca numere: golul trebuie să ajungă la schemă
 * ca gol (`""`), nu ca `0` — `Number("")` e `0`, iar un kilometraj sau un cost
 * necompletat s-ar salva ca „0 km” sau „0 lei” fără niciun mesaj (aceeași
 * capcană ca la vehicul, `valori-vehicul.ts`). Schemele din `fleet-service.ts`
 * fac coerciția, cu mesajele lor pe câmp.
 *
 * Bifa `activ` nebifată LIPSEȘTE din `FormData`: absența ei înseamnă `false`.
 */
function text(date: FormData, cheie: string): string {
  return String(date.get(cheie) ?? "").trim();
}

export type ValoriPlan = Readonly<{
  denumire: string;
  tip: string;
  interval_km: string;
  interval_luni: string;
  baza_data: string;
  baza_km: string;
  prag_avertizare_km: string;
  observatii: string;
}>;

export function valoriPlan(date: FormData): ValoriPlan {
  return {
    denumire: text(date, "denumire"),
    tip: text(date, "tip"),
    interval_km: text(date, "interval_km"),
    interval_luni: text(date, "interval_luni"),
    baza_data: text(date, "baza_data"),
    baza_km: text(date, "baza_km"),
    prag_avertizare_km: text(date, "prag_avertizare_km"),
    observatii: text(date, "observatii"),
  };
}

export function valoriPlanActualizat(date: FormData): ValoriPlan & Readonly<{ activ: boolean }> {
  return { ...valoriPlan(date), activ: date.get("activ") === "on" };
}

export type ValoriIntrare = Readonly<{
  plan_id: string;
  data_interventiei: string;
  km: string;
  tip: string;
  descriere: string;
  furnizor: string;
  numar_factura: string;
  cost_piese: string;
  cost_manopera: string;
  anvelope_montate: string;
  observatii: string;
}>;

export function valoriIntrare(date: FormData): ValoriIntrare {
  return {
    plan_id: text(date, "plan_id"),
    data_interventiei: text(date, "data_interventiei"),
    km: text(date, "km"),
    tip: text(date, "tip"),
    descriere: text(date, "descriere"),
    furnizor: text(date, "furnizor"),
    numar_factura: text(date, "numar_factura"),
    cost_piese: text(date, "cost_piese"),
    cost_manopera: text(date, "cost_manopera"),
    anvelope_montate: text(date, "anvelope_montate"),
    observatii: text(date, "observatii"),
  };
}

export type ValoriCheltuiala = Readonly<{
  categorie: string;
  data_cheltuielii: string;
  suma: string;
  litri: string;
  km_bord: string;
  numar_document: string;
  observatii: string;
}>;

export function valoriCheltuiala(date: FormData): ValoriCheltuiala {
  return {
    categorie: text(date, "categorie"),
    data_cheltuielii: text(date, "data_cheltuielii"),
    suma: text(date, "suma"),
    litri: text(date, "litri"),
    km_bord: text(date, "km_bord"),
    numar_document: text(date, "numar_document"),
    observatii: text(date, "observatii"),
  };
}
