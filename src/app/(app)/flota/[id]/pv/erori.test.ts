// src/app/(app)/flota/[id]/pv/erori.test.ts
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { ActionDenied } from "@/lib/actions/errors";
import { eroarePostgrest } from "@/lib/teste/supabase-fals";

import { MESAJ_PV_DUBLAT, traduEroarePv } from "./erori";

function prinde(error: unknown): ActionDenied {
  try {
    traduEroarePv(error);
  } catch (e) {
    if (e instanceof ActionDenied) return e;
    throw e;
  }
  throw new Error("traduEroarePv n-a aruncat");
}

const MIGRARE = readFileSync(
  join(process.cwd(), "supabase/migrations/0215_flota_proces_verbal.sql"),
  "utf8",
);

describe("traduEroarePv", () => {
  it("al doilea PV viu pe aceeași predare (23505) ajunge pe alocare, cu instrucțiunea", () => {
    const e = prinde(
      eroarePostgrest("23505", 'duplicate key value violates unique constraint "pvv_primita_uq"'),
    );
    expect(e).toMatchObject({
      code: "VALIDARE",
      fieldErrors: { alocare_primita_id: [MESAJ_PV_DUBLAT] },
    });
    expect(prinde(eroarePostgrest("23505", "… pvv_predata_uq …")).code).toBe("VALIDARE");
  });

  it("kilometrajul diferit propagă mesajul bazei, cu cifrele, pe `km_bord`", () => {
    const mesaj =
      "Kilometrajul din procesul-verbal (50500 km) diferă de cel al alocării (50000 km).";
    expect(prinde(eroarePostgrest("P0001", mesaj))).toMatchObject({
      code: "VALIDARE",
      message: mesaj,
      fieldErrors: { km_bord: [mesaj] },
    });
  });

  it("câmpurile lipsă la finalizare se arată pe fiecare câmp cerut", () => {
    const mesaj =
      "Completați kilometrajul, nivelul din rezervor, starea generală și dacă s-au constatat daune înainte de finalizare.";
    const e = prinde(eroarePostgrest("P0001", mesaj));
    expect(Object.keys(e.fieldErrors ?? {})).toEqual([
      "km_bord",
      "nivel_rezervor",
      "stare_generala",
      "daune_constatate",
    ]);
  });

  it("P0001 fără câmp devine regulă de business, cu mesajul bazei", () => {
    const mesaj =
      "Procesul-verbal este finalizat și nu se mai modifică. Dacă a fost întocmit greșit, anulați-l și întocmiți altul.";
    expect(prinde(eroarePostgrest("P0001", mesaj))).toMatchObject({
      code: "CONFLICT",
      message: mesaj,
    });
  });

  it("CHECK-ul de coerență a daunelor ajunge pe `daune`", () => {
    const e = prinde(
      eroarePostgrest("23514", 'new row … violates check constraint "pvv_daune_coerente_ck"'),
    );
    expect(e.code).toBe("VALIDARE");
    expect(Object.keys(e.fieldErrors ?? {})).toEqual(["daune"]);
  });

  it("fiecare mesaj P0001 al migrării se termină cu punct și are ș/ț cu virgulă", () => {
    const mesaje = [...MIGRARE.matchAll(/message = (?:format\()?'([^']+)'/gu)].map(
      (m) => m[1] ?? "",
    );
    expect(mesaje.length).toBeGreaterThan(15);
    for (const mesaj of mesaje) {
      expect(mesaj, mesaj).toMatch(/\.$/u);
      expect(mesaj, mesaj).not.toMatch(/[şţŞŢ]/u);
    }
  });

  it("mesajele de kilometraj și de daune din migrare au câmpul lor", () => {
    const mesaje = [...MIGRARE.matchAll(/message = (?:format\()?'([^']+)'/gu)].map(
      (m) => m[1] ?? "",
    );
    const deKm = mesaje.filter((m) => m.startsWith("Kilometrajul din procesul-verbal"));
    expect(deKm.length).toBe(3);
    for (const mesaj of [...deKm, ...mesaje.filter((m) => m.startsWith("Fiecare daună"))]) {
      const e = prinde(eroarePostgrest("P0001", mesaj));
      expect(e.code, mesaj).toBe("VALIDARE");
    }
  });
});
