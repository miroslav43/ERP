// src/app/(app)/flota/etichete-service.test.ts
//
// Hărțile de text ale service-ului (0200) lipite de enumurile schemei, iar
// enumurile schemei lipite de migrare: o valoare adăugată într-un loc și uitată
// în altul ar apărea pe ecran ca `undefined` sau ar da 22P02 la scriere.
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { ANVELOPE_MONTATE } from "@/schemas/fleet";
import { CATEGORII_CHELTUIALA, TIPURI_SERVICE } from "@/schemas/fleet-service";

import {
  ETICHETE_ANVELOPE,
  ETICHETE_CATEGORIE_CHELTUIALA,
  ETICHETE_STARE_PLAN,
  ETICHETE_TIP_SERVICE,
  TONURI_STARE_PLAN,
} from "./etichete-service";

const migrare = readFileSync(
  join(process.cwd(), "supabase/migrations/0200_flota_service_costuri.sql"),
  "utf8",
);

function valoriEnum(nume: string): string[] {
  const m = new RegExp(`create type public\\.${nume} as enum \\(([^)]*)\\)`, "u").exec(migrare);
  if (m === null) throw new Error(`Enumul ${nume} nu e în migrarea 0200.`);
  return [...(m[1] ?? "").matchAll(/'([^']+)'/gu)].map((x) => x[1] as string);
}

describe("etichetele service-ului", () => {
  it("fiecare valoare din schemă are text, și doar ele", () => {
    expect(Object.keys(ETICHETE_TIP_SERVICE).sort()).toEqual([...TIPURI_SERVICE].sort());
    expect(Object.keys(ETICHETE_CATEGORIE_CHELTUIALA).sort()).toEqual(
      [...CATEGORII_CHELTUIALA].sort(),
    );
    expect(Object.keys(ETICHETE_ANVELOPE).sort()).toEqual([...ANVELOPE_MONTATE].sort());
  });

  it("enumurile schemei sunt cele din migrare, în aceeași ordine", () => {
    expect(valoriEnum("vehicle_service_type")).toEqual([...TIPURI_SERVICE]);
    expect(valoriEnum("vehicle_expense_category")).toEqual([...CATEGORII_CHELTUIALA]);
    expect(valoriEnum("vehicle_tire_set")).toEqual([...ANVELOPE_MONTATE]);
  });

  it("starea planului are text și ton pentru fiecare treaptă", () => {
    expect(Object.keys(TONURI_STARE_PLAN).sort()).toEqual(Object.keys(ETICHETE_STARE_PLAN).sort());
    expect(TONURI_STARE_PLAN.depasit).toBe("pericol");
    expect(TONURI_STARE_PLAN.curand).toBe("atentie");
  });
});
