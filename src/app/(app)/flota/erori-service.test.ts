// src/app/(app)/flota/erori-service.test.ts
//
// Traducerea erorilor de service (0203): mesajele P0001 ale triggerelor ajung pe
// câmpul vinovat, CHECK-urile și unicitatea la fel, iar „Vehiculul ales…” rămâne
// mesaj general (în casete vehiculul e câmp ascuns). Mesajele sunt CITATE din
// migrare, ca o rescriere a textului din bază să rupă testul, nu traducerea.

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { ActionDenied } from "@/lib/actions/errors";
import { eroarePostgrest } from "@/lib/teste/supabase-fals";

import { traduEroareService } from "./erori";

const migrare = readFileSync(
  join(process.cwd(), "supabase/migrations/0203_flota_service_costuri.sql"),
  "utf8",
);

function prinde(error: unknown): ActionDenied {
  try {
    traduEroareService(error);
  } catch (e) {
    if (e instanceof ActionDenied) return e;
    throw e;
  }
  throw new Error("traduEroareService n-a aruncat");
}

/** Mesajul P0001 așa cum e scris în migrare. */
function mesajDinMigrare(prefix: string): string {
  const m = new RegExp(`message = '(${prefix}[^']*)'`, "u").exec(migrare);
  if (m === null) throw new Error(`Mesajul „${prefix}…” nu e în migrarea 0203.`);
  return m[1] as string;
}

describe("traduEroareService — P0001 din triggerele 0203", () => {
  it.each([
    ["Data ultimei intervenții", "baza_data"],
    ["Planul ales nu aparține", "plan_id"],
    ["Data intervenției", "data_interventiei"],
    ["Data cheltuielii", "data_cheltuielii"],
  ])("„%s…” ajunge pe câmpul %s", (prefix, camp) => {
    const mesaj = mesajDinMigrare(prefix);
    const e = prinde(eroarePostgrest("P0001", mesaj));
    expect(e).toMatchObject({ code: "VALIDARE" });
    expect(Object.keys(e.fieldErrors ?? {})).toEqual([camp]);
    expect(e.message).toBe(mesaj);
  });

  it.each([
    "Vehiculul ales nu există",
    "Planul de service nu se mută",
    "Vehiculul a ieșit din parc",
    "Intervenția de service nu se modifică",
    "Cheltuiala nu se mută",
  ])("„%s…” rămâne mesaj general, fără câmp", (prefix) => {
    const mesaj = mesajDinMigrare(prefix);
    const e = prinde(eroarePostgrest("P0001", mesaj));
    expect(e).toMatchObject({ code: "CONFLICT", fieldErrors: null });
    expect(e.message).toBe(mesaj);
  });
});

describe("traduEroareService — CHECK și unicitate", () => {
  it.each([
    ["vsp_interval_ck", "interval_km"],
    ["vse_anvelope_ck", "anvelope_montate"],
    ["vex_litri_ck", "litri"],
    ["vex_suma_ck", "suma"],
    ["vse_costuri_ck", "cost_piese"],
  ])("23514 pe %s → câmpul %s", (constrangere, camp) => {
    const e = prinde(
      eroarePostgrest("23514", `new row violates check constraint "${constrangere}"`),
    );
    expect(Object.keys(e.fieldErrors ?? {})).toEqual([camp]);
  });

  it("numele planului luat (23505) ajunge pe `denumire`", () => {
    const e = prinde(
      eroarePostgrest(
        "23505",
        'duplicate key value violates unique constraint "vsp_vehicul_denumire_uq"',
      ),
    );
    expect(Object.keys(e.fieldErrors ?? {})).toEqual(["denumire"]);
  });

  it("constrângerile din migrare există sub numele din hartă", () => {
    for (const nume of [
      "vsp_interval_ck",
      "vse_anvelope_ck",
      "vex_litri_ck",
      "vex_suma_ck",
      "vse_costuri_ck",
      "vsp_vehicul_denumire_uq",
    ]) {
      expect(migrare, nume).toContain(nume);
    }
  });

  it("restul trece prin traducerea generală a flotei", () => {
    const e = prinde(eroarePostgrest("22003"));
    expect(e).toMatchObject({ code: "CONFLICT" });
  });
});
